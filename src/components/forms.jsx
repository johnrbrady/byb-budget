import React, { useMemo, useState } from "react";
import { PALETTE, SAVINGS_CAT } from "../lib/constants.js";
import { centsToInput, fmtAUD, parseAUDToCents, todayISO } from "../lib/utils.js";
import { descriptionSuggestions } from "../lib/descriptionSuggestions.js";

const inputCents = (value, options) => {
  try { return parseAUDToCents(value, options); } catch { return null; }
};

// `style` overrides the form's own container styling only — it is there so the
// same form can be a card in the page or the body of a bottom sheet without a
// second copy of it existing. Nothing below it reads `style`; the allocation
// rules are untouched by it.
export function TxForm({ tx, categories, transactionHistory = [], activeUserId, onSave, onTransfer, onCancel, styles, defaultCategoryId, defaultType, style }) {
  const defaultCat = defaultCategoryId ? categories.find((c) => c.id === defaultCategoryId) : null;
  // `allocations` records where an income transaction's money actually went and
  // is the only thing the balance arithmetic reads, so the "Allocate to
  // envelope" select is seeded from it. Any `allocatedEnvelopeId` stored on the
  // transaction is leftover form scaffolding from an older save and is ignored:
  // income logged through the Add Income flow never has one, so trusting it
  // opened this form on "— unallocated —" and saving drained the envelope.
  const existingAllocations = tx?.type === "income" && Array.isArray(tx.allocations) ? tx.allocations : [];
  const [form, setForm] = useState(
    tx
      ? { ...tx, amount: centsToInput(tx.amount), allocatedEnvelopeId: existingAllocations.length === 1 ? existingAllocations[0].catId : "" }
      : {
        date: todayISO(),
        amount: "",
        type: defaultCat?.type || defaultType || "expense",
        categoryId: defaultCategoryId || categories.find((c) => c.type === (defaultType || "expense"))?.id || "",
        description: "",
        addedBy: activeUserId,
        fromCatId: "",
        toCatId: "",
        allocatedEnvelopeId: "",
      }
  );
  const expenseCats = categories.filter((c) => c.type === "expense");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const suggestedDescriptions = useMemo(
    () => descriptionSuggestions(transactionHistory, form.description, { type: form.type }),
    [transactionHistory, form.description, form.type]
  );
  // A split across several envelopes cannot be shown in a single select, and
  // collapsing it into one envelope — or dropping it — would move the household's
  // money. It is shown read-only and carried through the save untouched; the
  // Add Income flow is where a split is composed.
  const splitAllocations = form.type === "income" && Array.isArray(form.allocations) && form.allocations.length > 1
    ? form.allocations
    : null;
  // Editing the amount below the split total is legal but scales the split down,
  // so warn on the way rather than surprising the user after the save.
  const parsedFormAmount = inputCents(form.amount) || 0;
  const splitOverAmount = !!splitAllocations &&
    splitAllocations.reduce((s, a) => s + a.amount, 0) > parsedFormAmount;
  const submit = (e) => {
    e.preventDefault();
    const amount = inputCents(form.amount);
    if (!amount || amount <= 0) return;
    if (form.type === "transfer") {
      if (!form.fromCatId || !form.toCatId || form.fromCatId === form.toCatId) return;
      onTransfer?.({ fromId: form.fromCatId, toId: form.toCatId, amount, description: form.description || "" });
      return;
    }
    onSave({ ...form, amount, addedBy: activeUserId });
  };
  const catOptions = categories.filter((c) => c.type === form.type);
  const mobile = styles.isMobile;
  const isTransfer = form.type === "transfer";
  const isIncome = form.type === "income";
  const cols = mobile ? "1fr 1fr" : (isIncome && !isTransfer) ? "repeat(6, 1fr)" : "repeat(5, 1fr)";
  return (
    <form className="byb-panel" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} style={{ ...styles.card, marginBottom: 16, display: "grid", gridTemplateColumns: cols, gap: 10, ...style }} data-testid="tx-form">
      <div style={mobile ? { gridColumn: "span 2" } : {}}><div style={styles.label}>Date</div><input style={styles.input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
      <div>
        <div style={styles.label}>Type</div>
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: categories.find((c) => c.type === e.target.value)?.id || "", fromCatId: "", toCatId: "", allocatedEnvelopeId: "", allocations: [] })}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>
      <div><div style={styles.label}>Amount</div><input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="tx-amount" /></div>
      {isTransfer ? (
        <>
          <div>
            <div style={styles.label}>From envelope</div>
            <select style={styles.input} value={form.fromCatId} onChange={(e) => setForm({ ...form, fromCatId: e.target.value })} data-testid="tx-from">
              <option value="">Select envelope…</option>
              {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
            </select>
          </div>
          <div>
            <div style={styles.label}>To envelope</div>
            <select style={styles.input} value={form.toCatId} onChange={(e) => setForm({ ...form, toCatId: e.target.value })} data-testid="tx-to">
              <option value="">Select envelope…</option>
              {expenseCats.filter((c) => c.id !== form.fromCatId).map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
            </select>
          </div>
        </>
      ) : (
        <>
          <div style={mobile ? { gridColumn: "span 2" } : {}}>
            <div style={styles.label}>Category</div>
            <select style={styles.input} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} data-testid="tx-category">
              {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.type === "expense" ? ` — ${fmtAUD(c.envelopeBalance || 0)}` : ""}</option>)}
            </select>
          </div>
          {isIncome && (
            <div style={mobile ? { gridColumn: "span 2" } : {}}>
              <div style={styles.label}>Allocate to envelope</div>
              {splitAllocations ? (
                <div style={{ ...styles.input, height: "auto", display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }} data-testid="tx-allocate-split">
                  {splitAllocations.map((a, i) => (
                    <span key={i}>{categories.find((c) => c.id === a.catId)?.name || "?"} — {fmtAUD(a.amount)}</span>
                  ))}
                  <span style={{ color: splitOverAmount ? "var(--byb-over)" : styles.textMuted, fontSize: 11 }}>
                    {splitOverAmount
                      ? `Split exceeds the amount — it will be scaled down to ${fmtAUD(parsedFormAmount)}`
                      : "Split kept as is · change it in Add Income"}
                  </span>
                </div>
              ) : (
                <select style={styles.input} value={form.allocatedEnvelopeId || ""} onChange={(e) => setForm({ ...form, allocatedEnvelopeId: e.target.value, allocations: [] })} data-testid="tx-allocate-envelope">
                  <option value="">— unallocated —</option>
                  {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
                </select>
              )}
            </div>
          )}
        </>
      )}
      <div style={{ gridColumn: mobile ? "span 2" : "span 2", position: "relative" }}>
        <div style={styles.label}>Description</div>
        <input
          style={styles.input}
          value={form.description || ""}
          onChange={(e) => { setForm({ ...form, description: e.target.value }); setDescriptionOpen(true); }}
          onFocus={() => setDescriptionOpen(true)}
          onBlur={() => setDescriptionOpen(false)}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="tx-description-suggestions"
          aria-expanded={descriptionOpen && suggestedDescriptions.length > 0}
          data-testid="tx-description"
        />
        {descriptionOpen && suggestedDescriptions.length > 0 && (
          <div
            id="tx-description-suggestions"
            role="listbox"
            aria-label="Previous descriptions"
            style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", marginTop: 4, padding: 4, border: `1px solid ${styles.border}`, borderRadius: "var(--byb-radius-sm)", background: styles.surface, boxShadow: "var(--byb-elev-2)", maxHeight: 210, overflowY: "auto" }}
          >
            {suggestedDescriptions.map((description) => (
              <button
                key={description.toLocaleLowerCase()}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => { setForm({ ...form, description }); setDescriptionOpen(false); }}
                style={{ display: "block", width: "100%", minHeight: 40, padding: "8px 10px", border: "none", borderRadius: "var(--byb-radius-sm)", background: "transparent", color: styles.text, textAlign: "left", font: "inherit", cursor: "pointer" }}
              >
                {description}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ gridColumn: mobile ? "span 2" : `span ${isIncome ? 6 : 5}`, display: "flex", alignItems: "end", gap: 8 }}>
        <button type="submit" style={{ ...styles.button, flex: mobile ? 1 : "none" }} data-testid="tx-save">Save</button>
        <button type="button" style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function AddAmountForm({ categories, onSave, onCancel, styles }) {
  const expenseCats = categories.filter((c) => c.type === "expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [catId, setCatId] = useState(expenseCats[0]?.id || "");
  const mobile = styles.isMobile;
  const submit = (e) => {
    e.preventDefault();
    const amt = inputCents(amount);
    if (!amt || amt <= 0 || !catId) return;
    onSave(catId, amt, description);
  };
  return (
    <form className="byb-panel" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      style={{ ...styles.card, marginBottom: 16, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 2fr auto auto", gap: 10, borderColor: PALETTE.primary, background: "var(--byb-primary-tint)" }}>
      <div>
        <div style={styles.label}>Amount ($)</div>
        <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div>
        <div style={styles.label}>Envelope</div>
        <select style={styles.input} value={catId} onChange={(e) => setCatId(e.target.value)} required>
          {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
        </select>
      </div>
      <div style={mobile ? { gridColumn: "span 2" } : {}}>
        <div style={styles.label}>Description (optional)</div>
        <input style={styles.input} placeholder="e.g. Found cash" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, gridColumn: mobile ? "span 2" : "auto" }}>
        <button type="submit" style={{ ...styles.button, whiteSpace: "nowrap" }}>Add Amount</button>
        <button type="button" style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function CatForm({ cat, onSave, onCancel, onDelete, styles }) {
  const [form, setForm] = useState(cat
    ? { ...cat, baseAmount: centsToInput(cat.baseAmount ?? cat.monthlyBudget ?? 0), targetAmount: cat.targetAmount ? centsToInput(cat.targetAmount) : "", targetDate: cat.targetDate || "" }
    : { name: "", type: "expense", colour: "#7FB069", baseAmount: "", isAccumulating: false, envelopeBalance: 0, targetAmount: "", targetDate: "" }
  );
  const [targetError, setTargetError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const baseAmount = form.type === "expense" && form.baseAmount !== "" ? inputCents(form.baseAmount) : 0;
    if (baseAmount === null) return;
    const hasTargetAmount = form.type === "expense" && form.targetAmount !== "";
    const targetAmount = hasTargetAmount ? inputCents(form.targetAmount) : 0;
    const targetDate = form.type === "expense" ? (form.targetDate || "") : "";
    if (targetAmount === null || (targetAmount > 0 && !targetDate) || (targetDate && !(targetAmount > 0))) {
      setTargetError("Enter both a target amount and due date, or leave both blank.");
      return;
    }
    setTargetError("");
    onSave({ ...form, baseAmount, monthlyBudget: baseAmount, targetAmount, targetDate, isAccumulating: targetAmount > 0 ? true : form.isAccumulating });
  };
  const mobile = styles.isMobile;
  return (
    <form className="byb-panel" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      style={{ ...styles.card, marginBottom: 12, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10 }}>
      <div style={{ gridColumn: "span 2" }}>
        <div style={styles.label}>Name</div>
        <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
      </div>
      <div>
        <div style={styles.label}>Type</div>
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="expense">Expense envelope</option>
          <option value="income">Income source</option>
        </select>
      </div>
      {form.type === "expense" && (
        <>
          <div style={{ gridColumn: "span 2" }}>
            <div style={styles.label}>Monthly fill amount</div>
            <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal"
              placeholder="e.g. 1400" value={form.baseAmount ?? ""}
              onChange={(e) => setForm({ ...form, baseAmount: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: mobile ? "span 2" : "auto", paddingTop: 20 }}>
            {cat?.id === SAVINGS_CAT.id ? (
              <span style={{ fontSize: 12, color: styles.textMuted, fontStyle: "italic" }}>Savings always accumulates</span>
            ) : (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
                  <input type="checkbox" checked={!!form.isAccumulating}
                    onChange={(e) => setForm({ ...form, isAccumulating: e.target.checked })} />
                  <span>Saving envelope</span>
                </label>
                <span style={{ fontSize: 11, color: styles.textMuted }}>(balance builds up)</span>
              </>
            )}
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div style={styles.label}>Savings target (optional)</div>
            <input aria-label="Savings target amount" style={styles.input} type="number" step="0.01" min="0" inputMode="decimal"
              placeholder="e.g. 900" value={form.targetAmount ?? ""}
              onChange={(e) => { setForm({ ...form, targetAmount: e.target.value }); setTargetError(""); }} />
          </div>
          <div>
            <div style={styles.label}>Target due date</div>
            <input aria-label="Target due date" style={styles.input} type="date" value={form.targetDate || ""}
              onChange={(e) => { setForm({ ...form, targetDate: e.target.value }); setTargetError(""); }} />
          </div>
          {targetError && <div role="alert" style={{ gridColumn: mobile ? "span 2" : "span 3", color: "var(--byb-over)", fontSize: 12 }}>{targetError}</div>}
        </>
      )}
      <div style={{ gridColumn: mobile ? "span 2" : "span 3", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <button type="submit" style={{ ...styles.button, flex: mobile ? 1 : "none" }}>Save</button>
        <button type="button" style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={onCancel}>Cancel</button>
        {onDelete && !cat?.protected && (
          <button type="button" style={{ ...styles.buttonDanger, marginLeft: "auto" }} onClick={onDelete}>Delete envelope</button>
        )}
      </div>
    </form>
  );
}

export function RuleForm({ rule, categories, users, activeUserId, onSave, onCancel, styles }) {
  const [form, setForm] = useState(
    rule ? { ...rule, amount: centsToInput(rule.amount) } : { label: "", amount: "", type: "expense", categoryId: categories.find((c) => c.type === "expense")?.id || "", frequency: "monthly", nextDueDate: todayISO(), addedBy: activeUserId }
  );
  const submit = (e) => {
    e.preventDefault();
    const amount = inputCents(form.amount);
    if (!amount || amount <= 0 || !form.label) return;
    const { startDate: _discardedLegacyStartDate, ...saved } = form;
    onSave({ ...saved, amount });
  };
  const catOptions = categories.filter((c) => c.type === form.type);
  const mobile = styles.isMobile;
  return (
    <form className="byb-panel" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} style={{ ...styles.card, marginBottom: 16, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
      <div style={{ gridColumn: "span 2" }}><div style={styles.label}>Label</div><input style={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></div>
      <div>
        <div style={styles.label}>Type</div>
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: categories.find((c) => c.type === e.target.value)?.id || "" })}>
          <option value="expense">Expense</option><option value="income">Income</option>
        </select>
      </div>
      <div><div style={styles.label}>Amount</div><input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
      <div>
        <div style={styles.label}>Frequency</div>
        <select style={styles.input} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option>
        </select>
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <div style={styles.label}>Category</div>
        <select style={styles.input} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><div style={styles.label}>Next due</div><input style={styles.input} type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></div>
      <div style={{ gridColumn: "span 2", display: "flex", alignItems: "end", gap: 8 }}>
        <button type="submit" style={{ ...styles.button, flex: mobile ? 1 : "none" }}>Save</button>
        <button type="button" style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
