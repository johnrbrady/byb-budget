import React, { useState } from "react";
import { PALETTE } from "../lib/constants.js";
import { askConfirm } from "./ConfirmDialog.jsx";
import { IconMoon, IconSun, IconClose } from "./Icons.jsx";

export function WelcomeModal({ onClose, styles }) {
  const mobile = styles.isMobile;
  const p = { marginBottom: 14, lineHeight: 1.8 };
  return (
    <div className="byb-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }}>
      <div className={mobile ? "byb-sheet" : "byb-modal"} style={{ background: styles.surface, borderRadius: mobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: 560, maxHeight: mobile ? "93vh" : "90vh", overflow: "auto", padding: mobile ? "24px 18px 36px" : 40, boxSizing: "border-box", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>

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
            <li><strong>Log your money in</strong> — Use Add Income on the Dashboard whenever money lands. Pick the stream it came from (or create a new one on the spot), then choose whether it stays unallocated, fills your envelopes, or goes straight to specific ones.</li>
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

export function SettingsModal({ user, users, setUsers, authToken, isAdmin, theme, setTheme, activeUserId, onShowWelcome, onResetBalances, onClose, styles }) {
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
    <div className="byb-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }} onClick={onClose}>
      <div className={mobile ? "byb-sheet" : "byb-modal"} style={{ background: styles.surface, borderRadius: mobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: 480, maxHeight: mobile ? "92vh" : "88vh", overflow: "auto", padding: mobile ? "20px 16px 32px" : 28, boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,0.22)" }} onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Settings</div>
          <button style={{ ...styles.buttonGhost, padding: "6px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }} onClick={onClose}><IconClose size={14} /> Close</button>
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
          <button style={{ ...(dark ? styles.button : styles.buttonGhost), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setTheme("dark")}><IconMoon size={15} /> Dark</button>
          <button style={{ ...(!dark ? styles.button : styles.buttonGhost), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setTheme("light")}><IconSun size={15} /> Light</button>
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
                    <button key={c} onClick={() => setNewUserColour(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${c === newUserColour ? styles.text : "transparent"}`, cursor: "pointer", padding: 0, flexShrink: 0 }} aria-label={`Colour ${c}`} />
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
          onClick={async () => {
            const ok = await askConfirm({
              title: "Reset all balances to zero?",
              message: "This will clear every envelope balance and your unallocated amount. Your transaction history will not be affected. This cannot be undone.",
              confirmLabel: "Reset balances",
              danger: true,
            });
            if (ok) {
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

export function NameSetupModal({ authToken, activeUserId, onComplete, onSkip, styles }) {
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
    <div className="byb-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }}>
      <div className={mobile ? "byb-sheet" : "byb-modal"} style={{ background: styles.surface, borderRadius: mobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: 420, padding: mobile ? "28px 20px 36px" : 40, boxSizing: "border-box", boxShadow: "0 8px 48px rgba(0,0,0,0.28)" }}>
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
