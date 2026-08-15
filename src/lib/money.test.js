import {
  householdTotal,
  applyTxEffect,
  allocationsForForm,
  saveTransactionEffect,
  envelopeFillPlan,
  applyEnvelopeFill,
  removeEnvelope,
  reconcileLedger,
  applyOpeningBalances,
} from "./money.js";

// The rule every one of these functions serves: household money is
// `unallocatedBalance` plus every `envelopeBalance`, and only adding or removing
// a real transaction may change that sum.
//
// `total` is deliberately reimplemented here rather than reusing the module's
// own householdTotal, so a bug in that helper cannot make an invariant
// assertion agree with the code it is checking. householdTotal gets its own
// tests against these hand-computed numbers instead.
const total = (ledger) =>
  ledger.categories.reduce((s, c) => s + (c.envelopeBalance || 0), 0) + ledger.unallocatedBalance;

const envelope = (id, balance, extra = {}) =>
  ({ id, name: id, type: "expense", colour: "#7FB069", baseAmount: 100, envelopeBalance: balance, isAccumulating: false, ...extra });

const balanceOf = (ledger, id) => ledger.categories.find((c) => c.id === id).envelopeBalance;

const ledgerOf = (unallocatedBalance, ...categories) => ({ categories, unallocatedBalance });

describe("householdTotal", () => {
  test("adds unallocated to every envelope balance", () => {
    expect(householdTotal(ledgerOf(50, envelope("a", 300), envelope("b", 200)))).toBe(550);
  });

  test("a missing envelopeBalance counts as zero, and an overdraw counts against the total", () => {
    expect(householdTotal(ledgerOf(10, { id: "a", type: "expense" }, envelope("b", -75)))).toBe(-65);
  });
});

describe("applyTxEffect", () => {
  const expense = { id: "t", type: "expense", categoryId: "a", amount: 40 };
  const plainIncome = { id: "t", type: "income", categoryId: "inc", amount: 500, allocations: [] };
  const allocatedIncome = { id: "t", type: "income", categoryId: "inc", amount: 500, allocations: [{ catId: "a", amount: 300 }, { catId: "b", amount: 150 }] };

  test("an expense comes out of its envelope and nowhere else", () => {
    const before = ledgerOf(50, envelope("a", 300), envelope("b", 200));
    const after = applyTxEffect(before, expense, 1);
    expect(balanceOf(after, "a")).toBe(260);
    expect(balanceOf(after, "b")).toBe(200);
    expect(after.unallocatedBalance).toBe(50);
    expect(total(after)).toBe(total(before) - 40);
  });

  test("unallocated income raises unallocated only", () => {
    const before = ledgerOf(50, envelope("a", 300));
    const after = applyTxEffect(before, plainIncome, 1);
    expect(after.unallocatedBalance).toBe(550);
    expect(balanceOf(after, "a")).toBe(300);
    expect(total(after)).toBe(total(before) + 500);
  });

  test("allocations route income straight into envelopes, and only the remainder lands in unallocated", () => {
    const before = ledgerOf(50, envelope("a", 300), envelope("b", 200));
    const after = applyTxEffect(before, allocatedIncome, 1);
    expect(balanceOf(after, "a")).toBe(600);
    expect(balanceOf(after, "b")).toBe(350);
    expect(after.unallocatedBalance).toBe(100); // 50 + (500 - 450)
    // The total moves by the transaction amount and nothing else — allocations
    // only decide how it is split, never how much of it there is.
    expect(total(after)).toBe(total(before) + 500);
  });

  test("reversing puts every allocation back where it came from", () => {
    const before = ledgerOf(50, envelope("a", 300), envelope("b", 200));
    const round = applyTxEffect(applyTxEffect(before, allocatedIncome, 1), allocatedIncome, -1);
    expect(round).toEqual(before);
  });

  test("a missing envelopeBalance is treated as zero rather than NaN", () => {
    const after = applyTxEffect(ledgerOf(0, { id: "a", type: "expense" }), { type: "expense", categoryId: "a", amount: 25 }, 1);
    expect(balanceOf(after, "a")).toBe(-25);
  });

  test("the input ledger is not mutated", () => {
    const before = ledgerOf(50, envelope("a", 300));
    applyTxEffect(before, allocatedIncome, 1);
    expect(before.unallocatedBalance).toBe(50);
    expect(balanceOf(before, "a")).toBe(300);
  });
});

