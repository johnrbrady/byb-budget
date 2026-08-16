// Where an envelope stands against the amount it is meant to hold.
//
// Presentation only. It classifies a balance that lib/money.js has already
// worked out and computes nothing itself — no rounding, no arithmetic on money
// beyond the ratio used to draw a bar.
//
// It lives in one place because the same three-way split is drawn on both the
// Dashboard row and the Envelopes card, and the two had already been written
// out separately. One definition means they cannot disagree about whether an
// envelope is running low.
//
// The three colours are deliberately not the brand green: #7FB069 is the app's
// identity and appears on the logo, the primary button and the active tab, so
// using it to mean "healthy" as well left the user unable to tell decoration
// from a statement about their money.

export const STATUS_OK = "ok";       // holding what it should
export const STATUS_LOW = "low";     // under a fifth of its base left
export const STATUS_OVER = "over";   // overdrawn

export function envelopeStatus(balance, base) {
  if (balance < 0) return STATUS_OVER;
  if (base > 0 && balance * 5 < base) return STATUS_LOW;
  return STATUS_OK;
}

// Token lookups, so a status never resolves to a literal colour in a component.
export const statusColour = (status) => `var(--byb-${status})`;
export const statusSoft = (status) => `var(--byb-${status}-soft)`;

// How full to draw the meter. Clamped: an envelope holding more than its base
// is full, not overflowing off the end of the bar.
export function fillFraction(balance, base) {
  if (!(base > 0)) return 0;
  return Math.min(1, Math.max(0, balance / base));
}

export const STATUS_LABEL = {
  [STATUS_OK]: "On track",
  [STATUS_LOW]: "Running low",
  [STATUS_OVER]: "Overspent",
};
