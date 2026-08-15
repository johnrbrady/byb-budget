// Layout composed from the design tokens in global.css.
//
// Every colour, space, radius, shadow and type size here is a `var(--byb-*)`.
// Nothing in this file invents a value: if a number needs changing it changes
// in one place, for both themes, and the CSS-only surfaces (hover, focus,
// sticky offsets, animations) move with it because they read the same token.
//
// `isMobile` is down to the decisions that genuinely change the structure of
// the page — a rail becomes a bottom bar, a row becomes a column, a footer goes
// away. Everything that is merely the same decision at two sizes (gutters, tap
// targets, control padding, the two type steps that shrink) is a token with a
// breakpoint, so it cannot drift out of step with the CSS.

const T = {
  primary: "var(--byb-primary)",
  secondary: "var(--byb-secondary)",
  primaryTint: "var(--byb-primary-tint)",
  warn: "var(--byb-warn)",

  surface: "var(--byb-surface)",
  surfaceAlt: "var(--byb-surface-alt)",
  text: "var(--byb-text)",
  textMuted: "var(--byb-text-muted)",
  border: "var(--byb-border)",
  inverseSurface: "var(--byb-inverse-surface)",
  inverseText: "var(--byb-inverse-text)",

  elev1: "var(--byb-elev-1)",
  elev2: "var(--byb-elev-2)",
  elev3: "var(--byb-elev-3)",

  radiusSm: "var(--byb-radius-sm)",
  radius: "var(--byb-radius)",
  pill: "var(--byb-radius-pill)",

  font: "var(--byb-font)",
  text2xs: "var(--byb-text-2xs)",
  textXs: "var(--byb-text-xs)",
  textSm: "var(--byb-text-sm)",
  textMd: "var(--byb-text-md)",
  textLg: "var(--byb-text-lg)",
  textBase: "var(--byb-text-base)",
  text2xl: "var(--byb-text-2xl)",

  gutter: "var(--byb-gutter)",
  contentPad: "var(--byb-content-pad)",
  cardPad: "var(--byb-card-pad)",
  tapMin: "var(--byb-tap-min)",
  btnPad: "var(--byb-btn-pad)",
  btnGhostPad: "var(--byb-btn-ghost-pad)",
  inputPad: "var(--byb-input-pad)",
  inputText: "var(--byb-input-text)",
  viewTitle: "var(--byb-view-title)",
  kpiText: "var(--byb-kpi-text)",
  headerH: "var(--byb-header-h)",
};

// The bottom nav is positioned against in JS (`calc` with a safe-area inset),
// so its height is needed as a number as well as a token.
const BOTTOM_NAV_H = 64;

