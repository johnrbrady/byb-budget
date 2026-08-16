#!/usr/bin/env node
import fs from "fs";
import { inspectMoneyBytes, migrateMoneyFile, publicInspection } from "./money-file.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const stdin = args.includes("--stdin");
const files = args.filter((arg) => !arg.startsWith("--"));

try {
  if (stdin) {
    const label = files[0] || "stdin";
    const result = inspectMoneyBytes(fs.readFileSync(0), label);
    process.stdout.write(`${JSON.stringify(publicInspection({ ...result, wrote: false, recoveryFile: null }), null, 2)}\n`);
  } else {
    if (!files.length) throw new Error("Usage: node migrate-money.js --dry-run <budget.json...> | --stdin <label>");
    for (const file of files) {
      const result = migrateMoneyFile(file, { dryRun });
      process.stdout.write(`${JSON.stringify(publicInspection(result), null, 2)}\n`);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
