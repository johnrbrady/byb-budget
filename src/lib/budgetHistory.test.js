import { budgetHistoryCategories, budgetHistoryRows, captureBudgetMonth } from "./budgetHistory.js";

const groceries = (baseAmount, extra = {}) => ({ id: "groceries", name: "Groceries", type: "expense", baseAmount, ...extra });

test("captures one replaceable current-month plan and never rewrites closed months", () => {
  const march = captureBudgetMonth([], [groceries(40000)], "2026-03");
  const april = captureBudgetMonth(march, [groceries(45000)], "2026-04");
  const changedApril = captureBudgetMonth(april, [groceries(50000, { targetAmount: 90000, targetDate: "2026-09-30" })], "2026-04");
  expect(changedApril).toEqual([
    { month: "2026-04", categories: [{ categoryId: "groceries", categoryName: "Groceries", baseAmount: 50000, targetAmount: 90000, targetDate: "2026-09-30" }] },
    { month: "2026-03", categories: [{ categoryId: "groceries", categoryName: "Groceries", baseAmount: 40000, targetAmount: 0, targetDate: "" }] },
  ]);
});

test("joins historical plans to actual spending without using today's category amount", () => {
  const history = [
    { month: "2026-03", categories: [{ categoryId: "groceries", categoryName: "Groceries", baseAmount: 40000 }] },
    { month: "2026-04", categories: [{ categoryId: "groceries", categoryName: "Groceries", baseAmount: 50000 }, { categoryId: "fuel", categoryName: "Fuel", baseAmount: 10000 }] },
  ];
  const transactions = [
    { date: "2026-03-10", type: "expense", categoryId: "groceries", amount: 35000 },
    { date: "2026-04-10", type: "expense", categoryId: "groceries", amount: 52000 },
    { date: "2026-04-11", type: "expense", categoryId: "fuel", amount: 8000 },
    { date: "2026-04-12", type: "income", categoryId: "salary", amount: 100000 },
  ];
  expect(budgetHistoryRows(history, transactions, "groceries")).toEqual([
    { month: "2026-04", budgeted: 50000, spent: 52000, variance: -2000, hasPlan: true },
    { month: "2026-03", budgeted: 40000, spent: 35000, variance: 5000, hasPlan: true },
  ]);
  expect(budgetHistoryRows(history, transactions, "all")[0]).toMatchObject({ budgeted: 60000, spent: 60000, variance: 0 });
});

test("keeps deleted envelope names available for historical reports", () => {
  const history = [{ month: "2026-03", categories: [{ categoryId: "old", categoryName: "Old envelope", baseAmount: 100 }] }];
  expect(budgetHistoryCategories(history, [groceries(200)])).toEqual([
    { id: "groceries", name: "Groceries" },
    { id: "old", name: "Old envelope" },
  ]);
});

test("retains at most ten years of monthly plans", () => {
  let history = [];
  for (let index = 0; index < 130; index++) {
    const year = 2016 + Math.floor(index / 12);
    const month = String((index % 12) + 1).padStart(2, "0");
    history = captureBudgetMonth(history, [groceries(index)], `${year}-${month}`);
  }
  expect(history).toHaveLength(120);
  expect(history[0].month).toBe("2026-10");
  expect(history.at(-1).month).toBe("2016-11");
});
