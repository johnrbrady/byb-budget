import {
  CURRENCIES,
  formatForeign,
  formatMoney,
  foreignDetail,
  impliedRate,
  isSupportedCurrency,
  minorToInput,
  parseAmountToMinor,
  parseRateToRational,
  convertCurrencyDocument,
} from "./currency.js";

const baseDocument = () => ({
  moneyScale: 100,
  settings: { currency: "AUD" },
  currencyHistory: [{ id: "h1", date: "2026-01-01", from: "AUD", to: "EUR", rate: 1.5 }],
  unallocatedBalance: 10000,
  transactions: [
    { id: "t-foreign", type: "expense", amount: 7500, currency: "EUR", foreignAmount: 7500, exchangeRate: 1 },
    {
      id: "t-income",
      type: "income",
      amount: 10000,
      allocations: [{ catId: "c-food", amount: 4000 }, { catId: "c-fun", amount: 6000 }],
    },
  ],
  categories: [
    { id: "c-food", envelopeBalance: -7500, baseAmount: 5000, monthlyBudget: 5000, targetAmount: 9000, suggestedPct: 2.5 },
  ],
  recurring: [{ id: "r1", amount: 1000, dueDay: 31 }],
  assets: [{ id: "a1", value: 100000 }],
  transfers: [{ id: "x1", amount: 1000 }],
  budgetHistory: [{ month: "2026-06", categories: [{ categoryId: "c-food", baseAmount: 5000, targetAmount: 9000 }] }],
  reconcileLog: [{
    id: "rec1",
    pooled: 1000,
    returned: 500,
    toppedUp: 1,
    movements: [
      { catId: "c-fun", before: 1000, amount: -1000, after: 0 },
      { catId: "c-food", before: -2000, amount: 500, after: -1500 },
    ],
  }],
  adjustments: [{
    id: "adj1",
    before: 1000,
    amount: -500,
    after: 500,
    entries: [{ catId: "c-food", before: 1000, amount: -500, after: 500 }],
    unallocated: { before: 0, after: 0 },
  }],
  openingBalances: [{
    id: "open1",
    total: 1000,
    amount: 1000,
    entries: [{ catId: "c-food", before: 0, amount: 1000, after: 1000 }],
    unallocated: { before: 0, after: 0 },
  }],
});

describe("currency list and formatting", () => {
  test("exposes a sorted ISO list and recognises common codes", () => {
    expect(CURRENCIES.length).toBeGreaterThan(20);
    expect([...CURRENCIES]).toEqual([...CURRENCIES].sort());
    for (const code of ["AUD", "USD", "EUR", "JPY", "KWD"]) expect(isSupportedCurrency(code)).toBe(true);
    expect(isSupportedCurrency("AUDX")).toBe(false);
  });

  test("main amounts stay at two decimals even for whole-number currencies", () => {
    expect(formatMoney(123456, "AUD")).toBe("$1,234.56");
    expect(formatMoney(123456, "JPY")).toBe("¥1,234.56");
    expect(formatMoney(123456, "KWD")).toContain("1,234.56");
  });

  test("foreign amounts use their native minor unit", () => {
    expect(formatForeign(1500, "JPY")).toBe("¥1,500");
    expect(formatForeign(1234, "KWD")).toContain("1.234");
    expect(formatForeign(7500, "EUR")).toBe("€75.00");
  });

  test("minor-unit inputs round-trip at the currency's precision", () => {
    expect(parseAmountToMinor("1500", "JPY")).toBe(1500);
    expect(parseAmountToMinor("1.234", "KWD")).toBe(1234);
    expect(parseAmountToMinor("75.00", "EUR")).toBe(7500);
    expect(parseAmountToMinor("-0.01", "AUD", { allowNegative: true })).toBe(-1);
    expect(minorToInput(1500, "JPY")).toBe("1500");
    expect(minorToInput(1234, "KWD")).toBe("1.234");
    expect(minorToInput(-1, "AUD")).toBe("-0.01");
    expect(() => parseAmountToMinor("1.5", "JPY")).toThrow("0 decimal places");
    expect(() => parseAmountToMinor("1.2345", "KWD")).toThrow("3 decimal places");
  });

  test("the implied rate is the main amount per foreign unit", () => {
    expect(impliedRate(7500, 12000, "EUR")).toBe(1.6);
    expect(impliedRate(1500, 12000, "JPY")).toBe(0.08);
    expect(impliedRate(0, 12000, "EUR")).toBe(0);
    expect(foreignDetail({ currency: "EUR", foreignAmount: 7500, exchangeRate: 1.6 })).toBe("€75.00 @ 1.6000");
    expect(foreignDetail({ amount: 100 })).toBeNull();
  });

  test("rates are parsed as exact positive rationals", () => {
    expect(parseRateToRational("0.65")).toEqual({ numerator: 65n, denominator: 100n });
    expect(parseRateToRational("1.60000000")).toEqual({ numerator: 160000000n, denominator: 100000000n });
    expect(() => parseRateToRational("0")).toThrow("greater than zero");
    expect(() => parseRateToRational("-1")).toThrow();
    expect(() => parseRateToRational("1.123456789")).toThrow("8 decimal places");
  });
});