describe("allocationsForForm", () => {
  test("an expense never allocates", () => {
    expect(allocationsForForm({ type: "expense", amount: 40, allocatedEnvelopeId: "a" }, 100)).toEqual([]);
  });

  test("no envelope chosen means the money stays unallocated", () => {
    expect(allocationsForForm({ type: "income", amount: 500, allocatedEnvelopeId: "" }, 100)).toEqual([]);
  });

  test("a chosen envelope takes the whole amount", () => {
    expect(allocationsForForm({ type: "income", amount: 500, allocatedEnvelopeId: "a" }, 100))
      .toEqual([{ catId: "a", amount: 500 }]);
  });

  test("a new allocation is capped so it cannot push unallocated below zero", () => {
    // Unallocated is already -400; the $500 income only lifts it to $100, so at
    // most $100 can be routed into an envelope.
    expect(allocationsForForm({ type: "income", amount: 500, allocatedEnvelopeId: "a" }, -400))
      .toEqual([{ catId: "a", amount: 100 }]);
    expect(allocationsForForm({ type: "income", amount: 500, allocatedEnvelopeId: "a" }, -600)).toEqual([]);
  });

  // DEF-004: the form's single select cannot express a split, and the old code
  // read only `allocatedEnvelopeId` — so every split came back as [] and the
  // envelopes were drained.
  test("a split across several envelopes is carried through untouched", () => {
    const split = [{ catId: "a", amount: 300 }, { catId: "b", amount: 200 }];
    expect(allocationsForForm({ type: "income", amount: 500, allocations: split, allocatedEnvelopeId: "" }, 0))
      .toEqual(split);
  });

  test("a split is preserved even when unallocated is already negative", () => {
    // The money is already in those envelopes; re-clamping it here would move it
    // back out, which is the bug this whole function exists to stop.
    const split = [{ catId: "a", amount: 300 }, { catId: "b", amount: 200 }];
    expect(allocationsForForm({ type: "income", amount: 500, allocations: split }, -900)).toEqual(split);
  });

  test("a split larger than the amount is scaled down proportionally, not truncated", () => {
    const split = [{ catId: "a", amount: 300 }, { catId: "b", amount: 200 }];
    const scaled = allocationsForForm({ type: "income", amount: 400, allocations: split }, 0);
    expect(scaled).toEqual([{ catId: "a", amount: 240 }, { catId: "b", amount: 160 }]);
    expect(scaled.reduce((s, a) => s + a.amount, 0)).toBe(400);
  });

  test("scaling that does not divide evenly still sums to the amount exactly", () => {
    const split = [{ catId: "a", amount: 100 }, { catId: "b", amount: 100 }, { catId: "c", amount: 100 }];
    const scaled = allocationsForForm({ type: "income", amount: 100, allocations: split }, 0);
    expect(scaled.reduce((s, a) => s + a.amount, 0)).toBe(100);
    expect(scaled.map((a) => a.catId)).toEqual(["a", "b", "c"]);
  });

  test("a split of one falls through to the select, so clearing it releases the money", () => {
    const single = [{ catId: "a", amount: 300 }];
    expect(allocationsForForm({ type: "income", amount: 300, allocations: single, allocatedEnvelopeId: "a" }, 50))
      .toEqual([{ catId: "a", amount: 300 }]);
    expect(allocationsForForm({ type: "income", amount: 300, allocations: single, allocatedEnvelopeId: "" }, 50))
      .toEqual([]);
  });
});

