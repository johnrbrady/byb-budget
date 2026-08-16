import fs from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";
import { assertCentsDocument, dollarsToCents, inspectMoneyDocument, toCentsDocument } from "./money-schema.js";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function inspectMoneyBytes(bytes, label = "budget.json") {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const document = JSON.parse(source.toString("utf8"));
  const inspection = inspectMoneyDocument(document);
  if (inspection.unexpectedNumericPaths.length) {
    throw new Error(`${label}: unexpected numeric paths: ${inspection.unexpectedNumericPaths.join(", ")}`);
  }
  const migrated = toCentsDocument(document, { bumpVersion: document.moneyScale === undefined });
  const target = Buffer.from(JSON.stringify(migrated, null, 2));
  const sourceLedger = (document.unallocatedBalance || 0) + (document.categories || []).reduce((sum, category) => sum + (category.envelopeBalance || 0), 0);
  const targetLedger = (migrated.unallocatedBalance || 0) + (migrated.categories || []).reduce((sum, category) => sum + (category.envelopeBalance || 0), 0);
  const ledgerRoundingConserved = document.moneyScale === 100 ? sourceLedger === targetLedger : dollarsToCents(sourceLedger) === targetLedger;
  const allocationsWithinIncome = (migrated.transactions || []).every((transaction) =>
    transaction.type !== "income" || (transaction.allocations || []).reduce((sum, allocation) => sum + allocation.amount, 0) <= transaction.amount
  );
  const reconcileMovementsBalance = (migrated.reconcileLog || []).every((entry) => {
    if (!Array.isArray(entry.movements) || entry.movements.length === 0) return true;
    return entry.movements.every((movement) => movement.after === movement.before + movement.amount) &&
      entry.movements.reduce((sum, movement) => sum + movement.amount, 0) + entry.returned === 0;
  });
  const adjustmentsExplainChange = (migrated.adjustments || []).every((entry) =>
    entry.before === undefined || entry.after === undefined || entry.amount === undefined || entry.after - entry.before === entry.amount
  );
  const invariants = { ledgerRoundingConserved, allocationsWithinIncome, reconcileMovementsBalance, adjustmentsExplainChange };
  const failedInvariants = Object.entries(invariants).filter(([, passed]) => !passed).map(([name]) => name);
  if (failedInvariants.length) throw new Error(`${label}: migration invariants failed: ${failedInvariants.join(", ")}`);
  return {
    label,
    alreadyCents: document.moneyScale === 100,
    sourceHash: sha256(source),
    targetHash: sha256(target),
    sourceVersion: Number.isSafeInteger(document.dataVersion) ? document.dataVersion : 0,
    targetVersion: migrated.dataVersion,
    moneyFieldCount: Object.values(inspection.counts).reduce((sum, count) => sum + count, 0),
    invariants,
    ...inspection,
    document: migrated,
  };
}

function writeSynced(file, bytes, flags = "wx") {
  const fd = fs.openSync(file, flags, 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function migrateMoneyFile(file, { dryRun = false, beforeRename } = {}) {
  const source = fs.readFileSync(file);
  const result = inspectMoneyBytes(source, file);
  if (result.alreadyCents || dryRun) return { ...result, wrote: false, recoveryFile: null };

  const extension = path.extname(file);
  const base = file.slice(0, -extension.length);
  const recoveryFile = `${base}.pre-cents-${result.sourceHash.slice(0, 12)}${extension}`;
  if (fs.existsSync(recoveryFile)) {
    if (sha256(fs.readFileSync(recoveryFile)) !== result.sourceHash) throw new Error(`Recovery file collision: ${recoveryFile}`);
  } else {
    writeSynced(recoveryFile, source);
  }

  const temporary = `${file}.money-${process.pid}-${randomBytes(6).toString("hex")}.tmp`;
  const target = Buffer.from(JSON.stringify(result.document, null, 2));
  try {
    writeSynced(temporary, target);
    beforeRename?.({ file, temporary, recoveryFile });
    fs.renameSync(temporary, file);
    const dir = fs.openSync(path.dirname(file), "r");
    try {
      try { fs.fsyncSync(dir); } catch (error) {
        // Windows does not permit fsync on a directory handle. The production
        // NAS is Linux and takes this durability barrier; local Windows tests
        // still exercise file fsync + atomic same-directory rename.
        if (process.platform !== "win32" || !["EPERM", "EINVAL", "EBADF"].includes(error.code)) throw error;
      }
    } finally { fs.closeSync(dir); }
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    throw error;
  }

  const reread = JSON.parse(fs.readFileSync(file, "utf8"));
  assertCentsDocument(reread);
  if (sha256(Buffer.from(JSON.stringify(reread, null, 2))) !== result.targetHash) {
    throw new Error(`Post-migration hash mismatch: ${file}`);
  }
  return { ...result, wrote: true, recoveryFile };
}

export function publicInspection(result) {
  const { document: _document, ...safe } = result;
  return safe;
}
