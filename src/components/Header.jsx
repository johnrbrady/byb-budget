import React from "react";
import { PALETTE, VIEW_TITLES } from "../lib/constants.js";
import { formatMonth, formatMonthShort } from "../lib/utils.js";
import { IconLogout } from "./Icons.jsx";

export function Header({ view, activeMonth, setActiveMonth, availableMonths, users, activeUserId, onOpenSettings, onLogout, styles }) {
  const mobile = styles.isMobile;
  const activeUser = users.find((u) => u.id === activeUserId);
  return (
    <div style={styles.header}>
      <div style={styles.viewTitle}>
        {mobile && (
          <img src="/logo.png" alt="BYB!" style={{ width: 28, height: 28, borderRadius: "50%", background: "#FFF", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
        )}
        <span>{VIEW_TITLES[view]}</span>
      </div>
      <div style={styles.headerRight}>
        <select style={styles.monthSelect} value={activeMonth} onChange={(e) => setActiveMonth(e.target.value)} data-testid="month-select" aria-label="Active month">
          {availableMonths.map((m) => <option key={m} value={m}>{mobile ? formatMonthShort(m) : formatMonth(m)}</option>)}
        </select>
        {/* Avatar button — opens settings modal */}
        {activeUser && (
          <button
            onClick={onOpenSettings}
            title={`${activeUser.name} — Settings`}
            style={{ ...styles.avatarCircle(activeUser), fontSize: 13, border: "none", cursor: "pointer", outline: "none", position: "relative" }}
            data-testid="settings-btn"
            aria-label="Settings"
          >
            {activeUser.name[0]}
          </button>
        )}
        {onLogout && (
          <button
            style={{ padding: mobile ? "7px 9px" : "6px 12px", borderRadius: 6, border: `1px solid ${PALETTE.warn}`, background: "transparent", color: PALETTE.warn, fontSize: mobile ? 11 : 12, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <IconLogout size={14} />
            {!mobile && "Sign out"}
          </button>
        )}
      </div>
    </div>
  );
}
