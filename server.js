import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { MONEY_SCALE, MONEY_SCALE_HEADER, assertCentsDocument, centsToDollars, reconcileEntryToDollars, toCentsDocument, toDollarsDocument } from "./money-schema.js";
import { migrateMoneyFile, publicInspection } from "./money-file.js";

// ── Config via env vars (with sensible defaults) ────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BYB_DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "budget.json");
const PASSWORDS_FILE = path.join(DATA_DIR, "passwords.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const MIN_PASSWORD_LENGTH = 8;

function boundedInteger(name, fallback, min, max) {
  const raw = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

const PORT = boundedInteger("BYB_PORT", 3001, 1, 65_535);
const SESSION_TTL_HOURS = boundedInteger("BYB_SESSION_TTL_HOURS", 72, 1, 8_760);
const SESSION_TTL_MS = SESSION_TTL_HOURS * 3600_000;
const BCRYPT_ROUNDS = boundedInteger("BYB_BCRYPT_ROUNDS", 12, process.env.NODE_ENV === "test" ? 4 : 10, 15);
// Integrations (both optional — features are disabled when unset)
const API_KEY = process.env.BYB_API_KEY || "";          // read-only summary endpoint for n8n etc.
const WEBHOOK_URL = process.env.BYB_WEBHOOK_URL || ""; // outbound POST on reconcile events

// ── Melbourne calendar dates ────────────────────────────────────────────────
// Dates in this app are the household's local calendar dates. This container
// ships without TZ set, so Node resolves to UTC and a plain toISOString() would
// report yesterday's date — and yesterday's month, on the 1st — until 10am
// local (11am in daylight saving). Intl carries the daylight-saving rules, so
// AEST/AEDT is handled rather than approximated with a fixed offset.
//
// This mirrors todayISO() in src/lib/utils.js. It is duplicated rather than
// imported because the production image copies only server.js and dist/ (see
// Dockerfile) — src/ is not there to import from. Keep the two in step.
const MELBOURNE_TZ = "Australia/Melbourne";
const melbourneDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: MELBOURNE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const todayISO = () => melbourneDate.format(new Date());
// Day counting on a date-only value, so UTC arithmetic is exactly right here.
function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const app = express();

// ── Security headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // Vite dev needs inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"],     // inline styles used throughout
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null, // must be null to remove — app runs on plain HTTP
      },
    },
    crossOriginEmbedderPolicy: false, // allow loading local assets
    strictTransportSecurity: false,   // no HSTS — HTTPS is handled upstream (Tailscale/reverse proxy)
    crossOriginOpenerPolicy: false,   // avoid COOP issues on plain HTTP
  })
);

// ── Body parser with size limit ─────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// Financial and authentication responses must never be stored by a browser or
// intermediary cache. Static application assets are served outside /api/ and
// retain their normal cache behaviour.
app.use("/api/", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  next();
});

// ── Rate limiting ───────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: 15,               // 15 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — try again in 15 minutes" },
});

const apiLimiter = rateLimit({
  windowMs: 60_000,   // 1 minute
  max: 120,           // 120 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded — slow down" },
});

app.use("/api/", apiLimiter);

// ── Strict, atomic JSON storage ──────────────────────────────────────────────
function readJSON(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    throw new Error(`Could not read ${path.basename(file)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path.basename(file)} must contain a JSON object`);
  }
  return parsed;
}

