import React from "react";
import { PALETTE, VIEW_TITLES } from "../lib/constants.js";
import { NAV_ICONS } from "./Icons.jsx";

const ITEMS = [
  { id: "dashboard", label: "Dashboard", short: "Home" },
  { id: "transactions", label: "Transactions", short: "Recent" },
  { id: "categories", label: "Envelopes", short: "Env" },
  { id: "recurring", label: "Recurring", short: "Bills" },
  { id: "reports", label: "Reports", short: "Reports" },
];

export function Sidebar({ view, setView, dueCount, styles }) {
  const mobile = styles.isMobile;
  return (
    <nav style={styles.sidebar} data-testid="sidebar">
      <div style={styles.brand}>
        <img src="/logo.png" alt="Ban' Yuh Belly Budgeting" style={styles.brandLogo} onError={(e) => { e.target.style.display = "none"; }} />
        <div style={styles.brandText}>
          <span style={styles.brandTitle}>BYB!</span>
          <span style={styles.brandSubtitle}>Ban' Yuh Belly</span>
        </div>
      </div>
      {ITEMS.map((it) => {
        const active = view === it.id;
        const badge = it.id === "recurring" && dueCount > 0;
        const Icon = NAV_ICONS[it.id];
        return (
          <div
            key={it.id}
            className="byb-nav-item"
            style={styles.navItem(active)}
            onClick={() => setView(it.id)}
            data-testid={`nav-${it.id}`}
            role="button"
            aria-label={VIEW_TITLES[it.id]}
            aria-current={active ? "page" : undefined}
          >
            {mobile ? (
              <span style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <Icon size={22} style={{ opacity: active ? 1 : 0.55, transition: "opacity .15s" }} />
                <span style={{ fontSize: 10, lineHeight: 1 }}>{it.short}</span>
                {badge && (
                  <span style={{ position: "absolute", top: -4, right: -10, fontSize: 9, background: PALETTE.primary, color: "#FFF", borderRadius: 10, padding: "1px 5px", fontWeight: 600, lineHeight: 1.2 }}>{dueCount}</span>
                )}
              </span>
            ) : (
              <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={17} style={{ opacity: active ? 1 : 0.7 }} />
                {it.label}
                {badge && (
                  <span style={{ marginLeft: 2, fontSize: 11, background: PALETTE.primary, color: "#FFF", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>{dueCount}</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
