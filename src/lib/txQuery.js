// Asking the transaction list a question.
//
// Every filtered view of the ledger is the same query with different defaults:
// the Transactions list wants one month, or one envelope's whole history, or an
// explicit date range; Reports wants a date range; the Dashboard wants what one
// envelope spent this month. That query used to be written out by hand in each
// of those places, and the copies had drifted — TransactionsView's hard-filtered
// every row to the global `activeMonth`, so an envelope's history was
// unreachable without moving the month selector, which moved every other view
// with it.
//
// It lives here instead: plain functions over a transaction array and a query
// object, with no React, so the filtering can be tested on its own.
//
// A query is `{ month, start, end, categoryId, type, addedBy, search }` and
// every field is optional. Date scope is decided by the first of these that is
// present:
//
//   start and/or end → an inclusive date range (either end may stand alone)
//   month            → that calendar month, "YYYY-MM"
//   neither          → the whole history
//
// `categoryId`, `type` and `addedBy` take "all" — the value the filter selects
// already use — or an id; `search` is a case-insensitive substring of the
// description. Amounts are floats and are summed as-is, matching money.js and
// the persisted files.

import { monthKey } from "./utils.js";

// The value the filter <select>s use for "don't filter on this".
const ALL = "all";

/**
 * Settle a date range into one that can be compared against.
 *
 * A range whose end falls before its start is collapsed to the single day
 * `start` rather than matching nothing. That is what Reports has always done
 * with an inverted range, and it is the kinder reading of a half-finished edit:
 * a user picking a new start date before fixing the end sees one day of data
 * rather than an empty screen that looks like a bug.
 *
 * Either end may be blank, meaning unbounded in that direction.
 */
export function normaliseRange({ start, end } = {}) {
  const from = start || "";
  const to = end || "";
  if (from && to && to < from) return { start: from, end: from };
  return { start: from, end: to };
}

/** Does one transaction answer the query? */
export function matchesQuery(tx, query = {}) {
  const { start, end } = normaliseRange(query);
  if (start || end) {
    // ISO dates sort lexicographically, so string comparison is date comparison,
    // and both bounds are inclusive.
    if (start && tx.date < start) return false;
    if (end && tx.date > end) return false;
  } else if (query.month && monthKey(tx.date) !== query.month) {
    return false;
  }
  if (query.type && query.type !== ALL && tx.type !== query.type) return false;
  if (query.categoryId && query.categoryId !== ALL && tx.categoryId !== query.categoryId) return false;
  if (query.addedBy && query.addedBy !== ALL && tx.addedBy !== query.addedBy) return false;
  if (query.search && !(tx.description || "").toLowerCase().includes(query.search.toLowerCase())) return false;
  return true;
}

/**
 * Every transaction answering the query, newest first.
 *
 * Sorting on the date alone leaves same-day rows in the order they arrived,
 * which is how the list has always read: a transaction added today appears
 * above the ones already logged for today.
 */
export function filterTransactions(transactions, query = {}) {
  return (transactions || [])
    .filter((t) => matchesQuery(t, query))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Money in, money out, and the difference, over whatever list is handed in. */
export function totals(transactions) {
  let income = 0;
  let expense = 0;
  for (const t of transactions || []) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/**
 * Split a transaction list into calendar months, newest month first and newest
 * transaction first inside each, with that month's totals alongside.
 *
 * Months are "YYYY-MM" strings, so ordering them is a string comparison and
 * December 2025 correctly precedes January 2026.
 *
 * The sort is done here rather than assumed of the input so the grouping is
 * correct whatever order it is handed; re-sorting an already-sorted list costs
 * nothing and cannot reorder it.
 */
export function groupByMonth(transactions) {
  const byMonth = new Map();
  for (const t of transactions || []) {
    const m = monthKey(t.date);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(t);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, rows]) => {
      const sorted = rows.sort((a, b) => b.date.localeCompare(a.date));
      return { month, transactions: sorted, ...totals(sorted) };
    });
}
