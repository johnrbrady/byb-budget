import React, { useState, useEffect } from "react";
import { PALETTE, DEFAULT_USERS } from "../lib/constants.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

export function LoginPage({ onLogin }) {
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
      <div className="byb-view" style={{ width: "100%", maxWidth: 420 }}>
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="BYB!" style={{ width: 96, height: 96, borderRadius: "50%", background: "#FFF", objectFit: "contain", marginBottom: 16, filter: "drop-shadow(0 3px 12px rgba(0,0,0,0.13))" }} onError={(e) => { e.target.style.display = "none"; }} />
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
            <div style={{ fontSize: 11, color: "#6B6F6B", marginTop: 7 }}>Use the temporary password your admin gave you. On a brand-new household, the sole owner creates the first password here (minimum 8 characters).</div>
          </div>

          {/* Error */}
          {error && (
            <div className="byb-panel" style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 18 }}>{error}</div>
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
