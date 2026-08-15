import React, { useState } from "react";
import { PALETTE } from "../lib/constants.js";
import { fmtAUD } from "../lib/utils.js";
import { filterTransactions, totals } from "../lib/txQuery.js";
import { TxForm } from "../components/forms.jsx";
import { AddIncomeFlow } from "../components/AddIncomeFlow.jsx";
import { AnimatedCurrency } from "../components/AnimatedNumber.jsx";
import { QuickActionsSheet } from "../components/QuickActions.jsx";
import { askConfirm } from "../components/ConfirmDialog.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { IconWallet, IconHistory, IconList, IconZap } from "../components/Icons.jsx";

function EnvelopeRow({ cat, spent, styles, onNavigate, onLongPress }) {
  const balance = cat.envelopeBalance || 0;
  const base = cat.baseAmount || 0;
  const balColour = balance < 0 ? PALETTE.danger : balance < base * 0.2 ? PALETTE.warn : PALETTE.primaryDeep;
  const lp = useLongPress(() => onLongPress(cat));
  return (
    <div
      className="byb-hover-row"
      style={{ padding: styles.isMobile ? "10px 14px" : "12px 20px", borderBottom: `1px solid ${styles.border}`, cursor: onNavigate ? "pointer" : "default", transition: "background .15s" }}
      onClick={() => { if (!lp.longPressFired()) onNavigate && onNavigate(cat.id); }}
      onTouchStart={lp.onTouchStart}
      onTouchMove={lp.onTouchMove}
      onTouchEnd={lp.onTouchEnd}
      onTouchCancel={lp.onTouchCancel}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.colour, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, flex: 1 }}>{cat.name}</span>
        {cat.isAccumulating && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: PALETTE.secondary + "55", color: PALETTE.primaryDeep, fontWeight: 700 }}>Saving</span>}
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 14, color: balColour }}>{fmtAUD(balance)}</span>
        <span style={{ fontSize: 11, color: styles.textMuted }}>/ {fmtAUD(base)}</span>
      </div>
      {base > 0 && (
        <div style={{ height: 5, background: styles.barTrack, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
          <div className="byb-bar-fill" style={{ width: `${Math.min(100, Math.max(0, (balance / base) * 100))}%`, height: "100%", background: balColour, borderRadius: 3 }} />
        </div>
      )}
      <div style={{ fontSize: 11, color: styles.textMuted }}>
        Spent <strong style={{ color: styles.text }}>{fmtAUD(spent)}</strong> this month
      </div>
    </div>
  );
}

