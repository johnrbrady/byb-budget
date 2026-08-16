import React, { useState, useMemo } from "react";
import { PALETTE } from "../lib/constants.js";
import { centsToInput, fmtAUD, parseAUDToCents, todayISO } from "../lib/utils.js";
import { IconPlus, IconCheck, IconZap, IconWallet, IconEnvelope } from "./Icons.jsx";

// Unified "Add Income" flow — one place to log money coming in, from any
// stream (or a brand-new one), and decide where it goes:
//   1. Source — existing income streams as chips, or create a new one inline
//   2. Amount — with "Stay Consistent" shortcut when a recurring rule matches
//   3. Allocation — keep unallocated, run a fill, or split across envelopes
//
// Calls onSubmit({ sourceId, newSourceName, amount, date, description,
//                  allocationMode: "unallocated"|"fill"|"split", splits })
//
// `style` overrides this form's own container styling only, exactly as TxForm's
// does — it is there so the same flow can be a card in the page or the body of a
// bottom sheet without a second copy of it existing. Nothing below it reads
// `style`; the allocation logic it composes (DEF-004) is untouched by it.

export function AddIncomeFlow({ categories, recurring, unallocatedBalance, onSubmit, onCancel, styles, style }) {
  const mobile = styles.isMobile;
  const incomeCats = categories.filter((c) => c.type === "income");
  const expenseCats = categories.filter((c) => c.type === "expense");

  const [sourceId, setSourceId] = useState(incomeCats[0]?.id || "");
  const [newSource, setNewSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [allocationMode, setAllocationMode] = useState("unallocated");
  const [splits, setSplits] = useState([{ catId: expenseCats[0]?.id || "", amount: "" }]);

  const parseInput = (value) => { try { return parseAUDToCents(value); } catch { return null; } };
  const parsedAmount = parseInput(amount) || 0;

  // Recurring shortcut for the selected source
  const recurringAmt = useMemo(() => {
    if (newSource || !sourceId) return null;
    const rules = (recurring || []).filter((r) => r.categoryId === sourceId && r.type === "income");
    return rules.length > 0 ? rules[0].amount : null;
  }, [sourceId, newSource, recurring]);

  // What a fill would do with this amount
  const fillPreview = useMemo(() => {
    const need = expenseCats
      .filter((c) => (c.baseAmount || 0) > 0)
      .reduce((s, c) => s + (c.isAccumulating ? (c.baseAmount || 0) : Math.max(0, (c.baseAmount || 0) - (c.envelopeBalance || 0))), 0);
    return need;
  }, [expenseCats]);

  const parsedSplits = splits.map((row) => ({ ...row, amount: parseInput(row.amount) }));
  const splitTotal = parsedSplits.reduce((s, row) => s + (row.amount || 0), 0);
  const splitRemaining = parsedAmount - splitTotal;

  const sourceValid = newSource ? newSourceName.trim().length > 0 : !!sourceId;
  const splitsValid = allocationMode !== "split" ||
    (parsedSplits.every((row) => row.catId && row.amount !== null && row.amount >= 0) && splitTotal > 0 && splitTotal <= parsedAmount);
  const canSubmit = sourceValid && parsedAmount > 0 && splitsValid;

  const submit = (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      sourceId: newSource ? null : sourceId,
      newSourceName: newSource ? newSourceName.trim() : null,
      amount: parsedAmount,
      date,
      description: description.trim(),
      allocationMode,
      splits: allocationMode === "split"
        ? parsedSplits.map((row) => ({ catId: row.catId, amount: row.amount || 0 })).filter((row) => row.amount > 0)
        : [],
    });
  };

  const stepLabel = { fontSize: 11, fontWeight: 700, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 };
  const chip = (active) => ({
    padding: "9px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: `2px solid ${active ? PALETTE.primary : styles.border}`,
    background: active ? "var(--byb-primary-tint)" : "transparent",
    color: active ? PALETTE.primaryDeep : styles.text,
    display: "inline-flex", alignItems: "center", gap: 6,
  });
  const allocOption = (active) => ({
    flex: 1, minWidth: mobile ? "100%" : 150, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
    border: `2px solid ${active ? PALETTE.primary : styles.border}`,
    background: active ? "var(--byb-primary-tint)" : "transparent",
    color: styles.text, display: "flex", flexDirection: "column", gap: 3,
  });

  return (
    <form className="byb-panel" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      style={{ ...styles.card, marginBottom: 16, borderColor: PALETTE.primary, background: "var(--byb-primary-tint)", ...style }}
      data-testid="add-income-flow">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <IconWallet size={18} /> Add income
      </div>

      {/* Step 1 — source */}
      <div style={stepLabel}>1 · Where is it from?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {incomeCats.map((c) => (
          <button key={c.id} type="button" style={chip(!newSource && sourceId === c.id)}
            onClick={() => { setNewSource(false); setSourceId(c.id); }} data-testid={`income-source-${c.id}`}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.colour }} />
            {c.name}
          </button>
        ))}
        <button type="button" style={chip(newSource)} onClick={() => setNewSource(true)} data-testid="income-source-new">
          <IconPlus size={14} /> New stream
        </button>
      </div>
      {newSource && (
        <input
          className="byb-panel"
          style={{ ...styles.input, marginBottom: 6 }}
          placeholder="Name the income stream (e.g. Etsy shop, Dividends)"
          value={newSourceName}
          autoFocus
          onChange={(e) => setNewSourceName(e.target.value)}
        />
      )}

      {/* Step 2 — amount */}
      <div style={{ ...stepLabel, marginTop: 14 }}>2 · How much?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <input
            style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="income-amount"
          />
        </div>
        {recurringAmt != null && (
          <button type="button"
            style={{ ...styles.buttonGhost, fontSize: 12, padding: "9px 12px", borderColor: PALETTE.primary, color: PALETTE.primaryDeep, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setAmount(centsToInput(recurringAmt))}>
            <IconZap size={13} /> Stay Consistent ({fmtAUD(recurringAmt)})
          </button>
        )}
        <div style={{ minWidth: mobile ? "100%" : 150 }}>
          <input style={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date received" />
        </div>
      </div>
      <input style={{ ...styles.input, marginBottom: 6 }} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

      {/* Step 3 — allocation */}
      <div style={{ ...stepLabel, marginTop: 14 }}>3 · Where should it go?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" style={allocOption(allocationMode === "unallocated")} onClick={() => setAllocationMode("unallocated")} data-testid="alloc-unallocated">
          <span style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><IconWallet size={14} /> Keep unallocated</span>
          <span style={{ fontSize: 11, color: styles.textMuted }}>Decide later. Current: {fmtAUD(unallocatedBalance)}</span>
        </button>
        <button type="button" style={allocOption(allocationMode === "fill")} onClick={() => setAllocationMode("fill")} data-testid="alloc-fill">
          <span style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><IconZap size={14} /> Fill envelopes</span>
          <span style={{ fontSize: 11, color: styles.textMuted }}>Top up to monthly targets ({fmtAUD(fillPreview)} needed)</span>
        </button>
        <button type="button" style={allocOption(allocationMode === "split")} onClick={() => setAllocationMode("split")} data-testid="alloc-split">
          <span style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><IconEnvelope size={14} /> Specific envelopes</span>
          <span style={{ fontSize: 11, color: styles.textMuted }}>Send it straight where it's needed</span>
        </button>
      </div>

      {allocationMode === "split" && (
        <div className="byb-panel" style={{ marginBottom: 10 }}>
          {splits.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select style={{ ...styles.input, flex: 2 }} value={row.catId}
                onChange={(e) => setSplits((prev) => prev.map((r, j) => j === i ? { ...r, catId: e.target.value } : r))}>
                {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtAUD(c.envelopeBalance || 0)})</option>)}
              </select>
              <input style={{ ...styles.input, flex: 1, minWidth: 90 }} type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
                value={row.amount}
                onChange={(e) => setSplits((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))} />
              {splits.length > 1 && (
                <button type="button" style={{ ...styles.buttonGhost, padding: "8px 10px", fontSize: 12 }}
                  onClick={() => setSplits((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove split">✕</button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={{ ...styles.buttonGhost, fontSize: 12, padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
              onClick={() => setSplits((prev) => [...prev, { catId: expenseCats[0]?.id || "", amount: "" }])}>
              <IconPlus size={13} /> Add another envelope
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: splitRemaining < 0 ? "var(--byb-over)" : styles.textMuted }}>
              {splitRemaining < 0
                ? `Over by ${fmtAUD(-splitRemaining)}`
                : `${fmtAUD(splitRemaining)} of ${fmtAUD(parsedAmount)} stays unallocated`}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="submit" style={{ ...styles.button, flex: 1, padding: "13px 16px", fontSize: 15, fontWeight: 700, opacity: canSubmit ? 1 : 0.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          disabled={!canSubmit} data-testid="income-submit">
          <IconCheck size={16} /> Add {parsedAmount > 0 ? fmtAUD(parsedAmount) : "income"}
        </button>
        <button type="button" style={styles.buttonGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
