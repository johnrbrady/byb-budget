import React, { useState, useEffect, useRef } from "react";
import { PALETTE } from "../lib/constants.js";
import { fmtAUD, monthKey } from "../lib/utils.js";
import { TxForm } from "../components/forms.jsx";
import { AddIncomeFlow } from "../components/AddIncomeFlow.jsx";
import { QuickActionsSheet } from "../components/QuickActions.jsx";
import { askConfirm } from "../components/ConfirmDialog.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { IconArrowLeft, IconWallet, IconList, IconPlus } from "../components/Icons.jsx";

export function TransactionsView({
  transactions, categories, users, categoriesById, usersById, activeMonth, activeUserId,
  txFilters, setTxFilters, editingTx, setEditingTx, txFormOpen, setTxFormOpen,
  saveTx, deleteTx, onTransferEnvelope, onAddIncome,
  incomeFlowOpen, setIncomeFlowOpen, unallocatedBalance, recurring, styles,
}) {
  const filteredTx = transactions.filter((t) => {
    if (monthKey(t.date) !== activeMonth) return false;
    if (txFilters.type !== "all" && t.type !== txFilters.type) return false;
    if (txFilters.categoryId !== "all" && t.categoryId !== txFilters.categoryId) return false;
    if (txFilters.addedBy !== "all" && t.addedBy !== txFilters.addedBy) return false;
    if (txFilters.search && !(t.description || "").toLowerCase().includes(txFilters.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const filteredIncome = filteredTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const filteredExpense = filteredTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const mobile = styles.isMobile;
  const [showFilters, setShowFilters] = useState(false);
  const [fabMenu, setFabMenu] = useState(false);

  const inEnvelopeView = txFilters.categoryId !== "all";
  const contextCatId = inEnvelopeView ? txFilters.categoryId : null;

  const openAddForm = () => { setIncomeFlowOpen(false); setEditingTx(null); setTxFormOpen(true); };
  const openEdit = (t) => { setIncomeFlowOpen(false); setEditingTx(t); setTxFormOpen(false); };

  const confirmDelete = async (id) => {
    const ok = await askConfirm({ title: "Delete this transaction?", message: "Envelope balances will be adjusted to reverse its effect.", confirmLabel: "Delete", danger: true });
    if (ok) deleteTx(id);
  };

  // FAB long-press → choose income or expense
  const fabLp = useLongPress(() => setFabMenu(true));

  // Auto-close form when clicking outside it
  const formRef = useRef(null);
  useEffect(() => {
    if (!txFormOpen && !editingTx) return;
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
  }, [txFormOpen, editingTx]);

  // Swipe-left to exit envelope view (when in individual envelope context)
  const swipeRef = useRef({ startX: 0, startY: 0 });
  const handleSwipeTouchStart = (e) => { swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }; };
  const handleSwipeTouchEnd = (e) => {
    if (!inEnvelopeView) return;
    const dx = swipeRef.current.startX - e.changedTouches[0].clientX;
    const dy = Math.abs(swipeRef.current.startY - e.changedTouches[0].clientY);
    if (dx > 60 && dy < 40) {
      setTxFilters((f) => ({ ...f, categoryId: "all" }));
    }
  };

  const filterBar = (
    <div className="byb-panel" style={{ display: mobile ? "grid" : "flex", gridTemplateColumns: mobile ? "1fr 1fr" : undefined, gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      {!inEnvelopeView && (
        <select style={styles.input} value={txFilters.type} onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}>
          <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
        </select>
      )}
      <select style={styles.input} value={txFilters.categoryId} onChange={(e) => setTxFilters({ ...txFilters, categoryId: e.target.value })}>
        <option value="all">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select style={styles.input} value={txFilters.addedBy} onChange={(e) => setTxFilters({ ...txFilters, addedBy: e.target.value })}>
        <option value="all">All users</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <input style={{ ...styles.input, gridColumn: mobile ? "span 2" : undefined }} placeholder="Search description" value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} data-testid="tx-search" />
      <button style={{ ...styles.buttonGhost, gridColumn: mobile ? "span 2" : undefined }} onClick={() => setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "" })}>Clear filters</button>
    </div>
  );

  return (
    <div onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>
      {/* Envelope context header with back hint */}
      {inEnvelopeView && mobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: styles.textMuted }}>
          <button style={{ ...styles.buttonGhost, padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => setTxFilters((f) => ({ ...f, categoryId: "all" }))}><IconArrowLeft size={14} /> All</button>
          <span style={styles.pill(categoriesById[txFilters.categoryId]?.colour || "#999")}>{categoriesById[txFilters.categoryId]?.name || "Envelope"}</span>
          <span style={{ fontSize: 12 }}>Swipe left to go back</span>
        </div>
      )}
      {mobile ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <button style={{ ...styles.button, flex: 1, fontSize: 16, fontWeight: 700 }} onClick={openAddForm} data-testid="add-tx-mobile">+ Add</button>
            <button style={{ ...styles.button, flex: 1, fontSize: 14, fontWeight: 600, background: styles.dark ? "#2A3A2A" : "#EDF3E8", color: PALETTE.primaryDeep, border: `1px solid ${PALETTE.primary}` }}
              onClick={() => { setTxFormOpen(false); setEditingTx(null); setIncomeFlowOpen((o) => !o); }}>
              {incomeFlowOpen ? "✕ Cancel" : "+ Income"}
            </button>
            <button style={{ ...styles.buttonGhost, flex: 1 }} onClick={() => setShowFilters((s) => !s)}>{showFilters ? "Hide" : "Filter"}</button>
          </div>
          {showFilters && filterBar}
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {!inEnvelopeView && (
            <select style={{ ...styles.input, minWidth: 130, width: "auto" }} value={txFilters.type} onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}>
              <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
            </select>
          )}
          <select style={{ ...styles.input, minWidth: 180, width: "auto" }} value={txFilters.categoryId} onChange={(e) => setTxFilters({ ...txFilters, categoryId: e.target.value })}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={{ ...styles.input, minWidth: 130, width: "auto" }} value={txFilters.addedBy} onChange={(e) => setTxFilters({ ...txFilters, addedBy: e.target.value })}>
            <option value="all">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input style={{ ...styles.input, minWidth: 160, flex: 1 }} placeholder="Search description" value={txFilters.search} onChange={(e) => setTxFilters({ ...txFilters, search: e.target.value })} data-testid="tx-search" />
          <button style={styles.buttonGhost} onClick={() => setTxFilters({ type: "all", categoryId: "all", addedBy: "all", search: "" })}>Clear</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={{ ...styles.buttonGhost, borderColor: PALETTE.primary, color: PALETTE.primaryDeep, display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => { setTxFormOpen(false); setEditingTx(null); setIncomeFlowOpen((o) => !o); }} data-testid="add-income-btn-tx">
              <IconWallet size={14} /> {incomeFlowOpen ? "✕ Cancel" : "Add Income"}
            </button>
            <button style={styles.button} onClick={openAddForm} data-testid="add-tx">Add transaction</button>
          </div>
        </div>
      )}

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

      {(txFormOpen || editingTx) && (
        <div ref={formRef}>
          <TxForm
            tx={editingTx}
            categories={categories}
            activeUserId={activeUserId}
            onSave={saveTx}
            onTransfer={(data) => { onTransferEnvelope(data.fromId, data.toId, data.amount, data.description); setTxFormOpen(false); setEditingTx(null); }}
            onCancel={() => { setTxFormOpen(false); setEditingTx(null); }}
            defaultCategoryId={!editingTx ? contextCatId : null}
            styles={styles}
          />
        </div>
      )}

      {mobile ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: styles.textMuted, padding: "4px 2px 10px" }}>
            <span>{filteredTx.length} transaction{filteredTx.length === 1 ? "" : "s"}</span>
            <span>
              <span style={{ color: PALETTE.primaryDeep, fontWeight: 600 }} data-testid="filter-income">+{fmtAUD(filteredIncome)}</span>
              {" · "}
              <span style={{ fontWeight: 600 }} data-testid="filter-expense">−{fmtAUD(filteredExpense)}</span>
            </span>
          </div>
          <div data-testid="tx-table">
            {filteredTx.map((t) => {
              const cat = categoriesById[t.categoryId];
              const u = usersById[t.addedBy];
              return (
                <div key={t.id} style={{ ...styles.txCard, background: t.imported ? (styles.dark ? "#122012" : "#ECF4E8") : styles.txCard.background, borderLeft: t.imported ? `3px solid ${PALETTE.primary}` : undefined }} data-testid={`tx-row-${t.id}`} onClick={() => openEdit(t)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, color: t.type === "income" ? PALETTE.primaryDeep : styles.text }}>
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
            {filteredTx.length === 0 && (
              <div style={{ ...styles.card, textAlign: "center", color: styles.textMuted }}>No transactions match the current filter.</div>
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
            <tbody>
              {filteredTx.map((t) => {
                const cat = categoriesById[t.categoryId];
                const u = usersById[t.addedBy];
                return (
                  <tr key={t.id} className="byb-hover-row" data-testid={`tx-row-${t.id}`} style={{ background: t.imported ? (styles.dark ? "#122012" : "#ECF4E8") : "transparent" }}>
                    <td style={styles.td}>{t.date}</td>
                    <td style={styles.td}><span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span></td>
                    <td style={styles.td}>
                      {t.description}
                      {t.isRecurring && <span style={{ marginLeft: 6, fontSize: 11, color: styles.textMuted }}>· recurring</span>}
                      {t.imported && <span style={{ marginLeft: 6, fontSize: 11, color: PALETTE.primaryDeep, fontWeight: 600 }}>· imported</span>}
                    </td>
                    <td style={styles.td}><span style={{ ...styles.avatarCircle(u || { colour: "#999", name: "?" }), width: 22, height: 22, fontSize: 10 }}>{u?.name[0] || "?"}</span></td>
                    <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: t.type === "income" ? PALETTE.primaryDeep : styles.text }}>
                      {t.type === "income" ? "+" : "−"}{fmtAUD(t.amount)}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.buttonGhost} onClick={() => openEdit(t)}>Edit</button>
                      <button style={{ ...styles.buttonDanger, marginLeft: 6 }} onClick={() => confirmDelete(t.id)} data-testid={`tx-delete-${t.id}`}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {filteredTx.length === 0 && (
                <tr><td style={{ ...styles.td, textAlign: "center", color: styles.textMuted, padding: 24 }} colSpan={6}>No transactions match the current filter.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...styles.td, fontWeight: 600 }} colSpan={4}>Totals</td>
                <td style={{ ...styles.td, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: PALETTE.primaryDeep }} data-testid="filter-income">+{fmtAUD(filteredIncome)}</span>
                  <br />
                  <span data-testid="filter-expense">−{fmtAUD(filteredExpense)}</span>
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
