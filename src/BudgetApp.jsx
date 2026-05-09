import React, { useState, useEffect, useRef } from "react";

function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, [query]);
  return isMobile;
}

const PALETTE = {
  primary: "#7FB069",
  primaryDeep: "#5F8A4F",
  secondary: "#B8D4AE",
  accent: "#8FA876",
  textLight: "#1A1A1A",
  textDark: "#F5F5F5",
  surfaceLight: "#FFFFFF",
  surfaceLightAlt: "#F7F8F6",
  surfaceDark: "#1A1A1A",
  surfaceDarkAlt: "#242624",
  border: "#E4E8E0",
  borderDark: "#2F322F",
  warn: "#C27B3F",
};

const DEFAULT_USERS = [
  { id: "u-user1", name: "User 1", role: "owner", colour: "#7FB069" },
];

const INCIDENTALS_CAT = {
  id: "c-incidentals",
  name: "Household Incidentals",
  type: "expense",
  colour: "#9CA3AF",
  monthlyBudget: 0,
  baseAmount: 0,
  envelopeBalance: 0,
  isAccumulating: false,
  protected: true,
};

const SAVINGS_CAT = {
  id: "c-savings",
  name: "Savings",
  type: "expense",
  colour: "#7FB069",
  monthlyBudget: 0,
  baseAmount: 0,
  envelopeBalance: 0,
  isAccumulating: true,
  protected: true,
};

const DEFAULT_CATEGORIES = [
  { id: "c-salary",     name: "Salary",       type: "income", colour: "#7FB069", monthlyBudget: null },
  { id: "c-other-in",  name: "Other Income", type: "income", colour: "#A0B894", monthlyBudget: null },
  // Housing
  { id: "c-mortgage",  name: "Mortgage Repayments",       type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 31 },
  { id: "c-bodycorp",  name: "Body Corporate Fees",        type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2  },
  { id: "c-council",   name: "Council Rates",              type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 2  },
  { id: "c-homeins",   name: "Home Contents Insurance",    type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 0.5 },
  { id: "c-homemaint", name: "Home Maintenance & Repairs", type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 2  },
  // Utilities
  { id: "c-utilities", name: "Utilities",             type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 3   },
  { id: "c-internet",  name: "Internet & Data Services", type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1   },
  { id: "c-mobile",    name: "Mobile Phone",            type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 0.5 },
  // Food & Home
  { id: "c-groceries",   name: "Groceries",              type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 10 },
  { id: "c-incidentals", name: "Household Incidentals",  type: "expense", colour: "#9CA3AF", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2,  protected: true },
  // Health
  { id: "c-healthins", name: "Health Insurance",  type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 4   },
  { id: "c-medical",   name: "Medical Expenses",  type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 1.5 },
  { id: "c-gym",       name: "Gym & Fitness",     type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1.5 },
  // Personal care
  { id: "c-care-p1", name: "Personal Care \u2013 Partner 1", type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1 },
  { id: "c-care-p2", name: "Personal Care \u2013 Partner 2", type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1 },
  // Transport
  { id: "c-carins",  name: "Car Insurance",                      type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2   },
  { id: "c-vehreg",  name: "Vehicle Registration",               type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 0.5 },
  { id: "c-vehserv", name: "Vehicle Servicing & Maintenance",    type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 1   },
  { id: "c-fuel",    name: "Fuel",                               type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 3   },
  { id: "c-tolls",   name: "Road Tolls & Parking",               type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 0.5 },
  // Allowances & discretionary
  { id: "c-allow-p1", name: "Partner 1 \u2013 Personal Allowance",      type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-allow-p2", name: "Partner 2 \u2013 Personal Allowance",      type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-disc-p1",  name: "Partner 1 \u2013 Discretionary Spending",  type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-disc-p2",  name: "Partner 2 \u2013 Discretionary Spending",  type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  // Family
  { id: "c-children",   name: "Children's Allowance",     type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-famsupport", name: "Family Support Payments",  type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 3 },
  // Lifestyle
  { id: "c-entertain",   name: "Entertainment",            type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-gifts",       name: "Gifts & Celebrations",     type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 1 },
  { id: "c-travel",      name: "Travel",                   type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 2 },
  { id: "c-charitable",  name: "Charitable Contributions", type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1 },
  // Savings — protected, always accumulating, always last
  { id: "c-savings", name: "Savings", type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: true, suggestedPct: 11, protected: true },
];


const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2, 10));
const fmtAUD = (n) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n || 0);
const monthKey = (iso) => (iso || "").slice(0, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);

function addPeriod(iso, frequency) {
  const d = new Date(iso + "T00:00:00Z");
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "fortnightly") d.setUTCDate(d.getUTCDate() + 14);
  else if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function formatMonth(m) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