describe("saveTransactionEffect", () => {
  const income = (allocations, amount = 300) => ({
    id: "t", date: "2026-06-01", type: "income", categoryId: "inc", amount,
    description: "Payslip", allocations,
  });

  // DEF-004, stated as plainly as it can be: the money must not notice.
  test("editing only the description of a single-envelope income moves nothing", () => {
    const before = ledgerOf(50, envelope("a", 300), envelope("b", 200));
    const previous = income([{ catId: "a", amount: 300 }]);
    const form = { ...previous, description: "Payslip — June", allocatedEnvelopeId: "a" };
    const { ledger: after, transaction } = saveTransactionEffect(before, previous, form);

    expect(after).toEqual(before);
    expect(total(after)).toBe(550);
    expect(transaction.description).toBe("Payslip — June");
    expect(transaction.allocations).toEqual([{ catId: "a", amount: 300 }]);
  });

  test("editing only the description of a split income moves nothing", () => {
    const before = ledgerOf(0, envelope("a", 300), envelope("b", 200));
    const split = [{ catId: "a", amount: 300 }, { catId: "b", amount: 200 }];
    const previous = income(split, 500);
    const { ledger: after, transaction } = saveTransactionEffect(before, previous, { ...previous, description: "Payslip — June" });

    expect(after).toEqual(before);
    expect(total(after)).toBe(500);
    expect(transaction.allocations).toEqual(split);
  });

  test("clearing the envelope select pulls the money back into unallocated", () => {
    const before = ledgerOf(50, envelope("a", 300));
    const previous = income([{ catId: "a", amount: 300 }]);
    const { ledger: after } = saveTransactionEffect(before, previous, { ...previous, allocatedEnvelopeId: "" });

    expect(balanceOf(after, "a")).toBe(0);
    expect(after.unallocatedBalance).toBe(350);
    expect(total(after)).toBe(total(before)); // relocated, not created or destroyed
  });

  test("pointing the select at a different envelope moves the money across", () => {
    const before = ledgerOf(50, envelope("a", 300), envelope("b", 200));
    const previous = income([{ catId: "a", amount: 300 }]);
    const { ledger: after } = saveTransactionEffect(before, previous, { ...previous, allocatedEnvelopeId: "b" });

    expect(balanceOf(after, "a")).toBe(0);
    expect(balanceOf(after, "b")).toBe(500);
    expect(after.unallocatedBalance).toBe(50);
    expect(total(after)).toBe(total(before));
  });

  test("changing the amount moves the total by exactly the difference", () => {
    const before = ledgerOf(50, envelope("a", 300));
    const previous = income([{ catId: "a", amount: 300 }]);
    const { ledger: after } = saveTransactionEffect(before, previous, { ...previous, amount: 400, allocatedEnvelopeId: "a" });

    expect(balanceOf(after, "a")).toBe(400);
    expect(total(after)).toBe(total(before) + 100);
  });

  test("creating a transaction has no previous effect to reverse", () => {
    const before = ledgerOf(0, envelope("a", 0));
    const form = { id: "new", type: "expense", categoryId: "a", amount: 40 };
    const { ledger: after, transaction } = saveTransactionEffect(before, null, form);

    expect(balanceOf(after, "a")).toBe(-40);
    expect(transaction.allocations).toEqual([]);
    expect(total(after)).toBe(total(before) - 40);
  });
});

describe("envelopeFillPlan", () => {
  test("a normal envelope is topped up to its base", () => {
    const plan = envelopeFillPlan(ledgerOf(500, envelope("a", 30)), "a");
    expect(plan.amount).toBe(70);
    expect(plan.shortfall).toBe(-430);
  });

  test("a saving envelope takes another whole base amount", () => {
    const plan = envelopeFillPlan(ledgerOf(500, envelope("a", 30, { isAccumulating: true })), "a");
    expect(plan.amount).toBe(100);
  });

  test("an envelope already at its base needs nothing", () => {
    expect(envelopeFillPlan(ledgerOf(500, envelope("a", 100)), "a").amount).toBe(0);
    expect(envelopeFillPlan(ledgerOf(500, envelope("a", 140)), "a").amount).toBe(0);
  });

  test("no base amount means no plan, and an unknown envelope is reported as missing", () => {
    expect(envelopeFillPlan(ledgerOf(500, envelope("a", 0, { baseAmount: 0 })), "a").amount).toBe(0);
    expect(envelopeFillPlan(ledgerOf(500, envelope("a", 0)), "nope").cat).toBeNull();
  });

  // DEF-010: this is the number the old single-envelope path never looked at.
  test("shortfall is positive exactly when the fill outruns unallocated", () => {
    expect(envelopeFillPlan(ledgerOf(40, envelope("a", 0)), "a").shortfall).toBe(60);
    expect(envelopeFillPlan(ledgerOf(100, envelope("a", 0)), "a").shortfall).toBe(0);
    expect(envelopeFillPlan(ledgerOf(101, envelope("a", 0)), "a").shortfall).toBe(-1);
  });
});

