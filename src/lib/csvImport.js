import { parseImportedAUDToCents } from "../../money-schema.js";

const HEADER_ALIASES = {
  date: ["date", "transactiondate", "posteddate", "processeddate", "valuedate"],
  description: ["description", "details", "narrative", "merchant", "transactiondescription", "memo", "reference"],
  amount: ["amount", "transactionamount", "value"],
  debit: ["debit", "withdrawal", "withdrawals", "moneyout", "debitamount"],
  credit: ["credit", "deposit", "deposits", "moneyin", "creditamount"],
};
export const MAX_BANK_CSV_BYTES = 5 * 1024 * 1024;
const MAX_CSV_TRANSACTION_ROWS = 50_000;

function exceedsUtf8Bytes(text, limit) {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index++;
    } else bytes += 3;
    if (bytes > limit) return true;
  }
  return false;
}

const normaliseHeader = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const normaliseDescription = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

// RFC 4180 reader. Bank descriptions commonly contain commas, quotes and even
// line breaks, so splitting lines/commas is not safe enough for statement data.
export function parseCsv(text, { maxRows = Number.POSITIVE_INFINITY } = {}) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) {
        rows.push(row);
        if (rows.length > maxRows) throw new Error(`The CSV may contain at most ${MAX_CSV_TRANSACTION_ROWS.toLocaleString("en-AU")} transaction rows`);
      }
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) {
    rows.push(row);
    if (rows.length > maxRows) throw new Error(`The CSV may contain at most ${MAX_CSV_TRANSACTION_ROWS.toLocaleString("en-AU")} transaction rows`);
  }
  return rows;
}

const columnIndex = (headers, kind) => {
  const accepted = new Set(HEADER_ALIASES[kind]);
  return headers.findIndex((header) => accepted.has(normaliseHeader(header)));
};

function parseDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (match) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    if (month) return validDate(Number(match[3]), month, Number(match[1]));
  }
  return null;
}

function validDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseBankAmount(value) {
  let text = String(value ?? "").trim();
  if (!text) return null;
  const parenthesised = /^\(.*\)$/.test(text);
  const debitSuffix = /\b(?:dr|debit)\s*$/i.test(text);
  const creditSuffix = /\b(?:cr|credit)\s*$/i.test(text);
  text = text.replace(/\b(?:dr|cr|debit|credit)\s*$/i, "").replace(/[\s,$AUD]/gi, "");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(text)) return null;
  let number = Number(text);
  if (!Number.isFinite(number)) return null;
  if (parenthesised || debitSuffix) number = -Math.abs(number);
  if (creditSuffix) number = Math.abs(number);
  const parsed = parseImportedAUDToCents(number);
  return { cents: parsed.cents, rounded: parsed.rounded };
}

export const transactionFingerprint = (transaction) => [
  transaction.date,
  transaction.type,
  Math.abs(transaction.amount),
  normaliseDescription(transaction.description),
].join("|");

/** Parse common Australian bank statement CSV layouts into integer-cent rows. */
export function parseBankCsv(text, existingTransactions = []) {
  const source = String(text || "");
  if (exceedsUtf8Bytes(source, MAX_BANK_CSV_BYTES)) {
    throw new Error("The CSV must be 5 MB or smaller");
  }
  // One header plus the supported number of transaction rows.
  const matrix = parseCsv(source, { maxRows: MAX_CSV_TRANSACTION_ROWS + 1 });
  if (matrix.length < 2) throw new Error("The CSV does not contain any transaction rows");
  const headers = matrix[0];
  const indexes = {
    date: columnIndex(headers, "date"),
    description: columnIndex(headers, "description"),
    amount: columnIndex(headers, "amount"),
    debit: columnIndex(headers, "debit"),
    credit: columnIndex(headers, "credit"),
  };
  if (indexes.date < 0) throw new Error("Could not find a Date column");
  if (indexes.description < 0) throw new Error("Could not find a Description or Details column");
  if (indexes.amount < 0 && indexes.debit < 0 && indexes.credit < 0) {
    throw new Error("Could not find Amount, Debit/Withdrawal or Credit/Deposit columns");
  }

  // Treat duplicate protection as a multiset rather than a Set. Two identical
  // coffees on the same day may both be real; re-importing the same statement
  // should consume the two matching existing rows, while a third occurrence is
  // still allowed through.
  const existingCounts = new Map();
  existingTransactions.forEach((transaction) => {
    const fingerprint = transactionFingerprint(transaction);
    existingCounts.set(fingerprint, (existingCounts.get(fingerprint) || 0) + 1);
  });
  const rows = [];
  let invalid = 0;
  let duplicates = 0;
  let rounded = 0;
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex++) {
    const source = matrix[rowIndex];
    const date = parseDate(source[indexes.date]);
    const description = String(source[indexes.description] || "").trim();
    let amount;
    let type;
    if (indexes.amount >= 0) {
      const signed = parseBankAmount(source[indexes.amount]);
      if (signed && signed.cents !== 0) {
        amount = Math.abs(signed.cents);
        type = signed.cents < 0 ? "expense" : "income";
        if (signed.rounded) rounded++;
      }
    } else {
      const debit = indexes.debit >= 0 ? parseBankAmount(source[indexes.debit]) : null;
      const credit = indexes.credit >= 0 ? parseBankAmount(source[indexes.credit]) : null;
      if (debit && debit.cents !== 0) { amount = Math.abs(debit.cents); type = "expense"; if (debit.rounded) rounded++; }
      else if (credit && credit.cents !== 0) { amount = Math.abs(credit.cents); type = "income"; if (credit.rounded) rounded++; }
    }
    if (!date || !description || !Number.isSafeInteger(amount) || amount <= 0 || !type) { invalid++; continue; }
    const candidate = { date, description, amount, type, sourceRow: rowIndex + 1 };
    const fingerprint = transactionFingerprint(candidate);
    const alreadyStored = existingCounts.get(fingerprint) || 0;
    if (alreadyStored > 0) { existingCounts.set(fingerprint, alreadyStored - 1); duplicates++; continue; }
    rows.push(candidate);
  }
  return { rows, invalid, duplicates, rounded };
}

/** Prefer the category most often used for the same description, then latest. */
export function categoryHistory(transactions) {
  const grouped = new Map();
  (transactions || []).forEach((transaction, index) => {
    const key = `${transaction.type}|${normaliseDescription(transaction.description)}`;
    if (!normaliseDescription(transaction.description) || !transaction.categoryId) return;
    const categories = grouped.get(key) || new Map();
    const record = categories.get(transaction.categoryId) || { count: 0, latest: -1 };
    record.count++;
    record.latest = Math.max(record.latest, Date.parse(transaction.createdAt || transaction.date || "") || -index);
    categories.set(transaction.categoryId, record);
    grouped.set(key, categories);
  });
  const result = new Map();
  grouped.forEach((categories, key) => {
    const winner = [...categories.entries()].sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest || a[0].localeCompare(b[0]))[0];
    if (winner) result.set(key, winner[0]);
  });
  return result;
}
