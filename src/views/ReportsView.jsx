import React, { useState, useEffect } from "react";
import { PALETTE } from "../lib/constants.js";
import { fmtAUD, monthKey, todayISO, formatMonth } from "../lib/utils.js";
import { filterTransactions, totals, groupByMonth, normaliseRange } from "../lib/txQuery.js";
import { PieChart } from "../components/PieChart.jsx";
import { IconHistory } from "../components/Icons.jsx";

function UnallocatedEditor({ unallocatedBalance, onSetUnallocated, styles }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  if (!editing) {
    return (
      <button style={{ ...styles.buttonGhost, whiteSpace: "nowrap" }} onClick={() => { setVal(String(unallocatedBalance)); setEditing(true); }}>
        Edit Unallocated ({fmtAUD(unallocatedBalance)})
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input style={{ ...styles.input, width: 120 }} type="number" step="0.01" inputMode="decimal" value={val} autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat(val); if (!isNaN(v)) { onSetUnallocated(v); setEditing(false); } } if (e.key === "Escape") setEditing(false); }} />
      <button style={styles.button} onClick={() => { const v = parseFloat(val); if (!isNaN(v)) { onSetUnallocated(v); setEditing(false); } }}>Set</button>
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
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 13, minWidth: 88, textAlign: "right", color: m.amount < 0 ? styles.text : PALETTE.primaryDeep }}>
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
          <span style={{ color: PALETTE.primaryDeep, fontWeight: 700 }}>{fmtAUD(entry.pooled)}</span> redistributed
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
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: PALETTE.primaryDeep }}>{fmtAUD(entry.returned)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsView({ transactions, categories, categoriesById, usersById, reportRange, setReportRange, handleExport, assets, onSaveAsset, onDeleteAsset, transfers, reconcileLog, unallocatedBalance, onSetUnallocated, onImportJSON, onNavigateToCategory, activeMonth, styles }) {
  const [assetForm, setAssetForm] = useState(null); // null=closed, {}=new, {id,...}=editing
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importCopied, setImportCopied] = useState(false);

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
  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState("");

  const openNewAsset = () => { setAssetForm({}); setAssetName(""); setAssetValue(""); };
  const openEditAsset = (a) => { setAssetForm(a); setAssetName(a.name); setAssetValue(String(a.value)); };
  const closeAssetForm = () => { setAssetForm(null); setAssetName(""); setAssetValue(""); };
  const submitAsset = () => {
    const v = parseFloat(assetValue);
    if (!assetName.trim() || isNaN(v)) return;
    onSaveAsset({ ...assetForm, name: assetName.trim(), value: v });
    closeAssetForm();
  };
  const netWorth = assets.reduce((s, a) => s + (a.value || 0), 0);

  // Pie chart month — follows the global month selector but can be overridden
  const allMonths = Array.from(new Set([...transactions.map((t) => monthKey(t.date)), activeMonth])).sort().reverse();
  const [pieMonth, setPieMonth] = useState(activeMonth || allMonths[0] || todayISO().slice(0, 7));
  useEffect(() => { if (activeMonth) setPieMonth(activeMonth); }, [activeMonth]);

  const clamped = normaliseRange(reportRange);
  const rangeTx = filterTransactions(transactions, clamped);
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

  const goToCategory = (catId) => { if (onNavigateToCategory && catId) onNavigateToCategory(catId); };

  return (
    <div>
      {/* Net Worth / Assets section */}
      <div style={styles.sectionTitle}>Net worth</div>
      <div style={{ ...styles.card, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={styles.kpiLabel}>Total net worth</div>
            <div style={{ fontSize: styles.isMobile ? 28 : 36, fontWeight: 800, letterSpacing: -1, color: netWorth >= 0 ? PALETTE.primaryDeep : PALETTE.warn, lineHeight: 1.1 }}>
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
          <div style={{ color: styles.textMuted, fontSize: 13 }}>No assets added yet. Hit "+ Add asset" to track superannuation, property, savings accounts, etc.</div>
        )}
        {assets.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${styles.border}`, gap: 8 }}>
            <span style={{ fontWeight: 500, flex: 1 }}>{a.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: PALETTE.primaryDeep, fontSize: 15, whiteSpace: "nowrap" }}>{fmtAUD(a.value)}</span>
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
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Import transactions via AI</div>
          <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 14 }}>
            Use your AI assistant (ChatGPT, Claude, Gemini, etc.) to convert your bank statement into the format BYB! understands, then paste the result below.
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={styles.label}>Step 1 — Copy this prompt and send it to your AI with your bank statement attached</div>
              <button style={{ ...styles.buttonGhost, fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }} onClick={copyPrompt}>
                {importCopied ? "Copied!" : "Copy prompt"}
              </button>
            </div>
            <pre style={{ background: styles.dark ? "#111" : "#F3F4F6", border: `1px solid ${styles.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: styles.text, maxHeight: 200, overflow: "auto", margin: 0 }}>
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
            <button style={styles.buttonGhost} onClick={() => { setImportOpen(false); setImportText(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: styles.isMobile ? 10 : 12, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={styles.card}><div style={styles.kpiLabel}>Income</div><div style={styles.kpiValue}>{fmtAUD(income)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Expenses</div><div style={styles.kpiValue}>{fmtAUD(expenses)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Net</div><div style={{ ...styles.kpiValue, color: net >= 0 ? PALETTE.primaryDeep : PALETTE.warn }}>{fmtAUD(net)}</div></div>
        <div style={styles.card}><div style={styles.kpiLabel}>Avg daily spend</div><div style={styles.kpiValue}>{fmtAUD(avgDaily)}</div></div>
        <div style={{ ...styles.card, gridColumn: styles.isMobile ? "span 2" : "auto" }}><div style={styles.kpiLabel}>Top category</div><div style={{ ...styles.kpiValue, fontSize: 16 }}>{topCat}</div></div>
      </div>

      {/* Pie charts */}
      <div style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr" : "1fr 1fr", gap: styles.isMobile ? 16 : 20, marginBottom: styles.isMobile ? 16 : 24 }}>
        <div style={styles.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ ...styles.sectionTitle, margin: 0 }}>Monthly distribution</div>
            <select style={{ ...styles.monthSelect }} value={pieMonth} onChange={(e) => setPieMonth(e.target.value)}>
              {allMonths.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
          </div>
          <PieChart
            size={160}
            data={categories.filter((c) => c.type === "expense").map((c) => ({
              label: c.name,
              colour: c.colour,
              value: totals(filterTransactions(transactions, { month: pieMonth, categoryId: c.id, type: "expense" })).expense,
            })).filter((d) => d.value > 0)}
          />
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.sectionTitle, margin: "0 0 12px 0" }}>Full period distribution</div>
          <PieChart
            size={160}
            data={categories.filter((c) => c.type === "expense").map((c) => ({
              label: c.name,
              colour: c.colour,
              value: totals(filterTransactions(rangeTx, { categoryId: c.id, type: "expense" })).expense,
            })).filter((d) => d.value > 0)}
          />
        </div>
      </div>

      <div style={styles.sectionTitle}>Monthly trend</div>
      <div style={styles.card}>
        {monthlyTrend.map((m) => (
          <div key={m.month} style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr" : "120px 1fr 120px", gap: styles.isMobile ? 4 : 12, alignItems: "center", padding: styles.isMobile ? "10px 0" : "6px 0", borderBottom: styles.isMobile ? `1px solid ${styles.border}` : "none" }}>
            {styles.isMobile && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12 }}>
                <span style={{ color: styles.text, fontWeight: 500 }}>{formatMonth(m.month)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: PALETTE.primaryDeep }}>+{fmtAUD(m.income)}</span>
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
                <div style={{ color: PALETTE.primaryDeep }}>+{fmtAUD(m.income)}</div>
                <div>−{fmtAUD(m.expense)}</div>
              </div>
            )}
          </div>
        ))}
        {monthlyTrend.length === 0 && <div style={{ color: styles.textMuted, fontSize: 13 }}>No data in this range.</div>}
      </div>

      <div style={styles.sectionTitle}>Category breakdown</div>
      {styles.isMobile ? (
        <div>
          {breakdown.map((b) => (
            <div key={b.cat?.id || "unknown"} style={{ ...styles.txCard, cursor: b.cat ? "pointer" : "default" }} onClick={() => goToCategory(b.cat?.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={styles.pill(b.cat?.colour || "#999")}>{b.cat?.name || "Unknown"}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 15 }}>{fmtAUD(b.total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: styles.textMuted, fontVariantNumeric: "tabular-nums" }}>
                <span>{b.pct.toFixed(1)}% of total</span>
                <span>{b.count}× · avg {fmtAUD(b.avg)}</span>
              </div>
            </div>
          ))}
          {breakdown.length === 0 && <div style={{ ...styles.card, textAlign: "center", color: styles.textMuted }}>No expenses in range.</div>}
        </div>
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
                <th style={{ ...styles.th, textAlign: "right" }}>%</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Avg</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.cat?.id || "unknown"} className="byb-hover-row" style={{ cursor: b.cat ? "pointer" : "default" }} onClick={() => goToCategory(b.cat?.id)} title={b.cat ? `View ${b.cat.name} transactions` : undefined}>
                  <td style={styles.td}><span style={styles.pill(b.cat?.colour || "#999")}>{b.cat?.name || "Unknown"}</span></td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAUD(b.total)}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.pct.toFixed(1)}%</td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAUD(b.avg)}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.count}</td>
                </tr>
              ))}
              {breakdown.length === 0 && <tr><td style={{ ...styles.td, textAlign: "center", color: styles.textMuted, padding: 24 }} colSpan={5}>No expenses in range.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}
