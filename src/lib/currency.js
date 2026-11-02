// Currency support.
//
// Main-currency amounts are always integer hundredths of the currency unit
// (`MONEY_SCALE`), even for currencies whose own minor unit is 0 or 3 digits.
// Foreign amounts are native minor units of their own currency, which is why
// `foreignAmount` is deliberately not in money-schema's money paths.
//
// This module holds no React state. The active main currency is read by
// formatters at render time, and BudgetApp sets it synchronously before its
// children render.

import { MONEY_SCALE, forEachMoneyPath } from "../../money-schema.js";
import { clampAllocations } from "./money.js";

export const DEFAULT_CURRENCY = "AUD";

const FALLBACK_CURRENCIES = [
  "AED", "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "COP", "CZK",
  "DKK", "EGP", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS", "INR", "ISK",
  "JPY", "KRW", "KWD", "MXN", "MYR", "NGN", "NOK", "NZD", "PEN", "PHP",
  "PKR", "PLN", "QAR", "RON", "RUB", "SAR", "SEK", "SGD", "THB", "TRY",
  "TWD", "UAH", "USD", "VND", "ZAR",
];

function supportedCurrencies() {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("currency");
      if (Array.isArray(values) && values.length > 0) return [...new Set(values)].sort();
    }
  } catch {
    // Older engines may expose the function but not the currency key.
  }
  return [...new Set(FALLBACK_CURRENCIES)].sort();
}

export const CURRENCIES = supportedCurrencies();

const CURRENCY_SET = new Set(CURRENCIES);

export function isSupportedCurrency(code) {
  return typeof code === "string" && CURRENCY_SET.has(code);
}

let activeCurrency = DEFAULT_CURRENCY;

export function setActiveCurrency(code) {
  if (isSupportedCurrency(code)) activeCurrency = code;
  return activeCurrency;
}

export function getActiveCurrency() {
  return activeCurrency;
}

const fractionCache = new Map();

export function currencyFractionDigits(code) {
  const currency = isSupportedCurrency(code) ? code : DEFAULT_CURRENCY;
  if (fractionCache.has(currency)) return fractionCache.get(currency);
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    digits = 2;
  }
  fractionCache.set(currency, digits);
  return digits;
}

const mainFormatterCache = new Map();

function mainFormatter(code) {
  const currency = isSupportedCurrency(code) ? code : DEFAULT_CURRENCY;
  if (mainFormatterCache.has(currency)) return mainFormatterCache.get(currency);
  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  mainFormatterCache.set(currency, formatter);
  return formatter;
}

/** Format a main-currency amount, which is always stored in hundredths. */
export function formatMoney(cents, code = activeCurrency) {
  return mainFormatter(code).format((cents || 0) / MONEY_SCALE);
}

const foreignFormatterCache = new Map();

function foreignFormatter(code) {
  const currency = isSupportedCurrency(code) ? code : DEFAULT_CURRENCY;
  const digits = currencyFractionDigits(currency);
  const key = `${currency}:${digits}`;
  if (foreignFormatterCache.has(key)) return foreignFormatterCache.get(key);
  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  foreignFormatterCache.set(key, formatter);
  return formatter;
}

/** Format a foreign amount, which is stored in that currency's minor unit. */
export function formatForeign(minor, code) {
  const digits = currencyFractionDigits(code);
  return foreignFormatter(code).format((minor || 0) / 10 ** digits);
}

/** Render a foreign minor-unit amount as a form input string. */
export function minorToInput(minor, code) {
  if (minor === "" || minor === null || minor === undefined) return "";
  if (!Number.isSafeInteger(minor)) throw new TypeError("Foreign amount must be a safe integer of minor units");
  const digits = currencyFractionDigits(code);
  const negative = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  if (digits === 0) return `${negative}${absolute}`;
  const scale = 10 ** digits;
  const whole = Math.floor(absolute / scale);
  const fraction = String(absolute % scale).padStart(digits, "0");
  return `${negative}${whole}.${fraction}`;
}

