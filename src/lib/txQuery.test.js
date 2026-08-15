import {
  normaliseRange,
  matchesQuery,
  filterTransactions,
  totals,
  groupByMonth,
} from "./txQuery.js";

// The rule these functions serve: one query answers every filtered view of the
// ledger, so the Transactions list, the Reports range and the Dashboard's
// per-envelope spend all agree about which rows count.
//
// The fixture deliberately crosses a year boundary (Nov 2025 → Jun 2026) and
// mixes two envelopes, two users and both transaction types, so month ordering
// and the filter fields are genuinely exercised rather than coincidentally
// satisfied by two adjacent months of one kind of row.

const tx = (id, date, amount, extra = {}) => ({
  id,
  date,
  amount,
  type: "expense",
  categoryId: "c-groceries",
  description: id,
  addedBy: "u-1",
  ...extra,
});

const LEDGER = [
  tx("jun", "2026-06-02", 60, { description: "June shop" }),
  tx("may", "2026-05-04", 55, { description: "May shop" }),
  tx("feb", "2026-02-10", 40, { description: "February shop" }),
  tx("feb-late", "2026-02-24", 12, { description: "February top-up" }),
  tx("jan", "2026-01-08", 35, { description: "January shop" }),
  tx("dec", "2025-12-20", 30, { description: "December shop" }),
  tx("nov", "2025-11-15", 25, { description: "November shop" }),
  tx("fuel", "2026-02-11", 90, { categoryId: "c-fuel", description: "Petrol", addedBy: "u-2" }),
  tx("pay", "2026-02-01", 500, { type: "income", categoryId: "c-salary", description: "Payslip", addedBy: "u-2" }),
];

const idsOf = (rows) => rows.map((t) => t.id);

describe("normaliseRange", () => {
  test("a well-ordered range is left alone", () => {
    expect(normaliseRange({ start: "2026-01-01", end: "2026-03-31" }))
      .toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });

  test("an inverted range collapses onto its start day", () => {
    expect(normaliseRange({ start: "2026-05-04", end: "2026-01-08" }))
      .toEqual({ start: "2026-05-04", end: "2026-05-04" });
  });

  test("either end may stand alone, and nothing at all is an empty range", () => {
    expect(normaliseRange({ start: "2026-01-01" })).toEqual({ start: "2026-01-01", end: "" });
    expect(normaliseRange({ end: "2026-01-01" })).toEqual({ start: "", end: "2026-01-01" });
    expect(normaliseRange()).toEqual({ start: "", end: "" });
  });

  test("a single-day range is a legitimate range, not an inversion", () => {
    expect(normaliseRange({ start: "2026-02-10", end: "2026-02-10" }))
      .toEqual({ start: "2026-02-10", end: "2026-02-10" });
  });
});

describe("matchesQuery date scope", () => {
  const feb10 = tx("t", "2026-02-10", 40);

  test("an empty query matches everything", () => {
    expect(matchesQuery(feb10, {})).toBe(true);
    expect(matchesQuery(feb10)).toBe(true);
  });

  test("a month restricts to that calendar month", () => {
    expect(matchesQuery(feb10, { month: "2026-02" })).toBe(true);
    expect(matchesQuery(feb10, { month: "2026-01" })).toBe(false);
    expect(matchesQuery(feb10, { month: "2025-02" })).toBe(false);
  });

  test("both range boundaries are inclusive", () => {
    expect(matchesQuery(feb10, { start: "2026-02-10", end: "2026-02-28" })).toBe(true);
    expect(matchesQuery(feb10, { start: "2026-02-01", end: "2026-02-10" })).toBe(true);
    expect(matchesQuery(feb10, { start: "2026-02-11", end: "2026-02-28" })).toBe(false);
    expect(matchesQuery(feb10, { start: "2026-02-01", end: "2026-02-09" })).toBe(false);
  });

  test("a range overrides a month, so a half-set filter cannot fight itself", () => {
    expect(matchesQuery(feb10, { month: "2026-06", start: "2026-01-01", end: "2026-12-31" })).toBe(true);
  });

  test("a one-ended range bounds only that end", () => {
    expect(matchesQuery(feb10, { start: "2026-01-01" })).toBe(true);
    expect(matchesQuery(feb10, { start: "2026-03-01" })).toBe(false);
    expect(matchesQuery(feb10, { end: "2026-03-01" })).toBe(true);
    expect(matchesQuery(feb10, { end: "2026-01-01" })).toBe(false);
  });
});

