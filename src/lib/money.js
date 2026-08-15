// Envelope arithmetic.
//
// The household's money lives in exactly two places: `unallocatedBalance`, and
// the `envelopeBalance` of each expense category. Their sum is the household
// total, and only adding or removing a real transaction may change it —
// everything else (allocating income, filling an envelope, deleting an
// envelope) moves money between those two places and must conserve the sum.
//
// That rule used to be spread across half a dozen hand-rolled copies of the
// same reverse-then-reapply arithmetic inside BudgetApp, which is where the
// envelope-draining edit (DEF-004) and the money-destroying envelope delete
// (DEF-005) both came from. It lives here instead: plain functions over a
// "ledger" — `{ categories, unallocatedBalance }` — returning a new ledger,
// with no React and no persistence, so the arithmetic can be tested on its own.
//
// Amounts are floats, matching the rest of the app and the persisted files.

const balanceOf = (cat) => cat.envelopeBalance || 0;

// Every balance change goes through here, so the "missing field means zero"
// rule is applied in exactly one place.
const adjust = (categories, catId, delta) =>
  categories.map((c) => (c.id === catId ? { ...c, envelopeBalance: balanceOf(c) + delta } : c));

const roundCents = (n) => Math.round(n * 100) / 100;

/** Total household money: unallocated plus everything sitting in envelopes. */
export function householdTotal({ categories, unallocatedBalance }) {
  return (categories || []).reduce((s, c) => s + balanceOf(c), 0) + (unallocatedBalance || 0);
}

/**
 * Apply (`factor: 1`) or reverse (`factor: -1`) a transaction's effect.
 *
 * An income transaction may carry an `allocations` array ([{ catId, amount }])
 * recording money that went straight into envelopes rather than sitting in
 * unallocated. Both directions honour it, so an edit or a delete puts the money
 * back exactly where it came from.
 *
 * Note the household total always moves by `factor * tx.amount` and nothing
 * else: allocations only decide how the money is split between unallocated and
 * the envelopes, never how much of it there is.
 */
export function applyTxEffect(ledger, tx, factor) {
  let categories = ledger.categories;
  let unallocatedBalance = ledger.unallocatedBalance;
  if (tx.type === "expense") {
    categories = adjust(categories, tx.categoryId, -factor * tx.amount);
  } else if (tx.type === "income") {
    unallocatedBalance += factor * tx.amount;
    for (const alloc of tx.allocations || []) {
      categories = adjust(categories, alloc.catId, factor * alloc.amount);
      unallocatedBalance -= factor * alloc.amount;
    }
  }
  return { categories, unallocatedBalance };
}

// An income transaction can never route more into envelopes than it brought in.
// If the user edits the amount down below an existing split, shrink the split
// proportionally rather than dropping envelopes out of it; the cent left over by
// rounding goes on the last row so the parts still sum to the whole.
function scaleAllocationsTo(allocations, amount) {
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  if (total <= amount + 0.005 || total <= 0) return allocations;
  const scaled = allocations.map((a) => ({ ...a, amount: roundCents((a.amount * amount) / total) }));
  const drift = roundCents(amount - scaled.reduce((s, a) => s + a.amount, 0));
  if (drift !== 0) {
    const last = scaled.length - 1;
    scaled[last] = { ...scaled[last], amount: roundCents(scaled[last].amount + drift) };
  }
  return scaled;
}

/**
 * Work out an income transaction's allocations from what the edit form is
 * holding.
 *
 * `form.allocations` is the transaction's existing split, carried through the
 * form untouched. The form's single "Allocate to envelope" select cannot
 * express a split across several envelopes, so a multi-envelope split is
 * preserved as-is rather than collapsed into one envelope or thrown away —
 * only its total is capped at the transaction amount. A split of one, or none,
 * is what the select edits, and `form.allocatedEnvelopeId` decides it.
 *
 * `availableUnallocated` is the unallocated balance with this transaction's old
 * effect already reversed but its new one not yet applied — the allocation is
 * capped so a fresh allocation cannot push unallocated below zero.
 */
export function allocationsForForm(form, availableUnallocated) {
  if (form.type !== "income") return [];
  const existing = (Array.isArray(form.allocations) ? form.allocations : []).filter((a) => a && a.catId && a.amount > 0);
  if (existing.length > 1) return scaleAllocationsTo(existing, form.amount);
  if (!form.allocatedEnvelopeId) return [];
  const allocAmt = Math.min(form.amount, Math.max(0, availableUnallocated + form.amount));
  return allocAmt > 0 ? [{ catId: form.allocatedEnvelopeId, amount: allocAmt }] : [];
}

/**
 * Reverse a transaction's old effect, settle its allocations against the
 * balance that leaves behind, then apply the new effect. `previousTx` is null
 * when the transaction is being created.
 *
 * Returns the new ledger and the transaction as it should be stored.
 */
export function saveTransactionEffect(ledger, previousTx, form) {
  const reversed = previousTx ? applyTxEffect(ledger, previousTx, -1) : ledger;
  const transaction = {
    ...(previousTx || {}),
    ...form,
    allocations: allocationsForForm(form, reversed.unallocatedBalance),
  };
  return { ledger: applyTxEffect(reversed, transaction, 1), transaction };
}

/**
 * What filling one envelope to its target would cost.
 *
 * A saving ("accumulating") envelope takes another whole base amount each time;
 * every other envelope is topped up to its base. `shortfall` is how much of the
 * top-up is not covered by unallocated — positive means the fill would push
 * unallocated below zero, which the caller must warn about first.
 */
export function envelopeFillPlan({ categories, unallocatedBalance }, catId) {
  const cat = categories.find((c) => c.id === catId) || null;
  const base = cat ? cat.baseAmount || 0 : 0;
  const amount = !cat || base <= 0 ? 0 : cat.isAccumulating ? base : Math.max(0, base - balanceOf(cat));
  return { cat, base, amount, shortfall: amount - unallocatedBalance };
}

/** Move `amount` out of unallocated and into one envelope. */
export function applyEnvelopeFill({ categories, unallocatedBalance }, catId, amount) {
  return { categories: adjust(categories, catId, amount), unallocatedBalance: unallocatedBalance - amount };
}

/**
 * Drop an envelope and hand whatever it was holding back to unallocated.
 *
 * Unallocated is where the app already keeps money that is not earmarked, and
 * an envelope that no longer exists has nothing to earmark it for — so the
 * balance goes there and waits for the user to place it, rather than being
 * folded into another envelope whose own fill target it would distort.
 *
 * An overdrawn envelope is handled by the same addition: `released` is negative
 * and unallocated absorbs the shortfall, because that money has genuinely
 * already been spent. Dropping it instead would invent money out of nothing.
 *
 * Returns the new ledger and `released` — signed, for the caller to explain.
 */
export function removeEnvelope({ categories, unallocatedBalance }, catId) {
  const cat = categories.find((c) => c.id === catId);
  const released = cat ? balanceOf(cat) : 0;
  return {
    ledger: {
      categories: categories.filter((c) => c.id !== catId),
      unallocatedBalance: unallocatedBalance + released,
    },
    released,
  };
}
