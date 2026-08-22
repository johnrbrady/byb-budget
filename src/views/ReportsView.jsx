import React, { useState, useEffect } from "react";
import { PALETTE } from "../lib/constants.js";
import { centsToInput, fmtAUD, monthKey, parseAUDToCents, todayISO, formatMonth } from "../lib/utils.js";
import { filterTransactions, totals, groupByMonth, normaliseRange } from "../lib/txQuery.js";
import { PieChart } from "../components/PieChart.jsx";
import { CategorySpendingTrends } from "../components/CategorySpendingTrends.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { IconHistory, IconWallet } from "../components/Icons.jsx";
import { MAX_BANK_CSV_BYTES, categoryHistory, normaliseDescription, parseBankCsv } from "../lib/csvImport.js";
import { budgetHistoryCategories, budgetHistoryRows } from "../lib/budgetHistory.js";

function UnallocatedEditor({ unallocatedBalance, onSetUnallocated, styles }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => {
    try { onSetUnallocated(parseAUDToCents(val, { allowNegative: true })); setEditing(false); } catch {}
  };
  if (!editing) {
    return (
      <button style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={() => { setVal(centsToInput(unallocatedBalance)); setEditing(true); }}>
        Edit Unallocated ({fmtAUD(unallocatedBalance)})
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input style={{ ...styles.input, width: 120 }} type="number" step="0.01" inputMode="decimal" value={val} autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
      <button style={styles.button} onClick={commit}>Set</button>
      <button style={styles.buttonGhost} onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}

// One run in the reconcile history.
//
// The summary line is the three aggregates the log has always carried, so a run
// recorded before per-envelope movements existed reads exactly as it did — and
// gets no expander, because there is genuinely nothing behind it. A run that
// does carry movements expands to say which envelopes surrendered surplus,
// which were topped up and by how much, and what went back to unallocated.
function ReconcileEntry({ entry, categoriesById, usersById, styles }) {
  const [open, setOpen] = useState(false);
  const movements = Array.isArray(entry.movements) ? entry.movements : [];
  const expandable = movements.length > 0;
  const surrendered = movements.filter((m) => m.amount < 0);
  const toppedUp = movements.filter((m) => m.amount > 0);
  const name = (catId) => categoriesById?.[catId]?.name || "Deleted envelope";
  const colour = (catId) => categoriesById?.[catId]?.colour || "#999";

  const moveRow = (m) => (
    <div key={m.catId} data-testid={`reconcile-move-${entry.id}-${m.catId}`}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", flexWrap: "wrap" }}>
      <span style={styles.pill(colour(m.catId))}>{name(m.catId)}</span>
      <span style={{ fontSize: 12, color: styles.textMuted, fontVariantNumeric: "tabular-nums" }}>
        {fmtAUD(m.before)} → {fmtAUD(m.after)}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 13, minWidth: 88, textAlign: "right", color: m.amount < 0 ? styles.text : "var(--byb-ok)" }}>
        {m.amount < 0 ? "−" : "+"}{fmtAUD(Math.abs(m.amount))}
      </span>
    </div>
  );

  const summary = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {expandable && <span style={{ color: styles.textMuted, marginRight: 6, fontSize: 11 }}>{open ? "▾" : "▸"}</span>}
          {entry.date}
          <span style={{ fontWeight: 400, color: styles.textMuted, marginLeft: 8, fontSize: 12 }}>
            by {usersById?.[entry.userId]?.name || "Unknown"}
          </span>
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
          <span style={{ color: "var(--byb-ok)", fontWeight: 700 }}>{fmtAUD(entry.pooled)}</span> redistributed
        </span>
      </div>
      <div style={{ fontSize: 12, color: styles.textMuted, marginTop: 3 }}>
        {entry.toppedUp} envelope{entry.toppedUp === 1 ? "" : "s"} topped up · {fmtAUD(entry.returned)} returned to Unallocated
      </div>
    </>
  );

  const pad = styles.isMobile ? "10px 14px" : "12px 20px";
  if (!expandable) {
    return <div style={{ padding: pad, borderBottom: `1px solid ${styles.border}` }} data-testid={`reconcile-entry-${entry.id}`}>{summary}</div>;
  }
  return (
    <div style={{ borderBottom: `1px solid ${styles.border}` }} data-testid={`reconcile-entry-${entry.id}`}>
      <button
        style={{ display: "block", width: "100%", padding: pad, background: "transparent", border: "none", color: styles.text, font: "inherit", textAlign: "left", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`reconcile-toggle-${entry.id}`}
      >
        {summary}
      </button>
      {open && (
        <div style={{ padding: styles.isMobile ? "0 14px 12px" : "0 20px 14px" }} data-testid={`reconcile-detail-${entry.id}`}>
          {surrendered.length > 0 && (
            <>
              <div style={{ ...styles.label, marginTop: 6 }}>Surplus pooled from</div>
              {surrendered.map(moveRow)}
            </>
          )}
          {toppedUp.length > 0 && (
            <>
              <div style={{ ...styles.label, marginTop: 10 }}>Topped up</div>
              {toppedUp.map(moveRow)}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, paddingTop: 8, borderTop: `1px solid ${styles.border}`, fontSize: 13 }}>
            <span style={{ color: styles.textMuted }}>Returned to Unallocated</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--byb-ok)" }}>{fmtAUD(entry.returned)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// One entry in the balance-adjustment history: the deliberate, non-transaction
// changes to what the household holds — envelopes opened at setup, all balances
// reset, unallocated set by hand.
//
// `amount` is the household total's change, so it is the number shown biggest:
// it is the answer to "where did my money go". `before`/`after` are the totals
// either side. An entry migrated from the short-lived `openingBalances` log
// carries neither, so both lines are conditional rather than assumed — the same
// courtesy ReconcileEntry extends to runs recorded before movements existed.
const ADJUSTMENT_LABELS = {
  opening: "Envelopes opened with money already held",
  reset: "All balances reset to zero",
  "set-unallocated": "Unallocated set by hand",
};

function AdjustmentEntry({ entry, categoriesById, usersById, styles }) {
  const [open, setOpen] = useState(false);
  const entries = Array.isArray(entry.entries) ? entry.entries : [];
  // Setting unallocated by hand moves no envelope, so its detail is the
  // unallocated line alone — still worth expanding for, because the summary
  // shows the household total rather than the balance that was actually typed.
  const expandable = entries.length > 0 || !!entry.unallocated;
  const name = (catId) => categoriesById?.[catId]?.name || "Deleted envelope";
  const colour = (catId) => categoriesById?.[catId]?.colour || "#999";
  const signed = (n) => `${n < 0 ? "−" : "+"}${fmtAUD(Math.abs(n))}`;
  const hasTotals = typeof entry.before === "number" && typeof entry.after === "number";

  const envRow = (m) => (
    <div key={m.catId} data-testid={`adjustment-move-${entry.id}-${m.catId}`}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", flexWrap: "wrap" }}>
      <span style={styles.pill(colour(m.catId))}>{name(m.catId)}</span>
      {typeof m.before === "number" && typeof m.after === "number" && (
        <span style={{ fontSize: 12, color: styles.textMuted, fontVariantNumeric: "tabular-nums" }}>
          {fmtAUD(m.before)} → {fmtAUD(m.after)}
        </span>
      )}
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 13, minWidth: 88, textAlign: "right", color: m.amount < 0 ? styles.text : "var(--byb-ok)" }}>
        {signed(m.amount)}
      </span>
    </div>
  );

  const summary = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {expandable && <span style={{ color: styles.textMuted, marginRight: 6, fontSize: 11 }}>{open ? "▾" : "▸"}</span>}
          {entry.date}
          <span style={{ fontWeight: 400, color: styles.textMuted, marginLeft: 8, fontSize: 12 }}>
            by {usersById?.[entry.userId]?.name || "Unknown"}
          </span>
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700, color: entry.amount < 0 ? "var(--byb-over)" : "var(--byb-ok)" }}
          data-testid={`adjustment-amount-${entry.id}`}>
          {signed(entry.amount || 0)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: styles.textMuted, marginTop: 3 }}>
        {ADJUSTMENT_LABELS[entry.kind] || "Balance adjustment"}
        {hasTotals && <> · total held {fmtAUD(entry.before)} → {fmtAUD(entry.after)}</>}
      </div>
    </>
  );

  const pad = styles.isMobile ? "10px 14px" : "12px 20px";
  if (!expandable) {
    return <div style={{ padding: pad, borderBottom: `1px solid ${styles.border}` }} data-testid={`adjustment-entry-${entry.id}`}>{summary}</div>;
  }
  return (
    <div style={{ borderBottom: `1px solid ${styles.border}` }} data-testid={`adjustment-entry-${entry.id}`}>
      <button
        style={{ display: "block", width: "100%", padding: pad, background: "transparent", border: "none", color: styles.text, font: "inherit", textAlign: "left", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`adjustment-toggle-${entry.id}`}
      >
        {summary}
      </button>
      {open && (
        <div style={{ padding: styles.isMobile ? "0 14px 12px" : "0 20px 14px" }} data-testid={`adjustment-detail-${entry.id}`}>
          {entries.length > 0 && (
            <>
              <div style={{ ...styles.label, marginTop: 6 }}>Envelopes</div>
              {entries.map(envRow)}
            </>
          )}
          {entry.unallocated && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, paddingTop: 8, borderTop: `1px solid ${styles.border}`, fontSize: 13 }}>
              <span style={{ color: styles.textMuted }}>Unallocated</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                {fmtAUD(entry.unallocated.before)} → {fmtAUD(entry.unallocated.after)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ReportsView({ transactions, categories, categoriesById, usersById, reportRange, setReportRange, handleExport, assets, onSaveAsset, onDeleteAsset, transfers, reconcileLog, adjustments, budgetHistory, unallocatedBalance, onSetUnallocated, onImportJSON, onImportTransactions, onNavigateToCategory, activeMonth, activeUserId, styles }) {
  const [assetForm, setAssetForm] = useState(null); // null=closed, {}=new, {id,...}=editing
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importCopied, setImportCopied] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvError, setCsvError] = useState("");
  const [budgetCategoryId, setBudgetCategoryId] = useState("all");

  const expenseCatList = categories.filter((c) => c.type === "expense");
  const aiPrompt = `Convert my bank statement transactions to JSON format for the BYB budget app.
Return ONLY a valid JSON array - no explanation, no markdown, just raw JSON.

Each item must follow this exact structure:
[
  {
    "date": "YYYY-MM-DD",
    "amount": 123.45,
    "type": "expense",
    "categoryId": "c-groceries",
    "description": "Brief description"
  }
]

Rules:
- type is expense for money paid out, income for money received
- amount is always a positive number
- date must be YYYY-MM-DD format
- description should be plain text with no special characters or apostrophes
- Choose the best categoryId from this list:
${expenseCatList.map((c) => `  "${c.id}": ${c.name}`).join("\n")}
  "c-salary": Salary (for income)
  "c-other-in": Other Income (for income)

My transactions and bank statement:
[PASTE YOUR BANK STATEMENT HERE]`;

  const copyPrompt = () => {
    const doFallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = aiPrompt;
        ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setImportCopied(true);
        setTimeout(() => setImportCopied(false), 2000);
      } catch { /* silent */ }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(aiPrompt)
        .then(() => { setImportCopied(true); setTimeout(() => setImportCopied(false), 2000); })
        .catch(doFallback);
    } else {
      doFallback();
    }
  };

  const runImport = () => {
    if (!importText.trim()) return;
    const ok = onImportJSON(importText);
    if (ok) { setImportText(""); setImportOpen(false); }
  };

  const chooseCsv = async (file) => {
    setCsvError("");
    setCsvPreview(null);
    if (!file) return;
    try {
      if (Number.isFinite(file.size) && file.size > MAX_BANK_CSV_BYTES) {
        throw new Error("The CSV must be 5 MB or smaller");
      }
      const parsed = parseBankCsv(await file.text(), transactions);
      const history = categoryHistory(transactions);
      const fallback = {
        expense: categories.find((category) => category.type === "expense")?.id || "",
        income: categories.find((category) => category.type === "income")?.id || "",
      };
      const rows = parsed.rows.map((row, index) => {
        const historyCategoryId = history.get(`${row.type}|${normaliseDescription(row.description)}`);
        return { ...row, previewId: `${row.sourceRow}-${index}`, categoryId: historyCategoryId || fallback[row.type], matchedByHistory: Boolean(historyCategoryId) };
      });
      setCsvPreview({ ...parsed, rows, fileName: file.name });
    } catch (error) {
      setCsvError(error.message || "Could not read that CSV file");
    }
  };

  const setCsvCategory = (previewId, categoryId) => {
    setCsvPreview((current) => ({ ...current, rows: current.rows.map((row) => row.previewId === previewId ? { ...row, categoryId, matchedByHistory: false } : row) }));
  };

  const runCsvImport = () => {
    if (!csvPreview?.rows.length || typeof onImportTransactions !== "function") return;
    const rows = csvPreview.rows.map(({ previewId, matchedByHistory, sourceRow, ...row }) => ({ ...row, addedBy: activeUserId }));
    const result = onImportTransactions(rows, { invalid: csvPreview.invalid, duplicates: csvPreview.duplicates, rounded: csvPreview.rounded, preDeduped: true });
    if (result?.ok) { setCsvPreview(null); setCsvError(""); setImportOpen(false); }
  };
  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState("");

  const openNewAsset = () => { setAssetForm({}); setAssetName(""); setAssetValue(""); };
  const openEditAsset = (a) => { setAssetForm(a); setAssetName(a.name); setAssetValue(centsToInput(a.value)); };
  const closeAssetForm = () => { setAssetForm(null); setAssetName(""); setAssetValue(""); };
  const submitAsset = () => {
    let v;
    try { v = parseAUDToCents(assetValue, { allowNegative: true }); } catch { return; }
    if (!assetName.trim()) return;
    onSaveAsset({ ...assetForm, name: assetName.trim(), value: v });
    closeAssetForm();
  };
  const netWorth = assets.reduce((s, a) => s + (a.value || 0), 0);

  // Pie chart month — follows the global month selector but can be overridden
  const allMonths = Array.from(new Set([...transactions.map((t) => monthKey(t.date)), activeMonth])).sort().reverse();
  const [pieMonth, setPieMonth] = useState(activeMonth || allMonths[0] || todayISO().slice(0, 7));
  const [piePeriod, setPiePeriod] = useState("month");
  useEffect(() => { if (activeMonth) setPieMonth(activeMonth); }, [activeMonth]);

  const clamped = normaliseRange(reportRange);
  const rangeTx = filterTransactions(transactions, clamped);
  const distributionTx = piePeriod === "month"
    ? filterTransactions(transactions, { month: pieMonth, type: "expense" })
    : filterTransactions(transactions, { ...clamped, type: "expense" });
  const distributionData = categories.filter((category) => category.type === "expense").map((category) => ({
    label: category.name,
    colour: category.colour,
    value: totals(filterTransactions(distributionTx, { categoryId: category.id, type: "expense" })).expense,
  })).filter((entry) => entry.value > 0);
  const { income, expense: expenses, net } = totals(rangeTx);

  const daysInRange = Math.max(1, Math.round((new Date(clamped.end) - new Date(clamped.start)) / 86400000) + 1);
  const avgDaily = daysInRange > 0 ? expenses / daysInRange : 0;

  const byCat = {};
  rangeTx.filter((t) => t.type === "expense").forEach((t) => {
    if (!byCat[t.categoryId]) byCat[t.categoryId] = { total: 0, count: 0 };
    byCat[t.categoryId].total += t.amount;
    byCat[t.categoryId].count += 1;
  });
  const breakdown = Object.entries(byCat).map(([cid, v]) => ({
    cat: categoriesById[cid],
    total: v.total,
    count: v.count,
    avg: v.total / v.count,
    pct: expenses > 0 ? (v.total / expenses) * 100 : 0,
  })).sort((a, b) => b.total - a.total);

  const topCat = breakdown[0]?.cat?.name || "—";

  // The trend reads oldest-first, left to right, so it is the month grouping
  // reversed rather than a second pass over the range.
  const monthlyTrend = groupByMonth(rangeTx).reverse();
  const maxTrend = Math.max(1, ...monthlyTrend.flatMap((m) => [m.income, m.expense]));
  const budgetCategories = budgetHistoryCategories(budgetHistory, categories);
  const historicalBudgets = budgetHistoryRows(budgetHistory, transactions, budgetCategoryId);

  return (
    <div>
      {/* Net Worth / Assets section */}
      <div style={styles.sectionTitle}>Net worth</div>
      <div style={{ ...styles.card, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={styles.kpiLabel}>Total net worth</div>
            <div style={{ fontSize: styles.isMobile ? 28 : 36, fontWeight: 800, letterSpacing: -1, color: netWorth >= 0 ? "var(--byb-ok)" : "var(--byb-over)", lineHeight: 1.1 }}>
              {fmtAUD(netWorth)}
            </div>
          </div>
          {assetForm === null && (
            <button style={{ ...styles.button, whiteSpace: "nowrap" }} onClick={openNewAsset}>+ Add asset</button>
          )}
        </div>

        {/* Inline add/edit form */}
        {assetForm !== null && (
          <div className="byb-panel" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input style={{ ...styles.input, flex: 2, minWidth: 140 }} placeholder="Asset name (e.g. Superannuation)" value={assetName} onChange={(e) => setAssetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitAsset(); if (e.key === "Escape") closeAssetForm(); }} autoFocus />
            <input style={{ ...styles.input, flex: 1, minWidth: 120 }} type="number" step="0.01" inputMode="decimal" placeholder="Value ($)" value={assetValue} onChange={(e) => setAssetValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitAsset(); if (e.key === "Escape") closeAssetForm(); }} />
            <button style={{ ...styles.button, whiteSpace: "nowrap" }} onClick={submitAsset}>{assetForm.id ? "Update" : "Add"}</button>
            <button style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={closeAssetForm}>Cancel</button>
          </div>
        )}

        {/* Asset list */}
        {assets.length === 0 && assetForm === null && (
          <EmptyState icon={IconWallet} title="No assets added yet." hint="Track superannuation, property, savings accounts and anything else you own, for the full picture rather than just the spending." styles={styles} />
        )}
        {assets.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${styles.border}`, gap: 8 }}>
            <span style={{ fontWeight: 500, flex: 1 }}>{a.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--byb-ok)", fontSize: 15, whiteSpace: "nowrap" }}>{fmtAUD(a.value)}</span>
            <button style={{ ...styles.buttonGhost, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={() => openEditAsset(a)}>Edit</button>
            <button style={{ ...styles.buttonDanger, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={() => onDeleteAsset(a.id)}>Delete</button>
          </div>
        ))}
      </div>

      {styles.isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: importOpen ? 0 : 16, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, overflow: "hidden" }}>
            <div style={{ minWidth: 0 }}><div style={styles.label}>From</div><input style={{ ...styles.input, minWidth: 0 }} type="date" value={reportRange.start} onChange={(e) => setReportRange({ ...reportRange, start: e.target.value })} /></div>
            <div style={{ minWidth: 0 }}><div style={styles.label}>To</div><input style={{ ...styles.input, minWidth: 0 }} type="date" value={reportRange.end} onChange={(e) => setReportRange({ ...reportRange, end: e.target.value })} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button style={{ ...styles.buttonGhost, textAlign: "center" }} onClick={() => { setImportOpen((o) => !o); setImportText(""); }}>
              {importOpen ? "✕ Close" : "Import"}
            </button>
            <button style={{ ...styles.buttonGhost, textAlign: "center" }} onClick={handleExport} data-testid="reports-export">Export XLSX</button>
          </div>
          <UnallocatedEditor unallocatedBalance={unallocatedBalance} onSetUnallocated={onSetUnallocated} styles={styles} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: importOpen ? 0 : 16, alignItems: "end", flexWrap: "wrap" }}>
          <div><div style={styles.label}>From</div><input style={styles.input} type="date" value={reportRange.start} onChange={(e) => setReportRange({ ...reportRange, start: e.target.value })} /></div>
          <div><div style={styles.label}>To</div><input style={styles.input} type="date" value={reportRange.end} onChange={(e) => setReportRange({ ...reportRange, end: e.target.value })} /></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <UnallocatedEditor unallocatedBalance={unallocatedBalance} onSetUnallocated={onSetUnallocated} styles={styles} />
            <button style={styles.buttonGhost} onClick={() => { setImportOpen((o) => !o); setImportText(""); }}>
              {importOpen ? "✕ Close import" : "Import Transactions"}
            </button>
            <button style={styles.buttonGhost} onClick={handleExport} data-testid="reports-export">Export XLSX</button>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="byb-panel" style={{ ...styles.card, marginBottom: 20, borderColor: PALETTE.primary }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Import a bank statement</div>
          <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 10 }}>
            Choose a CSV downloaded from your bank. BYB! previews every new row, remembers categories used for the same description and protects against importing the same statement twice.
          </div>

          <input
            aria-label="Choose bank CSV"
            data-testid="bank-csv-input"
            type="file"
            accept=".csv,text/csv"
            style={{ ...styles.input, marginBottom: 10 }}
            onChange={(event) => chooseCsv(event.target.files?.[0])}
          />
          {csvError && <div role="alert" style={{ color: "var(--byb-over)", fontSize: 13, marginBottom: 10 }}>{csvError}</div>}
          {csvPreview && (
            <div data-testid="csv-preview" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 8 }}>
                {csvPreview.fileName}: {csvPreview.rows.length} new · {csvPreview.duplicates} already imported · {csvPreview.invalid} invalid
              </div>
              {csvPreview.rows.length === 0 ? (
                <div style={{ fontSize: 13 }}>No new transactions found in this statement.</div>
              ) : (
                <>
                  <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${styles.border}`, borderRadius: 6 }}>
                    {csvPreview.rows.map((row) => (
                      <div key={row.previewId} data-testid="csv-preview-row" style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr" : "90px minmax(130px, 1fr) 100px minmax(130px, 180px)", gap: 8, alignItems: "center", padding: 8, borderBottom: `1px solid ${styles.border}` }}>
                        <span style={{ fontSize: 12 }}>{row.date}</span>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{row.description}</span>
                        <strong style={{ color: row.type === "income" ? "var(--byb-ok)" : "var(--byb-over)", fontVariantNumeric: "tabular-nums" }}>{row.type === "income" ? "+" : "−"}{fmtAUD(row.amount)}</strong>
                        <label>
                          <span className="sr-only">Category for {row.description}</span>
                          <select aria-label={`Category for ${row.description}`} style={{ ...styles.input, width: "100%" }} value={row.categoryId} onChange={(event) => setCsvCategory(row.previewId, event.target.value)}>
                            {categories.filter((category) => category.type === row.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                  <button style={{ ...styles.button, marginTop: 10 }} onClick={runCsvImport}>Import {csvPreview.rows.length} transaction{csvPreview.rows.length === 1 ? "" : "s"}</button>
                </>
              )}
            </div>
          )}

          <div style={{ fontWeight: 700, fontSize: 14, margin: "16px 0 4px", paddingTop: 14, borderTop: `1px solid ${styles.border}` }}>Or use an AI assistant</div>
          <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 14 }}>
            ChatGPT, Claude or Gemini can convert statements that are not available as CSV; paste the JSON result below.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={styles.label}>Step 1 — Copy this prompt and send it to your AI with your bank statement attached</div>
              <button style={{ ...styles.buttonGhost, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={copyPrompt}>
                {importCopied ? "Copied!" : "Copy prompt"}
              </button>
            </div>
            <pre style={{ background: "var(--byb-surface-sunken)", border: `1px solid ${styles.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: styles.text, maxHeight: 200, overflow: "auto", margin: 0 }}>
              {aiPrompt}
            </pre>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={styles.label}>Step 2 — Paste the JSON output from your AI here</div>
            <textarea
              style={{ ...styles.input, minHeight: 120, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
              placeholder='[{"date":"2024-01-15","amount":85.50,"type":"expense","categoryId":"c-groceries","description":"Woolworths"}]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.button, flex: styles.isMobile ? 1 : "none" }} onClick={runImport} disabled={!importText.trim()}>Import Transactions</button>
            <button style={styles.buttonGhost} onClick={() => { setImportOpen(false); setImportText(""); setCsvPreview(null); setCsvError(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: styles.isMobile ? 10 : 12, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={styles.card}><div style={styles.kpiLabel}>Income</div><div style={styles.kpiValue}>{fmtAUD(income)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Expenses</div><div style={styles.kpiValue}>{fmtAUD(expenses)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Net</div><div style={{ ...styles.kpiValue, color: net >= 0 ? "var(--byb-ok)" : "var(--byb-over)" }}>{fmtAUD(net)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Avg daily spend</div><div style={styles.kpiValue}>{fmtAUD(avgDaily)}</div></div>
        <div style={{ ...styles.card, gridColumn: styles.isMobile ? "span 2" : "auto" }}><div style={styles.kpiLabel}>Top category</div><div style={{ ...styles.kpiValue, fontSize: 16 }}>{topCat}</div></div>
      </div>

      {/* One distribution chart with an explicit month or any custom period. */}
      <div style={{ ...styles.card, marginBottom: styles.isMobile ? 16 : 24 }} data-testid="spending-distribution-card">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ ...styles.sectionTitle, margin: 0 }}>Spending distribution</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label htmlFor="distribution-period" style={{ ...styles.label, display: "block" }}>Show</label>
              <select id="distribution-period" aria-label="Distribution period" data-testid="distribution-period" style={styles.input} value={piePeriod} onChange={(event) => setPiePeriod(event.target.value)}>
                <option value="month">One month</option>
                <option value="range">Custom dates</option>
              </select>
            </div>
            {piePeriod === "month" ? (
              <div>
                <label htmlFor="distribution-month" style={{ ...styles.label, display: "block" }}>Month</label>
                <select id="distribution-month" aria-label="Distribution month" data-testid="distribution-month" style={{ ...styles.monthSelect, minHeight: 42 }} value={pieMonth} onChange={(event) => setPieMonth(event.target.value)}>
                  {allMonths.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="distribution-from" style={{ ...styles.label, display: "block" }}>From</label>
                  <input id="distribution-from" aria-label="Distribution from" data-testid="distribution-from" style={styles.input} type="date" value={reportRange.start} onChange={(event) => setReportRange({ ...reportRange, start: event.target.value })} />
                </div>
                <div>
                  <label htmlFor="distribution-to" style={{ ...styles.label, display: "block" }}>To</label>
                  <input id="distribution-to" aria-label="Distribution to" data-testid="distribution-to" style={styles.input} type="date" value={reportRange.end} onChange={(event) => setReportRange({ ...reportRange, end: event.target.value })} />
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 8 }} data-testid="distribution-scope">
          {piePeriod === "month" ? formatMonth(pieMonth) : `${clamped.start || "the beginning"} → ${clamped.end || "today"}`}
        </div>
        <PieChart size={180} data={distributionData} />
      </div>

      <div style={styles.sectionTitle}>Monthly trend</div>
      <div style={styles.card}>
        {monthlyTrend.map((m) => (
          <div key={m.month} style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr" : "120px 1fr 120px", gap: styles.isMobile ? 4 : 12, alignItems: "center", padding: styles.isMobile ? "10px 0" : "6px 0", borderBottom: styles.isMobile ? `1px solid ${styles.border}` : "none" }}>
            {styles.isMobile && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12 }}>
                <span style={{ color: styles.text, fontWeight: 500 }}>{formatMonth(m.month)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: "var(--byb-ok)" }}>+{fmtAUD(m.income)}</span>
                  {" · "}
                  <span style={{ color: PALETTE.warn }}>−{fmtAUD(m.expense)}</span>
                </span>
              </div>
            )}
            {!styles.isMobile && <div style={{ fontSize: 12, color: styles.textMuted }}>{formatMonth(m.month)}</div>}
            <div>
              <div className="byb-bar-fill" style={{ height: 8, background: PALETTE.primary, width: `${(m.income / maxTrend) * 100}%`, borderRadius: 3, marginBottom: 4 }} />
              <div className="byb-bar-fill" style={{ height: 8, background: PALETTE.warn, width: `${(m.expense / maxTrend) * 100}%`, borderRadius: 3 }} />
            </div>
            {!styles.isMobile && (
              <div style={{ fontSize: 11, color: styles.textMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <div style={{ color: "var(--byb-ok)" }}>+{fmtAUD(m.income)}</div>
                <div>−{fmtAUD(m.expense)}</div>
              </div>
            )}
          </div>
        ))}
        {monthlyTrend.length === 0 && <div style={{ color: styles.textMuted, fontSize: 13 }}>No data in this range.</div>}
      </div>

      <CategorySpendingTrends
        transactions={transactions}
        categories={categories}
        activeMonth={activeMonth}
        onNavigateToCategory={onNavigateToCategory}
        styles={styles}
      />

      <div style={styles.sectionTitle}>Budget history</div>
      <div style={{ ...styles.card, marginBottom: styles.isMobile ? 16 : 24 }} data-testid="budget-history">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: styles.textMuted, maxWidth: 560 }}>
            Monthly plans are kept from the month this feature was installed. Closed months never change, even when today's envelope amount does.
          </div>
          <label>
            <span style={{ ...styles.label, display: "block" }}>Envelope</span>
            <select aria-label="Budget history envelope" style={styles.input} value={budgetCategoryId} onChange={(event) => setBudgetCategoryId(event.target.value)}>
              <option value="all">All envelopes</option>
              {budgetCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        {historicalBudgets.length === 0 ? (
          <div style={{ color: styles.textMuted, fontSize: 13 }}>Budget history will appear after the first household save.</div>
        ) : (
          <div>
            {historicalBudgets.map((row) => (
              <div key={row.month} data-testid="budget-history-row" style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr 1fr" : "minmax(130px, 1fr) repeat(3, minmax(110px, 1fr))", gap: 8, padding: "9px 0", borderBottom: `1px solid ${styles.border}`, alignItems: "baseline" }}>
                <strong style={{ gridColumn: styles.isMobile ? "span 2" : "auto" }}>{formatMonth(row.month)}</strong>
                <span><span style={{ color: styles.textMuted, fontSize: 11 }}>Budgeted</span><br /><strong>{row.hasPlan ? fmtAUD(row.budgeted) : "—"}</strong></span>
                <span><span style={{ color: styles.textMuted, fontSize: 11 }}>Spent</span><br /><strong>{fmtAUD(row.spent)}</strong></span>
                <span style={{ color: row.variance >= 0 ? "var(--byb-ok)" : "var(--byb-over)" }}>
                  <span style={{ fontSize: 11 }}>{row.variance >= 0 ? "Under by" : "Over by"}</span><br /><strong>{fmtAUD(Math.abs(row.variance))}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reconcile history */}
      <div style={{ ...styles.sectionTitle, display: "flex", alignItems: "center", gap: 6 }}><IconHistory size={14} /> Reconcile history</div>
      {(() => {
        const entries = (reconcileLog || []).slice(0, 24);
        if (entries.length === 0) return <div style={{ ...styles.card, color: styles.textMuted, fontSize: 13 }}>No reconciles yet. Run one from the Dashboard at the end of the month.</div>;
        return (
          <div style={{ ...styles.card, padding: 0 }}>
            {entries.map((e) => (
              <ReconcileEntry key={e.id} entry={e} categoriesById={categoriesById} usersById={usersById} styles={styles} />
            ))}
          </div>
        );
      })()}

      {/* Envelope transfers log */}
      <div style={styles.sectionTitle}>Envelope transfers</div>
      {(() => {
        const rangeTransfers = (transfers || []).filter((t) => t.date >= clamped.start && t.date <= clamped.end).slice(0, 50);
        if (rangeTransfers.length === 0) return <div style={{ ...styles.card, color: styles.textMuted, fontSize: 13 }}>No transfers in this period.</div>;
        return styles.isMobile ? (
          <div>
            {rangeTransfers.map((t) => (
              <div key={t.id} style={styles.txCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: styles.textMuted }}>{t.date}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmtAUD(t.amount)}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={styles.pill(categoriesById[t.fromId]?.colour || "#999")}>{categoriesById[t.fromId]?.name || "?"}</span>
                  {" → "}
                  <span style={styles.pill(categoriesById[t.toId]?.colour || "#999")}>{categoriesById[t.toId]?.name || "?"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead><tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>From</th>
                <th style={styles.th}>To</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
              </tr></thead>
              <tbody>
                {rangeTransfers.map((t) => (
                  <tr key={t.id}>
                    <td style={styles.td}>{t.date}</td>
                    <td style={styles.td}><span style={styles.pill(categoriesById[t.fromId]?.colour || "#999")}>{categoriesById[t.fromId]?.name || "?"}</span></td>
                    <td style={styles.td}><span style={styles.pill(categoriesById[t.toId]?.colour || "#999")}>{categoriesById[t.toId]?.name || "?"}</span></td>
                    <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtAUD(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Balance adjustments — every deliberate change to the household total
          that was not a transaction.

          Deliberately not filtered to the report range, unlike the transfers
          above. These are rare and momentous, and the one that matters most —
          the opening balance a household adopted the app with — is by
          definition the oldest thing in the file. The default range starts on
          1 January, so range-filtering would hide it for most of the app's
          life, from the very report that exists to answer "where did my money
          come from". Capped instead, the way the reconcile history is. */}
      <div style={{ ...styles.sectionTitle, display: "flex", alignItems: "center", gap: 6 }}><IconHistory size={14} /> Balance adjustments</div>
      {(() => {
        const entries = (adjustments || []).slice(0, 24);
        if (entries.length === 0) return <div style={{ ...styles.card, color: styles.textMuted, fontSize: 13 }} data-testid="adjustments-empty">No balance adjustments. Your envelopes only change through transactions, transfers and reconciles.</div>;
        return (
          <div style={{ ...styles.card, padding: 0 }}>
            {entries.map((e) => (
              <AdjustmentEntry key={e.id} entry={e} categoriesById={categoriesById} usersById={usersById} styles={styles} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
