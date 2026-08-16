import fs from "fs";
import os from "os";
import path from "path";
import { migrateMoneyFile } from "../money-file.js";

const legacy = () => ({
  dataVersion: 4,
  unallocatedBalance: 19.99,
  transactions: [{ amount: 19.99 }],
  categories: [{ envelopeBalance: -0.01, baseAmount: 20, monthlyBudget: 20 }],
});

let dir;
let file;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "byb-cents-"));
  file = path.join(dir, "budget.json");
  fs.writeFileSync(file, JSON.stringify(legacy(), null, 2));
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("dry-run hashes and counts without changing the original", () => {
  const before = fs.readFileSync(file);
  const result = migrateMoneyFile(file, { dryRun: true });
  expect(result).toMatchObject({ wrote: false, alreadyCents: false, sourceVersion: 4, targetVersion: 5, aliasMismatches: 0 });
  expect(result.invariants).toEqual({ ledgerRoundingConserved: true, allocationsWithinIncome: true, reconcileMovementsBalance: true, adjustmentsExplainChange: true });
  expect(result.moneyFieldCount).toBe(5);
  expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  expect(result.targetHash).toMatch(/^[0-9a-f]{64}$/);
  expect(fs.readFileSync(file)).toEqual(before);
  expect(fs.readdirSync(dir)).toEqual(["budget.json"]);
});

test("write mode leaves an exact recovery file and a validated cents document", () => {
  const before = fs.readFileSync(file);
  const result = migrateMoneyFile(file);
  expect(result.wrote).toBe(true);
  expect(fs.readFileSync(result.recoveryFile)).toEqual(before);
  const migrated = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(migrated).toMatchObject({ moneyScale: 100, dataVersion: 5, unallocatedBalance: 1999 });
  expect(migrated.transactions[0].amount).toBe(1999);
  const second = migrateMoneyFile(file);
  expect(second).toMatchObject({ alreadyCents: true, wrote: false, targetVersion: 5 });
});

test("an injected failure before rename leaves original bytes untouched", () => {
  const before = fs.readFileSync(file);
  expect(() => migrateMoneyFile(file, { beforeRename: () => { throw new Error("injected"); } })).toThrow("injected");
  expect(fs.readFileSync(file)).toEqual(before);
  expect(fs.readdirSync(dir).filter((name) => name.includes(".tmp"))).toEqual([]);
  expect(fs.readdirSync(dir).some((name) => name.includes("pre-cents"))).toBe(true);
});