function writeJSON(file, data) {
  const temporary = `${file}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;
  const bytes = Buffer.from(JSON.stringify(data, null, 2));
  let fd;
  try {
    fd = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, file);
    try { fs.chmodSync(file, 0o600); } catch {}
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

// ── Ensure data directory and files exist ───────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  writeJSON(
    DATA_FILE,
    {
      transactions: [],
      categories: [],
      recurring: [],
      users: [{ id: "u-user1", name: "User 1", role: "owner", colour: "#7FB069" }],
      assets: [],
      transfers: [],
      reconcileLog: [],
      budgetHistory: [],
      unallocatedBalance: 0,
      moneyScale: MONEY_SCALE,
      dataVersion: 0,
    }
  );
}
if (!fs.existsSync(PASSWORDS_FILE)) writeJSON(PASSWORDS_FILE, {});
if (!fs.existsSync(SESSIONS_FILE)) writeJSON(SESSIONS_FILE, {});

// Money is migrated before the first request can be served. The migration is
// explicit-path, idempotent, atomic, and leaves a sibling pre-cents recovery
// file. A stale pre-migration tab is forced through the normal dataVersion 409
// path and receives a dollar-compatible document on its next legacy GET.
const moneyMigration = migrateMoneyFile(DATA_FILE);
console.log("Money schema:", JSON.stringify(publicInspection(moneyMigration)));

// ── Session helpers (with expiry) ───────────────────────────────────────────
function cleanExpiredSessions() {
  const sessions = readJSON(SESSIONS_FILE);
  const now = Date.now();
  let changed = false;
  for (const token of Object.keys(sessions)) {
    const session = sessions[token];
    const valid = session && typeof session === "object" && !Array.isArray(session) &&
      typeof session.userId === "string" && session.userId.length > 0 &&
      Number.isSafeInteger(session.createdAt) && Number.isSafeInteger(session.expiresAt) &&
      session.expiresAt > now;
    if (!valid) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) writeJSON(SESSIONS_FILE, sessions);
  return sessions;
}

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const sessions = readJSON(SESSIONS_FILE);
  sessions[token] = { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
  writeJSON(SESSIONS_FILE, sessions);
  return token;
}

function revokeUserSessions(userId, exceptToken = null) {
  const sessions = readJSON(SESSIONS_FILE);
  let changed = false;
  for (const [token, session] of Object.entries(sessions)) {
    if (token !== exceptToken && session && typeof session === "object" && session.userId === userId) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) writeJSON(SESSIONS_FILE, sessions);
}

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// ── Auth middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const sessions = cleanExpiredSessions();
  const session = sessions[token];
  if (!session) return res.status(401).json({ error: "Invalid or expired session" });

  const data = readJSON(DATA_FILE);
  if (!(data.users || []).some((user) => user.id === session.userId)) {
    delete sessions[token];
    writeJSON(SESSIONS_FILE, sessions);
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.userId = session.userId;
  req.sessionToken = token;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const data = readJSON(DATA_FILE);
    const user = (data.users || []).find((u) => u.id === req.userId);
    if (!user || (user.role !== "owner" && user.role !== "admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

// API-key middleware for read-only integration endpoints (n8n etc.).
// Disabled entirely unless BYB_API_KEY is set in the environment.
function requireApiKey(req, res, next) {
  if (!API_KEY) return res.status(403).json({ error: "Integrations disabled — set BYB_API_KEY to enable" });
  const provided = req.headers["x-api-key"] ||
    ((req.headers.authorization || "").startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
  if (provided !== API_KEY) return res.status(401).json({ error: "Invalid API key" });
  next();
}

// ── Input validation helpers ────────────────────────────────────────────────
function isValidString(val, maxLen = 200) {
  return typeof val === "string" && val.trim().length > 0 && val.length <= maxLen;
}

function validateBudgetData(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return "Data must be a JSON object";
  }
  // `adjustments` is the record of every deliberate change to the household
  // total that is not a transaction: envelopes opened at setup, all balances
  // reset, unallocated set by hand (see recordAdjustment in BudgetApp.jsx). It
  // is written from the moment the client supports it, so it has to be accepted
  // here or every save after one would be rejected outright. Files written
  // before it exists simply do not carry the key.
  //
  // `openingBalances` was its short-lived predecessor, folded into
  // `adjustments` before it ever reached a deployed instance. Current clients
  // never send it, but it stays accepted so that a client still running the
  // build that wrote it is not met with a 400 on every save.
  const allowed = ["transactions", "categories", "recurring", "users", "unallocatedBalance", "assets", "transfers", "reconcileLog", "adjustments", "openingBalances", "budgetHistory", "moneyScale", "dataVersion"];
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) return `Unknown field: ${key}`;
  }
  if (data.transactions && !Array.isArray(data.transactions)) return "transactions must be an array";
  if (data.categories && !Array.isArray(data.categories)) return "categories must be an array";
  if (data.recurring && !Array.isArray(data.recurring)) return "recurring must be an array";
  if (data.users && !Array.isArray(data.users)) return "users must be an array";
  if (data.assets && !Array.isArray(data.assets)) return "assets must be an array";
  if (data.transfers && !Array.isArray(data.transfers)) return "transfers must be an array";
  if (data.reconcileLog && !Array.isArray(data.reconcileLog)) return "reconcileLog must be an array";
  if (data.adjustments && !Array.isArray(data.adjustments)) return "adjustments must be an array";
  if (data.budgetHistory && !Array.isArray(data.budgetHistory)) return "budgetHistory must be an array";
  if (data.openingBalances && !Array.isArray(data.openingBalances)) return "openingBalances must be an array";
  if (data.unallocatedBalance !== undefined && typeof data.unallocatedBalance !== "number") {
    return "unallocatedBalance must be a number";
  }
  if (data.dataVersion !== undefined && typeof data.dataVersion !== "number") {
    return "dataVersion must be a number";
  }
  if (data.moneyScale !== MONEY_SCALE) return `moneyScale must be ${MONEY_SCALE}`;
  for (const transaction of data.transactions || []) {
    if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) return "transactions must contain objects";
    if (transaction.type !== "income" && transaction.type !== "expense") return "transaction type must be income or expense";
    if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) return "transaction amount must be a positive safe integer";
  }
  for (const rule of data.recurring || []) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return "recurring must contain objects";
    if (!Number.isSafeInteger(rule.amount) || rule.amount <= 0) return "recurring amount must be a positive safe integer";
  }
  for (const transfer of data.transfers || []) {
    if (!transfer || typeof transfer !== "object" || Array.isArray(transfer)) return "transfers must contain objects";
    if (!Number.isSafeInteger(transfer.amount) || transfer.amount <= 0) return "transfer amount must be a positive safe integer";
  }
  // Size guard — prevent unreasonably large payloads
  const txCount = (data.transactions || []).length;
  const catCount = (data.categories || []).length;
  if (txCount > 50_000) return "Too many transactions (max 50,000)";
  if (catCount > 500) return "Too many categories (max 500)";
  return null; // valid
}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /api/health — deliberately contains no household data. Container health
// checks should use this rather than an endpoint that lists login identities.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// GET /api/users — returns only the identities needed by the login picker.
app.get("/api/users", (req, res) => {
  const data = readJSON(DATA_FILE);
  const users = (data.users || []).map((u) => ({ id: u.id, name: u.name, colour: u.colour }));
  res.json({ users });
});

// POST /api/auth/login
app.post("/api/auth/login", loginLimiter, asyncRoute(async (req, res) => {
  const { userId, password } = req.body || {};
  if (!isValidString(userId, 100) || !isValidString(password, 200)) {
    return res.status(400).json({ error: "userId and password required" });
  }

  // Verify user exists in budget data
  const data = readJSON(DATA_FILE);
  const users = data.users || [];
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const passwords = readJSON(PASSWORDS_FILE);

  if (!passwords[userId]) {
    // Only the untouched, single-owner installation may bootstrap itself. A
    // missing hash on any established account fails closed and must be repaired
    // through the authenticated admin reset route.
    const pristineBootstrap = users.length === 1 && user.role === "owner" && Object.keys(passwords).length === 0;
    if (!pristineBootstrap) {
      return res.status(401).json({ error: "Account setup required — ask an admin for a temporary password" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}–200 characters` });
    }
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    passwords[userId] = hash;
    writeJSON(PASSWORDS_FILE, passwords);
  } else {
    const ok = await bcrypt.compare(password, passwords[userId]);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createSession(userId);
  res.json({ token, userId });
}));

