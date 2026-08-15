export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2, 10));

export const fmtAUD = (n) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n || 0);

export const monthKey = (iso) => (iso || "").slice(0, 7);

// Every date this app stores is a Melbourne calendar date, so "today" has to be
// the Melbourne one. Deriving it from UTC put the app a day behind between local
// midnight and 10am (11am in daylight saving), which filed a morning shop into
// the previous month.
//
// The zone is fixed rather than read from the browser or the TZ env var. The
// budget period belongs to the household, not to whichever device is asking: if
// one phone were away on holiday, or a laptop's clock were set to the wrong
// zone, the same shop would land in a different month for each person. The
// server has no usable zone to read either — its container ships without TZ set,
// so Node resolves to UTC, which is the bug being fixed here.
export const MELBOURNE_TZ = "Australia/Melbourne";

// en-CA renders dates as YYYY-MM-DD, the shape stored everywhere in this app.
// Intl carries the daylight-saving rules, so AEST/AEDT is handled rather than
// approximated with a fixed offset.
const melbourneDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: MELBOURNE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const todayISO = () => melbourneDate.format(new Date());

export const dayOfMonth = (iso) => Number((iso || "").slice(8, 10)) || 0;

const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (n) => String(n).padStart(2, "0");

// `anchorDay` is the day of the month a recurring rule is meant to fall on.
// Monthly cycles have to clamp into short months — 31 January becomes 28
// February — and if the clamped date then becomes the anchor for the next cycle
// the rule is pulled back to the 28th permanently. Callers holding the intended
// day pass it so the rule can return to it; everyone else gets the day of `iso`,
// which is the same value right up until a clamp happens.
export function addPeriod(iso, frequency, anchorDay) {
  if (frequency === "monthly") {
    const [y, m] = iso.split("-").map(Number);
    const year = m === 12 ? y + 1 : y;
    const month = m === 12 ? 1 : m + 1;
    const day = Math.min(anchorDay || dayOfMonth(iso), lastDayOfMonth(year, month));
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  // Weekly and fortnightly are plain day counts on a date-only value, so UTC
  // arithmetic is exactly right here and daylight saving cannot reach them.
  const d = new Date(iso + "T00:00:00Z");
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "fortnightly") d.setUTCDate(d.getUTCDate() + 14);
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