export function Dashboard({
  activeMonth, transactions, categories, recurring, styles, unallocatedBalance,
  onTransferEnvelope, onAddTx, onAddIncome, activeUserId,
  txFormOpen, setTxFormOpen, setEditingTx, onReconcile, onNavigateToCategory,
  onFillSingleEnvelope, incomeFlowOpen, setIncomeFlowOpen,
}) {
  const mobile = styles.isMobile;
  const expenseCats = categories.filter((c) => c.type === "expense");
  const totalBase = expenseCats.reduce((s, c) => s + (c.baseAmount || 0), 0);
  const totalBalance = expenseCats.reduce((s, c) => s + (c.envelopeBalance || 0), 0);
  const upcoming = [...recurring].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)).slice(0, 4);

  const [quickCat, setQuickCat] = useState(null);

  // The Dashboard stays on the global month — that is the whole point of the
  // month selector — but it asks the same question the Transactions list asks,
  // through the same function, so the two can never disagree about which rows
  // belong to a month.
  const spentThisMonth = (catId) =>
    totals(filterTransactions(transactions, { month: activeMonth, categoryId: catId, type: "expense" })).expense;

  const handleReconcile = async () => {
    const ok = await askConfirm({
      title: "End-of-month reconcile?",
      message: "Surplus from non-savings envelopes will be pooled, used to cover any deficits, and the remainder returned to Unallocated. Savings envelopes are not touched.",
      confirmLabel: "Reconcile",
    });
    if (ok) onReconcile();
  };

  return (
    <div>
      {/* Top action bar */}
      <div style={{ display: "flex", alignItems: mobile ? "flex-start" : "center", gap: mobile ? 10 : 12, marginBottom: mobile ? 14 : 20, flexDirection: mobile ? "column" : "row" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: styles.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Unallocated</div>
          <div style={{ fontSize: mobile ? 26 : 32, fontWeight: 800, letterSpacing: -0.5, color: unallocatedBalance < 0 ? PALETTE.danger : PALETTE.primaryDeep, lineHeight: 1.1 }}>
            <AnimatedCurrency value={unallocatedBalance} data-testid="unallocated-balance" />
          </div>
          <div style={{ fontSize: 11, color: styles.textMuted }}>
            {fmtAUD(totalBalance)} in envelopes · {fmtAUD(totalBase)}/mo base
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: mobile ? "100%" : "auto" }}>
          <button style={{ ...styles.button, flex: mobile ? 1 : "none", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={() => { setTxFormOpen(false); setEditingTx(null); setIncomeFlowOpen((o) => !o); }} data-testid="add-income-btn">
            <IconWallet size={15} /> Add Income
          </button>
          <button style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none", fontSize: 13 }} onClick={() => { setIncomeFlowOpen(false); setEditingTx(null); setTxFormOpen(true); }}>+ Add Transaction</button>
          {onReconcile && (
            <button style={{ ...styles.buttonGhost, flex: mobile ? 1 : "none", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={handleReconcile} data-testid="reconcile-btn">
              <IconHistory size={14} /> Reconcile
            </button>
          )}
        </div>
      </div>

      {/* Unified Add Income flow */}
      {incomeFlowOpen && (
        <AddIncomeFlow
          categories={categories}
          recurring={recurring}
          unallocatedBalance={unallocatedBalance}
          onSubmit={(payload) => { onAddIncome(payload); setIncomeFlowOpen(false); }}
          onCancel={() => setIncomeFlowOpen(false)}
          styles={styles}
        />
      )}

      {/* Transaction form inline */}
      {txFormOpen && (
        <TxForm tx={null} categories={categories} activeUserId={activeUserId} onSave={(tx) => { onAddTx(tx); setTxFormOpen(false); }} onTransfer={(data) => { onTransferEnvelope(data.fromId, data.toId, data.amount, data.description); setTxFormOpen(false); }} onCancel={() => setTxFormOpen(false)} styles={styles} />
      )}

      {/* Envelopes list */}
      <div style={styles.sectionTitle}>Envelopes</div>
      <div style={{ ...styles.card, padding: 0, marginBottom: mobile ? 16 : 24 }}>
        {expenseCats.map((c) => (
          <EnvelopeRow
            key={c.id}
            cat={c}
            spent={spentThisMonth(c.id)}
            styles={styles}
            onNavigate={onNavigateToCategory}
            onLongPress={setQuickCat}
          />
        ))}
        {expenseCats.length === 0 && (
          <div style={{ padding: "20px", color: styles.textMuted, fontSize: 13 }}>No envelopes yet. Head to the Envelopes tab to create one.</div>
        )}
      </div>

      {/* Upcoming bills */}
      <div style={styles.sectionTitle}>Upcoming bills</div>
      <div style={styles.card}>
        {upcoming.length === 0 && <div style={{ color: styles.textMuted, fontSize: 13 }}>Nothing scheduled.</div>}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(2, 1fr)", gap: mobile ? 8 : 12 }}>
          {upcoming.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: styles.surface, borderRadius: 8, border: `1px solid ${styles.border}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: styles.textMuted, marginTop: 2 }}>{r.nextDueDate} · {r.frequency}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: r.type === "income" ? PALETTE.primaryDeep : styles.text, fontVariantNumeric: "tabular-nums" }}>
                {r.type === "income" ? "+" : "−"}{fmtAUD(r.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Long-press quick actions for an envelope */}
      {quickCat && (
        <QuickActionsSheet
          title={quickCat.name}
          styles={styles}
          onClose={() => setQuickCat(null)}
          actions={[
            ...((quickCat.baseAmount || 0) > 0 && onFillSingleEnvelope ? [{
              label: "Fill to target",
              sub: `Top up to ${fmtAUD(quickCat.baseAmount || 0)} from Unallocated`,
              icon: IconZap,
              onSelect: () => onFillSingleEnvelope(quickCat.id),
            }] : []),
            {
              label: "View transactions",
              sub: "See everything spent from this envelope",
              icon: IconList,
              onSelect: () => onNavigateToCategory && onNavigateToCategory(quickCat.id),
            },
            {
              label: "Add income here",
              sub: "Log money in, straight to this envelope",
              icon: IconWallet,
              onSelect: () => setIncomeFlowOpen(true),
            },
          ]}
        />
      )}
    </div>
  );
}