export function buildStyles(theme, isMobile = false) {
  const dark = theme === "dark";
  return {
    // Values views read directly. They are tokens now, so a view that spreads
    // one into an inline style gets the themed value without knowing the theme.
    dark,
    isMobile,
    surface: T.surface,
    surfaceAlt: T.surfaceAlt,
    text: T.text,
    textMuted: T.textMuted,
    border: T.border,
    barTrack: "var(--byb-bar-track)",

    app: { display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", fontFamily: T.font, background: T.surface, color: T.text, fontSize: T.textBase, lineHeight: 1.5 },
    sidebar: isMobile
      ? { position: "fixed", bottom: 0, left: 0, right: 0, height: BOTTOM_NAV_H, background: T.surfaceAlt, borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "row", justifyContent: "space-around", alignItems: "stretch", zIndex: 20, paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: T.elev2 }
      : { width: 220, background: T.surfaceAlt, borderRight: `1px solid ${T.border}`, padding: "var(--byb-space-6) 0", display: "flex", flexDirection: "column", gap: "var(--byb-space-1)", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", alignSelf: "flex-start" },
    brand: isMobile
      ? { display: "none" }
      : { padding: "0 var(--byb-space-5) var(--byb-space-6)", fontWeight: 700, fontSize: T.textBase, letterSpacing: -0.2, display: "flex", alignItems: "center", gap: "var(--byb-space-2)", lineHeight: 1.15 },
    brandLogo: { width: 40, height: 40, borderRadius: T.pill, background: T.secondary, padding: 4, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(24,32,22,0.12))" },
    brandText: { display: "flex", flexDirection: "column", gap: 2 },
    brandTitle: { color: T.primary, fontWeight: 800, fontSize: T.textLg, letterSpacing: 0.3, textTransform: "uppercase" },
    brandSubtitle: { color: T.textMuted, fontWeight: 500, fontSize: T.text2xs, letterSpacing: 0.5, textTransform: "uppercase" },
    navItem: (active) => isMobile
      ? { flex: 1, padding: "var(--byb-space-2) var(--byb-space-1)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderTop: `3px solid ${active ? T.primary : "transparent"}`, fontWeight: active ? 600 : 500, color: active ? T.text : T.textMuted, fontSize: T.textXs, textAlign: "center", userSelect: "none", WebkitTapHighlightColor: "transparent" }
      : { padding: "10px var(--byb-space-6)", cursor: "pointer", display: "flex", alignItems: "center", gap: "var(--byb-space-2)", borderLeft: `3px solid ${active ? T.primary : "transparent"}`, fontWeight: active ? 600 : 500, color: active ? T.text : T.textMuted, background: active ? T.primaryTint : "transparent" },
    main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, paddingBottom: isMobile ? BOTTOM_NAV_H : 0 },
    // Fixed height, so --byb-header-h is what the header actually is and the
    // sticky month headings underneath it can trust the number.
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", height: T.headerH, boxSizing: "border-box", padding: `0 ${T.gutter}`, borderBottom: `1px solid ${T.border}`, background: T.surface, position: "sticky", top: 0, zIndex: 10, gap: "var(--byb-space-2)" },
    viewTitle: { fontSize: T.viewTitle, fontWeight: 700, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: "var(--byb-space-2)", minWidth: 0 },
    headerRight: { display: "flex", alignItems: "center", gap: isMobile ? "var(--byb-space-2)" : "var(--byb-space-4)", flexShrink: 0 },
    monthSelect: { padding: "var(--byb-space-1) var(--byb-space-2)", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: T.textMd, cursor: "pointer", maxWidth: isMobile ? 130 : "none" },
    avatarCircle: (u) => ({ width: 28, height: 28, borderRadius: T.pill, background: u.colour, color: "#FFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: T.textSm, fontWeight: 600 }),
    userSwitcher: { display: "flex", gap: "var(--byb-space-1)" },
    themeBtn: { padding: "var(--byb-space-1) var(--byb-space-3)", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "transparent", color: T.text, fontSize: T.textMd, cursor: "pointer" },
    content: {
      flex: 1, padding: T.contentPad, maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box",
      // Vertical scrolling stays native and smooth while the horizontal axis is
      // left to the tab swipe. React attaches touchmove passively, so
      // preventDefault is not available to hold the axis — this is.
      touchAction: "pan-y",
    },
    footer: isMobile
      ? { display: "none" }
      : { padding: `var(--byb-space-3) ${T.gutter}`, borderTop: `1px solid ${T.border}`, fontSize: T.textSm, color: T.textMuted, display: "flex", justifyContent: "space-between" },
    card: { background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: T.cardPad, boxShadow: T.elev1 },
    kpiValue: { fontSize: T.kpiText, fontWeight: 700, letterSpacing: -0.5, marginTop: "var(--byb-space-1)" },
    kpiLabel: { fontSize: T.textSm, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
    sectionTitle: { fontSize: T.textLg, fontWeight: 600, margin: isMobile ? "var(--byb-space-5) 0 10px" : "var(--byb-space-7) 0 var(--byb-space-3)", textTransform: "uppercase", letterSpacing: 0.6, color: T.textMuted },
    button: { padding: T.btnPad, borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#FFF", fontWeight: 600, cursor: "pointer", fontSize: T.inputText, minHeight: T.tapMin, boxShadow: T.elev1 },
    buttonGhost: { padding: T.btnGhostPad, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "transparent", color: T.text, cursor: "pointer", fontSize: T.textLg, minHeight: T.tapMin },
    buttonDanger: { padding: T.btnGhostPad, borderRadius: T.radiusSm, border: `1px solid ${T.warn}`, background: "transparent", color: T.warn, cursor: "pointer", fontSize: T.textMd, minHeight: T.tapMin },
    input: { padding: T.inputPad, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: T.inputText, width: "100%", boxSizing: "border-box", minHeight: T.tapMin },
    label: { fontSize: T.textSm, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: "var(--byb-space-1)", display: "block" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: T.textLg },
    th: { textAlign: "left", padding: "10px var(--byb-space-2)", borderBottom: `1px solid ${T.border}`, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", fontSize: T.textSm, letterSpacing: 0.5 },
    td: { padding: "10px var(--byb-space-2)", borderBottom: `1px solid ${T.border}`, verticalAlign: "middle" },
    pill: (colour) => ({ display: "inline-block", padding: "3px 10px", borderRadius: T.pill, background: colour + "22", color: colour, fontSize: T.textXs, fontWeight: 600 }),
    toast: { position: "fixed", bottom: isMobile ? BOTTOM_NAV_H + 16 : 24, left: "50%", transform: "translateX(-50%)", background: T.inverseSurface, color: T.inverseText, padding: "10px var(--byb-space-5)", borderRadius: T.radiusSm, fontSize: T.textLg, zIndex: 100, boxShadow: T.elev3 },
    fab: { position: "fixed", right: 18, bottom: `calc(${BOTTOM_NAV_H + 18}px + env(safe-area-inset-bottom, 0px))`, width: 56, height: 56, borderRadius: T.pill, background: T.primary, color: "#FFF", border: "none", fontSize: T.text2xl, fontWeight: 400, cursor: "pointer", boxShadow: T.elev3, zIndex: 15, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 4 },
    txCard: { background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "var(--byb-space-3)", marginBottom: "var(--byb-space-2)", display: "flex", flexDirection: "column", gap: "var(--byb-space-1)", boxShadow: T.elev1 },
  };
}
