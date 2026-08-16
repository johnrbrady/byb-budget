import { filterTransactions, groupByMonth } from "./txQuery.js";

const MONTH_KEY = /^\d{4}-\d{2}$/;

/** Move a YYYY-MM month key without letting short months change the anchor. */
export function shiftMonth(month, offset) {
  if (!MONTH_KEY.test(month)) throw new Error(`Invalid month key: ${month}`);
  const [year, monthNumber] = month.split("-").map(Number);
  const absolute = (year * 12) + monthNumber - 1 + offset;
  const shiftedYear = Math.floor(absolute / 12);
  const shiftedMonth = (absolute % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

/** A fixed-length, oldest-first run of month keys ending at endMonth. */
export function monthSequence(endMonth, count) {
  const length = Math.max(1, Math.trunc(count || 1));
  return Array.from({ length }, (_, index) => shiftMonth(endMonth, index - length + 1));
}

/**
 * Build the per-envelope spending series used by Reports.
 *
 * Filtering and grouping deliberately go through txQuery. That module is the
 * one definition of which ledger rows belong to a category and month; Reports
 * used to carry several hand-written copies that disagreed at range edges.
 * Missing months are then filled with zero so a seasonal gap is visible rather
 * than squeezed out of the chart.
 */
export function categorySpendingReport(transactions, categories, { endMonth, months = 5 } = {}) {
  if (!MONTH_KEY.test(endMonth || "")) throw new Error(`Invalid end month: ${endMonth}`);

  const monthKeys = monthSequence(endMonth, months);
  const range = { start: `${monthKeys[0]}-01`, end: `${monthKeys[monthKeys.length - 1]}-31` };
  const expenseRows = filterTransactions(transactions, { ...range, type: "expense" });
  const known = (categories || []).filter((category) => category.type === "expense");
  const knownIds = new Set(known.map((category) => category.id));
  const deleted = Array.from(new Set(expenseRows.map((tx) => tx.categoryId).filter((id) => id && !knownIds.has(id))))
    .map((id) => ({ id, name: "Deleted envelope", colour: "#999999", type: "expense", deleted: true }));

  return [...known, ...deleted].map((category) => {
    const rows = filterTransactions(transactions, { ...range, categoryId: category.id, type: "expense" });
    const grouped = new Map(groupByMonth(rows).map((group) => [group.month, group.expense]));
    const series = monthKeys.map((month) => ({ month, amount: grouped.get(month) || 0 }));
    const current = series[series.length - 1].amount;
    const previous = series.length > 1 ? series[series.length - 2].amount : 0;
    const change = current - previous;

    return {
      category,
      series,
      total: series.reduce((sum, point) => sum + point.amount, 0),
      current,
      previous,
      change,
      percentChange: previous > 0 ? (change / previous) * 100 : null,
      direction: change > 0 ? "up" : change < 0 ? "down" : "steady",
    };
  }).sort((a, b) => b.total - a.total || a.category.name.localeCompare(b.category.name));
}