// POST /api/auth/logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  const sessions = readJSON(SESSIONS_FILE);
  delete sessions[token];
  writeJSON(SESSIONS_FILE, sessions);
  res.json({ ok: true });
});

// POST /api/auth/update-profile — change own display name
app.post("/api/auth/update-profile", requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!isValidString(name, 50)) return res.status(400).json({ error: "Name required (max 50 chars)" });
  const data = readJSON(DATA_FILE);
  data.users = (data.users || []).map((u) => (u.id === req.userId ? { ...u, name: name.trim() } : u));
  writeJSON(DATA_FILE, data);
  res.json({ ok: true, name: name.trim() });
});

// POST /api/auth/welcome-seen — persist that this user has seen the welcome
// message. Stored on the user record so it follows the account across
// devices and survives session expiry (the old localStorage flag did not).
app.post("/api/auth/welcome-seen", requireAuth, (req, res) => {
  const data = readJSON(DATA_FILE);
  data.users = (data.users || []).map((u) => (u.id === req.userId ? { ...u, hasSeenWelcome: true } : u));
  writeJSON(DATA_FILE, data);
  res.json({ ok: true });
});

// POST /api/admin/add-user — admin adds a new user and receives the generated
// temporary credential exactly once in this response.
app.post("/api/admin/add-user", requireAdmin, asyncRoute(async (req, res) => {
  const { name, role, colour } = req.body || {};
  if (!isValidString(name, 50)) return res.status(400).json({ error: "Name required (max 50 chars)" });
  const data = readJSON(DATA_FILE);

  // Prevent duplicate names
  const trimmed = name.trim();
  if ((data.users || []).some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(400).json({ error: "A user with that name already exists" });
  }

  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const id = `u-${slug}-${randomBytes(3).toString("hex")}`;
  const validColour = typeof colour === "string" && /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : "#7FB069";
  const newUser = { id, name: trimmed, role: role === "admin" ? "admin" : "member", colour: validColour };
  const temporaryPassword = randomBytes(16).toString("hex");
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  // Re-read after the asynchronous hash to avoid overwriting an intervening
  // user-management change. Writing the credential first is fail-closed: if
  // the budget write fails, no login-picker identity is exposed without a hash.
  const latestData = readJSON(DATA_FILE);
  if ((latestData.users || []).some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(400).json({ error: "A user with that name already exists" });
  }
  const passwords = readJSON(PASSWORDS_FILE);
  passwords[id] = passwordHash;
  writeJSON(PASSWORDS_FILE, passwords);
  latestData.users = [...(latestData.users || []), newUser];
  writeJSON(DATA_FILE, latestData);
  res.json({ ok: true, user: newUser, temporaryPassword });
}));