describe("applyEnvelopeFill", () => {
  test("moves money from unallocated into the envelope, conserving the total", () => {
    const before = ledgerOf(500, envelope("a", 30), envelope("b", 200));
    const after = applyEnvelopeFill(before, "a", 70);
    expect(balanceOf(after, "a")).toBe(100);
    expect(balanceOf(after, "b")).toBe(200);
    expect(after.unallocatedBalance).toBe(430);
    expect(total(after)).toBe(total(before));
  });

  test("a fill the user confirmed past their balance still conserves the total", () => {
    const before = ledgerOf(40, envelope("a", 0));
    const after = applyEnvelopeFill(before, "a", 100);
    expect(after.unallocatedBalance).toBe(-60);
    expect(total(after)).toBe(total(before));
  });
});

describe("removeEnvelope", () => {
  // DEF-005: the old code dropped the category and its balance with it.
  test("a positive balance is handed back to unallocated", () => {
    const before = ledgerOf(100, envelope("a", 250), envelope("b", 80));
    const { ledger: after, released } = removeEnvelope(before, "a");
    expect(released).toBe(250);
    expect(after.categories.map((c) => c.id)).toEqual(["b"]);
    expect(after.unallocatedBalance).toBe(350);
    expect(total(after)).toBe(total(before));
  });

  test("an overdrawn envelope takes its shortfall out of unallocated", () => {
    const before = ledgerOf(100, envelope("a", -75), envelope("b", 80));
    const { ledger: after, released } = removeEnvelope(before, "a");
    expect(released).toBe(-75);
    expect(after.unallocatedBalance).toBe(25);
    // Dropping the overdraw instead would have invented $75 out of nothing.
    expect(total(after)).toBe(total(before));
  });

  test("an empty envelope changes nothing but its own existence", () => {
    const before = ledgerOf(100, envelope("a", 0), envelope("b", 80));
    const { ledger: after, released } = removeEnvelope(before, "a");
    expect(released).toBe(0);
    expect(after.unallocatedBalance).toBe(100);
    expect(total(after)).toBe(total(before));
  });

  test("an envelope with no balance field yet is treated as empty", () => {
    const before = ledgerOf(100, { id: "a", type: "expense" });
    const { ledger: after, released } = removeEnvelope(before, "a");
    expect(released).toBe(0);
    expect(after.unallocatedBalance).toBe(100);
  });

  test("an unknown id removes nothing and moves nothing", () => {
    const before = ledgerOf(100, envelope("a", 250));
    const { ledger: after, released } = removeEnvelope(before, "nope");
    expect(released).toBe(0);
    expect(after.categories).toHaveLength(1);
    expect(total(after)).toBe(total(before));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reconcileLedger
//
// The reconcile used to compute every per-envelope number and then record three
// aggregates, so "where did the money go" was unanswerable the moment the run
// finished. `movements` is that answer, and it is only worth having if it agrees
// with the ledger — a log that does not reconcile is worse than none, because it
// will be believed. So every case below asserts three things:
//
//   1. the household total is unchanged (nothing created, nothing destroyed);
//   2. the movements sum to exactly the balance changes the ledger made;
//   3. each envelope individually landed where it should.
//
// (2) and (3) are both needed: a bug can conserve the total while paying the
// wrong envelope, and a movement list can look tidy while describing a ledger
// that did something else.
// ─────────────────────────────────────────────────────────────────────────────
describe("reconcileLedger", () => {
  const saving = (id, balance) => envelope(id, balance, { isAccumulating: true });
  const income = (id) => ({ id, name: id, type: "income", colour: "#7FB069", monthlyBudget: null });

  // Every movement replayed against the starting ledger must reproduce the
  // finishing one, envelope by envelope — the movements ARE the change, not a
  // commentary on it.
  const expectMovementsExplainLedger = (before, result) => {
    const startOf = (id) => before.categories.find((c) => c.id === id)?.envelopeBalance || 0;
    const endOf = (id) => result.ledger.categories.find((c) => c.id === id)?.envelopeBalance || 0;

    for (const m of result.movements) {
      expect(m.before).toBeCloseTo(startOf(m.catId), 10);
      expect(m.after).toBeCloseTo(endOf(m.catId), 10);
      expect(m.after - m.before).toBeCloseTo(m.amount, 10);
      expect(m.amount).not.toBe(0);
    }
    // No envelope moved without saying so.
    const moved = new Set(result.movements.map((m) => m.catId));
    for (const c of before.categories) {
      if (!moved.has(c.id)) expect(endOf(c.id)).toBeCloseTo(startOf(c.id), 10);
    }
    // What the envelopes gave up is exactly what unallocated received.
    const net = result.movements.reduce((s, m) => s + m.amount, 0);
    expect(net + result.returned).toBeCloseTo(0, 10);
    expect(result.ledger.unallocatedBalance - before.unallocatedBalance).toBeCloseTo(result.returned, 10);
    // And the household is no richer or poorer for any of it.
    expect(total(result.ledger)).toBeCloseTo(total(before), 10);
  };

  const movementFor = (result, id) => result.movements.find((m) => m.catId === id);

  test("surplus only: every envelope is emptied into unallocated, and each says so", () => {
    const before = ledgerOf(10, envelope("a", 80), envelope("b", 45), envelope("c", 0));
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(125);
    expect(result.toppedUp).toBe(0);
    expect(result.returned).toBe(125);
    expect(result.ledger.unallocatedBalance).toBe(135);
    expect(balanceOf(result.ledger, "a")).toBe(0);
    expect(balanceOf(result.ledger, "b")).toBe(0);

    expect(movementFor(result, "a")).toEqual({ catId: "a", before: 80, amount: -80, after: 0 });
    expect(movementFor(result, "b")).toEqual({ catId: "b", before: 45, amount: -45, after: 0 });
    // An envelope that did not move is not in the log at all.
    expect(movementFor(result, "c")).toBeUndefined();
    expect(result.movements).toHaveLength(2);
    expectMovementsExplainLedger(before, result);
  });

  test("deficit only: with no surplus to pool, nothing is covered and nothing moves", () => {
    const before = ledgerOf(500, envelope("a", -30), envelope("b", -55));
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(0);
    expect(result.toppedUp).toBe(0);
    expect(result.returned).toBe(0);
    // The overdrafts stay where they are: unallocated is not raided to clear
    // them, which is what the reconcile has always done.
    expect(balanceOf(result.ledger, "a")).toBe(-30);
    expect(balanceOf(result.ledger, "b")).toBe(-55);
    expect(result.movements).toEqual([]);
    expectMovementsExplainLedger(before, result);
  });

  test("mixed: the pool covers both deficits and the remainder is returned", () => {
    const before = ledgerOf(0, envelope("a", 80), envelope("b", 45), envelope("c", -30), envelope("d", -55));
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(125);
    expect(result.toppedUp).toBe(2);
    expect(result.returned).toBe(40);
    expect(result.ledger.unallocatedBalance).toBe(40);

    // Most overdrawn first: d before c.
    expect(result.movements.filter((m) => m.amount > 0).map((m) => m.catId)).toEqual(["d", "c"]);
    expect(movementFor(result, "a")).toEqual({ catId: "a", before: 80, amount: -80, after: 0 });
    expect(movementFor(result, "b")).toEqual({ catId: "b", before: 45, amount: -45, after: 0 });
    expect(movementFor(result, "c")).toEqual({ catId: "c", before: -30, amount: 30, after: 0 });
    expect(movementFor(result, "d")).toEqual({ catId: "d", before: -55, amount: 55, after: 0 });
    expectMovementsExplainLedger(before, result);
  });

  test("a pool that only partly covers the deficits pays the most overdrawn first and stops", () => {
    // 40 of surplus against 100 of deficit. The pool is spent in order, so the
    // worst envelope takes all 40 and the other is left where it was — the
    // shortfall is not spread across both.
    const before = ledgerOf(0, envelope("a", 40), envelope("b", -60), envelope("c", -40));
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(40);
    expect(result.toppedUp).toBe(1);
    expect(result.returned).toBe(0);
    expect(result.ledger.unallocatedBalance).toBe(0);

    expect(balanceOf(result.ledger, "a")).toBe(0);
    expect(balanceOf(result.ledger, "b")).toBe(-20); // -60 + 40
    expect(balanceOf(result.ledger, "c")).toBe(-40); // untouched, pool was spent
    expect(movementFor(result, "b")).toEqual({ catId: "b", before: -60, amount: 40, after: -20 });
    expect(movementFor(result, "c")).toBeUndefined();
    expectMovementsExplainLedger(before, result);
  });

  test("savings envelopes are left alone on both sides, and never appear in the log", () => {
    const before = ledgerOf(0, envelope("a", 80), saving("s", 900), saving("s2", -20), income("inc"));
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(80);
    expect(result.returned).toBe(80);
    // The saving envelope's 900 is neither pooled nor used to cover anything,
    // and its overdrawn sibling is not topped up out of the pool.
    expect(balanceOf(result.ledger, "s")).toBe(900);
    expect(balanceOf(result.ledger, "s2")).toBe(-20);
    expect(movementFor(result, "s")).toBeUndefined();
    expect(movementFor(result, "s2")).toBeUndefined();
    expect(result.movements).toHaveLength(1);
    expectMovementsExplainLedger(before, result);
  });

  test("an income category is not an envelope and is never swept", () => {
    const before = ledgerOf(0, envelope("a", 50), { ...income("inc"), envelopeBalance: 700 });
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(50);
    expect(movementFor(result, "inc")).toBeUndefined();
    expectMovementsExplainLedger(before, result);
  });

  test("nothing to do: an all-zero ledger comes back untouched with an empty log", () => {
    const before = ledgerOf(120, envelope("a", 0), envelope("b", 0));
    const result = reconcileLedger(before);

    expect(result).toMatchObject({ movements: [], pooled: 0, toppedUp: 0, returned: 0 });
    expect(result.ledger.unallocatedBalance).toBe(120);
    expect(result.ledger.categories.map((c) => c.envelopeBalance)).toEqual([0, 0]);
    expectMovementsExplainLedger(before, result);
  });

  test("an exact cover returns nothing and still balances", () => {
    const before = ledgerOf(0, envelope("a", 60), envelope("b", -60));
    const result = reconcileLedger(before);

    expect(result.returned).toBe(0);
    expect(result.toppedUp).toBe(1);
    expect(balanceOf(result.ledger, "a")).toBe(0);
    expect(balanceOf(result.ledger, "b")).toBe(0);
    expectMovementsExplainLedger(before, result);
  });

  test("an envelope with no balance field yet is treated as empty and left out", () => {
    const before = ledgerOf(0, { id: "a", type: "expense" }, envelope("b", 25));
    const result = reconcileLedger(before);

    expect(result.pooled).toBe(25);
    expect(movementFor(result, "a")).toBeUndefined();
    expectMovementsExplainLedger(before, result);
  });

  test("cents that do not divide evenly still balance to the last cent", () => {
    const before = ledgerOf(0, envelope("a", 33.33), envelope("b", 12.11), envelope("c", -20.07));
    const result = reconcileLedger(before);

    expect(result.toppedUp).toBe(1);
    expect(balanceOf(result.ledger, "c")).toBeCloseTo(0, 10);
    expect(result.returned).toBeCloseTo(25.37, 10); // 45.44 - 20.07
    expectMovementsExplainLedger(before, result);
  });

  test("the input ledger is not mutated", () => {
    const before = ledgerOf(0, envelope("a", 80), envelope("b", -30));
    reconcileLedger(before);
    expect(balanceOf(before, "a")).toBe(80);
    expect(balanceOf(before, "b")).toBe(-30);
    expect(before.unallocatedBalance).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEF-013 — the first-time wizard raised the household total by the sum of
// every base amount and recorded nothing.
//
// This is the one function in the module that is ALLOWED to change the
// household total without a transaction, because a household adopting the app
// really does already hold this money. So the invariant it has to serve is a
// different one, and a stricter one: the total moves by exactly `total`, and
// `entries` accounts for every cent of that move, envelope by envelope.
// ─────────────────────────────────────────────────────────────────────────────
describe("applyOpeningBalances", () => {
  // The record and the balances have to be the same arithmetic. This checks
  // both directions: the total explains the household's move, and the entries
  // explain each envelope's.
  const expectEntriesExplainLedger = (before, result) => {
    expect(total(result.ledger) - total(before)).toBeCloseTo(result.total, 10);
    expect(result.entries.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(result.total, 10);
    for (const c of before.categories) {
      const entry = result.entries.find((e) => e.catId === c.id);
      const moved = balanceOf(result.ledger, c.id) - (c.envelopeBalance || 0);
      expect(moved).toBeCloseTo(entry ? entry.amount : 0, 10);
    }
    // Unallocated takes no part: the money is declared as already sitting in
    // the envelopes, not as a pile being allocated out of one.
    expect(result.ledger.unallocatedBalance).toBe(before.unallocatedBalance);
  };

  test("each envelope is opened at its own amount, and the total is their sum", () => {
    const before = ledgerOf(0, envelope("a", 0), envelope("b", 0), envelope("c", 0));
    const result = applyOpeningBalances(before, { a: 500, b: 300, c: 200 });

    expect(result.total).toBe(1000);
    expect(balanceOf(result.ledger, "a")).toBe(500);
    expect(balanceOf(result.ledger, "b")).toBe(300);
    expect(balanceOf(result.ledger, "c")).toBe(200);
    expectEntriesExplainLedger(before, result);
  });

  // A total can be right while the money is in the wrong envelope. The entries
  // are what make that distinguishable, so they are asserted in order and by id.
  test("the record names which envelope got what, not just how much in all", () => {
    const before = ledgerOf(0, envelope("a", 0), envelope("b", 0));
    const result = applyOpeningBalances(before, { a: 500, b: 300 });

    expect(result.entries).toEqual([{ catId: "a", amount: 500 }, { catId: "b", amount: 300 }]);
  });

  test("an envelope not named in the map is untouched and unrecorded", () => {
    const before = ledgerOf(0, envelope("a", 0), envelope("b", 0));
    const result = applyOpeningBalances(before, { a: 500 });

    expect(balanceOf(result.ledger, "b")).toBe(0);
    expect(result.entries.find((e) => e.catId === "b")).toBeUndefined();
    expectEntriesExplainLedger(before, result);
  });

  // A budget of $0 is a real answer in the wizard — most households leave
  // several envelopes blank. It is not money arriving, so it is not a movement.
  test("zero and negative amounts move nothing and are left out of the record", () => {
    const before = ledgerOf(0, envelope("a", 0), envelope("b", 0), envelope("c", 0));
    const result = applyOpeningBalances(before, { a: 0, b: -50, c: 200 });

    expect(result.total).toBe(200);
    expect(result.entries).toEqual([{ catId: "c", amount: 200 }]);
    expect(balanceOf(result.ledger, "b")).toBe(0);
    expectEntriesExplainLedger(before, result);
  });

  test("an empty map is a no-op that records nothing", () => {
    const before = ledgerOf(120, envelope("a", 40));
    const result = applyOpeningBalances(before, {});

    expect(result.total).toBe(0);
    expect(result.entries).toEqual([]);
    expect(total(result.ledger)).toBe(total(before));
  });

  test("a missing map is treated as an empty one rather than throwing", () => {
    const before = ledgerOf(0, envelope("a", 0));
    expect(applyOpeningBalances(before, undefined).total).toBe(0);
  });

  // Opening balances add to what is there. The wizard only offers itself on a
  // fresh budget, but the arithmetic must not depend on that.
  test("an envelope that already holds money is added to, not overwritten", () => {
    const before = ledgerOf(0, envelope("a", 75));
    const result = applyOpeningBalances(before, { a: 25 });

    expect(balanceOf(result.ledger, "a")).toBe(100);
    expect(result.total).toBe(25);
    expectEntriesExplainLedger(before, result);
  });

  test("an envelope with no balance field yet is treated as empty", () => {
    const before = ledgerOf(0, { id: "a", type: "expense" });
    const result = applyOpeningBalances(before, { a: 60 });

    expect(balanceOf(result.ledger, "a")).toBe(60);
    expectEntriesExplainLedger(before, result);
  });

  // Amounts are floats, as everywhere else in this module. The recorded total
  // is stored unrounded precisely so it stays equal to the move it explains.
  test("cents still add up to exactly what the household total moved by", () => {
    const before = ledgerOf(0, envelope("a", 0), envelope("b", 0), envelope("c", 0));
    const result = applyOpeningBalances(before, { a: 33.33, b: 12.11, c: 0.07 });

    expect(total(result.ledger) - total(before)).toBe(result.total);
    expectEntriesExplainLedger(before, result);
  });

  test("the input ledger is not mutated", () => {
    const before = ledgerOf(10, envelope("a", 40));
    applyOpeningBalances(before, { a: 500 });

    expect(balanceOf(before, "a")).toBe(40);
    expect(before.unallocatedBalance).toBe(10);
  });
});
