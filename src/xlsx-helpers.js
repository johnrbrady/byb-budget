import { centsToDollars, parseImportedAUDToCents } from "../money-schema.js";
import { todayISO } from "./lib/utils.js";

const loadExcelJS = async () => {
  const module = process.env.NODE_ENV === "test"
    ? await import("exceljs/dist/exceljs.js")
    : await import("exceljs");
  return module.default || module;
};

export async function buildExportWorkbook({ transactions, categories, users, recurring }) {
  const ExcelJS = await loadExcelJS();
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const txRows = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type,
    amount: centsToDollars(t.amount),
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
    { metric: "Total income", value: centsToDollars(income) },
    { metric: "Total expenses", value: centsToDollars(expenses) },
    { metric: "Net", value: centsToDollars(income - expenses) },
    { metric: "Transaction count", value: transactions.length },
    { metric: "Category count", value: categories.length },
    { metric: "Recurring rule count", value: recurring.length },
    { metric: "Exported at", value: new Date().toISOString() },
    {},
    { metric: "Category breakdown (expenses)" },
    ...Object.entries(byCat).map(([name, v]) => ({ metric: name, value: centsToDollars(v.total), count: v.count })),
  ];

  const wb = new ExcelJS.Workbook();

  const txSheet = wb.addWorksheet("Transactions");
  if (txRows.length > 0) {
    txSheet.columns = Object.keys(txRows[0]).map((k) => ({ header: k, key: k }));
    txSheet.addRows(txRows);
  }

  const sumSheet = wb.addWorksheet("Summary");
  sumSheet.columns = [
    { header: "metric", key: "metric" },
    { header: "value", key: "value" },
    { header: "count", key: "count" },
  ];
  sumSheet.addRows(summaryRows);

  return wb;
}

export async function exportToXlsx(payload) {
  const wb = await buildExportWorkbook(payload);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `budget-${todayISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromXlsx(file, { categories, users }) {
  const ExcelJS = await loadExcelJS();
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const sheet = wb.getWorksheet("Transactions") || wb.worksheets[0];
  if (!sheet) return { added: [], skipped: 0, rounded: 0 };

  // Read header row
  const headers = {};
  sheet.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value ?? ""); });

  const rows = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj = {};
    row.eachCell((cell, col) => { if (headers[col]) obj[headers[col]] = cell.value; });
    rows.push(obj);
  });

  const categoryByName = {};
  categories.forEach((c) => { categoryByName[c.name.toLowerCase()] = c.id; });
  const userByName = {};
  users.forEach((u) => { userByName[u.name.toLowerCase()] = u.id; });
  const categoryById = new Set(categories.map((c) => c.id));
  const userById = new Set(users.map((u) => u.id));

  const added = [];
  let skipped = 0;
  let rounded = 0;

  rows.forEach((r) => {
    const date = r.date || "";
    let imported;
    try { imported = parseImportedAUDToCents(r.amount); } catch { skipped++; return; }
    const amount = imported.cents;
    const type = (r.type || "").toLowerCase();
    if (!date || !amount || amount <= 0 || (type !== "income" && type !== "expense")) { skipped++; return; }

    let categoryId = r.categoryId;
    if (!categoryId || !categoryById.has(categoryId)) {
      const byName = r.categoryName ? categoryByName[String(r.categoryName).toLowerCase()] : null;
      if (byName) categoryId = byName;
    }
    if (!categoryId || !categoryById.has(categoryId)) { skipped++; return; }

    let addedBy = r.addedBy;
    if (!addedBy || !userById.has(addedBy)) {
      const byName = r.addedByName ? userByName[String(r.addedByName).toLowerCase()] : null;
      if (byName) addedBy = byName;
    }
    if (!addedBy || !userById.has(addedBy)) { skipped++; return; }

    if (imported.rounded) rounded++;
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

  return { added, skipped, rounded };
}