// POST /api/admin/reset-password — owner/admin recovery for an established
// non-owner account. Resetting also invalidates every active target session.
app.post("/api/admin/reset-password", requireAdmin, asyncRoute(async (req, res) => {
  const { targetUserId } = req.body || {};
  if (!isValidString(targetUserId, 100)) {
    return res.status(400).json({ error: "targetUserId required" });
  }
  const data = readJSON(DATA_FILE);
  const target = (data.users || []).find((user) => user.id === targetUserId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === "owner") return res.status(403).json({ error: "The owner must change their own password" });

  const temporaryPassword = randomBytes(16).toString("hex");
  const passwords = readJSON(PASSWORDS_FILE);
  passwords[targetUserId] = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
  // Revoke first: if the password write then fails, the reset reports failure
  // and at worst signs the target out; it never changes a credential while
  // leaving old sessions active.
  revokeUserSessions(targetUserId);
  writeJSON(PASSWORDS_FILE, passwords);
  res.json({ ok: true, temporaryPassword });
}));

// POST /api/admin/set-role — admin changes another user's role
app.post("/api/admin/set-role", requireAdmin, (req, res) => {
  const { targetUserId, role } = req.body || {};
  if (!isValidString(targetUserId, 100) || !isValidString(role, 20)) {
    return res.status(400).json({ error: "targetUserId and role required" });
  }
  const validRoles = ["member", "admin"];
  if (!validRoles.includes(role)) return res.status(400).json({ error: "Role must be member or admin" });

  const data = readJSON(DATA_FILE);
  // Prevent demoting the owner
  const target = (data.users || []).find((u) => u.id === targetUserId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === "owner") return res.status(403).json({ error: "Cannot change owner role" });

  data.users = (data.users || []).map((u) => (u.id === targetUserId ? { ...u, role } : u));
  writeJSON(DATA_FILE, data);
  res.json({ ok: true });
});

