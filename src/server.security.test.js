import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import http from "http";
import bcrypt from "bcryptjs";
import { spawn } from "child_process";

jest.setTimeout(60_000);

const OWNER_ID = "u-owner";
const MEMBER_ID = "u-member";
const OWNER_PASSWORD = "owner-pass";
const MEMBER_PASSWORD = "member-pass";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function request(port, method, route, body, token, extraHeaders = {}) {
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function budget(users = [
  { id: OWNER_ID, name: "Synthetic Owner", role: "owner", colour: "#7FB069" },
  { id: MEMBER_ID, name: "Synthetic Member", role: "member", colour: "#5F8A4F" },
]) {
  return {
    transactions: [],
    categories: [],
    recurring: [],
    users,
    assets: [],
    transfers: [],
    reconcileLog: [],
    budgetHistory: [],
    unallocatedBalance: 0,
    moneyScale: 100,
    dataVersion: 0,
  };
}

function passwordStore() {
  return {
    [OWNER_ID]: bcrypt.hashSync(OWNER_PASSWORD, 4),
    [MEMBER_ID]: bcrypt.hashSync(MEMBER_PASSWORD, 4),
  };
}

async function startServer({ budgetData = budget(), passwords = passwordStore(), sessions = {}, env = {} } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "byb-security-"));
  fs.writeFileSync(path.join(dataDir, "budget.json"), JSON.stringify(budgetData, null, 2));
  fs.writeFileSync(path.join(dataDir, "passwords.json"), JSON.stringify(passwords, null, 2));
  fs.writeFileSync(path.join(dataDir, "sessions.json"), JSON.stringify(sessions, null, 2));
  const port = await freePort();
  let output = "";
  const child = spawn(process.execPath, [path.resolve("server.js")], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      BYB_DATA_DIR: dataDir,
      BYB_PORT: String(port),
      BYB_BCRYPT_ROUNDS: "4",
      BYB_API_KEY: "synthetic-integration-key",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start. Output: ${output}`)), 10_000);
    const check = () => {
      if (output.includes("BYB! server running")) {
        clearTimeout(timeout);
        child.stdout.off("data", check);
        resolve();
      }
    };
    child.stdout.on("data", check);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. Output: ${output}`));
    });
  });

  return {
    child,
    dataDir,
    port,
    output: () => output,
    stop() {
      child.kill();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

async function login(server, userId, password) {
  return request(server.port, "POST", "/api/auth/login", { userId, password });
}

test("a member cannot turn a whole-budget save into role escalation", async () => {
  const server = await startServer();
  try {
    const memberLogin = await login(server, MEMBER_ID, MEMBER_PASSWORD);
    expect(memberLogin.status).toBe(200);
    const loaded = await request(server.port, "GET", "/api/data", undefined, memberLogin.body.token, { "X-BYB-Money-Scale": "100" });
    const tampered = {
      ...loaded.body,
      users: loaded.body.users.map((user) => user.id === MEMBER_ID ? { ...user, role: "owner" } : user),
    };
    const save = await request(server.port, "POST", "/api/data", tampered, memberLogin.body.token, { "X-BYB-Money-Scale": "100" });
    expect(save.status).toBe(200);

    const after = await request(server.port, "GET", "/api/data", undefined, memberLogin.body.token, { "X-BYB-Money-Scale": "100" });
    expect(after.body.users.find((user) => user.id === MEMBER_ID).role).toBe("member");
    const adminAttempt = await request(server.port, "POST", "/api/admin/add-user", { name: "Unauthorized User" }, memberLogin.body.token);
    expect(adminAttempt.status).toBe(403);
  } finally {
    server.stop();
  }
});

test("a direct API save cannot use a negative transaction to reverse ledger semantics", async () => {
  const server = await startServer();
  try {
    const memberLogin = await login(server, MEMBER_ID, MEMBER_PASSWORD);
    const loaded = await request(server.port, "GET", "/api/data", undefined, memberLogin.body.token, { "X-BYB-Money-Scale": "100" });
    const malformed = {
      ...loaded.body,
      transactions: [{
        id: "tx-negative",
        date: "2026-08-22",
        type: "expense",
        amount: -100,
        categoryId: "c-synthetic",
        description: "Synthetic negative expense",
        addedBy: MEMBER_ID,
      }],
    };
    const response = await request(server.port, "POST", "/api/data", malformed, memberLogin.body.token, { "X-BYB-Money-Scale": "100" });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("positive");
  } finally {
    server.stop();
  }
});

test("an admin-created account receives a generated credential and cannot be claimed with an arbitrary first password", async () => {
  const server = await startServer();
  try {
    const ownerLogin = await login(server, OWNER_ID, OWNER_PASSWORD);
    const added = await request(server.port, "POST", "/api/admin/add-user", { name: "New Synthetic User", role: "member", colour: "#7FB069" }, ownerLogin.body.token);
    expect(added.status).toBe(200);
    expect(added.body.temporaryPassword).toMatch(/^[a-f0-9]{32}$/);

    const claimed = await login(server, added.body.user.id, "attacker-chosen-password");
    expect(claimed.status).toBe(401);
    const legitimate = await login(server, added.body.user.id, added.body.temporaryPassword);
    expect(legitimate.status).toBe(200);
  } finally {
    server.stop();
  }
});

test("bootstrap refuses a trivially short first password", async () => {
  const server = await startServer({
    budgetData: budget([{ id: OWNER_ID, name: "Synthetic Owner", role: "owner", colour: "#7FB069" }]),
    passwords: {},
  });
  try {
    const response = await login(server, OWNER_ID, "x");
    expect(response.status).toBe(400);
  } finally {
    server.stop();
  }
});

test("corrupt password storage fails closed without being overwritten", async () => {
  const server = await startServer();
  try {
    const file = path.join(server.dataDir, "passwords.json");
    fs.writeFileSync(file, "{not-json");
    const response = await login(server, OWNER_ID, "attacker-chosen-password");
    expect(response.status).toBe(500);
    expect(fs.readFileSync(file, "utf8")).toBe("{not-json");
  } finally {
    server.stop();
  }
});

test("corrupt budget storage cannot be replaced through the version-zero fallback", async () => {
  const server = await startServer();
  try {
    const ownerLogin = await login(server, OWNER_ID, OWNER_PASSWORD);
    const loaded = await request(server.port, "GET", "/api/data", undefined, ownerLogin.body.token, { "X-BYB-Money-Scale": "100" });
    const file = path.join(server.dataDir, "budget.json");
    fs.writeFileSync(file, "{not-json");
    const response = await request(server.port, "POST", "/api/data", { ...loaded.body, unallocatedBalance: 9999 }, ownerLogin.body.token, { "X-BYB-Money-Scale": "100" });
    expect(response.status).toBe(500);
    expect(fs.readFileSync(file, "utf8")).toBe("{not-json");
  } finally {
    server.stop();
  }
});

test("legacy string sessions without an expiry are rejected", async () => {
  const server = await startServer({ sessions: { "legacy-token": MEMBER_ID } });
  try {
    const response = await request(server.port, "GET", "/api/data", undefined, "legacy-token", { "X-BYB-Money-Scale": "100" });
    expect(response.status).toBe(401);
  } finally {
    server.stop();
  }
});

test("expired structured sessions are rejected and removed", async () => {
  const server = await startServer({
    sessions: { "expired-token": { userId: MEMBER_ID, createdAt: Date.now() - 10_000, expiresAt: Date.now() - 1 } },
  });
  try {
    const response = await request(server.port, "GET", "/api/data", undefined, "expired-token", { "X-BYB-Money-Scale": "100" });
    expect(response.status).toBe(401);
    expect(JSON.parse(fs.readFileSync(path.join(server.dataDir, "sessions.json"), "utf8"))).not.toHaveProperty("expired-token");
  } finally {
    server.stop();
  }
});

test("repeated bad credentials trigger the login rate limit", async () => {
  const server = await startServer();
  try {
    let response;
    for (let attempt = 0; attempt < 16; attempt++) {
      response = await login(server, MEMBER_ID, "wrong-password");
    }
    expect(response.status).toBe(429);
    expect(response.body.error).toContain("Too many login attempts");
  } finally {
    server.stop();
  }
});

test("changing a password revokes the user's other sessions but preserves the current one", async () => {
  const server = await startServer();
  try {
    const first = await login(server, MEMBER_ID, MEMBER_PASSWORD);
    const second = await login(server, MEMBER_ID, MEMBER_PASSWORD);
    const changed = await request(server.port, "POST", "/api/auth/set-password", {
      currentPassword: MEMBER_PASSWORD,
      newPassword: "replacement-pass",
    }, first.body.token);
    expect(changed.status).toBe(200);

    expect((await request(server.port, "GET", "/api/data", undefined, first.body.token)).status).toBe(200);
    expect((await request(server.port, "GET", "/api/data", undefined, second.body.token)).status).toBe(401);
    expect((await login(server, MEMBER_ID, MEMBER_PASSWORD)).status).toBe(401);
    expect((await login(server, MEMBER_ID, "replacement-pass")).status).toBe(200);
  } finally {
    server.stop();
  }
});

test("an admin password reset issues a generated credential and revokes target sessions", async () => {
  const server = await startServer();
  try {
    const owner = await login(server, OWNER_ID, OWNER_PASSWORD);
    const member = await login(server, MEMBER_ID, MEMBER_PASSWORD);
    const reset = await request(server.port, "POST", "/api/admin/reset-password", {
      targetUserId: MEMBER_ID,
    }, owner.body.token);
    expect(reset.status).toBe(200);
    expect(reset.body.temporaryPassword).toMatch(/^[a-f0-9]{32}$/);
    expect((await request(server.port, "GET", "/api/data", undefined, member.body.token)).status).toBe(401);
    expect((await login(server, MEMBER_ID, MEMBER_PASSWORD)).status).toBe(401);
    expect((await login(server, MEMBER_ID, reset.body.temporaryPassword)).status).toBe(200);

    const ownerReset = await request(server.port, "POST", "/api/admin/reset-password", {
      targetUserId: OWNER_ID,
    }, owner.body.token);
    expect(ownerReset.status).toBe(403);
  } finally {
    server.stop();
  }
});

test("sensitive API responses are explicitly non-cacheable", async () => {
  const server = await startServer();
  try {
    const ownerLogin = await login(server, OWNER_ID, OWNER_PASSWORD);
    const data = await request(server.port, "GET", "/api/data", undefined, ownerLogin.body.token);
    const summary = await request(server.port, "GET", "/api/integrations/summary", undefined, undefined, { "X-API-Key": "synthetic-integration-key" });
    expect(data.headers["cache-control"]).toBe("no-store");
    expect(summary.headers["cache-control"]).toBe("no-store");
  } finally {
    server.stop();
  }
});

test("the public health route reveals no household users or roles", async () => {
  const server = await startServer();
  try {
    const health = await request(server.port, "GET", "/api/health");
    expect(health).toMatchObject({ status: 200, body: { ok: true } });
    const users = await request(server.port, "GET", "/api/users");
    expect(users.status).toBe(200);
    expect(users.body.users.every((user) => !("role" in user))).toBe(true);
  } finally {
    server.stop();
  }
});

test("startup logs do not disclose credentials embedded in the webhook URL", async () => {
  const server = await startServer({ env: { BYB_WEBHOOK_URL: "http://127.0.0.1:9/hook?token=synthetic-secret" } });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(server.output()).not.toContain("synthetic-secret");
  } finally {
    server.stop();
  }
});

test("an invalid session lifetime fails startup instead of creating non-expiring sessions", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "byb-security-config-"));
  const port = await freePort();
  const child = spawn(process.execPath, [path.resolve("server.js")], {
    cwd: path.resolve("."),
    env: { ...process.env, BYB_DATA_DIR: dataDir, BYB_PORT: String(port), BYB_SESSION_TTL_HOURS: "not-a-number", BYB_BCRYPT_ROUNDS: "4" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  try {
    const exitCode = await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Server stayed running. Output: ${output}`)), 3_000)),
    ]);
    expect(exitCode).not.toBe(0);
    expect(output).toContain("BYB_SESSION_TTL_HOURS");
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
