import React from "react";

// The app's bottom sheet: a panel that comes up from the bottom edge over
// whatever is on screen, dismissed by tapping the ground behind it.
//
// It is one component rather than one per caller so the chrome — the ground, the
// grab handle, the radius, the safe-area padding, the byb-sheet-in animation in
// global.css — is decided in a single place. A second hand-rolled sheet is how
// two things that should look identical drift apart.
//
// `data-swipe-ignore` is what stops the tab swipe firing from a sheet: the
// ground covers the screen, so useSwipeNavigation sees the attribute on
// whatever the finger lands on and leaves the gesture alone. A sheet is a modal;
// swiping one must not change the tab underneath it.
export function Sheet({ title, onClose, styles, testId, children }) {
  return (
    <div
      className="byb-overlay"
      data-swipe-ignore
      data-testid={testId}
      style={{ position: "fixed", inset: 0, background: "var(--byb-overlay)", zIndex: 350, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        className="byb-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ background: styles.surface, borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: "14px 14px calc(20px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box", boxShadow: "var(--byb-shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: styles.border, margin: "0 auto 12px" }} />
        {title && <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, padding: "0 6px", color: styles.text }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
