import { categoryHistory, parseBankCsv, parseCsv, transactionFingerprint } from "./csvImport.js";

test("reads quoted RFC 4180 fields including commas, escaped quotes and line breaks", () => {
  expect(parseCsv('Date,Details,Amount\r\n2026-08-01,"Cafe, ""North""\nSydney",-12.34\r\n')).toEqual([
    ["Date", "Details", "Amount"],
    ["2026-08-01", 'Cafe, "North"\nSydney', "-12.34"],
  ]);
});

test("detects signed Amount statements and Australian dates", () => {
  const result = parseBankCsv([
    "Transaction Date,Description,Amount",
    '1/8/2026,"Coffee, City",-5.75',
    "02/08/2026,Salary,1200.00",
    "31/02/2026,Impossible,-1.00",
  ].join("\n"));
  expect(result).toMatchObject({ invalid: 1, duplicates: 0, rounded: 0 });
  expect(result.rows).toEqual([
    { date: "2026-08-01", description: "Coffee, City", amount: 575, type: "expense", sourceRow: 2 },
    { date: "2026-08-02", description: "Salary", amount: 120000, type: "income", sourceRow: 3 },
  ]);
});

test("detects separate Debit and Credit statements and currency formatting", () => {
  const result = parseBankCsv([
    "Posted Date,Details,Withdrawal,Deposit",
    '3 Aug 2026,Groceries,"$1,234.56",',
    "04 Aug 2026,Refund,,45.678",
  ].join("\n"));
  expect(result.rows.map(({ sourceRow, ...row }) => row)).toEqual([
    { date: "2026-08-03", description: "Groceries", amount: 123456, type: "expense" },
    { date: "2026-08-04", description: "Refund", amount: 4568, type: "income" },
  ]);
  expect(result.rounded).toBe(1);
});

test("removes already-imported occurrences without losing legitimate identical rows", () => {
  const existing = [{ date: "2026-08-01", type: "expense", amount: 500, description: "  Coffee SHOP " }];
  const result = parseBankCsv([
    "Date,Description,Amount",
    "2026-08-01,Coffee Shop,-5.00",
    "2026-08-02,Fuel,-20.00",
    "2026-08-02,  Fuel  ,-20.00",
  ].join("\n"), existing);
  expect(result.rows).toHaveLength(2);
  expect(result.rows.map((row) => row.description)).toEqual(["Fuel", "Fuel"]);
  expect(result.duplicates).toBe(1);
  expect(transactionFingerprint(existing[0])).toBe("2026-08-01|expense|500|coffee shop");
});

test("category history chooses the most frequent matching description, then latest", () => {
  const history = categoryHistory([
    { type: "expense", description: "Coffee Club", categoryId: "eating", date: "2026-01-01" },
    { type: "expense", description: "coffee  club", categoryId: "eating", date: "2026-02-01" },
    { type: "expense", description: "Coffee Club", categoryId: "fun", date: "2026-08-01" },
    { type: "income", description: "Coffee Club", categoryId: "refund", date: "2026-08-02" },
  ]);
  expect(history.get("expense|coffee club")).toBe("eating");
  expect(history.get("income|coffee club")).toBe("refund");
});

test("rejects statements without required columns", () => {
  expect(() => parseBankCsv("Who,What\nA,B")).toThrow("Date column");
  expect(() => parseBankCsv("Date,What\n2026-01-01,B")).toThrow("Description or Details");
  expect(() => parseBankCsv("Date,Description\n2026-01-01,B")).toThrow("Amount");
});