// POST /api/auth/set-password (change password while authenticated)
app.post("/api/auth/set-password", requireAuth, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!isValidString(newPassword, 200) || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be ${MIN_PASSWORD_LENGTH}–200 characters` });
  }
  const passwords = readJSON(PASSWORDS_FILE);
  if (!passwords[req.userId]) return res.status(409).json({ error: "Account setup required — ask an admin" });
  const ok = await bcrypt.compare(currentPassword || "", passwords[req.userId]);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
  passwords[req.userId] = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  revokeUserSessions(req.userId, req.sessionToken);
  writeJSON(PASSWORDS_FILE, passwords);
  res.json({ ok: true });
}));

// GET /api/data
app.get("/api/data", requireAuth, (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    // Migrate-on-read: older data files have no version or reconcile log
    if (typeof data.dataVersion !== "number") data.dataVersion = 0;
    if (!Array.isArray(data.reconcileLog)) data.reconcileLog = [];
    if (!Array.isArray(data.budgetHistory)) data.budgetHistory = [];
    const requestedScale = req.headers[MONEY_SCALE_HEADER];
    if (requestedScale === undefined) return res.json(toDollarsDocument(data));
    if (requestedScale !== String(MONEY_SCALE)) return res.status(400).json({ error: "Unsupported money scale" });
    res.json(assertCentsDocument(data));
  } catch {
    res.status(500).json({ error: "Could not read data" });
  }
});

// POST /api/data — with schema validation and optimistic-concurrency guard.
// Clients send back the dataVersion they loaded. If another client has saved
// since, versions no longer match and the write is rejected with 409 so the
// stale client can reload instead of silently overwriting newer data.
app.post("/api/data", requireAuth, (req, res) => {
  let submitted;
  try {
    const requestedScale = req.headers[MONEY_SCALE_HEADER];
    if (requestedScale === undefined) {
      if (req.body?.moneyScale !== undefined) return res.status(400).json({ error: "Money scale header is required when moneyScale is declared" });
      submitted = toCentsDocument(req.body);
    } else if (requestedScale === String(MONEY_SCALE)) {
      submitted = assertCentsDocument(req.body);
    } else {
      return res.status(400).json({ error: "Unsupported money scale" });
    }
  } catch (conversionError) {
    return res.status(400).json({ error: conversionError.message });
  }
  const error = validateBudgetData(submitted);
  if (error) return res.status(400).json({ error });
  try {
    const current = readJSON(DATA_FILE);
    const currentVersion = typeof current.dataVersion === "number" ? current.dataVersion : 0;
    const clientVersion = typeof submitted.dataVersion === "number" ? submitted.dataVersion : 0;
    if (clientVersion !== currentVersion) {
      return res.status(409).json({
        error: "Data has changed since you loaded it — reloading latest",
        dataVersion: currentVersion,
      });
    }
    // Identity and authorization data is server-owned. A normal household data
    // save may edit the shared ledger but can never add users or alter roles.
    const next = { ...submitted, users: current.users || [], moneyScale: MONEY_SCALE, dataVersion: currentVersion + 1 };
    writeJSON(DATA_FILE, next);
    res.json({ ok: true, dataVersion: next.dataVersion });
  } catch {
    res.status(500).json({ error: "Could not write data" });
  }
});

// ── Integrations ────────────────────────────────────────────────────────────

// GET /api/integrations/summary — read-only budget summary for automation
// tools (n8n daily briefing etc.). Auth: x-api-key header or Bearer token
// matching BYB_API_KEY. Returns 403 until BYB_API_KEY is configured.
app.get("/api/integrations/summary", requireApiKey, (req, res) => {
  try {
    const data = readJSON(DATA_FILE);
    const transactions = data.transactions || [];
    const categories = data.categories || [];
    const recurring = data.recurring || [];
    const assets = data.assets || [];
    const reconcileLog = data.reconcileLog || [];

    const now = new Date();
    const today = todayISO();
    const month = today.slice(0, 7);
    const inMonth = (t) => (t.date || "").slice(0, 7) === month;
    const monthIncome = transactions.filter((t) => t.type === "income" && inMonth(t)).reduce((s, t) => s + t.amount, 0);
    const monthExpenses = transactions.filter((t) => t.type === "expense" && inMonth(t)).reduce((s, t) => s + t.amount, 0);

    const sevenDays = addDays(today, 7);
    const upcomingBills = recurring
      .filter((r) => r.nextDueDate <= sevenDays)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
      .map((r) => ({ label: r.label, amount: centsToDollars(r.amount || 0), type: r.type, dueDate: r.nextDueDate, overdue: r.nextDueDate <= today }));

    const envelopes = categories
      .filter((c) => c.type === "expense")
      .map((c) => ({ name: c.name, balance: c.envelopeBalance || 0, base: c.baseAmount || 0, accumulating: !!c.isAccumulating }));

    const totalInEnvelopes = envelopes.reduce((sum, envelope) => sum + envelope.balance, 0);
    const dollarEnvelopes = envelopes.map((envelope) => ({
      ...envelope,
      balance: centsToDollars(envelope.balance),
      base: centsToDollars(envelope.base),
    }));

    res.json({
      generatedAt: now.toISOString(),
      month,
      unallocatedBalance: centsToDollars(data.unallocatedBalance || 0),
      totalInEnvelopes: centsToDollars(totalInEnvelopes),
      monthIncome: centsToDollars(monthIncome),
      monthExpenses: centsToDollars(monthExpenses),
      monthNet: centsToDollars(monthIncome - monthExpenses),
      envelopes: dollarEnvelopes,
      lowEnvelopes: envelopes.filter((e) => e.base > 0 && e.balance * 5 < e.base).map((e) => e.name),
      upcomingBills,
      netWorth: centsToDollars(assets.reduce((s, a) => s + (a.value || 0), 0)),
      lastReconcile: reconcileLog.length > 0 ? reconcileEntryToDollars(reconcileLog[0]) : null,
      transactionCount: transactions.length,
    });
  } catch {
    res.status(500).json({ error: "Could not build summary" });
  }
});

// POST /api/events/reconcile — fire-and-forget webhook notification.
// The reconcile entry itself is persisted via /api/data with the rest of the
// budget; this endpoint only notifies an external system (n8n) if configured.
app.post("/api/events/reconcile", requireAuth, async (req, res) => {
  res.json({ ok: true, webhook: !!WEBHOOK_URL });
  if (!WEBHOOK_URL) return;
  try {
    const requestedScale = req.headers[MONEY_SCALE_HEADER];
    if (requestedScale !== undefined && requestedScale !== String(MONEY_SCALE)) throw new Error("Unsupported money scale");
    const entry = requestedScale === String(MONEY_SCALE) ? reconcileEntryToDollars(req.body || {}) : (req.body || {});
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "reconcile", entry, at: new Date().toISOString() }),
    });
  } catch (e) {
    console.warn("Reconcile webhook failed:", e.message);
  }
});

// ── Serve production build ──────────────────────────────────────────────────
const DIST_DIR = path.join(__dirname, "dist");
const spaLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Unknown API paths must stay JSON failures rather than falling through to a
// production SPA document, which can make a broken health check look healthy.
app.use("/api/", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback — must come after all API routes
  app.get("*", spaLimiter, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

// Async storage/hash failures are deliberately generic at the trust boundary;
// logs retain only the non-secret error message needed for local diagnosis.
app.use((error, _req, res, next) => {
  console.error("Request failed:", error?.message || "Unknown error");
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`BYB! server running at http://localhost:${PORT}`);
  console.log(`  Integrations API: ${API_KEY ? "enabled (/api/integrations/summary)" : "disabled — set BYB_API_KEY to enable"}`);
  console.log(`  Reconcile webhook: ${WEBHOOK_URL ? "enabled" : "disabled — set BYB_WEBHOOK_URL to enable"}`);
  if (fs.existsSync(DIST_DIR)) {
    console.log(`  App available at http://localhost:${PORT}`);
  } else {
    console.log(`  API only — run 'npm run dev' for the full app, or 'npm run build' first.`);
  }
});
