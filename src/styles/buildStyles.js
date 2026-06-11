import { PALETTE } from "../lib/constants.js";

export function buildStyles(theme, isMobile = false) {
  const dark = theme === "dark";
  const surface = dark ? PALETTE.surfaceDark : PALETTE.surfaceLight;
  const surfaceAlt = dark ? PALETTE.surfaceDarkAlt : PALETTE.surfaceLightAlt;
  const text = dark ? PALETTE.textDark : PALETTE.textLight;
  const textMuted = dark ? "#9AA09A" : "#6B6F6B";
  const border = dark ? PALETTE.borderDark : PALETTE.border;
  const barTrack = dark ? "#2F322F" : "#E4E8E0";
  const bottomNavHeight = 64;
  return {
    dark, surface, surfaceAlt, text, textMuted, border, barTrack, isMobile, bottomNavHeight,
    app: { display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: surface, color: text, fontSize: 15, lineHeight: 1.5 },
    sidebar: isMobile
      ? { position: "fixed", bottom: 0, left: 0, right: 0, height: bottomNavHeight, background: surfaceAlt, borderTop: `1px solid ${border}`, display: "flex", flexDirection: "row", justifyContent: "space-around", alignItems: "stretch", zIndex: 20, paddingBottom: "env(safe-area-inset-bottom, 0px)" }
      : { width: 220, background: surfaceAlt, borderRight: `1px solid ${border}`, padding: "24px 0", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto", alignSelf: "flex-start" },
    brand: isMobile
      ? { display: "none" }
      : { padding: "0 20px 24px 20px", fontWeight: 700, fontSize: 15, letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 10, lineHeight: 1.15 },
    brandLogo: { width: 40, height: 40, borderRadius: "50%", background: PALETTE.secondary, padding: 4, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.12))" },
    brandText: { display: "flex", flexDirection: "column", gap: 2 },
    brandTitle: { color: PALETTE.primary, fontWeight: 800, fontSize: 14, letterSpacing: 0.3, textTransform: "uppercase" },
    brandSubtitle: { color: textMuted, fontWeight: 500, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
    navItem: (active) => isMobile
      ? { flex: 1, padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderTop: `3px solid ${active ? PALETTE.primary : "transparent"}`, fontWeight: active ? 600 : 500, color: active ? text : textMuted, fontSize: 11, textAlign: "center", userSelect: "none", WebkitTapHighlightColor: "transparent" }
      : { padding: "10px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderLeft: `3px solid ${active ? PALETTE.primary : "transparent"}`, fontWeight: active ? 600 : 500, color: active ? text : textMuted, background: active ? (dark ? "#2A2D2A" : "#EDF1E8") : "transparent" },
    main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, paddingBottom: isMobile ? bottomNavHeight : 0 },
    header: isMobile
      ? { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${border}`, background: surface, position: "sticky", top: 0, zIndex: 10, gap: 10 }
      : { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: `1px solid ${border}`, background: surface, position: "sticky", top: 0, zIndex: 10 },
    viewTitle: isMobile
      ? { fontSize: 18, fontWeight: 700, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }
      : { fontSize: 22, fontWeight: 600, letterSpacing: -0.4 },
    headerRight: { display: "flex", alignItems: "center", gap: isMobile ? 8 : 16 },
    monthSelect: { padding: isMobile ? "8px 6px" : "6px 10px", borderRadius: 6, border: `1px solid ${border}`, background: surface, color: text, fontSize: isMobile ? 12 : 13, cursor: "pointer", maxWidth: isMobile ? 130 : "none" },
    avatarCircle: (u) => ({ width: 28, height: 28, borderRadius: "50%", background: u.colour, color: "#FFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }),
    userSwitcher: { display: "flex", gap: 6 },
    themeBtn: { padding: isMobile ? "6px 8px" : "6px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: isMobile ? 11 : 13, cursor: "pointer" },
    content: { flex: 1, padding: isMobile ? "16px 12px" : "28px 32px", maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" },
    footer: isMobile
      ? { display: "none" }
      : { padding: "12px 32px", borderTop: `1px solid ${border}`, fontSize: 12, color: textMuted, display: "flex", justifyContent: "space-between" },
    card: { background: surfaceAlt, border: `1px solid ${border}`, borderRadius: 10, padding: isMobile ? 14 : 20 },
    kpiGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 },
    kpiValue: { fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 },
    kpiLabel: { fontSize: 12, color: textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
    sectionTitle: { fontSize: 14, fontWeight: 600, margin: isMobile ? "20px 0 10px 0" : "28px 0 12px 0", textTransform: "uppercase", letterSpacing: 0.6, color: textMuted },
    button: { padding: isMobile ? "12px 18px" : "8px 16px", borderRadius: 6, border: "none", background: PALETTE.primary, color: "#FFF", fontWeight: 600, cursor: "pointer", fontSize: isMobile ? 15 : 14, minHeight: isMobile ? 44 : "auto" },
    buttonGhost: { padding: isMobile ? "11px 14px" : "8px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer", fontSize: 14, minHeight: isMobile ? 44 : "auto" },
    buttonDanger: { padding: isMobile ? "10px 14px" : "6px 12px", borderRadius: 6, border: `1px solid ${PALETTE.warn}`, background: "transparent", color: PALETTE.warn, cursor: "pointer", fontSize: isMobile ? 14 : 13, minHeight: isMobile ? 40 : "auto" },
    input: { padding: isMobile ? "11px 12px" : "8px 10px", borderRadius: 6, border: `1px solid ${border}`, background: surface, color: text, fontSize: isMobile ? 16 : 14, width: "100%", boxSizing: "border-box", minHeight: isMobile ? 44 : "auto" },
    label: { fontSize: 12, fontWeight: 600, color: textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
    th: { textAlign: "left", padding: "10px 8px", borderBottom: `1px solid ${border}`, fontWeight: 600, color: textMuted, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 },
    td: { padding: "10px 8px", borderBottom: `1px solid ${border}`, verticalAlign: "middle" },
    pill: (colour) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: colour + "22", color: colour, fontSize: 11, fontWeight: 600 }),
    toast: { position: "fixed", bottom: isMobile ? bottomNavHeight + 16 : 24, left: "50%", transform: "translateX(-50%)", background: PALETTE.textLight, color: PALETTE.textDark, padding: "10px 18px", borderRadius: 6, fontSize: 14, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.16)" },
    fab: { position: "fixed", right: 18, bottom: `calc(${bottomNavHeight + 18}px + env(safe-area-inset-bottom, 0px))`, width: 56, height: 56, borderRadius: "50%", background: PALETTE.primary, color: "#FFF", border: "none", fontSize: 28, fontWeight: 400, cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,0.18)", zIndex: 15, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 4 },
    txCard: { background: surfaceAlt, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 },
  };
}
