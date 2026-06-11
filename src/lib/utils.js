export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2, 10));

export const fmtAUD = (n) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n || 0);

export const monthKey = (iso) => (iso || "").slice(0, 7);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addPeriod(iso, frequency) {
  const d = new Date(iso + "T00:00:00Z");
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "fortnightly") d.setUTCDate(d.getUTCDate() + 14);
  else if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatMonth(m) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatMonthShort(m) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" });
}

// Generate months between two YYYY-MM strings inclusive
export function genMonthRange(startMo, endMo) {
  const months = [];
  let [y, m] = startMo.split("-").map(Number);
  const [ey, em] = endMo.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}
