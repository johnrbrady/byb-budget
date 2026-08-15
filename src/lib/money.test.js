import {
  householdTotal,
  applyTxEffect,
  allocationsForForm,
  saveTransactionEffect,
  envelopeFillPlan,
  applyEnvelopeFill,
  removeEnvelope,
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
