const MONTH_RE = /^\d{4}-\d{2}$/;

const snapshotCategories = (categories) => (categories || [])
  .filter((category) => category.type === "expense")
  .map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    baseAmount: Number.isSafeInteger(category.baseAmount) ? category.baseAmount : 0,
    targetAmount: Number.isSafeInteger(category.targetAmount) ? category.targetAmount : 0,
    targetDate: category.targetDate || "",
  }));

/** Record this month's current plan while leaving every closed month immutable. */
export function captureBudgetMonth(history, categories, month) {
  if (!MONTH_RE.test(month)) throw new TypeError("Budget history month must be YYYY-MM");
  const snapshot = { month, categories: snapshotCategories(categories) };
  return [snapshot, ...(history || []).filter((entry) => entry?.month !== month)]
    .filter((entry) => MONTH_RE.test(entry?.month || ""))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 120);
}

export function budgetHistoryCategories(history, currentCategories = []) {
  const names = new Map();
  (history || []).forEach((entry) => (entry.categories || []).forEach((category) => {
    if (category.categoryId && !names.has(category.categoryId)) names.set(category.categoryId, category.categoryName || category.categoryId);
  }));
  (currentCategories || []).filter((category) => category.type === "expense").forEach((category) => names.set(category.id, category.name));
  return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Join immutable monthly plans to the transaction ledger for budget vs actual. */
export function budgetHistoryRows(history, transactions, categoryId = "all") {
  return [...(history || [])].sort((a, b) => b.month.localeCompare(a.month)).map((entry) => {
    const planned = (entry.categories || []).filter((category) => categoryId === "all" || category.categoryId === categoryId);
    const budgeted = planned.reduce((sum, category) => sum + (category.baseAmount || 0), 0);
    const spent = (transactions || []).filter((transaction) => transaction.type === "expense" && transaction.date?.slice(0, 7) === entry.month && (categoryId === "all" || transaction.categoryId === categoryId))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return { month: entry.month, budgeted, spent, variance: budgeted - spent, hasPlan: planned.length > 0 };
  });
}
