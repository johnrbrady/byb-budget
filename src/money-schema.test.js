import {
  MONEY_SCALE,
  assertCentsDocument,
  centsToInput,
  inspectMoneyDocument,
  parseAUDToCents,
  parseImportedAUDToCents,
  reconcileEntryToDollars,
  toCentsDocument,
  toDollarsDocument,
} from "../money-schema.js";

const legacy = () => ({
  dataVersion: 7,
  unallocatedBalance: 12.34,
  transactions: [{ amount: 19.99, allocations: [{ amount: 4.56 }] }],
  categories: [{ envelopeBalance: -0.01, baseAmount: 800.25, monthlyBudget: 800.25, suggestedPct: 2.5, sortOrder: 3 }],
  recurring: [{ amount: 10.5, dueDay: 31 }],
  assets: [{ value: 1234.56 }],
  transfers: [{ amount: 7.89 }],
  reconcileLog: [{ pooled: 20.01, returned: 2.02, toppedUp: 1, movements: [{ before: -5.01, amount: 5.01, after: 0 }] }],
  adjustments: [{ before: 1.01, amount: -1.01, after: 0, entries: [{ before: 1.01, amount: -1.01, after: 0 }], unallocated: { before: 0.01, after: 0 } }],
  openingBalances: [{ total: 3.03, amount: 3.03, entries: [{ before: 0, amount: 3.03, after: 3.03 }], unallocated: { before: 0, after: 0 } }],
  users: [],
});

test("explicit money paths migrate to cents and non-money numerics do not", () => {
  const cents = toCentsDocument(legacy(), { bumpVersion: true });
  expect(cents.moneyScale).toBe(MONEY_SCALE);
  expect(cents.dataVersion).toBe(8);
  expect(cents.unallocatedBalance).toBe(1234);
  expect(cents.transactions[0]).toMatchObject({ amount: 1999, allocations: [{ amount: 456 }] });
  expect(cents.categories[0]).toMatchObject({ envelopeBalance: -1, baseAmount: 80025, monthlyBudget: 80025, suggestedPct: 2.5, sortOrder: 3 });
  expect(cents.recurring[0]).toMatchObject({ amount: 1050, dueDay: 31 });
  expect(cents.assets[0].value).toBe(123456);
  expect(cents.transfers[0].amount).toBe(789);
  expect(cents.reconcileLog[0]).toMatchObject({ pooled: 2001, returned: 202, toppedUp: 1, movements: [{ before: -501, amount: 501, after: 0 }] });
  expect(cents.adjustments[0].entries[0]).toEqual({ before: 101, amount: -101, after: 0 });
  expect(cents.openingBalances[0]).toMatchObject({ total: 303, amount: 303 });
  expect(() => assertCentsDocument(cents)).not.toThrow();
});

test("migration rounds binary residuals, reports them, and is idempotent", () => {
  const input = { ...legacy(), unallocatedBalance: 2.842170943040401e-14 };
  const inspection = inspectMoneyDocument(input);
  expect(inspection.rounded.unallocatedBalance).toBe(1);
  const once = toCentsDocument(input, { bumpVersion: true });
  expect(once.unallocatedBalance).toBe(0);
  expect(toCentsDocument(once, { bumpVersion: true })).toEqual(once);
});

test("legacy aliases are converted independently and mismatches are reported", () => {
  const input = legacy();
  input.categories[0].monthlyBudget = 700.25;
  input.categories.push({ envelopeBalance: 0, baseAmount: 0, monthlyBudget: null });
  expect(inspectMoneyDocument(input).aliasMismatches).toBe(1);
  const cents = toCentsDocument(input);
  expect(cents.categories[0]).toMatchObject({ baseAmount: 80025, monthlyBudget: 70025 });
  expect(cents.categories[1].monthlyBudget).toBeNull();
});

test("unexpected numeric paths and unknown scales fail closed", () => {
  expect(() => toCentsDocument({ ...legacy(), mysteryCount: 2 })).toThrow("Unexpected numeric paths: mysteryCount");
  expect(() => toCentsDocument({ ...toCentsDocument(legacy()), mysteryCount: 2 })).toThrow("Unexpected numeric paths: mysteryCount");
  expect(() => toCentsDocument({ ...legacy(), moneyScale: 10 })).toThrow("Unsupported moneyScale");
  expect(() => assertCentsDocument({ moneyScale: 100, unallocatedBalance: 1.5 })).toThrow("unallocatedBalance");
});

test("legacy compatibility decoding preserves values and removes the marker", () => {
  const cents = toCentsDocument(legacy());
  expect(toDollarsDocument(cents)).toEqual(legacy());
});

test("interactive input is strict while imports explicitly report rounding", () => {
  expect(parseAUDToCents("19.99")).toBe(1999);
  expect(parseAUDToCents("-0.01", { allowNegative: true })).toBe(-1);
  expect(centsToInput(-1)).toBe("-0.01");
  expect(() => parseAUDToCents("1.005")).toThrow("two decimal places");
  expect(() => parseAUDToCents("NaN")).toThrow();
  expect(parseImportedAUDToCents("1.005")).toEqual({ cents: 101, rounded: true });
});

test("external reconcile payloads remain dollar-valued including movements", () => {
  expect(reconcileEntryToDollars({ pooled: 1234, returned: 56, toppedUp: 2, movements: [{ before: -100, amount: 50, after: -50 }] })).toEqual({
    pooled: 12.34,
    returned: 0.56,
    toppedUp: 2,
    movements: [{ before: -1, amount: 0.5, after: -0.5 }],
  });
});
