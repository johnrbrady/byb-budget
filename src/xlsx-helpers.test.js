import ExcelJS from "exceljs/dist/exceljs.js";
import { buildExportWorkbook, exportToXlsx, importFromXlsx } from "./xlsx-helpers.js";

const categories = [{ id: "c-groceries", name: "Groceries", type: "expense" }];
const users = [{ id: "u-john", name: "John" }];
const payload = {
  transactions: [{
    id: "t-1", date: "2026-06-15", type: "expense", amount: 1999,
    categoryId: "c-groceries", description: "Shop", addedBy: "u-john",
    createdAt: "2026-06-15T00:00:00Z",
  }],
  categories,
  users,
  recurring: [],
};

test("XLSX export keeps human-facing values in dollars", async () => {
  const workbook = await buildExportWorkbook(payload);
  const transactions = workbook.getWorksheet("Transactions");
  const headers = transactions.getRow(1).values;
  const amountColumn = headers.indexOf("amount");
  expect(transactions.getRow(2).getCell(amountColumn).value).toBe(19.99);

  const summary = workbook.getWorksheet("Summary");
  expect(summary.getRow(3).getCell(2).value).toBe(19.99);
});

test("XLSX export keeps formula-looking descriptions as text", async () => {
  const workbook = await buildExportWorkbook({
    ...payload,
    transactions: [{ ...payload.transactions[0], description: '=HYPERLINK("https://invalid.example","open")' }],
  });
  const transactions = workbook.getWorksheet("Transactions");
  const descriptionColumn = transactions.getRow(1).values.indexOf("description");
  const cell = transactions.getRow(2).getCell(descriptionColumn);
  expect(cell.value).toBe('=HYPERLINK("https://invalid.example","open")');
  expect(cell.type).toBe(ExcelJS.ValueType.String);
});

test("XLSX import converts dollars to cents and reports source rounding", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");
  sheet.addRow(["id", "date", "type", "amount", "categoryId", "addedBy"]);
  sheet.addRow(["a", "2026-06-15", "expense", 19.99, "c-groceries", "u-john"]);
  sheet.addRow(["b", "2026-06-16", "expense", 1.005, "c-groceries", "u-john"]);
  const buffer = await workbook.xlsx.writeBuffer();
  const result = await importFromXlsx({ arrayBuffer: async () => buffer }, { categories, users });
  expect(result).toMatchObject({ skipped: 0, rounded: 1 });
  expect(result.added.map((row) => row.amount)).toEqual([1999, 101]);
});

test("XLSX export writes foreign amounts as major units", async () => {
  const workbook = await buildExportWorkbook({
    ...payload,
    transactions: [{ ...payload.transactions[0], currency: "EUR", foreignAmount: 7500, exchangeRate: 1.6 }],
  });
  const transactions = workbook.getWorksheet("Transactions");
  const headers = transactions.getRow(1).values;
  expect(transactions.getRow(2).getCell(headers.indexOf("currency")).value).toBe("EUR");
  expect(transactions.getRow(2).getCell(headers.indexOf("foreignAmount")).value).toBe(75);
  expect(transactions.getRow(2).getCell(headers.indexOf("exchangeRate")).value).toBe(1.6);
});

test("XLSX import carries valid foreign fields and falls back otherwise", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");
  sheet.addRow(["id", "date", "type", "amount", "categoryId", "addedBy", "currency", "foreignAmount", "exchangeRate"]);
  sheet.addRow(["a", "2026-06-15", "expense", 120, "c-groceries", "u-john", "EUR", 75, 1.6]);
  sheet.addRow(["b", "2026-06-16", "expense", 20, "c-groceries", "u-john", "AUD", 999, 1.6]);
  const buffer = await workbook.xlsx.writeBuffer();
  const result = await importFromXlsx({ arrayBuffer: async () => buffer }, { categories, users, currency: "AUD" });
  expect(result.added[0]).toMatchObject({ amount: 12000, currency: "EUR", foreignAmount: 7500, exchangeRate: 1.6 });
  expect(result.added[1]).toMatchObject({ amount: 2000 });
  expect(result.added[1].currency).toBeUndefined();
  expect(result.added[1].foreignAmount).toBeUndefined();
});

test("export filename uses the Melbourne calendar date", async () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:test");
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  let anchor;
  const append = jest.spyOn(document.body, "appendChild").mockImplementation((node) => { anchor = node; return node; });
  const remove = jest.spyOn(document.body, "removeChild").mockImplementation((node) => node);
  try {
    await exportToXlsx(payload);
    expect(anchor.download).toBe("budget-2026-06-15.xlsx");
    expect(click).toHaveBeenCalled();
  } finally {
    append.mockRestore();
    remove.mockRestore();
    click.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
