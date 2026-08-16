import { categorySpendingReport, monthSequence, shiftMonth } from "./reporting.js";

const categories = [
  { id: "c-groceries", name: "Groceries", type: "expense", colour: "#7FB069" },
  { id: "c-power", name: "Electricity", type: "expense", colour: "#C27B3F" },
  { id: "c-income", name: "Salary", type: "income", colour: "#999999" },
];

const tx = (id, date, amount, categoryId, type = "expense") => ({ id, date, amount, categoryId, type });

describe("category spending reports", () => {
  test("month arithmetic stays anchored across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 2)).toBe("2026-02");
    expect(monthSequence("2026-02", 5)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  test("builds an oldest-first five-month series and leaves missing months at zero", () => {
    const reports = categorySpendingReport([
      tx("a", "2026-02-03", 40, "c-groceries"),
      tx("b", "2026-04-30", 60, "c-groceries"),
      tx("c", "2026-06-01", 90, "c-groceries"),
      tx("income", "2026-06-02", 5000, "c-income", "income"),
    ], categories, { endMonth: "2026-06", months: 5 });

    const groceries = reports.find((report) => report.category.id === "c-groceries");
    expect(groceries.series).toEqual([
      { month: "2026-02", amount: 40 },
      { month: "2026-03", amount: 0 },
      { month: "2026-04", amount: 60 },
      { month: "2026-05", amount: 0 },
      { month: "2026-06", amount: 90 },
    ]);
    expect(groceries.total).toBe(190);
  });

  test("the period includes both edge months and excludes rows outside them", () => {
    const reports = categorySpendingReport([
      tx("old", "2025-12-31", 1000, "c-groceries"),
      tx("first", "2026-01-01", 10, "c-groceries"),
      tx("last", "2026-05-31", 20, "c-groceries"),
      tx("future", "2026-06-01", 2000, "c-groceries"),
    ], categories, { endMonth: "2026-05", months: 5 });

    const groceries = reports.find((report) => report.category.id === "c-groceries");
    expect(groceries.total).toBe(30);
    expect(groceries.series[0]).toEqual({ month: "2026-01", amount: 10 });
    expect(groceries.series[4]).toEqual({ month: "2026-05", amount: 20 });
  });

  test("states the direction, dollar change and percentage against the previous month", () => {
    const reports = categorySpendingReport([
      tx("g-may", "2026-05-10", 80, "c-groceries"),
      tx("g-jun", "2026-06-10", 100, "c-groceries"),
      tx("p-may", "2026-05-11", 120, "c-power"),
      tx("p-jun", "2026-06-11", 60, "c-power"),
    ], categories, { endMonth: "2026-06", months: 5 });

    const groceries = reports.find((report) => report.category.id === "c-groceries");
    const power = reports.find((report) => report.category.id === "c-power");
    expect(groceries).toMatchObject({ current: 100, previous: 80, change: 20, percentChange: 25, direction: "up" });
    expect(power).toMatchObject({ current: 60, previous: 120, change: -60, percentChange: -50, direction: "down" });
  });

  test("keeps spending from a deleted envelope visible instead of dropping it", () => {
    const reports = categorySpendingReport([
      tx("gone", "2026-06-10", 45, "c-deleted"),
    ], categories, { endMonth: "2026-06", months: 5 });

    expect(reports[0]).toMatchObject({
      category: { id: "c-deleted", name: "Deleted envelope", deleted: true },
      total: 45,
    });
  });
});