/** Parse a decimal amount at the currency's native precision into minor units. */
export function parseAmountToMinor(text, code, { allowNegative = false } = {}) {
  const digits = currencyFractionDigits(code);
  const value = String(text ?? "").trim();
  const pattern = digits === 0
    ? (allowNegative ? /^-?\d+$/ : /^\d+$/)
    : (allowNegative ? new RegExp(`^-?\\d+(?:\\.\\d{1,${digits}})?$`) : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`));
  if (!pattern.test(value)) throw new TypeError(`Enter an amount with no more than ${digits} decimal place${digits === 1 ? "" : "s"}`);
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const scale = BigInt(10 ** digits);
  const minor = BigInt(whole) * scale + BigInt((fraction.padEnd(digits, "0") || "0"));
  const signed = negative ? -minor : minor;
  const number = Number(signed);
  if (!Number.isSafeInteger(number)) throw new RangeError("Amount is outside the safe integer range");
  return number;
}

/**
 * Main units per one foreign unit, derived from what was actually charged.
 * Rounded to 8 decimal places because it is informational, not ledger data.
 */
export function impliedRate(foreignMinor, mainCents, code) {
  if (!Number.isSafeInteger(foreignMinor) || foreignMinor === 0) return 0;
  if (!Number.isSafeInteger(mainCents)) return 0;
  const digits = currencyFractionDigits(code);
  const mainUnits = mainCents / 100;
  const foreignUnits = foreignMinor / 10 ** digits;
  if (!Number.isFinite(mainUnits) || !Number.isFinite(foreignUnits) || foreignUnits === 0) return 0;
  return Number((mainUnits / foreignUnits).toFixed(8));
}

/** Secondary display line for a foreign expense, or null for a main-only row. */
export function foreignDetail(tx) {
  if (!tx || !tx.currency || !Number.isSafeInteger(tx.foreignAmount) || tx.foreignAmount <= 0) return null;
  const amount = formatForeign(tx.foreignAmount, tx.currency);
  if (!Number.isFinite(tx.exchangeRate) || tx.exchangeRate <= 0) return amount;
  return `${amount} @ ${tx.exchangeRate.toFixed(4)}`;
}

const displayNames = (() => {
  try {
    return new Intl.DisplayNames(["en-AU"], { type: "currency" });
  } catch {
    return null;
  }
})();

export function currencyName(code) {
  try {
    return displayNames?.of(code) || code;
  } catch {
    return code;
  }
}

/**
 * Parse a positive decimal rate into an exact BigInt rational.
 * At most 8 decimal places, which is the precision the UI allows.
 */
export function parseRateToRational(text) {
  const value = String(text ?? "").trim();
  if (!/^\d+(?:\.\d{1,8})?$/.test(value)) throw new TypeError("Enter a positive rate with no more than 8 decimal places");
  const [whole, fraction = ""] = value.split(".");
  const numerator = BigInt(whole + fraction);
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator <= 0n) throw new RangeError("Rate must be greater than zero");
  return { numerator, denominator };
}

const toRational = (rate) => {
  if (rate && typeof rate === "object" && typeof rate.numerator === "bigint" && typeof rate.denominator === "bigint") {
    if (rate.numerator <= 0n || rate.denominator <= 0n) throw new RangeError("Rate must be greater than zero");
    return rate;
  }
  const number = typeof rate === "number" ? rate : Number(rate);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError("Rate must be a finite number greater than zero");
  return parseRateToRational(Number.isFinite(number) ? number.toFixed(8) : String(number));
};

const scaleInteger = (value, { numerator, denominator }) => {
  const product = BigInt(value) * numerator;
  const negative = product < 0n;
  const absolute = negative ? -product : product;
  let quotient = absolute / denominator;
  const remainder = absolute % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  const result = Number(negative ? -quotient : quotient);
  if (!Number.isSafeInteger(result)) throw new RangeError("Converted amount is outside the safe integer range");
  return result;
};

/**
 * Convert every main-currency amount in a household document.
 *
 * Derived audit fields are recomputed from their converted parents rather than
 * scaled on their own, so a log entry cannot end up claiming a movement the
 * balances did not make. Foreign originals are never re-denominated.
 */
export function convertCurrencyDocument(document, { from = DEFAULT_CURRENCY, to, rate } = {}) {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new TypeError("Budget must be an object");
  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) throw new TypeError("Unsupported currency");
  if (from === to) throw new TypeError("Choose a different currency");
  const rational = toRational(rate);
  const next = JSON.parse(JSON.stringify(document));

  forEachMoneyPath(next, (owner, key) => {
    owner[key] = scaleInteger(owner[key], rational);
  });

  for (const transaction of next.transactions || []) {
    if (transaction.type === "income" && Array.isArray(transaction.allocations)) {
      transaction.allocations = clampAllocations(transaction.allocations, transaction.amount);
    }
    if (transaction.currency && Number.isSafeInteger(transaction.foreignAmount) && transaction.foreignAmount > 0) {
      transaction.exchangeRate = impliedRate(transaction.foreignAmount, transaction.amount, transaction.currency);
    }
  }

  for (const entry of next.adjustments || []) {
    if (Number.isSafeInteger(entry.before) && Number.isSafeInteger(entry.after)) entry.amount = entry.after - entry.before;
    for (const movement of entry.entries || []) {
      if (Number.isSafeInteger(movement.before) && Number.isSafeInteger(movement.after)) movement.amount = movement.after - movement.before;
    }
  }

  for (const entry of next.openingBalances || []) {
    const entries = Array.isArray(entry.entries) ? entry.entries : [];
    for (const movement of entries) {
      if (Number.isSafeInteger(movement.before) && Number.isSafeInteger(movement.after)) movement.amount = movement.after - movement.before;
    }
    if (entries.length > 0) {
      const total = entries.reduce((sum, movement) => sum + movement.amount, 0);
      entry.total = total;
      if (Number.isSafeInteger(entry.amount)) entry.amount = total;
    }
  }

  for (const entry of next.reconcileLog || []) {
    const movements = Array.isArray(entry.movements) ? entry.movements : [];
    for (const movement of movements) {
      if (Number.isSafeInteger(movement.before) && Number.isSafeInteger(movement.after)) movement.amount = movement.after - movement.before;
    }
    if (movements.length > 0) {
      const returned = -movements.reduce((sum, movement) => sum + movement.amount, 0);
      const positive = movements.reduce((sum, movement) => sum + (movement.amount > 0 ? movement.amount : 0), 0);
      entry.returned = returned;
      entry.pooled = returned + positive;
    }
  }

  return next;
}