describe("matchesQuery fields", () => {
  const row = tx("t", "2026-02-10", 40, { description: "Woolworths Richmond", addedBy: "u-2" });

  test('"all" and blank mean no filter', () => {
    expect(matchesQuery(row, { categoryId: "all", type: "all", addedBy: "all", search: "" })).toBe(true);
  });

  test("category, type and user each narrow on their own", () => {
    expect(matchesQuery(row, { categoryId: "c-groceries" })).toBe(true);
    expect(matchesQuery(row, { categoryId: "c-fuel" })).toBe(false);
    expect(matchesQuery(row, { type: "expense" })).toBe(true);
    expect(matchesQuery(row, { type: "income" })).toBe(false);
    expect(matchesQuery(row, { addedBy: "u-2" })).toBe(true);
    expect(matchesQuery(row, { addedBy: "u-1" })).toBe(false);
  });

  test("search is a case-insensitive substring of the description", () => {
    expect(matchesQuery(row, { search: "woolworths" })).toBe(true);
    expect(matchesQuery(row, { search: "RICHMOND" })).toBe(true);
    expect(matchesQuery(row, { search: "worth" })).toBe(true);
    expect(matchesQuery(row, { search: "coles" })).toBe(false);
  });

  test("a row with no description survives everything except a search", () => {
    const bare = tx("t", "2026-02-10", 40, { description: undefined });
    expect(matchesQuery(bare, { categoryId: "c-groceries" })).toBe(true);
    expect(matchesQuery(bare, { search: "anything" })).toBe(false);
  });
});

describe("filterTransactions", () => {
  test("returns everything, newest first, when asked nothing", () => {
    expect(idsOf(filterTransactions(LEDGER)))
      .toEqual(["jun", "may", "feb-late", "fuel", "feb", "pay", "jan", "dec", "nov"]);
  });

  test("one envelope's whole history reaches back past the current month", () => {
    expect(idsOf(filterTransactions(LEDGER, { categoryId: "c-groceries" })))
      .toEqual(["jun", "may", "feb-late", "feb", "jan", "dec", "nov"]);
  });

  test("a month and a category together are this month's spend on one envelope", () => {
    expect(idsOf(filterTransactions(LEDGER, { month: "2026-02", categoryId: "c-groceries", type: "expense" })))
      .toEqual(["feb-late", "feb"]);
  });

  test("an inclusive range keeps the rows sitting exactly on both boundaries", () => {
    expect(idsOf(filterTransactions(LEDGER, { start: "2026-01-08", end: "2026-05-04", categoryId: "c-groceries" })))
      .toEqual(["may", "feb-late", "feb", "jan"]);
  });

  test("an inverted range yields the start day alone", () => {
    expect(idsOf(filterTransactions(LEDGER, { start: "2026-05-04", end: "2026-01-08" })))
      .toEqual(["may"]);
  });

  test("a range with nothing in it is empty, not an error", () => {
    expect(filterTransactions(LEDGER, { start: "2026-03-01", end: "2026-04-30" })).toEqual([]);
  });

  test("an empty or missing transaction list is handled", () => {
    expect(filterTransactions([], { month: "2026-02" })).toEqual([]);
    expect(filterTransactions(undefined, { month: "2026-02" })).toEqual([]);
  });

  test("the caller's array is never reordered underneath it", () => {
    const original = [...LEDGER];
    filterTransactions(LEDGER, {});
    expect(LEDGER).toEqual(original);
  });
});

describe("totals", () => {
  test("splits income from expense and nets them", () => {
    expect(totals(LEDGER)).toEqual({ income: 500, expense: 347, net: 153 });
  });

  test("an empty list is all zeroes", () => {
    expect(totals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });

  test("totals what it is given, so a filtered list totals the filter", () => {
    const range = filterTransactions(LEDGER, { start: "2026-01-08", end: "2026-05-04", categoryId: "c-groceries" });
    expect(totals(range).expense).toBe(142); // 55 + 12 + 40 + 35
  });
});

describe("groupByMonth", () => {
  const groups = groupByMonth(filterTransactions(LEDGER, { categoryId: "c-groceries" }));

  test("months run newest first and step correctly over the year boundary", () => {
    expect(groups.map((g) => g.month))
      .toEqual(["2026-06", "2026-05", "2026-02", "2026-01", "2025-12", "2025-11"]);
  });

  test("each month carries its own subtotal", () => {
    expect(groups.find((g) => g.month === "2026-02")).toMatchObject({ expense: 52, income: 0, net: -52 });
    expect(groups.find((g) => g.month === "2025-11")).toMatchObject({ expense: 25 });
  });

  test("transactions inside a month run newest first", () => {
    expect(idsOf(groups.find((g) => g.month === "2026-02").transactions)).toEqual(["feb-late", "feb"]);
  });

  test("every transaction lands in exactly one month", () => {
    const rows = filterTransactions(LEDGER, { categoryId: "c-groceries" });
    expect(groups.reduce((n, g) => n + g.transactions.length, 0)).toBe(rows.length);
  });

  test("ordering does not depend on the input already being sorted", () => {
    const shuffled = [LEDGER[6], LEDGER[0], LEDGER[3], LEDGER[2], LEDGER[5]];
    const g = groupByMonth(shuffled);
    expect(g.map((x) => x.month)).toEqual(["2026-06", "2026-02", "2025-12", "2025-11"]);
    expect(idsOf(g[1].transactions)).toEqual(["feb-late", "feb"]);
  });

  test("income and expense in the same month are subtotalled separately", () => {
    const feb = groupByMonth(filterTransactions(LEDGER, { month: "2026-02" }))[0];
    expect(feb).toMatchObject({ month: "2026-02", income: 500, expense: 142, net: 358 });
  });

  test("an empty list groups into nothing", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
