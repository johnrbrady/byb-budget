import React, { useState } from "react";
import { PALETTE } from "../lib/constants.js";
import { fmtAUD } from "../lib/utils.js";
import { IconZap, IconEdit } from "./Icons.jsx";

export function FirstTimeFillWizard({ categories, onComplete, onSkip, styles }) {
  const [mode, setMode] = useState(null); // null | 'auto' | 'manual'
  const [income, setIncome] = useState("");
  const expCats = categories.filter((c) => c.type === "expense");
  const [autoAmounts, setAutoAmounts] = useState(() => Object.fromEntries(expCats.map((c) => [c.id, ""])));
  const [step, setStep] = useState(0);
  const [manualAmounts, setManualAmounts] = useState(() => Object.fromEntries(expCats.map((c) => [c.id, ""])));
  const mobile = styles.isMobile;

  const parsedIncome = parseFloat(income) || 0;

  const applySuggestions = (incomeVal) => {
    const inc = parseFloat(incomeVal) || 0;
    if (inc <= 0) return;
    setAutoAmounts(Object.fromEntries(expCats.map((c) => [c.id, String(Math.round(inc * ((c.suggestedPct || 0) / 100)))])));
  };

  const autoTotal = expCats.reduce((s, c) => s + (parseFloat(autoAmounts[c.id]) || 0), 0);
  const manualTotal = expCats.reduce((s, c) => s + (parseFloat(manualAmounts[c.id]) || 0), 0);
  const overBudget = (total) => parsedIncome > 0 && total > parsedIncome;

  const overBudgetBanner = (total) => (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C", fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
      Oops! You have gone over your monthly budget by {fmtAUD(total - parsedIncome)}. Adjust some amounts to bring it back in line.
    </div>
  );

  if (!mode) {
    return (
      <div className="byb-panel" style={{ ...styles.card, borderColor: PALETTE.primary, background: "var(--byb-primary-tint)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Welcome! Let's set up your envelopes.</div>
        <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 20 }}>This is your first time here. Choose how you want to set your monthly budget amounts.</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <button
            style={{ ...styles.button, padding: "18px 14px", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, textAlign: "left" }}
            onClick={() => setMode("auto")}
          >
            <IconZap size={20} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Fill automatically</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.9 }}>Enter your income and we suggest amounts for each envelope based on sensible percentages.</span>
          </button>
          <button
            style={{ ...styles.buttonGhost, padding: "18px 14px", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, borderWidth: 2, textAlign: "left" }}
            onClick={() => setMode("manual")}
          >
            <IconEdit size={20} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Fill one by one</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: styles.textMuted }}>Go through each envelope and enter your own monthly budget amounts yourself.</span>
          </button>
        </div>
        <button style={{ ...styles.buttonGhost, fontSize: 12 }} onClick={onSkip}>Skip for now</button>
      </div>
    );
  }

  if (mode === "auto") {
    return (
      <div className="byb-panel" style={{ ...styles.card, borderColor: PALETTE.primary, background: "var(--byb-primary-tint)", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Fill automatically</div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 14 }}>Enter your monthly income. We will calculate suggested amounts for each envelope. You can adjust any of them before applying.</div>

        <div style={{ marginBottom: 14 }}>
          <div style={styles.label}>Monthly income ($)</div>
          <input
            style={styles.input} type="number" step="0.01" min="0" inputMode="decimal"
            placeholder="e.g. 8000" value={income} autoFocus
            onChange={(e) => { setIncome(e.target.value); applySuggestions(e.target.value); }}
          />
        </div>

        {parsedIncome > 0 && (
          <>
            <div style={{ maxHeight: 300, overflow: "auto", border: `1px solid ${styles.border}`, borderRadius: 8, marginBottom: 10 }}>
              {expCats.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: `1px solid ${styles.border}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {c.name}
                    {c.suggestedPct ? <span style={{ fontSize: 10, color: styles.textMuted }}> {c.suggestedPct}%</span> : null}
                  </span>
                  <input
                    style={{ ...styles.input, width: 88, textAlign: "right", padding: "4px 8px", fontSize: 13 }}
                    type="number" step="1" min="0"
                    value={autoAmounts[c.id] || ""}
                    onChange={(e) => setAutoAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              <span>Total allocated:</span>
              <span style={{ color: overBudget(autoTotal) ? "var(--byb-over)" : "var(--byb-ok)" }}>{fmtAUD(autoTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: styles.textMuted, marginBottom: 12 }}>
              <span>Monthly income:</span><span>{fmtAUD(parsedIncome)}</span>
            </div>
            {overBudget(autoTotal) && overBudgetBanner(autoTotal)}
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.button, flex: 1 }} onClick={() => onComplete(Object.fromEntries(expCats.map((c) => [c.id, parseFloat(autoAmounts[c.id]) || 0])))} disabled={parsedIncome <= 0 || overBudget(autoTotal)}>Apply</button>
          <button style={styles.buttonGhost} onClick={() => setMode(null)}>Back</button>
        </div>
      </div>
    );
  }

  if (mode === "manual") {
    const cur = expCats[step];
    const isLast = step === expCats.length - 1;
    return (
      <div className="byb-panel" style={{ ...styles.card, borderColor: PALETTE.primary, background: "var(--byb-primary-tint)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Fill one by one</div>
          <div style={{ fontSize: 11, color: styles.textMuted }}>{step + 1} of {expCats.length}</div>
        </div>

        <div style={{ height: 4, background: styles.barTrack, borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
          <div className="byb-bar-fill" style={{ width: `${((step + 1) / expCats.length) * 100}%`, height: "100%", background: PALETTE.primary, borderRadius: 2 }} />
        </div>

        {step === 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={styles.label}>Monthly income (optional)</div>
            <input style={styles.input} type="number" step="0.01" min="0" inputMode="decimal" placeholder="e.g. 8000" value={income} onChange={(e) => setIncome(e.target.value)} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: cur.colour, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{cur.name}</span>
          {cur.isAccumulating && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: PALETTE.secondary + "55", color: PALETTE.primaryDeep, fontWeight: 700 }}>Saving</span>}
        </div>
        <div style={styles.label}>Monthly budget amount ($)</div>
        <input
          style={{ ...styles.input, marginBottom: 12 }}
          type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
          value={manualAmounts[cur.id] || ""} autoFocus
          onChange={(e) => setManualAmounts((prev) => ({ ...prev, [cur.id]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { isLast ? onComplete(Object.fromEntries(expCats.map((c) => [c.id, parseFloat(manualAmounts[c.id]) || 0]))) : setStep((s) => s + 1); } }}
        />

        {parsedIncome > 0 && (
          <div style={{ marginBottom: 10 }}>
            {overBudget(manualTotal) ? overBudgetBanner(manualTotal) : (
              <div style={{ fontSize: 12, color: styles.textMuted }}>
                Allocated so far: {fmtAUD(manualTotal)} of {fmtAUD(parsedIncome)}
                <span style={{ marginLeft: 6, color: "var(--byb-ok)" }}> ({fmtAUD(parsedIncome - manualTotal)} remaining)</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && <button style={styles.buttonGhost} onClick={() => setStep((s) => s - 1)}>Back</button>}
          {!isLast && <button style={{ ...styles.button, flex: 1 }} onClick={() => setStep((s) => s + 1)}>Next</button>}
          {isLast && <button style={{ ...styles.button, flex: 1 }} onClick={() => onComplete(Object.fromEntries(expCats.map((c) => [c.id, parseFloat(manualAmounts[c.id]) || 0])))}>Finish</button>}
          {step === 0 && <button style={{ ...styles.buttonGhost, fontSize: 12 }} onClick={() => setMode(null)}>Mode</button>}
        </div>
      </div>
    );
  }
}