describe("convertCurrencyDocument", () => {
  test("converts every money path and repairs derived audit fields", () => {
    const input = baseDocument();
    const converted = convertCurrencyDocument(input, { from: "AUD", to: "USD", rate: 0.5 });

    expect(converted.unallocatedBalance).toBe(5000);
    expect(converted.categories[0]).toMatchObject({ envelopeBalance: -3750, baseAmount: 2500, monthlyBudget: 2500, targetAmount: 4500, suggestedPct: 2.5 });
    expect(converted.transactions[1]).toMatchObject({ amount: 5000, allocations: [{ amount: 2000 }, { amount: 3000 }] });
    expect(converted.recurring[0]).toMatchObject({ amount: 500, dueDay: 31 });
    expect(converted.assets[0].value).toBe(50000);
    expect(converted.transfers[0].amount).toBe(500);
    expect(converted.budgetHistory[0].categories[0]).toMatchObject({ baseAmount: 2500, targetAmount: 4500 });

    expect(converted.adjustments[0]).toMatchObject({ before: 500, amount: -250, after: 250 });
    expect(converted.adjustments[0].entries[0]).toMatchObject({ before: 500, amount: -250, after: 250 });
    expect(converted.openingBalances[0]).toMatchObject({ total: 500, amount: 500 });
    expect(converted.openingBalances[0].entries[0]).toMatchObject({ before: 0, amount: 500, after: 500 });

    expect(converted.reconcileLog[0]).toMatchObject({ pooled: 500, returned: 250, toppedUp: 1 });
    expect(converted.reconcileLog[0].movements).toEqual([
      { catId: "c-fun", before: 500, amount: -500, after: 0 },
      { catId: "c-food", before: -1000, amount: 250, after: -750 },
    ]);

    expect(converted.settings).toEqual({ currency: "AUD" });
    expect(converted.currencyHistory).toEqual(input.currencyHistory);
  });

  test("keeps the foreign original and recomputes the implied rate", () => {
    const converted = convertCurrencyDocument(baseDocument(), { from: "AUD", to: "USD", rate: 0.5 });
    expect(converted.transactions[0]).toMatchObject({ amount: 3750, currency: "EUR", foreignAmount: 7500, exchangeRate: 0.5 });
  });

  test("rounds half away from zero, including negative balances", () => {
    const converted = convertCurrencyDocument({
      moneyScale: 100,
      unallocatedBalance: 1,
      categories: [{ id: "c1", envelopeBalance: -3, baseAmount: 0 }],
    }, { from: "AUD", to: "USD", rate: 0.5 });
    expect(converted.unallocatedBalance).toBe(1);
    expect(converted.categories[0].envelopeBalance).toBe(-2);
  });

  test("clamps income allocations that rounding pushed over the amount", () => {
    const converted = convertCurrencyDocument({
      moneyScale: 100,
      unallocatedBalance: 0,
      transactions: [{ id: "t", type: "income", amount: 5, allocations: [{ catId: "a", amount: 3 }, { catId: "b", amount: 3 }] }],
    }, { from: "AUD", to: "USD", rate: 1 });
    const allocations = converted.transactions[0].allocations;
    expect(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(5);
    expect(allocations).toEqual([{ catId: "a", amount: 3 }, { catId: "b", amount: 2 }]);
  });

  test("rejects unsupported currencies and invalid rates", () => {
    expect(() => convertCurrencyDocument(baseDocument(), { from: "AUD", to: "AUD", rate: 1 })).toThrow("different currency");
    expect(() => convertCurrencyDocument(baseDocument(), { from: "AUD", to: "ZZZ", rate: 1 })).toThrow("Unsupported currency");
    expect(() => convertCurrencyDocument(baseDocument(), { from: "AUD", to: "USD", rate: 0 })).toThrow("greater than zero");
    expect(() => convertCurrencyDocument(baseDocument(), { from: "AUD", to: "USD", rate: "nope" })).toThrow();
  });

  test("does not mutate the input document", () => {
    const input = baseDocument();
    const snapshot = JSON.parse(JSON.stringify(input));
    convertCurrencyDocument(input, { from: "AUD", to: "USD", rate: 2 });
    expect(input).toEqual(snapshot);
  });
});
