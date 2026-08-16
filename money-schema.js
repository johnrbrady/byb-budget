export const MONEY_SCALE = 100;
export const MONEY_SCALE_HEADER = "x-byb-money-scale";

const NON_MONEY_NUMERIC_PATHS = new Set([
  "dataVersion",
  "moneyScale",
  "categories[].suggestedPct",
  "categories[].sortOrder",
  "recurring[].dueDay",
  "reconcileLog[].toppedUp",
]);

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function walkMoney(document, visit) {
  const field = (owner, key, path) => {
    if (owner && Object.prototype.hasOwnProperty.call(owner, key) && owner[key] !== null && owner[key] !== undefined) {
      visit(owner, key, path);
    }
  };
  const fields = (owner, keys, prefix) => keys.forEach((key) => field(owner, key, `${prefix}.${key}`));

  field(document, "unallocatedBalance", "unallocatedBalance");
  for (const tx of document.transactions || []) {
    field(tx, "amount", "transactions[].amount");
    for (const allocation of tx.allocations || []) field(allocation, "amount", "transactions[].allocations[].amount");
  }
  for (const category of document.categories || []) {
    fields(category, ["envelopeBalance", "baseAmount", "monthlyBudget"], "categories[]");
  }
  for (const rule of document.recurring || []) field(rule, "amount", "recurring[].amount");
  for (const asset of document.assets || []) field(asset, "value", "assets[].value");
  for (const transfer of document.transfers || []) field(transfer, "amount", "transfers[].amount");
  for (const entry of document.reconcileLog || []) {
    fields(entry, ["pooled", "returned"], "reconcileLog[]");
    for (const movement of entry.movements || []) {
      fields(movement, ["before", "amount", "after"], "reconcileLog[].movements[]");
    }
  }
  for (const entry of document.adjustments || []) {
    fields(entry, ["before", "amount", "after"], "adjustments[]");
    for (const movement of entry.entries || []) {
      fields(movement, ["before", "amount", "after"], "adjustments[].entries[]");
    }
    fields(entry.unallocated, ["before", "after"], "adjustments[].unallocated");
  }
  for (const entry of document.openingBalances || []) {
    fields(entry, ["before", "amount", "after", "total"], "openingBalances[]");
    for (const movement of entry.entries || []) {
      fields(movement, ["before", "amount", "after", "total"], "openingBalances[].entries[]");
    }
    fields(entry.unallocated, ["before", "after"], "openingBalances[].unallocated");
  }
}

function numericPaths(value) {
  const paths = new Set();
  const walk = (current, path = "") => {
    if (typeof current === "number") {
      paths.add(path || "<root>");
    } else if (Array.isArray(current)) {
      for (const item of current) walk(item, `${path}[]`);
    } else if (current && typeof current === "object") {
      for (const [key, item] of Object.entries(current)) walk(item, path ? `${path}.${key}` : key);
    }
  };
  walk(value);
  return paths;
}

function knownMoneyPaths(document) {
  const paths = new Set();
  walkMoney(document, (_owner, _key, path) => paths.add(path));
  return paths;
}

export function unexpectedNumericPaths(document) {
  const money = knownMoneyPaths(document);
  return [...numericPaths(document)]
    .filter((path) => !money.has(path) && !NON_MONEY_NUMERIC_PATHS.has(path))
    .sort();
}

export function dollarsToCents(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("Money must be a finite number");
  const scaled = Number((Math.abs(value) * MONEY_SCALE).toFixed(8));
  const cents = Math.sign(value) * Math.round(scaled);
  if (!Number.isSafeInteger(cents)) throw new RangeError("Money is outside the safe integer range");
  return cents;
}

export function centsToDollars(value) {
  if (!Number.isSafeInteger(value)) throw new TypeError("Cents must be a safe integer");
  return value / MONEY_SCALE;
}

export function parseAUDToCents(value, { allowNegative = false } = {}) {
  const text = String(value ?? "").trim();
  const pattern = allowNegative ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(text)) throw new TypeError("Enter a dollar amount with no more than two decimal places");
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  const signed = negative ? -cents : cents;
  const number = Number(signed);
  if (!Number.isSafeInteger(number)) throw new RangeError("Money is outside the safe integer range");
  return number;
}

export function parseImportedAUDToCents(value) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(number)) throw new TypeError("Imported money must be a finite number");
  const cents = dollarsToCents(number);
  return { cents, rounded: centsToDollars(cents) !== number };
}

export function centsToInput(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (!Number.isSafeInteger(value)) throw new TypeError("Cents must be a safe integer");
  const negative = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative}${whole}.${fraction}`;
}

export function assertCentsDocument(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new TypeError("Budget must be an object");
  if (document.moneyScale !== MONEY_SCALE) throw new TypeError(`moneyScale must be ${MONEY_SCALE}`);
  walkMoney(document, (owner, key, path) => {
    if (!Number.isSafeInteger(owner[key])) throw new TypeError(`${path} must be a safe integer number of cents`);
  });
  if (document.dataVersion !== undefined && !Number.isSafeInteger(document.dataVersion)) {
    throw new TypeError("dataVersion must be a safe integer");
  }
  return document;
}

export function toCentsDocument(document, { bumpVersion = false, rejectUnexpected = true } = {}) {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new TypeError("Budget must be an object");
  if (document.moneyScale === MONEY_SCALE) {
    const unexpected = unexpectedNumericPaths(document);
    if (rejectUnexpected && unexpected.length) throw new TypeError(`Unexpected numeric paths: ${unexpected.join(", ")}`);
    return assertCentsDocument(clone(document));
  }
  if (document.moneyScale !== undefined) throw new TypeError(`Unsupported moneyScale: ${document.moneyScale}`);
  const unexpected = unexpectedNumericPaths(document);
  if (rejectUnexpected && unexpected.length) throw new TypeError(`Unexpected numeric paths: ${unexpected.join(", ")}`);
  const next = clone(document);
  walkMoney(next, (owner, key) => { owner[key] = dollarsToCents(owner[key]); });
  next.moneyScale = MONEY_SCALE;
  if (bumpVersion) next.dataVersion = (Number.isSafeInteger(next.dataVersion) ? next.dataVersion : 0) + 1;
  return assertCentsDocument(next);
}

export function toDollarsDocument(document) {
  const next = clone(assertCentsDocument(document));
  walkMoney(next, (owner, key) => { owner[key] = centsToDollars(owner[key]); });
  delete next.moneyScale;
  return next;
}

export function inspectMoneyDocument(document) {
  const counts = {};
  const rounded = {};
  walkMoney(document, (owner, key, path) => {
    counts[path] = (counts[path] || 0) + 1;
    if (document.moneyScale !== MONEY_SCALE && centsToDollars(dollarsToCents(owner[key])) !== owner[key]) {
      rounded[path] = (rounded[path] || 0) + 1;
    }
  });
  const aliasMismatches = (document.categories || []).filter((category) =>
    category.baseAmount !== null && category.baseAmount !== undefined &&
    category.monthlyBudget !== null && category.monthlyBudget !== undefined &&
    category.baseAmount !== category.monthlyBudget
  ).length;
  return {
    sourceScale: document.moneyScale ?? null,
    counts,
    rounded,
    aliasMismatches,
    unexpectedNumericPaths: unexpectedNumericPaths(document),
  };
}

export function reconcileEntryToDollars(entry) {
  if (!entry) return entry;
  return toDollarsDocument({ moneyScale: MONEY_SCALE, reconcileLog: [entry] }).reconcileLog[0];
}
