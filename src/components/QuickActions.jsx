import React from "react";
import { PALETTE } from "../lib/constants.js";
import { Sheet } from "./Sheet.jsx";

// Bottom-sheet quick-action menu, opened by long-press gestures.
// actions: [{ label, sub, icon: Component, onSelect, danger }]
export function QuickActionsSheet({ title, actions, onClose, styles }) {
  return (
    <Sheet title={title} onClose={onClose} styles={styles}>
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
    </Sheet>
  );
}
