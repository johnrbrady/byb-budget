import React, { useState, useEffect } from "react";
import { PALETTE } from "../lib/constants.js";

// Promise-based replacement for window.confirm. Render <ConfirmHost/> once at
// the app root, then call askConfirm({...}) from anywhere:
//
//   const ok = await askConfirm({ title: "Delete?", message: "...", confirmLabel: "Delete", danger: true });
//
// Resolves true on confirm, false on cancel/dismiss.

let hostSetter = null;

export function askConfirm(opts) {
  if (!hostSetter) {
    // Host not mounted (e.g. tests) — fall back to native confirm
    return Promise.resolve(window.confirm(opts.message || opts.title || "Are you sure?"));
  }
  return new Promise((resolve) => {
    hostSetter({ ...opts, resolve });
  });
}

export function ConfirmHost({ styles }) {
  const [req, setReq] = useState(null);

  useEffect(() => {
    hostSetter = setReq;
    return () => { hostSetter = null; };
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!req) return null;

  const close = (result) => {
    req.resolve(result);
    setReq(null);
  };

  const mobile = styles.isMobile;
  const accent = req.danger ? PALETTE.danger : PALETTE.primary;

  return (
    <div
      className="byb-overlay"
      style={{ position: "fixed", inset: 0, background: "var(--byb-overlay)", zIndex: 500, display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 16 }}
      onClick={() => close(false)}
    >
      <div
        className={mobile ? "byb-sheet" : "byb-modal"}
        role="alertdialog"
        aria-modal="true"
        style={{ background: styles.surface, color: styles.text, borderRadius: mobile ? "16px 16px 0 0" : 14, width: "100%", maxWidth: 400, padding: mobile ? "24px 20px 32px" : 28, boxSizing: "border-box", boxShadow: "var(--byb-shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {req.title && <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{req.title}</div>}
        {req.message && <div style={{ fontSize: 14, color: styles.textMuted, lineHeight: 1.6, marginBottom: 22, whiteSpace: "pre-line" }}>{req.message}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{ ...styles.buttonGhost, flex: 1, justifyContent: "center", textAlign: "center" }}
            onClick={() => close(false)}
            autoFocus={!req.danger}
          >
            {req.cancelLabel || "Cancel"}
          </button>
          <button
            style={{ ...styles.button, flex: 1, background: accent, textAlign: "center" }}
            onClick={() => close(true)}
            data-testid="confirm-ok"
          >
            {req.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
