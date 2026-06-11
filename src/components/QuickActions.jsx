import React from "react";
import { PALETTE } from "../lib/constants.js";

// Bottom-sheet quick-action menu, opened by long-press gestures.
// actions: [{ label, sub, icon: Component, onSelect, danger }]
export function QuickActionsSheet({ title, actions, onClose, styles }) {
  return (
    <div className="byb-overlay" style={{ position: "fixed", inset: 0, background: "var(--byb-overlay)", zIndex: 350, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div className="byb-sheet" style={{ background: styles.surface, borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: "14px 14px calc(20px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box", boxShadow: "var(--byb-shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: styles.border, margin: "0 auto 12px" }} />
        {title && <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, padding: "0 6px", color: styles.text }}>{title}</div>}
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                padding: "13px 12px", borderRadius: 10, border: "none", background: "transparent",
                color: a.danger ? PALETTE.danger : styles.text, fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}
              onClick={() => { onClose(); a.onSelect(); }}
            >
              {Icon && <Icon size={19} style={{ flexShrink: 0, opacity: 0.85 }} />}
              <span style={{ flex: 1 }}>
                {a.label}
                {a.sub && <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: styles.textMuted, marginTop: 1 }}>{a.sub}</span>}
              </span>
            </button>
          );
        })}
        <button style={{ ...styles.buttonGhost, width: "100%", marginTop: 8, textAlign: "center" }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