function buildStyles(theme, isMobile = false) {
  const dark = theme === "dark";
  const surface = dark ? PALETTE.surfaceDark : PALETTE.surfaceLight;
  const surfaceAlt = dark ? PALETTE.surfaceDarkAlt : PALETTE.surfaceLightAlt;
  const text = dark ? PALETTE.textDark : PALETTE.textLight;
  const textMuted = dark ? "#9AA09A" : "#6B6F6B";
  const border = dark ? PALETTE.borderDark : PALETTE.border;
  const barTrack = dark ? "#2F322F" : "#E4E8E0";
  const bottomNavHeight = 64;
  return {
    dark, surface, surfaceAlt, text, textMuted, border, barTrack, isMobile,
    app: { display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: surface, color: text, fontSize: 15, lineHeight: 1.5 },
    sidebar: isMobile
      ? { position: "fixed", bottom: 0, left: 0, right: 0, height: bottomNavHeight, background: surfaceAlt, borderTop: `1px solid ${border}`, display: "flex", flexDirection: "row", justifyContent: "space-around", alignItems: "stretch", zIndex: 20, paddingBottom: "env(safe-area-inset-bottom, 0px)" }
      : { width: 220, background: surfaceAlt, borderRight: `1px solid ${border}`, padding: "24px 0", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", alignSelf: "flex-start" },
    brand: isMobile
      ? { display: "none" }
      : { padding: "0 20px 24px 20px", fontWeight: 700, fontSize: 15, letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 10, lineHeight: 1.15 },
    brandLogo: { width: 40, height: 40, borderRadius: "50%", background: PALETTE.secondary, padding: 4, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.12))" },
    brandText: { display: "flex", flexDirection: "column", gap: 2 },
    brandTitle: { color: PALETTE.primary, fontWeight: 800, fontSize: 14, letterSpacing: 0.3, textTransform: "uppercase" },
    brandSubtitle: { color: textMuted, fontWeight: 500, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
    navItem: (active) => isMobile
      ? { flex: 1, padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderTop: `3px solid ${active ? PALETTE.primary : "transparent"}`, fontWeight: active ? 600 : 500, color: active ? text : textMuted, fontSize: 11, textAlign: "center", userSelect: "none", WebkitTapHighlightColor: "transparent" }
      : { padding: "10px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderLeft: `3px solid ${active ? PALETTE.primary : "transparent"}`, fontWeight: active ? 600 : 500, color: active ? text : textMuted, background: active ? (dark ? "#2A2D2A" : "#EDF1E8") : "transparent" },
    main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, paddingBottom: isMobile ? bottomNavHeight : 0 },
    header: isMobile
      ? { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${border}`, background: surface, position: "sticky", top: 0, zIndex: 10, gap: 10 }
      : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: `1px solid ${border}`, background: surface, position: "sticky", top: 0, zIndex: 10 },
    viewTitle: isMobile
      ? { fontSize: 18, fontWeight: 700, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }
      : { fontSize: 22, fontWeight: 600, letterSpacing: -0.4 },
    headerRight: { display: "flex", alignItems: "center", gap: isMobile ? 8 : 16 },
    monthSelect: { padding: isMobile ? "8px 6px" : "6px 10px", borderRadius: 6, border: `1px solid ${border}`, background: surface, color: text, fontSize: isMobile ? 12 : 13, cursor: "pointer", maxWidth: isMobile ? 130 : "none" },
    avatarCircle: (u) => ({ width: 28, height: 28, borderRadius: "50%", background: u.colour, color: "#FFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }),
    userSwitcher: { display: "flex", gap: 6 },
    themeBtn: { padding: isMobile ? "6px 8px" : "6px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: isMobile ? 11 : 13, cursor: "pointer" },
    content: { flex: 1, padding: isMobile ? "16px 12px" : "28px 32px", maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" },
    footer: isMobile
      ? { display: "none" }
      : { padding: "12px 32px", borderTop: `1px solid ${border}`, fontSize: 12, color: textMuted, display: "flex", justifyContent: "space-between" },
    card: { background: surfaceAlt, border: `1px solid ${border}`, borderRadius: 10, padding: isMobile ? 14 : 20 },
    kpiGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 },
    kpiValue: { fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 },
    kpiLabel: { fontSize: 12, color: textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
    sectionTitle: { fontSize: 14, fontWeight: 600, margin: isMobile ? "20px 0 10px 0" : "28px 0 12px 0", textTransform: "uppercase", letterSpacing: 0.6, color: textMuted },
    button: { padding: isMobile ? "12px 18px" : "8px 16px", borderRadius: 6, border: "none", background: PALETTE.primary, color: "#FFF", fontWeight: 600, cursor: "pointer", fontSize: isMobile ? 15 : 14, minHeight: isMobile ? 44 : "auto" },
    buttonGhost: { padding: isMobile ? "11px 14px" : "8px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer", fontSize: 14, minHeight: isMobile ? 44 : "auto" },
    buttonDanger: { padding: isMobile ? "10px 14px" : "6px 12px", borderRadius: 6, border: `1px solid ${PALETTE.warn}`, background: "transparent", color: PALETTE.warn, cursor: "pointer", fontSize: isMobile ? 14 : 13, minHeight: isMobile ? 40 : "auto" },
    input: { padding: isMobile ? "11px 12px" : "8px 10px", borderRadius: 6, border: `1px solid ${border}`, background: surface, color: text, fontSize: isMobile ? 16 : 14, width: "100%", boxSizing: "border-box", minHeight: isMobile ? 44 : "auto" },
    label: { fontSize: 12, fontWeight: 600, color: textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
    th: { textAlign: "left", padding: "10px 8px", borderBottom: `1px solid ${border}`, fontWeight: 600, color: textMuted, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 },
    td: { padding: "10px 8px", borderBottom: `1px solid ${border}`, verticalAlign: "middle" },
    pill: (colour) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: colour + "22", color: colour, fontSize: 11, fontWeight: 600 }),
    toast: { position: "fixed", bottom: isMobile ? bottomNavHeight + 16 : 24, left: "50%", transform: "translateX(-50%)", background: PALETTE.textLight, color: PALETTE.textDark, padding: "10px 18px", borderRadius: 6, fontSize: 14, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.16)" },
    fab: { position: "fixed", right: 18, bottom: `calc(${bottomNavHeight + 18}px + env(safe-area-inset-bottom, 0px))`, width: 56, height: 56, borderRadius: "50%", background: PALETTE.primary, color: "#FFF", border: "none", fontSize: 28, fontWeight: 400, cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,0.18)", zIndex: 15, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 4 },
    txCard: { background: surfaceAlt, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 },
  };
}

function Sidebar({ view, setView, dueCount, styles }) {
  const items = [
    { id: "dashboard", label: "Dashboard", short: "Home", icon: "home" },
    { id: "transactions", label: "Transactions", short: "Recent", icon: "transactions" },
    { id: "categories", label: "Envelopes", short: "Env", icon: "categories" },
    { id: "recurring", label: "Recurring", short: "Bills", icon: "bills" },
    { id: "reports", label: "Reports", short: "Reports", icon: "reports" },
  ];
  const mobile = styles.isMobile;
  return (
    <nav style={styles.sidebar} data-testid="sidebar">
      <div style={styles.brand}>
        <img src="/logo.svg" alt="Ban' Yuh Belly Budgeting" style={styles.brandLogo} onError={(e) => { e.target.style.display = "none"; }} />
        <div style={styles.brandText}>
          <span style={styles.brandTitle}>BYB!</span>
          <span style={styles.brandSubtitle}>Ban' Yuh Belly</span>
        </div>
      </div>
      {items.map((it) => {
        const active = view === it.id;
        const badge = it.id === "recurring" && dueCount > 0;
        return (
          <div key={it.id} style={styles.navItem(active)} onClick={() => setView(it.id)} data-testid={`nav-${it.id}`}>
            {mobile ? (
              <span style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <img
                  src={`/${it.icon}.png`}
                  alt={it.label}
                  style={{ width: 24, height: 24, objectFit: "contain", opacity: active ? 1 : 0.55 }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <span style={{ fontSize: 10, lineHeight: 1 }}>{it.short}</span>
                {badge && (
                  <span style={{ position: "absolute", top: -4, right: -10, fontSize: 9, background: PALETTE.primary, color: "#FFF", borderRadius: 10, padding: "1px 5px", fontWeight: 600, lineHeight: 1.2 }}>{dueCount}</span>
                )}
              </span>
            ) : (
              <span style={{ position: "relative" }}>
                {it.label}
                {badge && (
                  <span style={{ marginLeft: 8, fontSize: 11, background: PALETTE.primary, color: "#FFF", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>{dueCount}</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Header({ view, activeMonth, setActiveMonth, availableMonths, users, activeUserId, onOpenSettings, onLogout, styles }) {
  const titles = { dashboard: "Dashboard", transactions: "Transactions", categories: "Envelopes", recurring: "Recurring", reports: "Reports" };
  const mobile = styles.isMobile;
  const formatMonthMobile = (m) => {
    const [y, mm] = m.split("-").map(Number);
    return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" });
  };
  const activeUser = users.find((u) => u.id === activeUserId);
  return (
    <div style={styles.header}>
      <div style={styles.viewTitle}>
        {mobile && (
          <img src="/logo.svg" alt="BYB!" style={{ width: 28, height: 28, borderRadius: "50%", background: PALETTE.secondary, padding: 3, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
        )}
        <span>{titles[view]}</span>
      </div>
      <div style={styles.headerRight}>
        {view !== "reports" && (
          <select style={styles.monthSelect} value={activeMonth} onChange={(e) => setActiveMonth(e.target.value)} data-testid="month-select">
            {availableMonths.map((m) => <option key={m} value={m}>{mobile ? formatMonthMobile(m) : formatMonth(m)}</option>)}
          </select>
        )}
        {/* Avatar button — opens settings modal */}
        {activeUser && (
          <button
            onClick={onOpenSettings}
            title={`${activeUser.name} — Settings`}
            style={{ ...styles.avatarCircle(activeUser), fontSize: 13, border: "none", cursor: "pointer", outline: "none", position: "relative" }}
            data-testid="settings-btn"
          >
            {activeUser.name[0]}
          </button>
        )}
        {onLogout && (
          <button
            style={{ padding: mobile ? "6px 10px" : "6px 12px", borderRadius: 6, border: `1px solid ${PALETTE.warn}`, background: "transparent", color: PALETTE.warn, fontSize: mobile ? 11 : 12, cursor: "pointer", fontWeight: 600 }}
            onClick={onLogout}
          >
            {mobile ? "Out" : "Sign out"}
          </button>
        )}
      </div>
    </div>
  );
}

function Dashboard({ activeMonth, transactions, categories, usersById, categoriesById, recurring, styles, unallocatedBalance, onTransferEnvelope, onFillWithIncome, onAddTx, activeUserId, txFormOpen, setTxFormOpen, setEditingTx, onReconcile, onNavigateToCategory }) {
  const mobile = styles.isMobile;
  const expenseCats = categories.filter((c) => c.type === "expense");
  const incomeCats = categories.filter((c) => c.type === "income");
  const totalBase = expenseCats.reduce((s, c) => s + (c.baseAmount || 0), 0);
  const totalBalance = expenseCats.reduce((s, c) => s + (c.envelopeBalance || 0), 0);
  const upcoming = [...recurring].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)).slice(0, 4);

  const [fillPanel, setFillPanel] = useState(null);
  const [fillSource, setFillSource] = useState(() => incomeCats[0]?.id || "");
  const [fillIncomeAmt, setFillIncomeAmt] = useState("");

  const openFillSingle = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    const base = cat?.baseAmount || 0;
    const current = cat?.envelopeBalance || 0;
    const needed = cat?.isAccumulating ? base : Math.max(0, base - current);
    setFillPanel({ mode: "single", catId });
    setFillSource(incomeCats[0]?.id || "");
    setFillIncomeAmt(String(needed || ""));
  };

  const applyFill = () => {
    const amt = parseFloat(fillIncomeAmt);
    if (!amt || amt <= 0 || !fillSource) return;
    if (fillPanel.mode === "single" && fillPanel.catId) {
      const cat = categories.find((c) => c.id === fillPanel.catId);
      if (cat && !cat.isAccumulating) {
        const fillNeeded = (cat.baseAmount || 0) - (cat.envelopeBalance || 0);
        const netDraw = fillNeeded - amt;
        if (netDraw > 0.01) {
          if (!window.confirm(`This will draw ${fmtAUD(netDraw)} from your existing unallocated balance (${fmtAUD(unallocatedBalance)} available). Continue?`)) return;
        }
      }
    }
    onFillWithIncome(fillSource, amt, fillPanel.mode, fillPanel.catId);
    setFillPanel(null);
    setFillIncomeAmt("");
  };

  const spentThisMonth = (catId) => transactions
    .filter((t) => monthKey(t.date) === activeMonth && t.categoryId === catId && t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      {/* Top action bar */}
      <div style={{ display: "flex", alignItems: mobile ? "flex-start" : "center", gap: mobile ? 10 : 12, marginBottom: mobile ? 14 : 20, flexDirection: mobile ? "column" : "row" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: styles.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Unallocated</div>
          <div style={{ fontSize: mobile ? 26 : 32, fontWeight: 800, letterSpacing: -0.5, color: unallocatedBalance < 0 ? "#DC2626" : PALETTE.primaryDeep, lineHeight: 1.1 }}>
            {fmtAUD(unallocatedBalance)}
          </div>
          <div style={{ fontSize: 11, color: styles.textMuted }}>
            {fmtAUD(totalBalance)} in envelopes · {fmtAUD(totalBase)}/mo base
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: mobile ? "100%" : "auto" }}>
          <button style={{ ...styles.button, flex: mobile ? 1 : "none", fontSize: 13 }} onClick={() => { setEditingTx(null); setTxFormOpen(true); }}>+ Add Transaction</button>
          {onReconcile && (
            <button style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none", fontSize: 13 }} onClick={() => {
              if (window.confirm("Reconcile envelopes? Surplus from non-savings envelopes will be pooled, used to cover any deficits, and the remainder returned to Unallocated. Savings envelopes are not touched.")) {
                onReconcile();
              }
            }}>End-of-month Reconcile</button>
          )}
        </div>
      </div>

      {/* Transaction form inline */}
      {txFormOpen && (
        <TxForm tx={null} categories={categories} activeUserId={activeUserId} onSave={(tx) => { onAddTx(tx); setTxFormOpen(false); }} onTransfer={(data) => { onTransferEnvelope(data.fromId, data.toId, data.amount, data.description); setTxFormOpen(false); }} onCancel={() => setTxFormOpen(false)} styles={styles} />
      )}

      {/* Fill panel */}
      {fillPanel && (
        <div style={{ ...styles.card, marginBottom: 16, background: styles.dark ? "#1A2A1A" : "#EDF3E8", borderColor: PALETTE.primary }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            {fillPanel.mode === "all" ? "Fill all envelopes" : `Fill — ${categories.find((c) => c.id === fillPanel.catId)?.name}`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={styles.label}>Income source</div>
              <select style={styles.input} value={fillSource} onChange={(e) => setFillSource(e.target.value)}>
                {incomeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {incomeCats.length === 0 && <option value="">No income sources</option>}
              </select>
            </div>
            <div>
              <div style={styles.label}>Amount received ($)</div>
              <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" placeholder="e.g. 4200"
                value={fillIncomeAmt} autoFocus onChange={(e) => setFillIncomeAmt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyFill(); if (e.key === "Escape") setFillPanel(null); }} />
            </div>
          </div>
          {fillPanel.mode === "all" && (
            <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 10 }}>
              Total fill needed: {fmtAUD(expenseCats.filter((c) => (c.baseAmount || 0) > 0).reduce((s, c) => s + (c.isAccumulating ? (c.baseAmount || 0) : Math.max(0, (c.baseAmount || 0) - (c.envelopeBalance || 0))), 0))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.button, flex: mobile ? 1 : "none" }} onClick={applyFill}>Apply Fill</button>
            <button style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={() => setFillPanel(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Envelopes list */}
      <div style={styles.sectionTitle}>Envelopes</div>
      <div style={{ ...styles.card, padding: 0, marginBottom: mobile ? 16 : 24 }}>
        {expenseCats.map((c) => {
          const spent = spentThisMonth(c.id);
          const balance = c.envelopeBalance || 0;
          const base = c.baseAmount || 0;
          const balColour = balance < 0 ? "#DC2626" : balance < base * 0.2 ? PALETTE.warn : PALETTE.primaryDeep;
          const fillAmt = c.isAccumulating ? base : Math.max(0, base - balance);
          return (
            <div key={c.id}
              style={{ padding: mobile ? "10px 14px" : "12px 20px", borderBottom: `1px solid ${styles.border}`, cursor: onNavigateToCategory ? "pointer" : "default" }}
              onClick={() => onNavigateToCategory && onNavigateToCategory(c.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
                {c.isAccumulating && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: PALETTE.secondary + "55", color: PALETTE.primaryDeep, fontWeight: 700 }}>Saving</span>}
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 14, color: balColour }}>{fmtAUD(balance)}</span>
                <span style={{ fontSize: 11, color: styles.textMuted }}>/ {fmtAUD(base)}</span>
              </div>
              {base > 0 && (
                <div style={{ height: 5, background: styles.barTrack, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, (balance / base) * 100))}%`, height: "100%", background: balColour, borderRadius: 3, transition: "width .3s" }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: styles.textMuted }}>
                Spent <strong style={{ color: styles.text }}>{fmtAUD(spent)}</strong> this month
              </div>
            </div>
          );
        })}
        {expenseCats.length === 0 && (
          <div style={{ padding: "20px", color: styles.textMuted, fontSize: 13 }}>No envelopes yet. Hit "+ Add Envelope" to create one.</div>
        )}
      </div>

      {/* Upcoming bills */}
      <div style={styles.sectionTitle}>Upcoming bills</div>
      <div style={styles.card}>
        {upcoming.length === 0 && <div style={{ color: styles.textMuted, fontSize: 13 }}>Nothing scheduled.</div>}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(2, 1fr)", gap: mobile ? 8 : 12 }}>
          {upcoming.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: styles.surface, borderRadius: 8, border: `1px solid ${styles.border}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: styles.textMuted, marginTop: 2 }}>{r.nextDueDate} · {r.frequency}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: r.type === "income" ? PALETTE.primaryDeep : styles.text, fontVariantNumeric: "tabular-nums" }}>
                {r.type === "income" ? "+" : "−"}{fmtAUD(r.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TxForm({ tx, categories, activeUserId, onSave, onTransfer, onCancel, styles, defaultCategoryId }) {
  const defaultCat = defaultCategoryId ? categories.find((c) => c.id === defaultCategoryId) : null;
  const [form, setForm] = useState(
    tx || {
      date: todayISO(),
      amount: "",
      type: defaultCat?.type || "expense",
      categoryId: defaultCategoryId || categories.find((c) => c.type === "expense")?.id || "",
      description: "",
      addedBy: activeUserId,
      fromCatId: "",
      toCatId: "",
      allocatedEnvelopeId: "",
    }
  );
  const expenseCats = categories.filter((c) => c.type === "expense");
  const submit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    if (form.type === "transfer") {
      if (!form.fromCatId || !form.toCatId || form.fromCatId === form.toCatId) return;
      onTransfer?.({ fromId: form.fromCatId, toId: form.toCatId, amount, description: form.description || "" });
      return;
    }
    onSave({ ...form, amount, addedBy: activeUserId });
  };
  const catOptions = categories.filter((c) => c.type === form.type);
  const mobile = styles.isMobile;
  const isTransfer = form.type === "transfer";
  const isIncome = form.type === "income";
  const cols = mobile ? "1fr 1fr" : (isIncome && !isTransfer) ? "repeat(6, 1fr)" : "repeat(5, 1fr)";
  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} style={{ ...styles.card, marginBottom: 16, display: "grid", gridTemplateColumns: cols, gap: 10 }} data-testid="tx-form">
      <div style={mobile ? { gridColumn: "span 2" } : {}}><div style={styles.label}>Date</div><input style={styles.input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
      <div>
        <div style={styles.label}>Type</div>
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: categories.find((c) => c.type === e.target.value)?.id || "", fromCatId: "", toCatId: "", allocatedEnvelopeId: "" })}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>
      <div><div style={styles.label}>Amount</div><input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="tx-amount" /></div>
      {isTransfer ? (
        <>
          <div>
            <div style={styles.label}>From envelope</div>
            <select style={styles.input} value={form.fromCatId} onChange={(e) => setForm({ ...form, fromCatId: e.target.value })} data-testid="tx-from">
              <option value="">Select envelope…</option>
              {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
            </select>
          </div>
          <div>
            <div style={styles.label}>To envelope</div>
            <select style={styles.input} value={form.toCatId} onChange={(e) => setForm({ ...form, toCatId: e.target.value })} data-testid="tx-to">
              <option value="">Select envelope…</option>
              {expenseCats.filter((c) => c.id !== form.fromCatId).map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
            </select>
          </div>
        </>
      ) : (
        <>
          <div style={mobile ? { gridColumn: "span 2" } : {}}>
            <div style={styles.label}>Category</div>
            <select style={styles.input} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} data-testid="tx-category">
              {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.type === "expense" ? ` — ${fmtAUD(c.envelopeBalance || 0)}` : ""}</option>)}
            </select>
          </div>
          {isIncome && (
            <div style={mobile ? { gridColumn: "span 2" } : {}}>
              <div style={styles.label}>Allocate to envelope</div>
              <select style={styles.input} value={form.allocatedEnvelopeId || ""} onChange={(e) => setForm({ ...form, allocatedEnvelopeId: e.target.value })} data-testid="tx-allocate-envelope">
                <option value="">— unallocated —</option>
                {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
              </select>
            </div>
          )}
        </>
      )}
      <div style={{ gridColumn: mobile ? "span 2" : "span 2" }}><div style={styles.label}>Description</div><input style={styles.input} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="tx-description" /></div>
      <div style={{ gridColumn: mobile ? "span 2" : `span ${isIncome ? 6 : 5}`, display: "flex", alignItems: "end", gap: 8 }}>
        <button type="submit" style={{ ...styles.button, flex: mobile ? 1 : "none" }} data-testid="tx-save">Save</button>
        <button type="button" style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AddAmountForm({ categories, onSave, onCancel, styles }) {
  const expenseCats = categories.filter((c) => c.type === "expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [catId, setCatId] = useState(expenseCats[0]?.id || "");
  const mobile = styles.isMobile;
  const submit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !catId) return;
    onSave(catId, amt, description);
  };
  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      style={{ ...styles.card, marginBottom: 16, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 2fr auto auto", gap: 10, borderColor: PALETTE.primary, background: styles.dark ? "#1A2A1A" : "#EDF3E8" }}>
      <div>
        <div style={styles.label}>Amount ($)</div>
        <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div>
        <div style={styles.label}>Envelope</div>
        <select style={styles.input} value={catId} onChange={(e) => setCatId(e.target.value)} required>
          {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
        </select>
      </div>
      <div style={mobile ? { gridColumn: "span 2" } : {}}>
        <div style={styles.label}>Description (optional)</div>
        <input style={styles.input} placeholder="e.g. Found cash" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, gridColumn: mobile ? "span 2" : "auto" }}>
        <button type="submit" style={{ ...styles.button, whiteSpace: "nowrap" }}>Add Amount</button>
        <button type="button" style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function TransactionsView({ transactions, categories, users, categoriesById, usersById, activeMonth, activeUserId, txFilters, setTxFilters, editingTx, setEditingTx, txFormOpen, setTxFormOpen, saveTx, deleteTx, onTransferEnvelope, handleImportFile, handleExport, onAddWindfall, styles }) {
  const filteredTx = transactions.filter((t) => {
    if (monthKey(t.date) !== activeMonth) return false;
    if (txFilters.type !== "all" && t.type !== txFilters.type) return false;
    if (txFilters.categoryId !== "all" && t.categoryId !== txFilters.categoryId) return false;
    if (txFilters.addedBy !== "all" && t.addedBy !== txFilters.addedBy) return false;
    if (txFilters.search && !(t.description || "").toLowerCase().includes(txFilters.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const filteredIncome = filteredTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const filteredExpense = filteredTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const mobile = styles.isMobile;
  const [showFilters, setShowFilters] = useState(false);
  const [addAmountOpen, setAddAmountOpen] = useState(false);

  const inEnvelopeView = txFilters.categoryId !== "all";
  const contextCatId = inEnvelopeView ? txFilters.categoryId : null;

  const openAddForm = () => { setAddAmountOpen(false); setEditingTx(null); setTxFormOpen(true); };
  const openEdit = (t) => { setAddAmountOpen(false); setEditingTx(t); setTxFormOpen(false); };

  // Auto-close form when clicking outside it
  const formRef = useRef(null);
  useEffect(() => {
    if (!txFormOpen && !editingTx) return;
    const handler = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setTxFormOpen(false);
        setEditingTx(null);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [txFormOpen, editingTx]);

  // Swipe-left to exit envelope view (when in individual envelope context)
  const swipeRef = useRef({ startX: 0, startY: 0 });
  const handleSwipeTouchStart = (e) => { swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }; };
  const handleSwipeTouchEnd = (e) => {
    if (!inEnvelopeView) return;
    const dx = swipeRef.current.startX - e.changedTouches[0].clientX;
    const dy = Math.abs(swipeRef.current.startY - e.changedTouches[0].clientY);
    if (dx > 60 && dy < 40) {
      setTxFilters((f) => ({ ...f, categoryId: "all" }));
    }
  };

  const filterBar = (
    <div style={{ display: mobile ? "grid" : "flex", gridTemplateColumns: mobile ? "1fr 1fr" : undefined, gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      {/* Hide type filter when inside a specific envelope view — irrelevant there */}
      {!inEnvelopeView && (
        <select style={styles.input} value={txFilters.type} onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}>
          <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
        </select>
      )}
      <select style={styles.input} value={txFilters.categoryId} onChange={(e) => setTxFilters({ ...txFilters, categoryId: e.target.value })}>
        <option value="all">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select style={styles.input} value={txFilters.addedBy} onChange={(e) => setTxFilters({ ...txFilters, addedBy: e.target.value })}>
        <option value="all">All users</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <input style={{ ...styles.input, gridColumn: mobile ? "span 2" : undefined }} placeholder="Search description" value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} data-testid="tx-search" />
      <button style={{ ...styles.buttonGhost, gridColumn: mobile ? "span 2" : undefined }} onClick={() => setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "" })}>Clear filters</button>
    </div>
  );

  return (
    <div onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>
      {/* Envelope context header with back hint */}
      {inEnvelopeView && mobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: styles.textMuted }}>
          <button style={{ ...styles.buttonGhost, padding: "6px 12px", fontSize: 13 }} onClick={() => setTxFilters((f) => ({ ...f, categoryId: "all" }))}>← All</button>
          <span style={styles.pill(categoriesById[txFilters.categoryId]?.colour || "#999")}>{categoriesById[txFilters.categoryId]?.name || "Envelope"}</span>
          <span style={{ fontSize: 12 }}>Swipe left to go back</span>
        </div>
      )}
      {mobile ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <button style={{ ...styles.button, flex: 1, fontSize: 16, fontWeight: 700 }} onClick={openAddForm} data-testid="add-tx-mobile">+ Add</button>
            <button style={{ ...styles.button, flex: 1, fontSize: 14, fontWeight: 600, background: styles.dark ? "#2A3A2A" : "#EDF3E8", color: PALETTE.primaryDeep, border: `1px solid ${PALETTE.primary}` }} onClick={() => { setTxFormOpen(false); setEditingTx(null); setAddAmountOpen((o) => !o); }}>
              {addAmountOpen ? "✕ Cancel" : "+ Amount"}
            </button>
            <button style={{ ...styles.buttonGhost, flex: 1 }} onClick={() => setShowFilters((s) => !s)}>{showFilters ? "Hide" : "Filter"}</button>
          </div>
          {showFilters && filterBar}
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* Hide type filter when in envelope view */}
          {!inEnvelopeView && (
            <select style={{ ...styles.input, minWidth: 130, width: "auto" }} value={txFilters.type} onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}>
              <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
            </select>
          )}
          <select style={{ ...styles.input, minWidth: 180, width: "auto" }} value={txFilters.categoryId} onChange={(e) => setTxFilters({ ...txFilters, categoryId: e.target.value })}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={{ ...styles.input, minWidth: 130, width: "auto" }} value={txFilters.addedBy} onChange={(e) => setTxFilters({ ...txFilters, addedBy: e.target.value })}>
            <option value="all">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input style={{ ...styles.input, minWidth: 160, flex: 1 }} placeholder="Search description" value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} data-testid="tx-search" />
          <button style={styles.buttonGhost} onClick={() => setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "" })}>Clear</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={{ ...styles.buttonGhost, borderColor: PALETTE.primary, color: PALETTE.primaryDeep }} onClick={() => { setTxFormOpen(false); setEditingTx(null); setAddAmountOpen((o) => !o); }}>
              {addAmountOpen ? "✕ Cancel" : "+ Add Amount"}
            </button>
            <button style={styles.button} onClick={openAddForm} data-testid="add-tx">Add transaction</button>
          </div>
        </div>
      )}

      {addAmountOpen && (
        <AddAmountForm
          categories={categories}
          onSave={(catId, amt, desc) => { onAddWindfall(catId, amt, desc); setAddAmountOpen(false); }}
          onCancel={() => setAddAmountOpen(false)}
          styles={styles}
        />
      )}

      {(txFormOpen || editingTx) && (
        <div ref={formRef}>
          <TxForm
            tx={editingTx}
            categories={categories}
            activeUserId={activeUserId}
            onSave={saveTx}
            onTransfer={(data) => { onTransferEnvelope(data.fromId, data.toId, data.amount, data.description); setTxFormOpen(false); setEditingTx(null); }}
            onCancel={() => { setTxFormOpen(false); setEditingTx(null); }}
            defaultCategoryId={!editingTx ? contextCatId : null}
            styles={styles}
          />
        </div>
      )}

      {mobile ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: styles.textMuted, padding: "4px 2px 10px" }}>
            <span>{filteredTx.length} transaction{filteredTx.length === 1 ? "" : "s"}</span>
            <span>
              <span style={{ color: PALETTE.primaryDeep, fontWeight: 600 }} data-testid="filter-income">+{fmtAUD(filteredIncome)}</span>
              {" · "}
              <span style={{ fontWeight: 600 }} data-testid="filter-expense">−{fmtAUD(filteredExpense)}</span>
            </span>
          </div>
          <div data-testid="tx-table">
            {filteredTx.map((t) => {
              const cat = categoriesById[t.categoryId];
              const u = usersById[t.addedBy];
              return (
                <div key={t.id} style={{ ...styles.txCard, background: t.imported ? (styles.dark ? "#122012" : "#ECF4E8") : styles.txCard.background, borderLeft: t.imported ? `3px solid ${PALETTE.primary}` : undefined }} data-testid={`tx-row-${t.id}`} onClick={() => openEdit(t)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, color: t.type === "income" ? PALETTE.primaryDeep : styles.text }}>
                      {t.type === "income" ? "+" : "−"}{fmtAUD(t.amount)}
                    </span>
                  </div>
                  {t.description && <div style={{ fontSize: 14, color: styles.text }}>{t.description}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: styles.textMuted }}>
                    <span>{t.date}{t.isRecurring && " · recurring"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...styles.avatarCircle(u || { colour: "#999", name: "?" }), width: 20, height: 20, fontSize: 10 }}>{u?.name[0] || "?"}</span>
                      <button style={{ ...styles.buttonDanger, padding: "4px 10px", fontSize: 12, minHeight: "auto" }} onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this transaction?")) deleteTx(t.id); }} data-testid={`tx-delete-${t.id}`}>Del</button>
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredTx.length === 0 && (
              <div style={{ ...styles.card, textAlign: "center", color: styles.textMuted }}>No transactions match the current filter.</div>
            )}
          </div>
          {!txFormOpen && !editingTx && !addAmountOpen && (
            <button style={styles.fab} onClick={openAddForm} data-testid="add-tx" aria-label="Add transaction">+</button>
          )}
        </>
      ) : (
        <div style={styles.card}>
          <table style={styles.table} data-testid="tx-table">
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>By</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.map((t) => {
                const cat = categoriesById[t.categoryId];
                const u = usersById[t.addedBy];
                return (
                  <tr key={t.id} data-testid={`tx-row-${t.id}`} style={{ background: t.imported ? (styles.dark ? "#122012" : "#ECF4E8") : "transparent" }}>
                    <td style={styles.td}>{t.date}</td>
                    <td style={styles.td}><span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span></td>
                    <td style={styles.td}>
                      {t.description}
                      {t.isRecurring && <span style={{ marginLeft: 6, fontSize: 11, color: styles.textMuted }}>· recurring</span>}
                      {t.imported && <span style={{ marginLeft: 6, fontSize: 11, color: PALETTE.primaryDeep, fontWeight: 600 }}>· imported</span>}
                    </td>
                    <td style={styles.td}><span style={{ ...styles.avatarCircle(u || { colour: "#999", name: "?" }), width: 22, height: 22, fontSize: 10 }}>{u?.name[0] || "?"}</span></td>
                    <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: t.type === "income" ? PALETTE.primaryDeep : styles.text }}>
                      {t.type === "income" ? "+" : "−"}{fmtAUD(t.amount)}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.buttonGhost} onClick={() => openEdit(t)}>Edit</button>
                      <button style={{ ...styles.buttonDanger, marginLeft: 6 }} onClick={() => { if (window.confirm("Delete this transaction?")) deleteTx(t.id); }} data-testid={`tx-delete-${t.id}`}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {filteredTx.length === 0 && (
                <tr><td style={{ ...styles.td, textAlign: "center", color: styles.textMuted, padding: 24 }} colSpan={6}>No transactions match the current filter.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...styles.td, fontWeight: 600 }} colSpan={4}>Totals</td>
                <td style={{ ...styles.td, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: PALETTE.primaryDeep }} data-testid="filter-income">+{fmtAUD(filteredIncome)}</span>
                  <br />
                  <span data-testid="filter-expense">−{fmtAUD(filteredExpense)}</span>
                </td>
                <td style={styles.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function CatForm({ cat, onSave, onCancel, onDelete, styles }) {
  const [form, setForm] = useState(cat
    ? { ...cat, baseAmount: cat.baseAmount ?? cat.monthlyBudget ?? "" }
    : { name: "", type: "expense", colour: "#7FB069", baseAmount: "", isAccumulating: false, envelopeBalance: 0 }
  );
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const baseAmount = form.type === "expense" && form.baseAmount !== "" ? parseFloat(form.baseAmount) || 0 : 0;
    onSave({ ...form, baseAmount, monthlyBudget: baseAmount });
  };
  const mobile = styles.isMobile;
  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      style={{ ...styles.card, marginBottom: 12, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10 }}>
      <div style={{ gridColumn: "span 2" }}>
        <div style={styles.label}>Name</div>
        <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
      </div>
      <div>
        <div style={styles.label}>Type</div>
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="expense">Expense envelope</option>
          <option value="income">Income source</option>
        </select>
      </div>
      {form.type === "expense" && (
        <>
          <div style={{ gridColumn: "span 2" }}>
            <div style={styles.label}>Monthly fill amount</div>
            <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal"
              placeholder="e.g. 1400" value={form.baseAmount ?? ""}
              onChange={(e) => setForm({ ...form, baseAmount: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: mobile ? "span 2" : "auto", paddingTop: 20 }}>
            {cat?.id === SAVINGS_CAT.id ? (
              <span style={{ fontSize: 12, color: styles.textMuted, fontStyle: "italic" }}>Savings always accumulates</span>
            ) : (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
                  <input type="checkbox" checked={!!form.isAccumulating}
                    onChange={(e) => setForm({ ...form, isAccumulating: e.target.checked })} />
                  <span>Saving envelope</span>
                </label>
                <span style={{ fontSize: 11, color: styles.textMuted }}>(balance builds up)</span>
              </>
            )}
          </div>
        </>
      )}
      <div style={{ gridColumn: mobile ? "span 2" : "span 3", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <button type="submit" style={{ ...styles.button, flex: mobile ? 1 : "none" }}>Save</button>
        <button type="button" style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={onCancel}>Cancel</button>
        {onDelete && !cat?.protected && (
          <button type="button" style={{ ...styles.buttonDanger, marginLeft: "auto" }} onClick={onDelete}>Delete envelope</button>
        )}
      </div>
    </form>
  );
}

function EnvelopesView({ categories, editingCat, setEditingCat, catFormOpen, setCatFormOpen, saveCat, deleteCat, unallocatedBalance, onFillWithIncome, onFillSingleEnvelope, onSetupBaseAmounts, recurring, onReorderCats, styles }) {
  const mobile = styles.isMobile;
  const incomeCats = categories.filter((c) => c.type === "income");
  const rawExpenseCats = categories.filter((c) => c.type === "expense");
  const expenseCats = [...rawExpenseCats].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

  // Drag-to-reorder state
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  // Ref holds mutable drag state so document listeners avoid stale closures
  const ds = useRef({ id: null, overId: null, startX: 0, startY: 0, timer: null, active: false });
  // Keep a ref to doReorder so the document listener always calls the latest version
  const doReorderRef = useRef(null);

  const doReorder = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId || !onReorderCats) return;
    const list = [...expenseCats];
    const fromIdx = list.findIndex((c) => c.id === fromId);
    const toIdx = list.findIndex((c) => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...list];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const newCats = categories.map((c) => {
      const newIdx = reordered.findIndex((x) => x.id === c.id);
      return newIdx !== -1 ? { ...c, sortOrder: newIdx } : c;
    });
    onReorderCats(newCats);
  };
  doReorderRef.current = doReorder;

  // Desktop drag handlers
  const handleDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, id) => { e.preventDefault(); if (id !== dragId) setDragOverId(id); };
  const handleDrop = (e, id) => { e.preventDefault(); doReorder(dragId, id); setDragId(null); setDragOverId(null); };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };

  // Document-level non-passive touch listeners — added only while a drag is active.
  // Non-passive allows e.preventDefault() to block scroll during drag.
  useEffect(() => {
    if (!dragId) return;
    const onMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const envEl = el?.closest("[data-env-id]");
      if (envEl) {
        const overId = envEl.dataset.envId;
        if (overId !== ds.current.id && overId !== ds.current.overId) {
          ds.current.overId = overId;
          setDragOverId(overId);
        }
      }
    };
    const onEnd = () => {
      const { id, overId } = ds.current;
      if (id && overId && id !== overId) doReorderRef.current(id, overId);
      ds.current.active = false; ds.current.id = null; ds.current.overId = null;
      setDragId(null); setDragOverId(null);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [dragId]);

  // Mobile: long-press to start drag
  const handleTouchStart = (e, id) => {
    if (editingCat) return;
    const touch = e.touches[0];
    ds.current.startX = touch.clientX; ds.current.startY = touch.clientY;
    ds.current.id = id; ds.current.active = false; ds.current.overId = null;
    ds.current.timer = setTimeout(() => {
      ds.current.active = true;
      setDragId(id);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };
  // Cancel long-press if finger moves before 500ms (normal scroll)
  const handleCardTouchMove = (e) => {
    if (ds.current.active) return;
    const touch = e.touches[0];
    if (Math.abs(touch.clientX - ds.current.startX) > 8 || Math.abs(touch.clientY - ds.current.startY) > 8) {
      clearTimeout(ds.current.timer); ds.current.id = null;
    }
  };
  const handleCardTouchEnd = () => {
    if (!ds.current.active) { clearTimeout(ds.current.timer); ds.current.id = null; }
  };
  const totalBase = expenseCats.reduce((s, c) => s + (c.baseAmount || 0), 0);
  const totalBalance = expenseCats.reduce((s, c) => s + (c.envelopeBalance || 0), 0);
  const isFirstTimeSetup = expenseCats.every((c) => (c.baseAmount || 0) === 0);

  const [fillPanelOpen, setFillPanelOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [addEnvOpen, setAddEnvOpen] = useState(false);
  const [fillAmounts, setFillAmounts] = useState({});

  const getRecurringAmount = (catId) => {
    const rules = (recurring || []).filter((r) => r.categoryId === catId && r.type === "income");
    return rules.length > 0 ? rules[0].amount : null;
  };

  const totalFillAmount = incomeCats.reduce((s, c) => s + (parseFloat(fillAmounts[c.id] || 0) || 0), 0);

  const applyAllIncomeFill = () => {
    const sources = incomeCats
      .map((c) => ({ catId: c.id, amount: parseFloat(fillAmounts[c.id] || 0) || 0 }))
      .filter((s) => s.amount > 0);
    if (sources.length === 0) { return; }
    onFillWithIncome(sources);
    setFillAmounts({});
    setFillPanelOpen(false);
  };

  return (
    <div>
      {/* Unallocated summary */}
      <div style={{ ...styles.card, marginBottom: 20 }}>
        <div style={styles.kpiLabel}>Unallocated balance</div>
        <div style={{ fontSize: mobile ? 28 : 34, fontWeight: 800, letterSpacing: -1, color: unallocatedBalance < 0 ? "#DC2626" : PALETTE.primaryDeep, lineHeight: 1.1 }}>{fmtAUD(unallocatedBalance)}</div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginTop: 4 }}>{fmtAUD(totalBalance)} in envelopes · {fmtAUD(totalBase)}/mo base</div>
      </div>

      {/* Two primary action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <button
          style={{ ...styles.button, padding: mobile ? "18px 12px" : "20px 16px", fontSize: mobile ? 14 : 16, fontWeight: 700, borderRadius: 10, background: (fillPanelOpen || showWizard) ? PALETTE.primaryDeep : PALETTE.primary }}
          onClick={() => {
            if (isFirstTimeSetup && !fillPanelOpen && !showWizard) {
              setShowWizard(true);
              setAddEnvOpen(false);
            } else {
              setFillPanelOpen((o) => !o);
              setShowWizard(false);
              setAddEnvOpen(false);
            }
          }}
        >
          {(fillPanelOpen || showWizard) ? "✕ Close" : "Fill Envelopes"}
        </button>
        <button
          style={{ ...styles.buttonGhost, padding: mobile ? "18px 12px" : "20px 16px", fontSize: mobile ? 14 : 16, fontWeight: 700, borderRadius: 10, borderWidth: 2, background: addEnvOpen ? (styles.dark ? "#2A2D2A" : "#EDF1E8") : "transparent" }}
          onClick={() => { setAddEnvOpen((o) => !o); setFillPanelOpen(false); setEditingCat(null); if (!addEnvOpen) setCatFormOpen(true); else setCatFormOpen(false); }}
        >
          {addEnvOpen ? "✕ Cancel" : "+ Add Envelope"}
        </button>
      </div>

      {/* First-time setup wizard */}
      {showWizard && (
        <FirstTimeFillWizard
          categories={categories}
          onComplete={(amountsMap) => {
            onSetupBaseAmounts(amountsMap);
            setShowWizard(false);
          }}
          onSkip={() => setShowWizard(false)}
          styles={styles}
        />
      )}

      {/* Fill Envelopes panel */}
      {fillPanelOpen && !showWizard && (
        <div style={{ ...styles.card, marginBottom: 20, borderColor: PALETTE.primary, background: styles.dark ? "#1A2A1A" : "#EDF3E8" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Fill all envelopes from income</div>
          <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 16 }}>
            Enter amounts from each income source. The combined total fills all envelopes at once.
          </div>
          {incomeCats.map((c) => {
            const recurringAmt = getRecurringAmount(c.id);
            return (
              <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${styles.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {recurringAmt != null && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Recurring</div>
                      <button
                        style={{ ...styles.buttonGhost, fontSize: 12, padding: "7px 12px", borderColor: PALETTE.primary, color: PALETTE.primaryDeep }}
                        onClick={() => setFillAmounts((prev) => ({ ...prev, [c.id]: String(recurringAmt) }))}
                      >
                        Stay Consistent ({fmtAUD(recurringAmt)})
                      </button>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                      {recurringAmt != null ? "Custom amount" : "Amount received ($)"}
                    </div>
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={fillAmounts[c.id] || ""}
                      onChange={(e) => setFillAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {incomeCats.length === 0 && (
            <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 12 }}>No income sources. Add one via the Envelopes form below.</div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingTop: 4 }}>
            <button
              style={{ ...styles.button, flex: 1, padding: "13px 16px", fontSize: 15, fontWeight: 700, opacity: totalFillAmount <= 0 ? 0.5 : 1 }}
              onClick={applyAllIncomeFill}
              disabled={totalFillAmount <= 0}
            >
              Fill All Envelopes — {fmtAUD(totalFillAmount)}
            </button>
            <button style={{ ...styles.buttonGhost }} onClick={() => { setFillPanelOpen(false); setFillAmounts({}); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add envelope form */}
      {addEnvOpen && catFormOpen && !editingCat && (
        <div style={{ marginBottom: 20 }}>
          <CatForm cat={null} onSave={(cat) => { saveCat(cat); setAddEnvOpen(false); setCatFormOpen(false); }} onCancel={() => { setAddEnvOpen(false); setCatFormOpen(false); }} styles={styles} />
        </div>
      )}

      {/* Expense envelopes management */}
      <div style={styles.sectionTitle}>Expense envelopes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {expenseCats.map((c) => {
          if (editingCat?.id === c.id) return (
            <div key={c.id}>
              <CatForm
                cat={editingCat}
                onSave={saveCat}
                onCancel={() => setEditingCat(null)}
                onDelete={!editingCat.protected ? () => { setEditingCat(null); deleteCat(editingCat.id); } : undefined}
                styles={styles}
              />
            </div>
          );
          const balance = c.envelopeBalance || 0;
          const base = c.baseAmount || 0;
          const balColour = balance < 0 ? "#DC2626" : balance < base * 0.2 ? PALETTE.warn : PALETTE.primaryDeep;
          return (
            <div key={c.id}
              data-env-id={c.id}
              draggable={!editingCat}
              onDragStart={(e) => handleDragStart(e, c.id)}
              onDragOver={(e) => handleDragOver(e, c.id)}
              onDrop={(e) => handleDrop(e, c.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, c.id)}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              style={{ ...styles.card, display: "flex", flexDirection: "column", opacity: dragId === c.id ? 0.45 : 1, outline: dragOverId === c.id ? `2px solid ${PALETTE.primary}` : "none", transition: "opacity .15s", cursor: dragId ? "grabbing" : "grab" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: styles.textMuted, flexShrink: 0, cursor: "grab", userSelect: "none" }}>⠿</span>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
                {c.isAccumulating && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: PALETTE.secondary + "55", color: PALETTE.primaryDeep, fontWeight: 700 }}>Saving</span>}
                {c.protected && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "#9CA3AF22", color: "#6B7280", fontWeight: 700 }}>Protected</span>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: balColour, letterSpacing: -0.5, marginBottom: 4 }}>{fmtAUD(balance)}</div>
              <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 10 }}>
                Fill {fmtAUD(base)}/mo{c.isAccumulating ? " · accumulating" : ""}
              </div>
              <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
                <button style={{ ...styles.buttonGhost, fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={(e) => { e.stopPropagation(); setEditingCat(c); setCatFormOpen(false); }}>Edit</button>
                {onFillSingleEnvelope && (c.baseAmount || 0) > 0 && (
                  <button style={{ ...styles.button, fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={(e) => { e.stopPropagation(); onFillSingleEnvelope(c.id); }} title={`Fill ${c.name} to target`}>Fill</button>
                )}
              </div>
            </div>
          );
        })}
        {expenseCats.length === 0 && (
          <div style={{ ...styles.card, gridColumn: "span 2", color: styles.textMuted, textAlign: "center" }}>
            No expense envelopes yet. Hit "+ Add envelope" to create one.
          </div>
        )}
      </div>
    </div>
  );
}

function RuleForm({ rule, categories, users, activeUserId, onSave, onCancel, styles }) {
  const [form, setForm] = useState(
    rule || { label: "", amount: "", type: "expense", categoryId: categories.find((c) => c.type === "expense")?.id || "", frequency: "monthly", startDate: todayISO(), nextDueDate: todayISO(), addedBy: activeUserId }
  );
  const submit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0 || !form.label) return;
    onSave({ ...form, amount });
  };
  const catOptions = categories.filter((c) => c.type === form.type);
  const mobile = styles.isMobile;
  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} style={{ ...styles.card, marginBottom: 16, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
      <div style={{ gridColumn: "span 2" }}><div style={styles.label}>Label</div><input style={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></div>
      <div>
        <div style={styles.label}>Type</div>
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: categories.find((c) => c.type === e.target.value)?.id || "" })}>
          <option value="expense">Expense</option><option value="income">Income</option>
        </select>
      </div>
      <div><div style={styles.label}>Amount</div><input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
      <div>
        <div style={styles.label}>Frequency</div>
        <select style={styles.input} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option>
        </select>
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <div style={styles.label}>Category</div>
        <select style={styles.input} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><div style={styles.label}>Start</div><input style={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, nextDueDate: form.nextDueDate || e.target.value })} /></div>
      <div><div style={styles.label}>Next due</div><input style={styles.input} type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></div>
      <div style={{ gridColumn: "span 2", display: "flex", alignItems: "end", gap: 8 }}>
        <button type="submit" style={{ ...styles.button, flex: mobile ? 1 : "none" }}>Save</button>
        <button type="button" style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function RecurringView({ recurring, categories, users, categoriesById, activeUserId, editingRule, setEditingRule, ruleFormOpen, setRuleFormOpen, saveRule, deleteRule, postDueRecurrences, styles }) {
  const due = recurring.filter((r) => r.nextDueDate <= todayISO());
  const mobile = styles.isMobile;
  return (
    <div>
      {due.length > 0 && (
        <div style={{ ...styles.card, background: PALETTE.secondary + "44", borderColor: PALETTE.primary, display: "flex", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", alignItems: mobile ? "stretch" : "center", marginBottom: 16, gap: 10 }} data-testid="due-banner">
          <div><strong>{due.length}</strong> recurring rule(s) due. Posting advances each rule by one cycle.</div>
          <button style={styles.button} onClick={postDueRecurrences} data-testid="post-due">Post due transactions</button>
        </div>
      )}
      {!mobile && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button style={styles.button} onClick={() => { setEditingRule(null); setRuleFormOpen(true); }}>Add recurring rule</button>
        </div>
      )}
      {(ruleFormOpen || editingRule) && <RuleForm rule={editingRule} categories={categories} users={users} activeUserId={activeUserId} onSave={saveRule} onCancel={() => { setRuleFormOpen(false); setEditingRule(null); }} styles={styles} />}
      {mobile ? (
        <>
          {!ruleFormOpen && !editingRule && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button style={{ ...styles.button, flex: 1, fontSize: 15, fontWeight: 700 }} onClick={() => { setEditingRule(null); setRuleFormOpen(true); }}>
                + Add rule
              </button>
            </div>
          )}
          {recurring.map((r) => {
            const cat = categoriesById[r.categoryId];
            const overdue = r.nextDueDate <= todayISO();
            return (
              <div key={r.id} style={{ ...styles.txCard, borderLeft: overdue ? `3px solid ${PALETTE.warn}` : styles.txCard.borderLeft }} onClick={() => { setEditingRule(r); setRuleFormOpen(false); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{r.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, color: r.type === "income" ? PALETTE.primaryDeep : styles.text }}>
                    {r.type === "income" ? "+" : "−"}{fmtAUD(r.amount)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span>
                  <span style={{ fontSize: 11, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.frequency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: styles.textMuted }}>
                  <span>Next: {r.nextDueDate}{overdue && " · due"}</span>
                  <button style={{ ...styles.buttonDanger, padding: "4px 10px", fontSize: 11, minHeight: "auto" }} onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this rule?")) deleteRule(r.id); }}>Del</button>
                </div>
              </div>
            );
          })}
          {recurring.length === 0 && (
            <div style={{ ...styles.card, textAlign: "center", color: styles.textMuted }}>No recurring rules yet.</div>
          )}
          {!ruleFormOpen && !editingRule && (
            <button style={styles.fab} onClick={() => { setEditingRule(null); setRuleFormOpen(true); }} aria-label="Add recurring rule">+</button>
          )}
        </>
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Label</th><th style={styles.th}>Type</th><th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                <th style={styles.th}>Category</th><th style={styles.th}>Frequency</th><th style={styles.th}>Next due</th><th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((r) => {
                const cat = categoriesById[r.categoryId];
                return (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.label}</td>
                    <td style={styles.td}>{r.type}</td>
                    <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAUD(r.amount)}</td>
                    <td style={styles.td}><span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span></td>
                    <td style={styles.td}>{r.frequency}</td>
                    <td style={styles.td}>{r.nextDueDate}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.buttonGhost} onClick={() => { setEditingRule(r); setRuleFormOpen(false); }}>Edit</button>
                      <button style={{ ...styles.buttonDanger, marginLeft: 6 }} onClick={() => { if (window.confirm("Delete this rule?")) deleteRule(r.id); }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {recurring.length === 0 && (
                <tr><td style={{ ...styles.td, textAlign: "center", color: styles.textMuted, padding: 24 }} colSpan={7}>No recurring rules yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PieChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (total <= 0) return <div style={{ fontSize: 13, color: "#9AA09A", textAlign: "center", padding: 20 }}>No data</div>;
  let angle = -Math.PI / 2;
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;
  const segments = data.filter((d) => d.value > 0).map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    return { path: `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`, colour: d.colour, label: d.label, value: d.value, pct: (d.value / total) * 100 };
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {segments.map((s, i) => <path key={i} d={s.path} fill={s.colour} />)}
      </svg>
      <div style={{ flex: 1, minWidth: 120 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.colour, flexShrink: 0 }} />
            <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnallocatedEditor({ unallocatedBalance, onSetUnallocated, styles }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  if (!editing) {
    return (
      <button style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={() => { setVal(String(unallocatedBalance)); setEditing(true); }}>
        Edit Unallocated ({fmtAUD(unallocatedBalance)})
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input style={{ ...styles.input, width: 120 }} type="number" step="0.01" inputMode="decimal" value={val} autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat(val); if (!isNaN(v)) { onSetUnallocated(v); setEditing(false); } } if (e.key === "Escape") setEditing(false); }} />
      <button style={styles.button} onClick={() => { const v = parseFloat(val); if (!isNaN(v)) { onSetUnallocated(v); setEditing(false); } }}>Set</button>
      <button style={styles.buttonGhost} onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}

function ReportsView({ transactions, categories, categoriesById, reportRange, setReportRange, handleExport, assets, onSaveAsset, onDeleteAsset, transfers, unallocatedBalance, onSetUnallocated, onImportJSON, styles }) {
  const [assetForm, setAssetForm] = useState(null); // null=closed, {}=new, {id,...}=editing
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importCopied, setImportCopied] = useState(false);

  const expenseCatList = categories.filter((c) => c.type === "expense");
  const aiPrompt = `Convert my bank statement transactions to JSON format for the BYB budget app.
Return ONLY a valid JSON array - no explanation, no markdown, just raw JSON.

Each item must follow this exact structure:
[
  {
    "date": "YYYY-MM-DD",
    "amount": 123.45,
    "type": "expense",
    "categoryId": "c-groceries",
    "description": "Brief description"
  }
]

Rules:
- type is expense for money paid out, income for money received
- amount is always a positive number
- date must be YYYY-MM-DD format
- description should be plain text with no special characters or apostrophes
- Choose the best categoryId from this list:
${expenseCatList.map((c) => `  "${c.id}": ${c.name}`).join("\n")}
  "c-salary": Salary (for income)
  "c-other-in": Other Income (for income)

My transactions and bank statement:
[PASTE YOUR BANK STATEMENT HERE]`;

  const copyPrompt = () => {
    const doFallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = aiPrompt;
        ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setImportCopied(true);
        setTimeout(() => setImportCopied(false), 2000);
      } catch { /* silent */ }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(aiPrompt)
        .then(() => { setImportCopied(true); setTimeout(() => setImportCopied(false), 2000); })
        .catch(doFallback);
    } else {
      doFallback();
    }
  };

  const runImport = () => {
    if (!importText.trim()) return;
    const ok = onImportJSON(importText);
    if (ok) { setImportText(""); setImportOpen(false); }
  };
  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState("");

  const openNewAsset = () => { setAssetForm({}); setAssetName(""); setAssetValue(""); };
  const openEditAsset = (a) => { setAssetForm(a); setAssetName(a.name); setAssetValue(String(a.value)); };
  const closeAssetForm = () => { setAssetForm(null); setAssetName(""); setAssetValue(""); };
  const submitAsset = () => {
    const v = parseFloat(assetValue);
    if (!assetName.trim() || isNaN(v)) return;
    onSaveAsset({ ...assetForm, name: assetName.trim(), value: v });
    closeAssetForm();
  };
  const netWorth = assets.reduce((s, a) => s + (a.value || 0), 0);

  // Pie chart state
  const allMonths = Array.from(new Set(transactions.map((t) => monthKey(t.date)))).sort().reverse();
  const [pieMonth, setPieMonth] = useState(() => allMonths[0] || todayISO().slice(0, 7));

  const clamped = reportRange.end < reportRange.start ? { start: reportRange.start, end: reportRange.start } : reportRange;
  const rangeTx = transactions.filter((t) => t.date >= clamped.start && t.date <= clamped.end);
  const income = rangeTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = rangeTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;

  const daysInRange = Math.max(1, Math.round((new Date(clamped.end) - new Date(clamped.start)) / 86400000) + 1);
  const avgDaily = daysInRange > 0 ? expenses / daysInRange : 0;

  const byCat = {};
  rangeTx.filter((t) => t.type === "expense").forEach((t) => {
    if (!byCat[t.categoryId]) byCat[t.categoryId] = { total: 0, count: 0 };
    byCat[t.categoryId].total += t.amount;
    byCat[t.categoryId].count += 1;
  });
  const breakdown = Object.entries(byCat).map(([cid, v]) => ({
    cat: categoriesById[cid],
    total: v.total,
    count: v.count,
    avg: v.total / v.count,
    pct: expenses > 0 ? (v.total / expenses) * 100 : 0,
  })).sort((a, b) => b.total - a.total);

  const topCat = breakdown[0]?.cat?.name || "—";

  const months = Array.from(new Set(rangeTx.map((t) => monthKey(t.date)))).sort();
  const monthlyTrend = months.map((m) => ({
    month: m,
    income: rangeTx.filter((t) => monthKey(t.date) === m && t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: rangeTx.filter((t) => monthKey(t.date) === m && t.type === "expense").reduce((s, t) => s + t.amount, 0),
  }));
  const maxTrend = Math.max(1, ...monthlyTrend.flatMap((m) => [m.income, m.expense]));

  return (
    <div>
      {/* Net Worth / Assets section */}
      <div style={styles.sectionTitle}>Net worth</div>
      <div style={{ ...styles.card, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={styles.kpiLabel}>Total net worth</div>
            <div style={{ fontSize: styles.isMobile ? 28 : 36, fontWeight: 800, letterSpacing: -1, color: netWorth >= 0 ? PALETTE.primaryDeep : PALETTE.warn, lineHeight: 1.1 }}>
              {fmtAUD(netWorth)}
            </div>
          </div>
          {assetForm === null && (
            <button style={{ ...styles.button, whiteSpace: "nowrap" }} onClick={openNewAsset}>+ Add asset</button>
          )}
        </div>

        {/* Inline add/edit form */}
        {assetForm !== null && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input style={{ ...styles.input, flex: 2, minWidth: 140 }} placeholder="Asset name (e.g. Superannuation)" value={assetName} onChange={(e) => setAssetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitAsset(); if (e.key === "Escape") closeAssetForm(); }} autoFocus />
            <input style={{ ...styles.input, flex: 1, minWidth: 120 }} type="number" step="0.01" inputMode="decimal" placeholder="Value ($)" value={assetValue} onChange={(e) => setAssetValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitAsset(); if (e.key === "Escape") closeAssetForm(); }} />
            <button style={{ ...styles.button, whiteSpace: "nowrap" }} onClick={submitAsset}>{assetForm.id ? "Update" : "Add"}</button>
            <button style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={closeAssetForm}>Cancel</button>
          </div>
        )}

        {/* Asset list */}
        {assets.length === 0 && assetForm === null && (
          <div style={{ color: styles.textMuted, fontSize: 13 }}>No assets added yet. Hit "+ Add asset" to track superannuation, property, savings accounts, etc.</div>
        )}
        {assets.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${styles.border}`, gap: 8 }}>
            <span style={{ fontWeight: 500, flex: 1 }}>{a.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: PALETTE.primaryDeep, fontSize: 15, whiteSpace: "nowrap" }}>{fmtAUD(a.value)}</span>
            <button style={{ ...styles.buttonGhost, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={() => openEditAsset(a)}>Edit</button>
            <button style={{ ...styles.buttonDanger, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={() => onDeleteAsset(a.id)}>Delete</button>
          </div>
        ))}
      </div>

      {styles.isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: importOpen ? 0 : 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, overflow: "hidden" }}>
            <div style={{ minWidth: 0 }}><div style={styles.label}>From</div><input style={{ ...styles.input, minWidth: 0 }} type="date" value={reportRange.start} onChange={(e) => setReportRange({ ...reportRange, start: e.target.value })} /></div>
            <div style={{ minWidth: 0 }}><div style={styles.label}>To</div><input style={{ ...styles.input, minWidth: 0 }} type="date" value={reportRange.end} onChange={(e) => setReportRange({ ...reportRange, end: e.target.value })} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button style={{ ...styles.buttonGhost, textAlign: "center" }} onClick={() => { setImportOpen((o) => !o); setImportText(""); }}>
              {importOpen ? "✕ Close" : "Import"}
            </button>
            <button style={{ ...styles.buttonGhost, textAlign: "center" }} onClick={handleExport} data-testid="reports-export">Export XLSX</button>
          </div>
          <UnallocatedEditor unallocatedBalance={unallocatedBalance} onSetUnallocated={onSetUnallocated} styles={styles} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: importOpen ? 0 : 16, alignItems: "end", flexWrap: "wrap" }}>
          <div><div style={styles.label}>From</div><input style={styles.input} type="date" value={reportRange.start} onChange={(e) => setReportRange({ ...reportRange, start: e.target.value })} /></div>
          <div><div style={styles.label}>To</div><input style={styles.input} type="date" value={reportRange.end} onChange={(e) => setReportRange({ ...reportRange, end: e.target.value })} /></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <UnallocatedEditor unallocatedBalance={unallocatedBalance} onSetUnallocated={onSetUnallocated} styles={styles} />
            <button style={styles.buttonGhost} onClick={() => { setImportOpen((o) => !o); setImportText(""); }}>
              {importOpen ? "✕ Close import" : "Import Transactions"}
            </button>
            <button style={styles.buttonGhost} onClick={handleExport} data-testid="reports-export">Export XLSX</button>
          </div>
        </div>
      )}

      {importOpen && (
        <div style={{ ...styles.card, marginBottom: 20, borderColor: PALETTE.primary }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Import transactions via AI</div>
          <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 14 }}>
            Use your AI assistant (ChatGPT, Claude, Gemini, etc.) to convert your bank statement into the format BYB! understands, then paste the result below.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={styles.label}>Step 1 — Copy this prompt and send it to your AI with your bank statement attached</div>
              <button style={{ ...styles.buttonGhost, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={copyPrompt}>
                {importCopied ? "Copied!" : "Copy prompt"}
              </button>
            </div>
            <pre style={{ background: styles.dark ? "#111" : "#F3F4F6", border: `1px solid ${styles.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: styles.text, maxHeight: 200, overflow: "auto", margin: 0 }}>
              {aiPrompt}
            </pre>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={styles.label}>Step 2 — Paste the JSON output from your AI here</div>
            <textarea
              style={{ ...styles.input, minHeight: 120, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
              placeholder='[{"date":"2024-01-15","amount":85.50,"type":"expense","categoryId":"c-groceries","description":"Woolworths"}]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.button, flex: styles.isMobile ? 1 : "none" }} onClick={runImport} disabled={!importText.trim()}>Import Transactions</button>
            <button style={styles.buttonGhost} onClick={() => { setImportOpen(false); setImportText(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: styles.isMobile ? 10 : 12, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={styles.card}><div style={styles.kpiLabel}>Income</div><div style={styles.kpiValue}>{fmtAUD(income)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Expenses</div><div style={styles.kpiValue}>{fmtAUD(expenses)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Net</div><div style={{ ...styles.kpiValue, color: net >= 0 ? PALETTE.primaryDeep : PALETTE.warn }}>{fmtAUD(net)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Avg daily spend</div><div style={styles.kpiValue}>{fmtAUD(avgDaily)}</div></div>
        <div style={{ ...styles.card, gridColumn: styles.isMobile ? "span 2" : "auto" }}><div style={styles.kpiLabel}>Top category</div><div style={{ ...styles.kpiValue, fontSize: 16 }}>{topCat}</div></div>
      </div>

      {/* Pie charts */}
      <div style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr" : "1fr 1fr", gap: styles.isMobile ? 16 : 20, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={styles.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ ...styles.sectionTitle, margin: 0 }}>Monthly distribution</div>
            <select style={{ ...styles.monthSelect }} value={pieMonth} onChange={(e) => setPieMonth(e.target.value)}>
              {allMonths.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
          </div>
          <PieChart
            size={160}
            data={categories.filter((c) => c.type === "expense").map((c) => ({
              label: c.name,
              colour: c.colour,
              value: transactions.filter((t) => monthKey(t.date) === pieMonth && t.categoryId === c.id && t.type === "expense").reduce((s, t) => s + t.amount, 0),
            })).filter((d) => d.value > 0)}
          />
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.sectionTitle, margin: "0 0 12px 0" }}>Full period distribution</div>
          <PieChart
            size={160}
            data={categories.filter((c) => c.type === "expense").map((c) => ({
              label: c.name,
              colour: c.colour,
              value: rangeTx.filter((t) => t.categoryId === c.id && t.type === "expense").reduce((s, t) => s + t.amount, 0),
            })).filter((d) => d.value > 0)}
          />
        </div>
      </div>

      <div style={styles.sectionTitle}>Monthly trend</div>
      <div style={styles.card}>
        {monthlyTrend.map((m) => (
          <div key={m.month} style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr" : "120px 1fr 120px", gap: styles.isMobile ? 4 : 12, alignItems: "center", padding: styles.isMobile ? "10px 0" : "6px 0", borderBottom: styles.isMobile ? `1px solid ${styles.border}` : "none" }}>
            {styles.isMobile && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12 }}>
                <span style={{ color: styles.text, fontWeight: 500 }}>{formatMonth(m.month)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: PALETTE.primaryDeep }}>+{fmtAUD(m.income)}</span>
                  {" · "}
                  <span style={{ color: PALETTE.warn }}>−{fmtAUD(m.expense)}</span>
                </span>
              </div>
            )}
            {!styles.isMobile && <div style={{ fontSize: 12, color: styles.textMuted }}>{formatMonth(m.month)}</div>}
            <div>
              <div style={{ height: 8, background: PALETTE.primary, width: `${(m.income / maxTrend) * 100}%`, borderRadius: 3, marginBottom: 4 }} />
              <div style={{ height: 8, background: PALETTE.warn, width: `${(m.expense / maxTrend) * 100}%`, borderRadius: 3 }} />
            </div>
            {!styles.isMobile && (
              <div style={{ fontSize: 11, color: styles.textMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <div style={{ color: PALETTE.primaryDeep }}>+{fmtAUD(m.income)}</div>
                <div>−{fmtAUD(m.expense)}</div>
              </div>
            )}
          </div>
        ))}
        {monthlyTrend.length === 0 && <div style={{ color: styles.textMuted, fontSize: 13 }}>No data in this range.</div>}
      </div>

      <div style={styles.sectionTitle}>Category breakdown</div>
      {styles.isMobile ? (
        <div>
          {breakdown.map((b) => (
            <div key={b.cat?.id || "unknown"} style={styles.txCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={styles.pill(b.cat?.colour || "#999")}>{b.cat?.name || "Unknown"}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 15 }}>{fmtAUD(b.total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: styles.textMuted, fontVariantNumeric: "tabular-nums" }}>
                <span>{b.pct.toFixed(1)}% of total</span>
                <span>{b.count}× · avg {fmtAUD(b.avg)}</span>
              </div>
            </div>
          ))}
          {breakdown.length === 0 && <div style={{ ...styles.card, textAlign: "center", color: styles.textMuted }}>No expenses in range.</div>}
        </div>
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
                <th style={{ ...styles.th, textAlign: "right" }}>%</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Avg</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.cat?.id || "unknown"}>
                  <td style={styles.td}><span style={styles.pill(b.cat?.colour || "#999")}>{b.cat?.name || "Unknown"}</span></td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAUD(b.total)}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.pct.toFixed(1)}%</td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAUD(b.avg)}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.count}</td>
                </tr>
              ))}
              {breakdown.length === 0 && <tr><td style={{ ...styles.td, textAlign: "center", color: styles.textMuted, padding: 24 }} colSpan={5}>No expenses in range.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Envelope transfers log */}
      <div style={styles.sectionTitle}>Envelope transfers</div>
      {(() => {
        const rangeTransfers = (transfers || []).filter((t) => t.date >= clamped.start && t.date <= clamped.end).slice(0, 50);
        if (rangeTransfers.length === 0) return <div style={{ ...styles.card, color: styles.textMuted, fontSize: 13 }}>No transfers in this period.</div>;
        return styles.isMobile ? (
          <div>
            {rangeTransfers.map((t) => (
              <div key={t.id} style={styles.txCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: styles.textMuted }}>{t.date}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmtAUD(t.amount)}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={styles.pill(categoriesById[t.fromId]?.colour || "#999")}>{categoriesById[t.fromId]?.name || "?"}</span>
                  {" → "}
                  <span style={styles.pill(categoriesById[t.toId]?.colour || "#999")}>{categoriesById[t.toId]?.name || "?"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead><tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>From</th>
                <th style={styles.th}>To</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
              </tr></thead>
              <tbody>
                {rangeTransfers.map((t) => (
                  <tr key={t.id}>
                    <td style={styles.td}>{t.date}</td>
                    <td style={styles.td}><span style={styles.pill(categoriesById[t.fromId]?.colour || "#999")}>{categoriesById[t.fromId]?.name || "?"}</span></td>
                    <td style={styles.td}><span style={styles.pill(categoriesById[t.toId]?.colour || "#999")}>{categoriesById[t.toId]?.name || "?"}</span></td>
                    <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtAUD(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

function WelcomeModal({ onClose, styles }) {
  const mobile = styles.isMobile;
  const p = { marginBottom: 14, lineHeight: 1.8 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }}>
      <div style={{ background: styles.surface, borderRadius: mobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: 560, maxHeight: mobile ? "93vh" : "90vh", overflow: "auto", padding: mobile ? "24px 18px 36px" : 40, boxSizing: "border-box", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>

        {/* Logo / brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.svg" alt="BYB!" style={{ width: 84, height: 84, borderRadius: "50%", background: PALETTE.secondary, padding: 7, objectFit: "contain", filter: "drop-shadow(0 3px 12px rgba(0,0,0,0.13))" }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ marginTop: 14, fontSize: 28, fontWeight: 800, color: PALETTE.primary, letterSpacing: -0.5 }}>BYB!</div>
          <div style={{ color: styles.textMuted, fontSize: 14, marginTop: 4 }}>Ban' Yuh Belly Budgeting</div>
        </div>

        {/* Disclaimer */}
        <div style={{ background: styles.dark ? "#2A2D2A" : "#F7F8F6", border: `1px solid ${styles.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 22, fontSize: 12, color: styles.textMuted, lineHeight: 1.7 }}>
          <strong style={{ fontSize: 12, color: styles.text }}>Disclaimer</strong><br />
          BYB! is a personal budgeting tool provided as-is for informational purposes only. It is not financial advice, and nothing in this app should be construed as professional financial, legal, or investment guidance. The creators and contributors of BYB! accept no responsibility or liability for any financial decisions, losses, or outcomes arising from your use of this app. Always consult a qualified financial advisor for personalised advice.
        </div>

        {/* Welcome message */}
        <div style={{ fontSize: 14.5, color: styles.text }}>
          <p style={{ ...p, fontStyle: "italic", color: PALETTE.primaryDeep, fontWeight: 600, fontSize: 15 }}>"Ban' yuh belly"</p>
          <p style={p}>It is a Caribbean saying, and if you grew up in Trinidad, Tobago, Guyana, or Grenada, you know exactly what it means. It means brace yourself, tighten up, and prepare for hard times ahead. It is the kind of thing your grandmother would tell you when money was scarce and sacrifice was necessary.</p>
          <p style={p}>But we built this app so that you never have to hear those words again. When you know where every dollar is going, hard times stop catching you off guard. You stop surviving and you start building. Real wealth. Real peace of mind. Month by month.</p>
          <p style={{ ...p, marginBottom: 24 }}>This is a passion project, built with love for the people close to us. We hope it serves you well, and we hope it gives your family the same clarity and confidence it gave ours.</p>

          <hr style={{ border: "none", borderTop: `1px solid ${styles.border}`, marginBottom: 24 }} />

          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: styles.text }}>Getting started</p>
          <ol style={{ paddingLeft: 22, margin: 0, display: "flex", flexDirection: "column", gap: 14, fontSize: 14, lineHeight: 1.75 }}>
            <li><strong>Fill your envelopes</strong> — Go to the Envelopes tab at the start of each month and hit Fill Envelopes. The very first time, you will be asked how you want to set things up. You can let the app fill everything automatically using sensible starting percentages, or you can go envelope by envelope and set the amounts yourself. If your total ever goes over your monthly income the app will warn you so you can adjust.</li>
            <li><strong>Log your spending</strong> — Use Add Transaction on the Dashboard or in the Transactions tab to record expenses as they happen. Do not let them pile up at the end of the month.</li>
            <li><strong>Move money around</strong> — Life does not always follow a plan. Use the Transfer option in Add Transaction to shift money between envelopes when you need to without losing track of where it went.</li>
            <li><strong>Your Savings envelope</strong> — This one is special. It builds up over time, it sits at the bottom of every list, and you cannot delete it. Treat it like it is not yours to touch until you are ready.</li>
            <li><strong>Your Unallocated balance</strong> — This is money that has landed in your account but has not been assigned to an envelope yet. When you fill envelopes, money moves out of Unallocated into each one. If it is positive, find it a home. At the end of the month use the Reconcile button on the Dashboard to sweep up any leftover surpluses and cover any shortfalls automatically.</li>
            <li><strong>Track what you own</strong> — The Reports tab lets you add assets like your bank account balance, superannuation, investment accounts, or property value. These are manual snapshots but they give you the full picture of where you stand financially, not just where your spending is going.</li>
            <li><strong>Know your numbers</strong> — The Reports tab gives you spending trends, category breakdowns, and charts. Check it at the end of each month. That five minutes will tell you everything you need to know.</li>
            <li><strong>Set up your bills</strong> — Add your regular payments in the Recurring tab so nothing sneaks up on you.</li>
          </ol>
        </div>

        <button
          style={{ ...styles.button, width: "100%", marginTop: 32, padding: 16, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
          onClick={onClose}
        >
          Agree and let's get started
        </button>
      </div>
    </div>
  );
}

function FirstTimeFillWizard({ categories, onComplete, onSkip, styles }) {
  const [mode, setMode] = useState(null); // null | 'auto' | 'manual'
  const [income, setIncome] = useState("");
  const expCats = categories.filter((c) => c.type === "expense");
  const [autoAmounts, setAutoAmounts] = useState(() => Object.fromEntries(expCats.map((c) => [c.id, ""])));
  const [step, setStep] = useState(0);
  const [manualAmounts, setManualAmounts] = useState(() => Object.fromEntries(expCats.map((c) => [c.id, ""])));
  const mobile = styles.isMobile;

  const parsedIncome = parseFloat(income) || 0;

  const applySuggestions = (incomeVal) => {
    const inc = parseFloat(incomeVal) || 0;
    if (inc <= 0) return;
    setAutoAmounts(Object.fromEntries(expCats.map((c) => [c.id, String(Math.round(inc * ((c.suggestedPct || 0) / 100)))])));
  };

  const autoTotal = expCats.reduce((s, c) => s + (parseFloat(autoAmounts[c.id]) || 0), 0);
  const manualTotal = expCats.reduce((s, c) => s + (parseFloat(manualAmounts[c.id]) || 0), 0);
  const overBudget = (total) => parsedIncome > 0 && total > parsedIncome;

  const overBudgetBanner = (total) => (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C", fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
      Oops! You have gone over your monthly budget by {fmtAUD(total - parsedIncome)}. Adjust some amounts to bring it back in line.
    </div>
  );

  if (!mode) {
    return (
      <div style={{ ...styles.card, borderColor: PALETTE.primary, background: styles.dark ? "#1A2A1A" : "#EDF3E8", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Welcome! Let's set up your envelopes.</div>
        <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 20 }}>This is your first time here. Choose how you want to set your monthly budget amounts.</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <button
            style={{ ...styles.button, padding: "18px 14px", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, textAlign: "left" }}
            onClick={() => setMode("auto")}
          >
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Fill automatically</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.9 }}>Enter your income and we suggest amounts for each envelope based on sensible percentages.</span>
          </button>
          <button
            style={{ ...styles.buttonGhost, padding: "18px 14px", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, borderWidth: 2, textAlign: "left" }}
            onClick={() => setMode("manual")}
          >
            <span style={{ fontSize: 20 }}>✏️</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Fill one by one</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: styles.textMuted }}>Go through each envelope and enter your own monthly budget amounts yourself.</span>
          </button>
        </div>
        <button style={{ ...styles.buttonGhost, fontSize: 12 }} onClick={onSkip}>Skip for now</button>
      </div>
    );
  }

  if (mode === "auto") {
    return (
      <div style={{ ...styles.card, borderColor: PALETTE.primary, background: styles.dark ? "#1A2A1A" : "#EDF3E8", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Fill automatically</div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 14 }}>Enter your monthly income. We will calculate suggested amounts for each envelope. You can adjust any of them before applying.</div>

        <div style={{ marginBottom: 14 }}>
          <div style={styles.label}>Monthly income ($)</div>
          <input
            style={styles.input} type="number" step="0.01" min="0" inputMode="decimal"
            placeholder="e.g. 8000" value={income} autoFocus
            onChange={(e) => { setIncome(e.target.value); applySuggestions(e.target.value); }}
          />
        </div>

        {parsedIncome > 0 && (
          <>
            <div style={{ maxHeight: 300, overflow: "auto", border: `1px solid ${styles.border}`, borderRadius: 8, marginBottom: 10 }}>
              {expCats.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: `1px solid ${styles.border}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {c.name}
                    {c.suggestedPct ? <span style={{ fontSize: 10, color: styles.textMuted }}> {c.suggestedPct}%</span> : null}
                  </span>
                  <input
                    style={{ ...styles.input, width: 88, textAlign: "right", padding: "4px 8px", fontSize: 13 }}
                    type="number" step="1" min="0"
                    value={autoAmounts[c.id] || ""}
                    onChange={(e) => setAutoAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              <span>Total allocated:</span>
              <span style={{ color: overBudget(autoTotal) ? "#DC2626" : PALETTE.primaryDeep }}>{fmtAUD(autoTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: styles.textMuted, marginBottom: 12 }}>
              <span>Monthly income:</span><span>{fmtAUD(parsedIncome)}</span>
            </div>
            {overBudget(autoTotal) && overBudgetBanner(autoTotal)}
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.button, flex: 1 }} onClick={() => onComplete(Object.fromEntries(expCats.map((c) => [c.id, parseFloat(autoAmounts[c.id]) || 0])))} disabled={parsedIncome <= 0 || overBudget(autoTotal)}>Apply</button>
          <button style={styles.buttonGhost} onClick={() => setMode(null)}>Back</button>
        </div>
      </div>
    );
  }

  if (mode === "manual") {
    const cur = expCats[step];
    const isLast = step === expCats.length - 1;
    return (
      <div style={{ ...styles.card, borderColor: PALETTE.primary, background: styles.dark ? "#1A2A1A" : "#EDF3E8", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Fill one by one</div>
          <div style={{ fontSize: 11, color: styles.textMuted }}>{step + 1} of {expCats.length}</div>
        </div>

        <div style={{ height: 4, background: styles.barTrack, borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ width: `${((step + 1) / expCats.length) * 100}%`, height: "100%", background: PALETTE.primary, borderRadius: 2, transition: "width .3s" }} />
        </div>

        {step === 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={styles.label}>Monthly income (optional)</div>
            <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" placeholder="e.g. 8000" value={income} onChange={(e) => setIncome(e.target.value)} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: cur.colour, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{cur.name}</span>
          {cur.isAccumulating && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: PALETTE.secondary + "55", color: PALETTE.primaryDeep, fontWeight: 700 }}>Saving</span>}
        </div>
        <div style={styles.label}>Monthly budget amount ($)</div>
        <input
          style={{ ...styles.input, marginBottom: 12 }}
          type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
          value={manualAmounts[cur.id] || ""} autoFocus
          onChange={(e) => setManualAmounts((prev) => ({ ...prev, [cur.id]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { isLast ? onComplete(Object.fromEntries(expCats.map((c) => [c.id, parseFloat(manualAmounts[c.id]) || 0]))) : setStep((s) => s + 1); } }}
        />

        {parsedIncome > 0 && (
          <div style={{ marginBottom: 10 }}>
            {overBudget(manualTotal) ? overBudgetBanner(manualTotal) : (
              <div style={{ fontSize: 12, color: styles.textMuted }}>
                Allocated so far: {fmtAUD(manualTotal)} of {fmtAUD(parsedIncome)}
                <span style={{ marginLeft: 6, color: PALETTE.primaryDeep }}> ({fmtAUD(parsedIncome - manualTotal)} remaining)</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && <button style={styles.buttonGhost} onClick={() => setStep((s) => s - 1)}>Back</button>}
          {!isLast && <button style={{ ...styles.button, flex: 1 }} onClick={() => setStep((s) => s + 1)}>Next</button>}
          {isLast && <button style={{ ...styles.button, flex: 1 }} onClick={() => onComplete(Object.fromEntries(expCats.map((c) => [c.id, parseFloat(manualAmounts[c.id]) || 0])))}>Finish</button>}
          {step === 0 && <button style={{ ...styles.buttonGhost, fontSize: 12 }} onClick={() => setMode(null)}>Mode</button>}
        </div>
      </div>
    );
  }
}

function SettingsModal({ user, users, setUsers, authToken, isAdmin, theme, setTheme, activeUserId, onShowWelcome, onResetBalances, onClose, styles }) {
  const [nameVal, setNameVal] = useState(user?.name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [newUserColour, setNewUserColour] = useState("#7FB069");
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserMsg, setAddUserMsg] = useState("");

  const mobile = styles.isMobile;
  const dark = styles.dark;

  const saveName = async () => {
    if (!nameVal.trim()) return;
    setNameLoading(true);
    setNameMsg("");
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: nameVal.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === activeUserId ? { ...u, name: nameVal.trim() } : u));
        setNameMsg("Name updated!");
      } else {
        setNameMsg(data.error || "Failed");
      }
    } catch { setNameMsg("Server unreachable — make sure both servers are running (npm start)."); }
    setNameLoading(false);
  };

  const savePwd = async () => {
    if (!newPwd || newPwd.length < 4) { setPwdMsg("New password must be at least 4 characters"); return; }
    setPwdLoading(true);
    setPwdMsg("");
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (res.ok) { setPwdMsg("Password changed!"); setCurPwd(""); setNewPwd(""); }
      else setPwdMsg(data.error || "Failed");
    } catch { setPwdMsg("Network error"); }
    setPwdLoading(false);
  };

  const addUser = async () => {
    if (!newUserName.trim()) return;
    setAddUserLoading(true);
    setAddUserMsg("");
    try {
      const res = await fetch("/api/admin/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: newUserName.trim(), role: newUserRole, colour: newUserColour }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => [...prev, data.user]);
        setNewUserName("");
        setAddUserMsg(`${data.user.name} added! They can sign in on the login page.`);
      } else {
        setAddUserMsg(data.error || "Failed");
      }
    } catch { setAddUserMsg("Server unreachable — make sure both servers are running (npm start)."); }
    setAddUserLoading(false);
  };

  const setUserRole = async (targetId, role) => {
    try {
      const res = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ targetUserId: targetId, role }),
      });
      if (res.ok) setUsers((prev) => prev.map((u) => u.id === targetId ? { ...u, role } : u));
    } catch {}
  };

  const COLOUR_OPTIONS = ["#7FB069", "#5F8A4F", "#6B9559", "#A0B894", "#9CA3AF", "#C27B3F", "#5B8DB8", "#B87BA0"];
  const sectionTitle = { fontSize: 11, fontWeight: 700, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10, marginTop: 22, paddingBottom: 4, borderBottom: `1px solid ${styles.border}` };
  const msgOk = (m) => m.includes("!");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }} onClick={onClose}>
      <div style={{ background: styles.surface, borderRadius: mobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: 480, maxHeight: mobile ? "92vh" : "88vh", overflow: "auto", padding: mobile ? "20px 16px 32px" : 28, boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,0.22)" }} onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Settings</div>
          <button style={{ ...styles.buttonGhost, padding: "6px 14px", fontSize: 13 }} onClick={onClose}>✕ Close</button>
        </div>
        <div style={{ fontSize: 10, color: styles.textMuted, marginBottom: 10 }}>Built {new Date(__BUILD_TIME__).toLocaleString()}</div>

        {/* About */}
        <div style={sectionTitle}>About BYB!</div>
        <button style={{ ...styles.buttonGhost, width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 8 }} onClick={onShowWelcome}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>View welcome message & getting started guide</span>
          <span style={{ display: "block", fontSize: 11, color: styles.textMuted, marginTop: 2 }}>Ban' Yuh Belly — the story behind the app</span>
        </button>

        {/* Profile */}
        <div style={sectionTitle}>Your profile</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ ...styles.avatarCircle(user || { colour: "#999", name: "?" }), width: 44, height: 44, fontSize: 18 }}>{user?.name?.[0] || "?"}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: styles.textMuted }}>{(user?.role === "owner" || user?.role === "admin") ? "Admin" : "Member"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...styles.input, flex: 1 }} value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="Display name" onKeyDown={(e) => { if (e.key === "Enter") saveName(); }} />
          <button style={{ ...styles.button, whiteSpace: "nowrap" }} onClick={saveName} disabled={nameLoading}>{nameLoading ? "…" : "Save name"}</button>
        </div>
        {nameMsg && <div style={{ fontSize: 12, color: msgOk(nameMsg) ? PALETTE.primaryDeep : "#DC2626", marginTop: 5 }}>{nameMsg}</div>}

        {/* Password */}
        <div style={sectionTitle}>Change password</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input style={styles.input} type="password" placeholder="Current password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} />
          <input style={styles.input} type="password" placeholder="New password (min 4 chars)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") savePwd(); }} />
          <button style={styles.button} onClick={savePwd} disabled={pwdLoading}>{pwdLoading ? "Saving…" : "Change password"}</button>
        </div>
        {pwdMsg && <div style={{ fontSize: 12, color: msgOk(pwdMsg) ? PALETTE.primaryDeep : "#DC2626", marginTop: 5 }}>{pwdMsg}</div>}

        {/* Appearance */}
        <div style={sectionTitle}>Appearance</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...(dark ? styles.button : styles.buttonGhost), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setTheme("dark")}>☾ Dark</button>
          <button style={{ ...(!dark ? styles.button : styles.buttonGhost), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setTheme("light")}>☀ Light</button>
        </div>

        {/* Admin: user management */}
        {isAdmin && (
          <>
            <div style={sectionTitle}>User management</div>
            <div style={{ marginBottom: 16 }}>
              {users.map((u) => {
                const isAdminUser = u.role === "owner" || u.role === "admin";
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${styles.border}` }}>
                    <div style={{ ...styles.avatarCircle(u), width: 32, height: 32, fontSize: 13 }}>{u.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}{u.id === activeUserId ? " (you)" : ""}</div>
                      <div style={{ fontSize: 11, color: styles.textMuted }}>{isAdminUser ? "Admin" : "Member"}</div>
                    </div>
                    {u.id !== activeUserId && (
                      <button style={{ ...styles.buttonGhost, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={() => setUserRole(u.id, isAdminUser ? "member" : "admin")}>
                        {isAdminUser ? "Remove admin" : "Make admin"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add new user</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input style={styles.input} placeholder="Name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
              <div>
                <div style={styles.label}>Colour</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COLOUR_OPTIONS.map((c) => (
                    <button key={c} onClick={() => setNewUserColour(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${c === newUserColour ? styles.text : "transparent"}`, cursor: "pointer", padding: 0, flexShrink: 0 }} />
                  ))}
                </div>
              </div>
              <select style={styles.input} value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button style={styles.button} onClick={addUser} disabled={addUserLoading || !newUserName.trim()}>{addUserLoading ? "Adding…" : "Add user"}</button>
            </div>
            {addUserMsg && <div style={{ fontSize: 12, color: msgOk(addUserMsg) ? PALETTE.primaryDeep : "#DC2626", marginTop: 5 }}>{addUserMsg}</div>}
          </>
        )}

        {/* Danger zone */}
        <div style={{ ...sectionTitle, color: PALETTE.warn, borderColor: PALETTE.warn + "55" }}>Danger zone</div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 10 }}>
          Reset all envelope and unallocated balances to zero. Transactions and history are not affected.
        </div>
        <button
          style={{ ...styles.buttonDanger, width: "100%", padding: "12px 14px", fontSize: 13, fontWeight: 600 }}
          onClick={() => {
            if (window.confirm("Reset ALL balances to zero?\n\nThis will clear every envelope balance and your unallocated amount. Your transaction history will not be affected. This cannot be undone.")) {
              onResetBalances();
              onClose();
            }
          }}
        >
          Reset all balances to zero
        </button>
      </div>
    </div>
  );
}

function NameSetupModal({ authToken, activeUserId, onComplete, onSkip, styles }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const mobile = styles.isMobile;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setErr("Please enter a name."); return; }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.ok) { onComplete(trimmed); }
      else { setErr(data.error || "Could not save name."); }
    } catch { setErr("Server unreachable — make sure both servers are running (npm start)."); }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }}>
      <div style={{ background: styles.surface, borderRadius: mobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: 420, padding: mobile ? "28px 20px 36px" : 40, boxSizing: "border-box", boxShadow: "0 8px 48px rgba(0,0,0,0.28)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.svg" alt="BYB!" style={{ width: 64, height: 64, borderRadius: "50%", background: PALETTE.secondary, padding: 6, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: PALETTE.primary }}>Welcome to BYB!</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: styles.text }}>What should we call you?</div>
        <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 16 }}>You can always change this later in Settings.</div>
        <input
          style={{ ...styles.input, marginBottom: 12 }}
          placeholder="Your name (e.g. Alex)"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        />
        {err && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.button, flex: 1, padding: 14, fontSize: 15 }} onClick={save} disabled={loading}>{loading ? "Saving…" : "Set my name"}</button>
          <button style={{ ...styles.buttonGhost }} onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [loginUsers, setLoginUsers] = useState(DEFAULT_USERS);
  const [selectedUserId, setSelectedUserId] = useState(DEFAULT_USERS[0].id);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  // Fetch actual users from server on mount; fall back to DEFAULT_USERS on error
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.users?.length) {
          setLoginUsers(data.users);
          if (!data.users.find((u) => u.id === selectedUserId)) {
            setSelectedUserId(data.users[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const selectedUser = loginUsers.find((u) => u.id === selectedUserId);

  const submit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        onLogin(data.userId, data.token);
      }
    } catch {
      setError("Could not reach the server. Make sure it is running (npm start).");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PALETTE.surfaceLightAlt, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", padding: 16, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.svg" alt="BYB!" style={{ width: 96, height: 96, borderRadius: "50%", background: PALETTE.secondary, padding: 8, objectFit: "contain", marginBottom: 16, filter: "drop-shadow(0 3px 12px rgba(0,0,0,0.13))" }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 28, fontWeight: 800, color: PALETTE.primary, letterSpacing: -0.5, lineHeight: 1.1 }}>BYB!</div>
          <div style={{ color: "#6B6F6B", fontSize: 14, marginTop: 5 }}>Ban' Yuh Belly Budgeting</div>
        </div>

        <form onSubmit={submit} style={{ background: PALETTE.surfaceLight, borderRadius: 16, padding: isMobile ? 24 : 36, boxShadow: "0 6px 32px rgba(0,0,0,0.09)", border: `1px solid ${PALETTE.border}` }}>
          {/* User selection */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6F6B", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>Who's signing in?</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {loginUsers.map((u) => (
                <button key={u.id} type="button" onClick={() => setSelectedUserId(u.id)}
                  style={{ flex: 1, padding: "16px 8px", borderRadius: 12, border: `2px solid ${u.id === selectedUserId ? PALETTE.primary : PALETTE.border}`, background: u.id === selectedUserId ? "#EDF1E8" : PALETTE.surfaceLight, color: PALETTE.textLight, fontWeight: u.id === selectedUserId ? 700 : 500, cursor: "pointer", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "border-color .15s, background .15s" }}>
                  <span style={{ width: 44, height: 44, borderRadius: "50%", background: u.colour, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>{u.name[0]}</span>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Password field */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6F6B", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
              style={{ width: "100%", padding: "13px 14px", borderRadius: 8, border: `1px solid ${PALETTE.border}`, fontSize: 16, boxSizing: "border-box", outline: "none", color: PALETTE.textLight, background: PALETTE.surfaceLight }}
            />
            <div style={{ fontSize: 11, color: "#6B6F6B", marginTop: 7 }}>First time signing in? Any password you enter will become your password.</div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 18 }}>{error}</div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: 15, borderRadius: 10, border: "none", background: PALETTE.primary, color: "#FFF", fontSize: 16, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.75 : 1, letterSpacing: 0.2 }}>
            {loading ? "Signing in…" : `Sign in as ${selectedUser?.name || ""}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BudgetApp({ onImport, onExport, onSave, onReload, initialData } = {}) {
  const initUsers = initialData?.users?.length ? initialData.users : DEFAULT_USERS;
  // Normalise categories: add envelope fields if missing (backward-compat migration)
  const rawCats = (initialData?.categories?.length ? initialData.categories : DEFAULT_CATEGORIES).map((c) => ({
    envelopeBalance: 0,
    isAccumulating: false,
    baseAmount: c.monthlyBudget || 0,
    ...c,
    // Force savings to always be accumulating and protected
    ...(c.id === SAVINGS_CAT.id ? { isAccumulating: true, protected: true } : {}),
  }));
  // Always ensure both protected categories exist
  let initCategories = rawCats;
  if (!initCategories.some((c) => c.id === INCIDENTALS_CAT.id)) initCategories = [...initCategories, INCIDENTALS_CAT];
  if (!initCategories.some((c) => c.id === SAVINGS_CAT.id)) initCategories = [...initCategories, SAVINGS_CAT];
  const initRecurring = initialData?.recurring?.length ? initialData.recurring : [];
  const initTransactions = initialData?.transactions?.length ? initialData.transactions : [];
  const initUnallocated = initialData?.unallocatedBalance || 0;

  // ALL hooks must come before any conditional return
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("byb_token") || "");
  const [users, setUsers] = useState(initUsers);
  const [activeUserId, setActiveUserId] = useState(() => {
    const stored = localStorage.getItem("byb_user");
    return stored && initUsers.find((u) => u.id === stored) ? stored : initUsers[0].id;
  });
  const [categories, setCategories] = useState(initCategories);
  const [unallocatedBalance, setUnallocatedBalance] = useState(initUnallocated);
  const [recurring, setRecurring] = useState(initRecurring);
  const [transactions, setTransactions] = useState(initTransactions);
  const [assets, setAssets] = useState(initialData?.assets?.length ? initialData.assets : []);
  const [transfers, setTransfers] = useState(initialData?.transfers?.length ? initialData.transfers : []);
  const [view, setView] = useState("dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("byb_theme") || "light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !localStorage.getItem("byb_welcomed"));
  const [showNamePrompt, setShowNamePrompt] = useState(() => {
    const token = localStorage.getItem("byb_token");
    const userId = localStorage.getItem("byb_user");
    if (!token || !userId) return false;
    if (localStorage.getItem(`byb_named_${userId}`)) return false;
    const user = initUsers.find((u) => u.id === userId);
    return user?.name === "User 1";
  });
  const [activeMonth, setActiveMonth] = useState(todayISO().slice(0, 7));
  const [txFilters, setTxFilters] = useState({ type: "all", categoryId: "all", addedBy: "all", search: "" });
  const [reportRange, setReportRange] = useState({ start: todayISO().slice(0, 4) + "-01-01", end: todayISO() });
  const [editingTx, setEditingTx] = useState(null);
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const isMobile = useIsMobile();

  const updateTheme = (t) => { setTheme(t); localStorage.setItem("byb_theme", t); };
  const styles = buildStyles(theme, isMobile);

  // Close all open forms when switching tabs; reset transaction filters on re-entry
  const handleSetView = (v) => {
    setView(v);
    if (v === "transactions") {
      setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "" });
    }
    setEditingTx(null);
    setTxFormOpen(false);
    setEditingCat(null);
    setCatFormOpen(false);
    setEditingRule(null);
    setRuleFormOpen(false);
  };

  // Navigate to Transactions tab filtered by category (sets filter AFTER handleSetView to override the reset)
  const navigateToCategory = (catId) => {
    handleSetView("transactions");
    setTxFilters({ type: "all", categoryId: catId, addedBy: "all", search: "" });
  };
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const handleLogin = async (userId, token) => {
    localStorage.setItem("byb_token", token);
    localStorage.setItem("byb_user", userId);
    setAuthToken(token);
    await onReload?.();
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem("byb_token");
    localStorage.removeItem("byb_user");
    setAuthToken("");
    await onReload?.();
  };

  // Show login page when not authenticated (after all hooks)
  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const persist = (patch) => onSave?.({ transactions, categories, recurring, users, unallocatedBalance, assets, transfers, ...patch });

  // Apply or reverse a transaction's effect on envelope balances + unallocated
  const applyTxEffect = (tx, factor, cats, unalloc) => {
    let newCats = cats;
    let newUnalloc = unalloc;
    if (tx.type === "expense") {
      newCats = cats.map((c) => c.id === tx.categoryId ? { ...c, envelopeBalance: (c.envelopeBalance || 0) - factor * tx.amount } : c);
    } else if (tx.type === "income") {
      newUnalloc = unalloc + factor * tx.amount;
    }
    return { newCats, newUnalloc };
  };

  const saveTx = (tx) => {
    let newTx;
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;

    if (tx.id) {
      const old = transactions.find((t) => t.id === tx.id);
      if (old) { const r = applyTxEffect(old, -1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; }
      const r2 = applyTxEffect(tx, 1, newCats, newUnalloc); newCats = r2.newCats; newUnalloc = r2.newUnalloc;
      newTx = transactions.map((t) => (t.id === tx.id ? { ...t, ...tx } : t));
      showToast("Transaction updated");
    } else {
      const r = applyTxEffect(tx, 1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc;
      // If income is allocated directly to a specific envelope, move it out of unallocated immediately
      if (tx.type === "income" && tx.allocatedEnvelopeId) {
        const allocAmt = Math.min(tx.amount, newUnalloc);
        newCats = newCats.map((c) => c.id === tx.allocatedEnvelopeId ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + allocAmt } : c);
        newUnalloc = newUnalloc - allocAmt;
      }
      const created = { ...tx, id: uid(), createdAt: new Date().toISOString(), isRecurring: false, recurringId: null };
      newTx = [created, ...transactions];
      showToast("Transaction added");
    }
    setTransactions(newTx);
    setCategories(newCats);
    setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
    setEditingTx(null);
    setTxFormOpen(false);
  };

  const deleteTx = (id) => {
    const tx = transactions.find((t) => t.id === id);
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    if (tx) { const r = applyTxEffect(tx, -1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; }
    const newTx = transactions.filter((t) => t.id !== id);
    setTransactions(newTx);
    setCategories(newCats);
    setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
    showToast("Transaction deleted");
  };

  const saveCat = (cat) => {
    let newCats;
    if (cat.id) {
      newCats = categories.map((c) => (c.id === cat.id ? { ...c, ...cat, monthlyBudget: cat.baseAmount || 0 } : c));
      showToast("Category updated");
    } else {
      newCats = [...categories, { envelopeBalance: 0, isAccumulating: false, ...cat, id: uid(), monthlyBudget: cat.baseAmount || 0 }];
      showToast("Category added");
    }
    setCategories(newCats);
    persist({ categories: newCats });
    setEditingCat(null);
    setCatFormOpen(false);
  };

  // Envelope actions — move money from unallocated into envelopes
  const fillEnvelope = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    const base = cat?.baseAmount || 0;
    if (!cat || base <= 0) { showToast("Set a base amount first"); return; }
    // Accumulating: always add full base. Non-accumulating: cap at base amount.
    const currentBalance = cat.envelopeBalance || 0;
    const amount = cat.isAccumulating ? base : Math.max(0, base - currentBalance);
    if (amount <= 0) { showToast(`${cat.name} is already full`); return; }
    const newCats = categories.map((c) => c.id === catId ? { ...c, envelopeBalance: currentBalance + amount } : c);
    const newUnalloc = unallocatedBalance - amount;
    setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`Filled ${cat.name} with ${fmtAUD(amount)}`);
  };

  const addToEnvelope = (catId, amount) => {
    const cat = categories.find((c) => c.id === catId);
    const newCats = categories.map((c) => c.id === catId ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + amount } : c);
    const newUnalloc = unallocatedBalance - amount;
    setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`Added ${fmtAUD(amount)} to ${cat?.name}`);
  };

  // Log a windfall income and allocate it directly to a specific envelope (net zero on unallocated)
  const addWindfallToEnvelope = (catId, amount, description) => {
    const cat = categories.find((c) => c.id === catId);
    const incomeCatId = categories.find((c) => c.type === "income")?.id || "c-other-in";
    const incomeTx = { id: uid(), date: todayISO(), amount, type: "income", categoryId: incomeCatId, description: description || "Windfall", isRecurring: false, recurringId: null, addedBy: activeUserId, createdAt: new Date().toISOString() };
    const newCats = categories.map((c) => c.id === catId ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + amount } : c);
    const newTx = [incomeTx, ...transactions];
    // unallocated is unchanged: income +amount then envelope allocation -amount = net 0
    setTransactions(newTx);
    setCategories(newCats);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance });
    showToast(`${fmtAUD(amount)} added to ${cat?.name}`);
  };

  const transferEnvelope = (fromId, toId, amount, description) => {
    const newCats = categories.map((c) => {
      if (c.id === fromId) return { ...c, envelopeBalance: (c.envelopeBalance || 0) - amount };
      if (c.id === toId) return { ...c, envelopeBalance: (c.envelopeBalance || 0) + amount };
      return c;
    });
    const log = { id: uid(), date: todayISO(), fromId, toId, amount, description: description || "", createdAt: new Date().toISOString() };
    const newTransfers = [log, ...transfers];
    setCategories(newCats);
    setTransfers(newTransfers);
    persist({ categories: newCats, transfers: newTransfers });
    showToast(`Transferred ${fmtAUD(amount)}`);
  };

  const fillAllEnvelopes = () => {
    const expCats = categories.filter((c) => c.type === "expense" && (c.baseAmount || 0) > 0);
    if (expCats.length === 0) { showToast("No envelopes with a base amount set"); return; }
    // Calculate fill amount for each: accumulating → full base, non-accumulating → cap at base
    const fills = expCats.map((c) => {
      const base = c.baseAmount || 0;
      const amount = c.isAccumulating ? base : Math.max(0, base - (c.envelopeBalance || 0));
      return { id: c.id, amount };
    });
    const total = fills.reduce((s, f) => s + f.amount, 0);
    if (total <= 0) { showToast("All envelopes are already full"); return; }
    const fillMap = Object.fromEntries(fills.map((f) => [f.id, f.amount]));
    const newCats = categories.map((c) => fillMap[c.id] != null
      ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + fillMap[c.id] }
      : c);
    const newUnalloc = unallocatedBalance - total;
    setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`Filled ${fills.filter((f) => f.amount > 0).length} envelopes · ${fmtAUD(total)} allocated`);
  };

  // Combined: log income transaction + fill envelope(s) in one step
  const fillWithIncome = (sourceId, incomeAmount, mode, catId) => {
    const incomeTx = { id: uid(), date: todayISO(), amount: incomeAmount, type: "income", categoryId: sourceId, description: "Income fill", isRecurring: false, recurringId: null, addedBy: activeUserId, createdAt: new Date().toISOString() };
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    // Add income to unallocated
    const r = applyTxEffect(incomeTx, 1, newCats, newUnalloc);
    newCats = r.newCats; newUnalloc = r.newUnalloc;
    const newTx = [incomeTx, ...transactions];

    if (mode === "single" && catId) {
      const cat = newCats.find((c) => c.id === catId);
      const base = cat?.baseAmount || 0;
      const currentBalance = cat?.envelopeBalance || 0;
      const amount = cat?.isAccumulating ? base : Math.max(0, base - currentBalance);
      if (amount > 0 && cat) {
        newCats = newCats.map((c) => c.id === catId ? { ...c, envelopeBalance: currentBalance + Math.min(amount, newUnalloc) } : c);
        newUnalloc = newUnalloc - Math.min(amount, newUnalloc);
      }
    } else if (mode === "all") {
      const expCats = newCats.filter((c) => c.type === "expense" && (c.baseAmount || 0) > 0);
      const fillAmounts = expCats.map((c) => {
        const base = c.baseAmount || 0;
        return { id: c.id, amount: c.isAccumulating ? base : Math.max(0, base - (c.envelopeBalance || 0)) };
      });
      let remaining = newUnalloc;
      const fillMap = {};
      fillAmounts.forEach((f) => { const used = Math.min(f.amount, remaining); fillMap[f.id] = used; remaining -= used; });
      newCats = newCats.map((c) => fillMap[c.id] != null ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + fillMap[c.id] } : c);
      newUnalloc = remaining;
    }

    setTransactions(newTx); setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`Income logged + envelopes filled`);
  };

  // Combined: log multiple income transactions + fill all envelopes in one step
  const fillAllWithMultipleIncome = (sources) => {
    // sources = [{ catId, amount }, ...]
    const validSources = sources.filter(({ amount }) => amount > 0);
    if (validSources.length === 0) { showToast("Enter at least one income amount"); return; }

    const totalIncome = validSources.reduce((s, { amount }) => s + amount, 0);

    // Pre-check: calculate net draw on existing unallocated (hard reset: non-savings → base, savings → +base)
    const expCats = categories.filter((c) => c.type === "expense" && (c.baseAmount || 0) > 0);
    const totalFillNeeded = expCats.reduce((s, c) => {
      const base = c.baseAmount || 0;
      return s + (c.isAccumulating ? base : (base - (c.envelopeBalance || 0)));
    }, 0);
    const netDraw = totalFillNeeded - totalIncome;
    if (netDraw > 0.01) {
      if (!window.confirm(`Filling all envelopes will draw ${fmtAUD(netDraw)} from your existing unallocated balance (${fmtAUD(unallocatedBalance)} available). Continue?`)) return;
    }

    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    const newIncomeTxs = [];
    validSources.forEach(({ catId, amount }) => {
      const incomeTx = { id: uid(), date: todayISO(), amount, type: "income", categoryId: catId, description: "Income fill", isRecurring: false, recurringId: null, addedBy: activeUserId, createdAt: new Date().toISOString() };
      newIncomeTxs.push(incomeTx);
      const r = applyTxEffect(incomeTx, 1, newCats, newUnalloc);
      newCats = r.newCats; newUnalloc = r.newUnalloc;
    });

    // Hard reset: non-savings → set balance to exactly base; savings → add base
    const fillMap = {};
    expCats.forEach((c) => {
      const base = c.baseAmount || 0;
      fillMap[c.id] = c.isAccumulating ? base : (base - (c.envelopeBalance || 0));
    });
    newCats = newCats.map((c) => fillMap[c.id] != null ? { ...c, envelopeBalance: (c.envelopeBalance || 0) + fillMap[c.id] } : c);
    newUnalloc = newUnalloc - Object.values(fillMap).reduce((s, a) => s + a, 0);

    const newTx = [...newIncomeTxs, ...transactions];
    setTransactions(newTx); setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`${fmtAUD(totalIncome)} income logged · envelopes filled`);
  };

  // First-time wizard: bulk set base amounts AND immediately fill envelopes
  const setupBaseAmounts = (amountsMap) => {
    const newCats = categories.map((c) =>
      amountsMap[c.id] !== undefined
        ? { ...c, baseAmount: amountsMap[c.id], monthlyBudget: amountsMap[c.id], envelopeBalance: amountsMap[c.id] }
        : c
    );
    setCategories(newCats);
    persist({ categories: newCats });
    showToast("Envelopes set up and filled! Your balances are ready to go.");
  };

  // End-of-month reconcile: pool non-savings surpluses, cover deficits, remainder to unallocated
  const reconcileEnvelopes = () => {
    const nonSavings = categories.filter((c) => c.type === "expense" && !c.isAccumulating);
    const hasActivity = nonSavings.some((c) => (c.envelopeBalance || 0) !== 0);
    if (!hasActivity) { showToast("Nothing to reconcile"); return; }

    // Step 1: pool all positive non-savings balances
    let pool = 0;
    const afterPool = categories.map((c) => {
      if (c.type === "expense" && !c.isAccumulating && (c.envelopeBalance || 0) > 0) {
        pool += c.envelopeBalance;
        return { ...c, envelopeBalance: 0 };
      }
      return c;
    });
    const totalPooled = pool;

    // Step 2: cover negatives most-negative first
    const negIds = afterPool
      .filter((c) => c.type === "expense" && !c.isAccumulating && (c.envelopeBalance || 0) < 0)
      .sort((a, b) => (a.envelopeBalance || 0) - (b.envelopeBalance || 0))
      .map((c) => c.id);

    let toppedUp = 0;
    let finalCats = [...afterPool];
    for (const id of negIds) {
      if (pool <= 0) break;
      const c = finalCats.find((x) => x.id === id);
      if (!c) continue;
      const deficit = -(c.envelopeBalance || 0);
      const use = Math.min(deficit, pool);
      pool -= use;
      if (use > 0) toppedUp++;
      finalCats = finalCats.map((x) => x.id === id ? { ...x, envelopeBalance: (x.envelopeBalance || 0) + use } : x);
    }

    const returned = pool;
    const newUnalloc = unallocatedBalance + returned;
    setCategories(finalCats);
    setUnallocatedBalance(newUnalloc);
    persist({ categories: finalCats, unallocatedBalance: newUnalloc });

    let msg = `${fmtAUD(totalPooled)} redistributed`;
    if (toppedUp > 0) msg += ` · ${toppedUp} envelope${toppedUp !== 1 ? "s" : ""} topped up`;
    if (returned > 0.01) msg += ` · ${fmtAUD(returned)} returned to unallocated`;
    showToast(msg);
  };

  const resetAllBalances = () => {
    const newCats = categories.map((c) => ({ ...c, envelopeBalance: 0 }));
    setCategories(newCats);
    setUnallocatedBalance(0);
    persist({ categories: newCats, unallocatedBalance: 0 });
    showToast("All balances reset to zero");
  };

  const reorderCategories = (newCats) => {
    setCategories(newCats);
    persist({ categories: newCats });
  };

  const setUnallocatedManually = (amount) => {
    setUnallocatedBalance(amount);
    persist({ unallocatedBalance: amount });
    showToast(`Unallocated set to ${fmtAUD(amount)}`);
  };

  const deleteCat = (id) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    if (cat.protected) { showToast(`"${cat.name}" is a protected envelope and cannot be deleted`); return; }
    const txCount = transactions.filter((t) => t.categoryId === id).length;
    const ruleCount = recurring.filter((r) => r.categoryId === id).length;
    const total = txCount + ruleCount;
    if (total > 0) {
      const confirmed = window.confirm(
        `${total} item(s) reference "${cat.name}" (${txCount} transaction(s), ${ruleCount} recurring rule(s)).\n\nThey will be reassigned to "Incidentals". Continue?`
      );
      if (!confirmed) return;
      // Ensure Incidentals exists in categories
      const hasIncidentals = categories.some((c) => c.id === INCIDENTALS_CAT.id);
      const catsWithIncidentals = hasIncidentals ? categories : [...categories, INCIDENTALS_CAT];
      const newTx = transactions.map((t) => t.categoryId === id ? { ...t, categoryId: INCIDENTALS_CAT.id } : t);
      const newRecurring = recurring.map((r) => r.categoryId === id ? { ...r, categoryId: INCIDENTALS_CAT.id } : r);
      const newCats = catsWithIncidentals.filter((c) => c.id !== id);
      setTransactions(newTx); setRecurring(newRecurring); setCategories(newCats);
      persist({ transactions: newTx, recurring: newRecurring, categories: newCats });
      showToast(`Deleted "${cat.name}" · ${total} item(s) moved to Incidentals`);
    } else {
      if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
      const newCats = categories.filter((c) => c.id !== id);
      setCategories(newCats);
      persist({ categories: newCats });
      showToast("Category deleted");
    }
  };

  const saveRule = (rule) => {
    let newRecurring;
    if (rule.id) {
      newRecurring = recurring.map((r) => (r.id === rule.id ? { ...r, ...rule } : r));
      showToast("Recurring rule updated");
    } else {
      newRecurring = [...recurring, { ...rule, id: uid() }];
      showToast("Recurring rule added");
    }
    setRecurring(newRecurring);
    persist({ recurring: newRecurring });
    setEditingRule(null);
    setRuleFormOpen(false);
  };

  const deleteRule = (id) => {
    const newRecurring = recurring.filter((r) => r.id !== id);
    setRecurring(newRecurring);
    persist({ recurring: newRecurring });
    showToast("Recurring rule deleted");
  };

  const saveAsset = (asset) => {
    let newAssets;
    if (asset.id) {
      newAssets = assets.map((a) => a.id === asset.id ? { ...a, ...asset } : a);
      showToast("Asset updated");
    } else {
      newAssets = [...assets, { ...asset, id: uid() }];
      showToast("Asset added");
    }
    setAssets(newAssets);
    persist({ assets: newAssets });
  };

  const deleteAsset = (id) => {
    const newAssets = assets.filter((a) => a.id !== id);
    setAssets(newAssets);
    persist({ assets: newAssets });
    showToast("Asset deleted");
  };

  const postDueRecurrences = () => {
    const due = recurring.filter((r) => r.nextDueDate <= todayISO());
    if (due.length === 0) return;
    const newPosted = due.map((r) => ({
      id: uid(), date: r.nextDueDate, amount: r.amount, type: r.type,
      categoryId: r.categoryId, description: r.label, isRecurring: true,
      recurringId: r.id, addedBy: r.addedBy, createdAt: new Date().toISOString(),
    }));
    const newTx = [...newPosted, ...transactions];
    const newRecurring = recurring.map((r) => r.nextDueDate <= todayISO() ? { ...r, nextDueDate: addPeriod(r.nextDueDate, r.frequency) } : r);
    let newCats = [...categories];
    let newUnalloc = unallocatedBalance;
    newPosted.forEach((tx) => { const r = applyTxEffect(tx, 1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; });
    setTransactions(newTx); setRecurring(newRecurring); setCategories(newCats); setUnallocatedBalance(newUnalloc);
    persist({ transactions: newTx, recurring: newRecurring, categories: newCats, unallocatedBalance: newUnalloc });
    showToast(`Posted ${due.length} recurring transaction(s)`);
  };

  const handleExport = () => {
    if (typeof onExport === "function") {
      onExport({ transactions, categories, users, recurring });
      showToast("Export started");
    } else {
      showToast("Export handler not wired");
    }
  };

  const importFromJSON = (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of transactions");
      const existing = new Set(transactions.map((t) => t.id));
      const incomeCatId = categories.find((c) => c.type === "income")?.id || "";
      const expenseCatId = categories.find((c) => c.type === "expense")?.id || "";
      const valid = parsed
        .filter((t) => t.date && t.amount)
        .map((t) => ({
          id: t.id || uid(),
          date: t.date,
          amount: Math.abs(parseFloat(t.amount) || 0),
          type: t.type === "income" ? "income" : "expense",
          categoryId: t.categoryId || (t.type === "income" ? incomeCatId : expenseCatId),
          description: t.description || "",
          isRecurring: false,
          recurringId: null,
          imported: true,
          addedBy: t.addedBy || activeUserId,
          createdAt: t.createdAt || new Date().toISOString(),
        }))
        .filter((t) => t.amount > 0 && !existing.has(t.id));
      if (valid.length === 0) { showToast("No new transactions found in the pasted data"); return false; }
      let newCats = [...categories];
      let newUnalloc = unallocatedBalance;
      valid.forEach((tx) => { const r = applyTxEffect(tx, 1, newCats, newUnalloc); newCats = r.newCats; newUnalloc = r.newUnalloc; });
      const newTx = [...valid, ...transactions];
      setTransactions(newTx); setCategories(newCats); setUnallocatedBalance(newUnalloc);
      persist({ transactions: newTx, categories: newCats, unallocatedBalance: newUnalloc });
      showToast(`Imported ${valid.length} transaction${valid.length !== 1 ? "s" : ""}`);
      return true;
    } catch (e) {
      showToast("Import failed: " + (e.message || "Invalid JSON"));
      return false;
    }
  };

  const handleImportFile = (file) => {
    if (typeof onImport !== "function") {
      showToast("Import handler not wired");
      return;
    }
    Promise.resolve(onImport(file, { categories, users })).then((result) => {
      if (result && Array.isArray(result.added)) {
        const existing = new Set(transactions.map((t) => t.id));
        const newRows = result.added.filter((t) => !existing.has(t.id));
        const merged = [...transactions, ...newRows];
        setTransactions(merged);
        persist({ transactions: merged });
        showToast(`Imported ${newRows.length} row(s)${result.skipped ? `, skipped ${result.skipped}` : ""}`);
      }
    }).catch(() => showToast("Import failed"));
  };

  const runningBalance = transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const lastUpdated = transactions.reduce((max, t) => (t.createdAt > max ? t.createdAt : max), "");

  // Generate months between two YYYY-MM strings inclusive
  const genMonthRange = (startMo, endMo) => {
    const months = [];
    let [y, m] = startMo.split("-").map(Number);
    const [ey, em] = endMo.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return months;
  };
  const todayMo = todayISO().slice(0, 7);
  const [ty] = todayMo.split("-").map(Number);
  const threeBack = `${ty - 3}-${todayMo.slice(5)}`;
  const oneAhead = `${ty + 1}-${todayMo.slice(5)}`;
  const earliestTxMo = transactions.length > 0
    ? transactions.reduce((min, t) => (monthKey(t.date) < min ? monthKey(t.date) : min), monthKey(transactions[0].date))
    : threeBack;
  const rangeStart = earliestTxMo < threeBack ? earliestTxMo : threeBack;
  const availableMonths = Array.from(new Set([...genMonthRange(rangeStart, oneAhead), ...transactions.map((t) => monthKey(t.date)), activeMonth])).sort().reverse();
  const dueCount = recurring.filter((r) => r.nextDueDate <= todayISO()).length;
  const activeUser = usersById[activeUserId];

  return (
    <div style={styles.app}>
      <Sidebar view={view} setView={handleSetView} dueCount={dueCount} styles={styles} />
      <div style={styles.main}>
        <Header
          view={view}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          availableMonths={availableMonths}
          users={users}
          activeUserId={activeUserId}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          styles={styles}
        />
        <div style={styles.content}>
          {view === "dashboard" && (
            <Dashboard
              activeMonth={activeMonth}
              transactions={transactions}
              categories={categories}
              usersById={usersById}
              categoriesById={categoriesById}
              recurring={recurring}
              styles={styles}
              unallocatedBalance={unallocatedBalance}
              onTransferEnvelope={transferEnvelope}
              onFillWithIncome={fillWithIncome}
              onAddTx={saveTx}
              activeUserId={activeUserId}
              txFormOpen={txFormOpen}
              setTxFormOpen={setTxFormOpen}
              setEditingTx={setEditingTx}
              onReconcile={reconcileEnvelopes}
              onNavigateToCategory={navigateToCategory}
            />
          )}
          {view === "transactions" && (
            <TransactionsView
              transactions={transactions}
              categories={categories}
              users={users}
              categoriesById={categoriesById}
              usersById={usersById}
              activeMonth={activeMonth}
              activeUserId={activeUserId}
              txFilters={txFilters}
              setTxFilters={setTxFilters}
              editingTx={editingTx}
              setEditingTx={setEditingTx}
              txFormOpen={txFormOpen}
              setTxFormOpen={setTxFormOpen}
              saveTx={saveTx}
              deleteTx={deleteTx}
              onTransferEnvelope={transferEnvelope}
              handleImportFile={handleImportFile}
              handleExport={handleExport}
              onAddWindfall={addWindfallToEnvelope}
              styles={styles}
            />
          )}
          {view === "categories" && (
            <EnvelopesView
              categories={categories}
              editingCat={editingCat}
              setEditingCat={setEditingCat}
              catFormOpen={catFormOpen}
              setCatFormOpen={setCatFormOpen}
              saveCat={saveCat}
              deleteCat={deleteCat}
              unallocatedBalance={unallocatedBalance}
              onFillWithIncome={fillAllWithMultipleIncome}
              onFillSingleEnvelope={fillEnvelope}
              onSetupBaseAmounts={setupBaseAmounts}
              recurring={recurring}
              onReorderCats={reorderCategories}
              styles={styles}
            />
          )}
          {view === "recurring" && (
            <RecurringView
              recurring={recurring}
              categories={categories}
              users={users}
              categoriesById={categoriesById}
              activeUserId={activeUserId}
              editingRule={editingRule}
              setEditingRule={setEditingRule}
              ruleFormOpen={ruleFormOpen}
              setRuleFormOpen={setRuleFormOpen}
              saveRule={saveRule}
              deleteRule={deleteRule}
              postDueRecurrences={postDueRecurrences}
              styles={styles}
            />
          )}
          {view === "reports" && (
            <ReportsView
              transactions={transactions}
              categories={categories}
              categoriesById={categoriesById}
              reportRange={reportRange}
              setReportRange={setReportRange}
              handleExport={handleExport}
              assets={assets}
              onSaveAsset={saveAsset}
              onDeleteAsset={deleteAsset}
              transfers={transfers}
              unallocatedBalance={unallocatedBalance}
              onSetUnallocated={setUnallocatedManually}
              onImportJSON={importFromJSON}
              styles={styles}
            />
          )}
        </div>
        <div style={styles.footer}>
          <span>Running balance: <strong style={{ color: runningBalance >= 0 ? PALETTE.primaryDeep : PALETTE.warn }} data-testid="running-balance">{fmtAUD(runningBalance)}</strong></span>
          <span style={{ fontSize: 11, color: styles.textMuted, textAlign: "center" }}>BYB! is for personal use only — not financial advice. Use at your own risk.</span>
          <span>Active: {activeUser?.name}{lastUpdated ? ` · last updated ${lastUpdated.slice(0, 10)}` : ""}</span>
        </div>
      </div>
      {settingsOpen && (
        <SettingsModal
          user={usersById[activeUserId]}
          users={users}
          setUsers={setUsers}
          authToken={authToken}
          isAdmin={activeUser?.role === "owner" || activeUser?.role === "admin"}
          theme={theme}
          setTheme={updateTheme}
          activeUserId={activeUserId}
          onShowWelcome={() => { setSettingsOpen(false); setWelcomeOpen(true); }}
          onResetBalances={resetAllBalances}
          onClose={() => setSettingsOpen(false)}
          styles={styles}
        />
      )}
      {showNamePrompt && (
        <NameSetupModal
          authToken={authToken}
          activeUserId={activeUserId}
          onComplete={(newName) => {
            setUsers((prev) => prev.map((u) => u.id === activeUserId ? { ...u, name: newName } : u));
            localStorage.setItem(`byb_named_${activeUserId}`, "1");
            setShowNamePrompt(false);
          }}
          onSkip={() => {
            localStorage.setItem(`byb_named_${activeUserId}`, "1");
            setShowNamePrompt(false);
          }}
          styles={styles}
        />
      )}
      {welcomeOpen && !showNamePrompt && (
        <WelcomeModal
          onClose={() => { setWelcomeOpen(false); localStorage.setItem("byb_welcomed", "1"); }}
          styles={styles}
        />
      )}
      {toast && <div style={styles.toast} data-testid="toast">{toast}</div>}
    </div>
  );
}
