import * as XLSX from "xlsx";

export function exportToXlsx({ transactions, categories, users, recurring }) {
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const txRows = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type,
    amount: t.amount,
    categoryName: categoriesById[t.categoryId]?.name || "",
    categoryId: t.categoryId,
    description: t.description || "",
    isRecurring: t.isRecurring ? "Yes" : "No",
    addedByName: usersById[t.addedBy]?.name || "",
    addedBy: t.addedBy,
    createdAt: t.createdAt,
  }));

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const byCat = {};
  transactions.filter((t) => t.type === "expense").forEach((t) => {
    const name = categoriesById[t.categoryId]?.name || "Unknown";
    if (!byCat[name]) byCat[name] = { total: 0, count: 0 };
    byCat[name].total += t.amount;
    byCat[name].count += 1;
  });

  const summaryRows = [
    { metric: "Total income", value: income },
    { metric: "Total expenses", value: expenses },
    { metric: "Net", value: income - expenses },
    { metric: "Transaction count", value: transactions.length },
    { metric: "Category count", value: categories.length },
    { metric: "Recurring rule count", value: recurring.length },
    { metric: "Exported at", value: new Date().toISOString() },
    {},
    { metric: "— Category breakdown (expenses) —" },
    ...Object.entries(byCat).map(([name, v]) => ({ metric: name, value: v.total, count: v.count })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), "Transactions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `budget-${stamp}.xlsx`);
}

export async function importFromXlsx(file, { categories, users }) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.includes("Transactions") ? "Transactions" : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

  const categoryByName = {};
  categories.forEach((c) => { categoryByName[c.name.toLowerCase()] = c.id; });
  const userByName = {};
  users.forEach((u) => { userByName[u.name.toLowerCase()] = u.id; });
  const categoryById = new Set(categories.map((c) => c.id));
  const userById = new Set(users.map((u) => u.id));

  const added = [];
  let skipped = 0;

  rows.forEach((r) => {
    const date = r.date || "";
    const amount = parseFloat(r.amount);
    const type = (r.type || "").toLowerCase();
    if (!date || !amount || amount <= 0 || (type !== "income" && type !== "expense")) {
      skipped += 1;
      return;
    }

    let categoryId = r.categoryId;
    if (!categoryId || !categoryById.has(categoryId)) {
      const byName = r.categoryName ? categoryByName[String(r.categoryName).toLowerCase()] : null;
      if (byName) categoryId = byName;
    }
    if (!categoryId || !categoryById.has(categoryId)) { skipped += 1; return; }

    let addedBy = r.addedBy;
    if (!addedBy || !userById.has(addedBy)) {
      const byName = r.addedByName ? userByName[String(r.addedByName).toLowerCase()] : null;
      if (byName) addedBy = byName;
    }
    if (!addedBy || !userById.has(addedBy)) { skipped += 1; return; }

    added.push({
      id: r.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2, 10)),
      date: String(date),
      amount,
      type,
      categoryId,
      description: r.description || "",
      isRecurring: String(r.isRecurring || "").toLowerCase() === "yes",
      recurringId: null,
      addedBy,
      createdAt: r.createdAt || new Date().toISOString(),
    });
  });

  return { added, skipped };
}
