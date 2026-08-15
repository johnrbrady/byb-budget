import React from "react";

// An empty list said properly: what is missing, and what to do about it.
//
// Every empty state in the app was one muted sentence sitting where a list
// should be, which reads as something failing to load rather than as a place
// waiting to be filled. All the styling is in global.css (.byb-empty) so the
// spacing and the muted tone come from the tokens like everything else.
export function EmptyState({ icon: Icon, title, hint, action, styles }) {
  return (
    <div className="byb-empty" data-testid="empty-state">
      {Icon && (
        <span className="byb-empty-icon">
          <Icon size={20} />
        </span>
      )}
      <span className="byb-empty-title">{title}</span>
      {hint && <span className="byb-empty-hint">{hint}</span>}
      {action && (
        <button style={{ ...styles.buttonGhost, marginTop: "var(--byb-space-2)" }} onClick={action.onSelect}>
          {action.label}
        </button>
      )}
    </div>
  );
}
