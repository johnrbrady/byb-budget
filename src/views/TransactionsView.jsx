import React, { useState, useEffect, useRef } from "react";
import { PALETTE } from "../lib/constants.js";
import { fmtAUD, formatMonth, monthKey } from "../lib/utils.js";
import { filterTransactions, totals, groupByMonth, normaliseRange } from "../lib/txQuery.js";
import { TxForm } from "../components/forms.jsx";
import { TxSheet } from "../components/TxSheet.jsx";
import { AddIncomeFlow } from "../components/AddIncomeFlow.jsx";
import { IncomeSheet } from "../components/IncomeSheet.jsx";
import { QuickActionsSheet } from "../components/QuickActions.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { askConfirm } from "../components/ConfirmDialog.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { IconArrowLeft, IconWallet, IconList, IconPlus, IconTransfer } from "../components/Icons.jsx";

// How many months of history are rendered at a time. A household with years of
// data has hundreds of rows behind an envelope, and phones are the primary
// interface, so the list is built a few months at a time rather than all at
// once. Three fills a phone screen without leaving the "show earlier" control
// below the fold on first paint.
const MONTHS_PER_PAGE = 3;

export function TransactionsView({
  transactions, categories, users, categoriesById, usersById, activeMonth, activeUserId,
  txFilters, setTxFilters, editingTx, setEditingTx, txFormOpen, setTxFormOpen,
  saveTx, deleteTx, onTransferEnvelope, onAddIncome,
  incomeFlowOpen, setIncomeFlowOpen, unallocatedBalance, recurring, reconcileLog, styles,
}) {
  const mobile = styles.isMobile;
  const [showFilters, setShowFilters] = useState(false);
  const [fabMenu, setFabMenu] = useState(false);

  const inEnvelopeView = txFilters.categoryId !== "all";
  const contextCatId = inEnvelopeView ? txFilters.categoryId : null;

  // What the list is scoped to. The global month selector still governs the
  // default, exactly as it always has and as every other view still does — but
  // picking a single envelope, or setting an explicit date range, is a request
  // for history and takes the list out of the month gate. Nothing here writes
  // back to `activeMonth`, so the rest of the app does not move.
  const range = normaliseRange(txFilters);
  const hasRange = !!(range.start || range.end);
  const grouped = hasRange || inEnvelopeView;
  const query = {
    month: grouped ? null : activeMonth,
    start: txFilters.start,
    end: txFilters.end,
    type: txFilters.type,
    categoryId: txFilters.categoryId,
    addedBy: txFilters.addedBy,
    search: txFilters.search,
  };

  const filteredTx = filterTransactions(transactions, query);
  const { income: filteredIncome, expense: filteredExpense } = totals(filteredTx);
  const monthGroups = groupByMonth(filteredTx);

  // ── Reconcile adjustments ──────────────────────────────────────────────────
  //
  // A reconcile is not a transaction. Nothing was bought, nobody was paid, and
  // it belongs to no category — it is the month-end sweep moving an envelope's
  // balance. So it is never merged into the transaction list and never reaches
  // totals(): the month subtotals are computed from `filteredTx` alone and
  // cannot be distorted by an adjustment, by construction rather than by care.
  // It is rendered as its own kind of row instead, muted and italic, carrying no
  // Edit or Delete, under the month it happened in.
  //
  // Transaction-shaped filters — type, who added it, a description search — have
  // nothing on an adjustment to match. Rather than pretend one way or the other,
  // adjustments step aside whenever the user is narrowing the list by them.
  const showAdjustments = inEnvelopeView && txFilters.type === "all" && txFilters.addedBy === "all" && !txFilters.search;
  const adjustments = !showAdjustments ? [] : (reconcileLog || []).flatMap((entry) => {
    const move = (entry.movements || []).find((m) => m.catId === contextCatId);
    if (!move) return [];
    // Same date scope as the list itself. Entries recorded before movements
    // existed have none, so they simply do not appear — there is nothing to say.
    if (range.start && entry.date < range.start) return [];
    if (range.end && entry.date > range.end) return [];
    return [{ id: entry.id, date: entry.date, before: move.before, amount: move.amount, after: move.after }];
  });

  const adjustmentsByMonth = new Map();
  for (const a of adjustments) {
    const m = monthKey(a.date);
    if (!adjustmentsByMonth.has(m)) adjustmentsByMonth.set(m, []);
    adjustmentsByMonth.get(m).push(a);
  }

  // A month can hold an adjustment and no transactions at all — an envelope
  // swept to zero in a month it was never spent from is exactly the case the
  // stakeholder is trying to explain. That month still gets a heading, with the
  // $0.00 subtotals it honestly earned.
  const displayGroups = [
    ...monthGroups,
    ...Array.from(adjustmentsByMonth.keys())
      .filter((m) => !monthGroups.some((g) => g.month === m))
      .map((month) => ({ month, transactions: [], income: 0, expense: 0, net: 0 })),
  ]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((g) => ({ ...g, adjustments: (adjustmentsByMonth.get(g.month) || []).slice().sort((a, b) => b.date.localeCompare(a.date)) }));

  // Progressive loading. Only the newest `monthsShown` months are built; the
  // rest are not in the tree at all until asked for. Changing the query starts
  // again from the top, otherwise a narrowed filter would keep an unrelated
  // page depth.
  const [monthsShown, setMonthsShown] = useState(MONTHS_PER_PAGE);
  const queryKey = [activeMonth, grouped, txFilters.categoryId, txFilters.type, txFilters.addedBy, txFilters.search, range.start, range.end].join("|");
  useEffect(() => { setMonthsShown(MONTHS_PER_PAGE); }, [queryKey]);

  const visibleGroups = grouped ? displayGroups.slice(0, monthsShown) : displayGroups;
  const hiddenMonths = displayGroups.length - visibleGroups.length;
  const showMore = () => setMonthsShown((n) => n + MONTHS_PER_PAGE);

  // Scrolling the "show earlier months" control into view loads the next page,
  // so on a phone the history just keeps coming. The control is a real button as
  // well, which is what a keyboard, a screen reader, or a browser without
  // IntersectionObserver gets. The observer is rebuilt whenever the number of
  // remaining months changes: an element already inside the viewport fires no
  // fresh intersection, so a page load would otherwise be the last one.
  const loadMoreRef = useRef(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) showMore(); },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hiddenMonths, queryKey]);

  const scopeLabel = hasRange
    ? `${range.start || "the beginning"} → ${range.end || "today"}`
    : grouped ? "All months" : formatMonth(activeMonth);

  const openAddForm = () => { setIncomeFlowOpen(false); setEditingTx(null); setTxFormOpen(true); };
  const openEdit = (t) => { setIncomeFlowOpen(false); setEditingTx(t); setTxFormOpen(false); };
  const closeEditor = () => { setTxFormOpen(false); setEditingTx(null); };
  const editorOpen = txFormOpen || !!editingTx;
  const clearFilters = () => setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "", start: "", end: "" });

  const confirmDelete = async (id) => {
    const ok = await askConfirm({ title: "Delete this transaction?", message: "Envelope balances will be adjusted to reverse its effect.", confirmLabel: "Delete", danger: true });
    if (ok) deleteTx(id);
    return ok;
  };

  // Delete from inside the editor. The sheet stays open if the user backs out of
  // the dialog, and closes when the transaction it was editing no longer exists.
  const deleteFromEditor = async () => {
    if (!editingTx) return;
    if (await confirmDelete(editingTx.id)) closeEditor();
  };

  // One set of props, two presentations: an inline panel on desktop, the body of
  // a bottom sheet on a phone. The component is the same either way — TxForm is
  // where the income-allocation rules live and it is not to be duplicated.
  const txFormProps = {
    tx: editingTx,
    categories,
    transactionHistory: transactions,
    activeUserId,
    onSave: saveTx,
    onTransfer: (data) => { onTransferEnvelope(data.fromId, data.toId, data.amount, data.description); closeEditor(); },
    onCancel: closeEditor,
    defaultCategoryId: !editingTx ? contextCatId : null,
    styles,
  };

  // One set of props, two presentations, exactly as txFormProps above: an inline
  // panel on desktop, the body of a bottom sheet on a phone. AddIncomeFlow is
  // where multi-envelope splits are composed and is not to be duplicated.
  const incomeFlowProps = {
    categories,
    recurring,
    unallocatedBalance,
    onSubmit: (payload) => { onAddIncome(payload); setIncomeFlowOpen(false); },
    onCancel: () => setIncomeFlowOpen(false),
    styles,
  };

  // FAB long-press → choose income or expense
  const fabLp = useLongPress(() => setFabMenu(true));

  // Auto-close the inline form when clicking outside it. Desktop only: on a
  // phone the editor is a sheet and its own ground is what dismisses it, so this
  // listener would be a second, invisible dismisser fighting the first.
  const formRef = useRef(null);
  useEffect(() => {
    if (mobile || !editorOpen) return;
    const handler = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setTxFormOpen(false);
        setEditingTx(null);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [mobile, editorOpen]);

  const dateRangeFields = (
    <>
      <div style={{ minWidth: 0 }}>
        <div style={styles.label}>From</div>
        <input style={{ ...styles.input, minWidth: 0 }} type="date" value={txFilters.start || ""} data-testid="tx-range-start"
          onChange={(e) => setTxFilters({ ...txFilters, start: e.target.value })} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={styles.label}>To</div>
        <input style={{ ...styles.input, minWidth: 0 }} type="date" value={txFilters.end || ""} data-testid="tx-range-end"
          onChange={(e) => setTxFilters({ ...txFilters, end: e.target.value })} />
      </div>
    </>
  );

  const filterBar = (
    <div className="byb-panel" style={{ display: mobile ? "grid" : "flex", gridTemplateColumns: mobile ? "1fr 1fr" : undefined, gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      {!inEnvelopeView && (
        <select style={styles.input} value={txFilters.type} data-testid="tx-filter-type" onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}>
          <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
        </select>
      )}
      <select style={styles.input} value={txFilters.categoryId} data-testid="tx-filter-category" onChange={(e) => setTxFilters({ ...txFilters, categoryId: e.target.value })}>
        <option value="all">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select style={styles.input} value={txFilters.addedBy} data-testid="tx-filter-user" onChange={(e) => setTxFilters({ ...txFilters, addedBy: e.target.value })}>
        <option value="all">All users</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      {dateRangeFields}
      <input style={{ ...styles.input, gridColumn: mobile ? "span 2" : undefined }} placeholder="Search description" value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} data-testid="tx-search" />
      <button style={{ ...styles.buttonGhost, gridColumn: mobile ? "span 2" : undefined }} onClick={clearFilters} data-testid="tx-clear-filters">Clear filters</button>
    </div>
  );

  // One line saying what is on screen. Without it the same list of rows could be
  // one month or five years of one envelope, and the stakeholder's question is
  // precisely "which month am I looking at".
  const scopeLine = (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: styles.textMuted, padding: "4px 2px 10px" }}>
      <span>
        <strong style={{ color: styles.text, fontWeight: 600 }} data-testid="tx-scope">{scopeLabel}</strong>
        {" · "}
        {filteredTx.length} transaction{filteredTx.length === 1 ? "" : "s"}
      </span>
      <span>
        <span style={{ color: "var(--byb-ok)", fontWeight: 600 }} data-testid="filter-income">+{fmtAUD(filteredIncome)}</span>
        {" · "}
        <span style={{ fontWeight: 600 }} data-testid="filter-expense">−{fmtAUD(filteredExpense)}</span>
      </span>
    </div>
  );

  const filteredSpendCard = hasRange ? (
    <div
      style={{ ...styles.card, padding: mobile ? "14px 16px" : "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderLeft: `4px solid ${PALETTE.primary}` }}
      data-testid="filtered-spend-total"
    >
      <div>
        <div style={styles.kpiLabel}>Total spent in filtered period</div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginTop: 3 }}>{scopeLabel}</div>
      </div>
      <div style={{ fontSize: mobile ? 24 : 28, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {fmtAUD(filteredExpense)}
      </div>
    </div>
  ) : null;

  const loadMoreLabel = `Show earlier months (${hiddenMonths} more)`;
  const noRows = filteredTx.length === 0 && adjustments.length === 0;

  // A reconcile adjustment, told as what it is: the date it ran, which way the
  // money went, and the balance either side of it. Muted, italic and without the
  // Edit/Delete a transaction carries, so it cannot be mistaken for one — and
  // deliberately outside the month subtotal above it, which counts transactions.
  const adjustmentLabel = (a) => (a.amount < 0 ? "Reconcile · surplus pooled" : "Reconcile · topped up");
  const adjustmentAmount = (a) => `${a.amount < 0 ? "−" : "+"}${fmtAUD(Math.abs(a.amount))}`;
  const adjustmentBalances = (a) => `${fmtAUD(a.before)} → ${fmtAUD(a.after)}`;

  const adjustmentCard = (a) => (
    <div key={`adj-${a.id}`} data-testid={`reconcile-adj-${a.id}`}
      style={{ ...styles.txCard, gap: 4, fontStyle: "italic", color: styles.textMuted, borderLeft: `3px solid ${PALETTE.accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <IconTransfer size={13} /> {adjustmentLabel(a)}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 14 }}>{adjustmentAmount(a)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>{a.date}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{adjustmentBalances(a)}</span>
      </div>
    </div>
  );

  const adjustmentRow = (a) => (
    <tr key={`adj-${a.id}`} data-testid={`reconcile-adj-${a.id}`} style={{ background: styles.surface, fontStyle: "italic", color: styles.textMuted }}>
      <td style={{ ...styles.td, borderLeft: `4px solid ${PALETTE.accent}` }}>{a.date}</td>
      <td style={styles.td} colSpan={3}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <IconTransfer size={13} /> {adjustmentLabel(a)} · {adjustmentBalances(a)}
        </span>
      </td>
      <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{adjustmentAmount(a)}</td>
      <td style={styles.td}></td>
    </tr>
  );

  return (
    <div>
      {/* Envelope context header.
          This button is the way out of an envelope, so it is a real control and
          not a hint: full tap height, the accent border the view's other
          affirmative buttons wear, and first on the row. It replaced a muted
          ghost button sitting next to the words "Swipe left to go back" — an
          instruction for a gesture that no longer does this (DEC-010). */}
      {inEnvelopeView && mobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button
            style={{ ...styles.button, background: "var(--byb-primary-tint)", color: PALETTE.primaryDeep, border: `1px solid ${PALETTE.primary}`, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, flexShrink: 0 }}
            onClick={() => setTxFilters((f) => ({ ...f, categoryId: "all" }))}
            data-testid="tx-exit-envelope"
            aria-label="Back to all categories"
          >
            <IconArrowLeft size={16} /> All
          </button>
          <span style={{ ...styles.pill(categoriesById[txFilters.categoryId]?.colour || "#999"), fontSize: "var(--byb-text-lg)", padding: "6px 12px", minWidth: 0 }}>
            {categoriesById[txFilters.categoryId]?.name || "Envelope"}
          </span>
        </div>
      )}
      {mobile ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <button style={{ ...styles.button, flex: 1, fontSize: 16, fontWeight: 700 }} onClick={openAddForm} data-testid="add-tx-mobile">+ Add</button>
            <button style={{ ...styles.button, flex: 1, fontSize: 14, fontWeight: 600, background: "var(--byb-primary-tint)", color: PALETTE.primaryDeep, border: `1px solid ${PALETTE.primary}` }}
              onClick={() => { setTxFormOpen(false); setEditingTx(null); setIncomeFlowOpen((o) => !o); }}>
              {incomeFlowOpen ? "✕ Cancel" : "+ Income"}
            </button>
            <button style={{ ...styles.buttonGhost, flex: 1 }} onClick={() => setShowFilters((s) => !s)}>{showFilters ? "Hide" : "Filter"}</button>
          </div>
          {showFilters && filterBar}
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {!inEnvelopeView && (
            <select style={{ ...styles.input, minWidth: 130, width: "auto" }} value={txFilters.type} data-testid="tx-filter-type" onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}>
              <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
            </select>
          )}
          <select style={{ ...styles.input, minWidth: 180, width: "auto" }} value={txFilters.categoryId} data-testid="tx-filter-category" onChange={(e) => setTxFilters({ ...txFilters, categoryId: e.target.value })}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={{ ...styles.input, minWidth: 130, width: "auto" }} value={txFilters.addedBy} data-testid="tx-filter-user" onChange={(e) => setTxFilters({ ...txFilters, addedBy: e.target.value })}>
            <option value="all">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {dateRangeFields}
          <input style={{ ...styles.input, minWidth: 160, flex: 1 }} placeholder="Search description" value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} data-testid="tx-search" />
          <button style={styles.buttonGhost} onClick={clearFilters} data-testid="tx-clear-filters">Clear</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={{ ...styles.buttonGhost, borderColor: PALETTE.primary, color: PALETTE.primaryDeep, display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => { setTxFormOpen(false); setEditingTx(null); setIncomeFlowOpen((o) => !o); }} data-testid="add-income-btn-tx">
              <IconWallet size={14} /> {incomeFlowOpen ? "✕ Cancel" : "Add Income"}
            </button>
            <button style={styles.button} onClick={openAddForm} data-testid="add-tx">Add transaction</button>
          </div>
        </div>
      )}

      {filteredSpendCard}

      {/* Desktop keeps the inline panel, the same decision DEC-011 made for the
          transaction editor. The phone's copy is a sheet, rendered after the
          list — see below. */}
      {!mobile && incomeFlowOpen && (
        <AddIncomeFlow {...incomeFlowProps} />
      )}

      {/* Desktop keeps the inline panel: the table is compact, the editor lands
          in view, and the row's Edit button is right beside it. The phone's copy
          is a sheet, rendered after the list — see below. */}
      {!mobile && editorOpen && (
        <div ref={formRef}>
          <TxForm {...txFormProps} />
        </div>
      )}

      {scopeLine}

      {mobile ? (
        <>
          <div data-testid="tx-table">
            {/* Each month is its own group element so its heading is pushed out
                by the next one instead of every heading piling up at the same
                sticky offset. */}
            {visibleGroups.map((g) => (
              <div className="byb-month-group" key={g.month}>
                {grouped && (
                  <div
                    className="byb-month-heading"
                    data-testid={`tx-month-heading-${g.month}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "10px 12px", marginBottom: 8, borderRadius: "var(--byb-radius)", background: styles.surfaceAlt, border: `1px solid ${styles.border}`, borderLeft: `4px solid ${PALETTE.primary}`, boxShadow: "var(--byb-elev-1)" }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "var(--byb-text-lg)" }}>{formatMonth(g.month)}</span>
                    <span style={{ fontSize: "var(--byb-text-md)", fontVariantNumeric: "tabular-nums", color: styles.textMuted }}>
                      {g.income > 0 && <span style={{ color: "var(--byb-ok)", fontWeight: 600 }}>+{fmtAUD(g.income)} · </span>}
                      <span style={{ fontWeight: 700, color: styles.text }} data-testid={`tx-month-total-${g.month}`}>−{fmtAUD(g.expense)}</span>
                    </span>
                  </div>
                )}
                {g.adjustments.map(adjustmentCard)}
                {g.transactions.map((t) => {
                  const cat = categoriesById[t.categoryId];
                  const u = usersById[t.addedBy];
                  return (
                    <div key={t.id} style={{ ...styles.txCard, background: t.imported ? "var(--byb-primary-tint)" : styles.txCard.background, borderLeft: t.imported ? `3px solid ${PALETTE.primary}` : undefined }} data-testid={`tx-row-${t.id}`} onClick={() => openEdit(t)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, color: t.type === "income" ? "var(--byb-ok)" : styles.text }}>
                          {t.type === "income" ? "+" : "−"}{fmtAUD(t.amount)}
                        </span>
                      </div>
                      {t.description && <div style={{ fontSize: 14, color: styles.text }}>{t.description}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: styles.textMuted }}>
                        <span>{t.date}{t.isRecurring && " · recurring"}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ ...styles.avatarCircle(u || { colour: "#999", name: "?" }), width: 20, height: 20, fontSize: 10 }}>{u?.name[0] || "?"}</span>
                          <button style={{ ...styles.buttonDanger, padding: "4px 10px", fontSize: 12, minHeight: "auto" }} onClick={(e) => { e.stopPropagation(); confirmDelete(t.id); }} data-testid={`tx-delete-${t.id}`}>Del</button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {noRows && (
              <div style={{ ...styles.card, padding: 0 }}>
                <EmptyState
                  icon={IconList}
                  title="No transactions match the current filter."
                  hint="Try clearing the filters, widening the date range, or adding the first transaction."
                  action={{ label: "Clear filters", onSelect: clearFilters }}
                  styles={styles}
                />
              </div>
            )}
            {hiddenMonths > 0 && (
              <button ref={loadMoreRef} style={{ ...styles.buttonGhost, width: "100%", marginTop: 4 }} onClick={showMore} data-testid="tx-load-more">
                {loadMoreLabel}
              </button>
            )}
          </div>
          {!txFormOpen && !editingTx && !incomeFlowOpen && (
            <button
              style={styles.fab}
              onClick={() => { if (!fabLp.longPressFired()) openAddForm(); }}
              onTouchStart={fabLp.onTouchStart}
              onTouchMove={fabLp.onTouchMove}
              onTouchEnd={fabLp.onTouchEnd}
              onTouchCancel={fabLp.onTouchCancel}
              data-testid="add-tx"
              aria-label="Add transaction (hold for options)"
            >+</button>
          )}
          {fabMenu && (
            <QuickActionsSheet
              title="Add…"
              styles={styles}
              onClose={() => setFabMenu(false)}
              actions={[
                { label: "Add expense", sub: "Log money spent from an envelope", icon: IconList, onSelect: openAddForm },
                { label: "Add income", sub: "Log money in and choose where it goes", icon: IconWallet, onSelect: () => { setTxFormOpen(false); setEditingTx(null); setIncomeFlowOpen(true); } },
                { label: "Transfer between envelopes", sub: "Move money without changing totals", icon: IconPlus, onSelect: openAddForm },
              ]}
            />
          )}
          {/* Last in the list's own subtree, so nothing above the rows moves when
              it opens and the sheet cannot push the list down under the finger. */}
          {editorOpen && (
            <TxSheet {...txFormProps} onClose={closeEditor} onDelete={deleteFromEditor} />
          )}
          {incomeFlowOpen && (
            <IncomeSheet {...incomeFlowProps} onClose={() => setIncomeFlowOpen(false)} />
          )}
        </>
      ) : (
        <div style={styles.card}>
          <table style={styles.table} data-testid="tx-table">
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>By</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            {/* One tbody per month, for the same reason the card list wraps each
                group in its own element: a sticky heading has to be pushed out
                by the next group rather than pile up on the one before it. */}
            {visibleGroups.map((g) => (
                <tbody key={g.month}>
                  {grouped && (
                    <tr data-testid={`tx-month-heading-${g.month}`}>
                      <td className="byb-month-heading-cell" style={{ ...styles.td, borderBottom: "none", fontWeight: 700, borderLeft: `4px solid ${PALETTE.primary}` }} colSpan={4}>{formatMonth(g.month)}</td>
                      <td className="byb-month-heading-cell" style={{ ...styles.td, borderBottom: "none", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                        {g.income > 0 && <span style={{ color: "var(--byb-ok)", display: "block", fontWeight: 600 }}>+{fmtAUD(g.income)}</span>}
                        <span data-testid={`tx-month-total-${g.month}`}>−{fmtAUD(g.expense)}</span>
                      </td>
                      <td className="byb-month-heading-cell" style={{ ...styles.td, borderBottom: "none" }}></td>
                    </tr>
                  )}
                  {g.adjustments.map(adjustmentRow)}
                  {g.transactions.map((t) => {
                    const cat = categoriesById[t.categoryId];
                    const u = usersById[t.addedBy];
                    return (
                      <tr key={t.id} className="byb-hover-row" data-testid={`tx-row-${t.id}`} style={{ background: t.imported ? "var(--byb-primary-tint)" : "transparent" }}>
                        <td style={styles.td}>{t.date}</td>
                        <td style={styles.td}><span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span></td>
                        <td style={styles.td}>
                          {t.description}
                          {t.isRecurring && <span style={{ marginLeft: 6, fontSize: 11, color: styles.textMuted }}>· recurring</span>}
                          {t.imported && <span style={{ marginLeft: 6, fontSize: 11, color: PALETTE.primaryDeep, fontWeight: 600 }}>· imported</span>}
                        </td>
                        <td style={styles.td}><span style={{ ...styles.avatarCircle(u || { colour: "#999", name: "?" }), width: 22, height: 22, fontSize: 10 }}>{u?.name[0] || "?"}</span></td>
                        <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: t.type === "income" ? "var(--byb-ok)" : styles.text }}>
                          {t.type === "income" ? "+" : "−"}{fmtAUD(t.amount)}
                        </td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <button style={styles.buttonGhost} onClick={() => openEdit(t)}>Edit</button>
                          <button style={{ ...styles.buttonDanger, marginLeft: 6 }} onClick={() => confirmDelete(t.id)} data-testid={`tx-delete-${t.id}`}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            <tbody>
              {noRows && (
                <tr><td style={{ ...styles.td, padding: 0 }} colSpan={6}>
                  <EmptyState
                    icon={IconList}
                    title="No transactions match the current filter."
                    hint="Try clearing the filters, widening the date range, or adding the first transaction."
                    action={{ label: "Clear filters", onSelect: clearFilters }}
                    styles={styles}
                  />
                </td></tr>
              )}
              {hiddenMonths > 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: "center", padding: 14 }} colSpan={6}>
                    <button ref={loadMoreRef} style={styles.buttonGhost} onClick={showMore} data-testid="tx-load-more">{loadMoreLabel}</button>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...styles.td, fontWeight: 600 }} colSpan={4}>{hasRange ? "Range total" : "Totals"}</td>
                <td style={{ ...styles.td, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: "var(--byb-ok)" }}>+{fmtAUD(filteredIncome)}</span>
                  <br />
                  <span>−{fmtAUD(filteredExpense)}</span>
                </td>
                <td style={styles.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
