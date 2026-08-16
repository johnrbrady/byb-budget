import React, { useState, useEffect, useRef } from "react";
import { PALETTE } from "../lib/constants.js";
import { centsToInput, fmtAUD, parseAUDToCents, todayISO } from "../lib/utils.js";
import { envelopeTarget } from "../lib/targets.js";
import { CatForm } from "../components/forms.jsx";
import { FirstTimeFillWizard } from "../components/FirstTimeFillWizard.jsx";
import { AnimatedCurrency } from "../components/AnimatedNumber.jsx";
import { QuickActionsSheet } from "../components/QuickActions.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { envelopeStatus, statusColour, statusSoft, fillFraction, STATUS_LABEL } from "../styles/envelopeStatus.js";
import { IconDrag, IconZap, IconList, IconEdit, IconClose, IconPlus, IconEnvelope } from "../components/Icons.jsx";

function EnvelopeCard({ c, styles, editingCat, dragId, dragOverId, dragHandlers, handleTouchHandlers, onEdit, onFill, onLongPress, canFill }) {
  const balance = c.envelopeBalance || 0;
  const base = c.baseAmount || 0;
  const status = envelopeStatus(balance, base);
  const balColour = statusColour(status);
  const filled = fillFraction(balance, base);
  const target = envelopeTarget(c, todayISO());
  const targetLabel = target?.status === "complete" ? "Target reached" : target?.status === "overdue" ? "Overdue" : target?.status === "on-track" ? "On track" : "Increase monthly fill";
  const targetColour = target?.status === "complete" || target?.status === "on-track" ? "var(--byb-ok)" : "var(--byb-over)";
  const lp = useLongPress(() => onLongPress(c));
  return (
    <div
      data-env-id={c.id}
      data-env-status={status}
      className="byb-hover-card byb-card-press"
      draggable={!editingCat}
      onDragStart={(e) => dragHandlers.start(e, c.id)}
      onDragOver={(e) => dragHandlers.over(e, c.id)}
      onDrop={(e) => dragHandlers.drop(e, c.id)}
      onDragEnd={dragHandlers.end}
      onTouchStart={lp.onTouchStart}
      onTouchMove={lp.onTouchMove}
      onTouchEnd={lp.onTouchEnd}
      onTouchCancel={lp.onTouchCancel}
      style={{ ...styles.card, display: "flex", flexDirection: "column", opacity: dragId === c.id ? 0.45 : 1, outline: dragOverId === c.id ? `2px solid ${PALETTE.primary}` : "none", transition: "opacity .15s, border-color .15s, box-shadow .15s, transform .1s", cursor: dragId ? "grabbing" : "grab" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {/* data-swipe-ignore: this handle owns horizontal drags — it is where
            reordering starts, so the shell's tab swipe leaves it alone. The card
            body around it does not, which is why swipe was dead on this tab. */}
        <span
          data-swipe-ignore
          style={{ color: styles.textMuted, flexShrink: 0, cursor: "grab", userSelect: "none", touchAction: "none", display: "inline-flex", padding: 2 }}
          onTouchStart={(e) => handleTouchHandlers.start(e, c.id)}
          onTouchEnd={handleTouchHandlers.end}
          aria-label="Drag to reorder"
        >
          <IconDrag size={15} />
        </span>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
        {c.isAccumulating && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: PALETTE.secondary + "55", color: PALETTE.primaryDeep, fontWeight: 700 }}>Saving</span>}
        {c.protected && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "#9CA3AF22", color: "#6B7280", fontWeight: 700 }}>Protected</span>}
      </div>
      {/* The card is an envelope, so it says how full it is. The number alone
          told you what was in it but not whether that was a lot or nearly
          nothing — which is the question actually being asked at a glance. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: "var(--byb-text-xl)", fontWeight: 800, color: balColour, letterSpacing: -0.5 }}>
          <AnimatedCurrency value={balance} />
        </span>
        <span style={{ fontSize: "var(--byb-text-sm)", color: styles.textMuted, fontVariantNumeric: "tabular-nums" }}>
          / {fmtAUD(base)}
        </span>
      </div>
      <div
        className="byb-meter"
        role="img"
        aria-label={`${STATUS_LABEL[status]} — ${fmtAUD(balance)} of ${fmtAUD(base)}`}
        data-testid={`env-meter-${c.id}`}
      >
        <div className="byb-meter-fill" data-testid={`env-meter-fill-${c.id}`} style={{ width: `${filled * 100}%`, background: balColour }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "var(--byb-text-xs)", color: styles.textMuted, margin: "6px 0 10px" }}>
        <span
          data-testid={`env-status-${c.id}`}
          style={{ color: balColour, fontWeight: 700, background: statusSoft(status), padding: "2px 8px", borderRadius: "var(--byb-radius-pill)" }}
        >
          {STATUS_LABEL[status]}
        </span>
        <span>{base > 0 ? `${Math.round(filled * 100)}% of ${fmtAUD(base)}/mo` : "No monthly amount set"}{c.isAccumulating ? " · accumulating" : ""}</span>
      </div>
      {target && (
        <div data-testid={`env-target-${c.id}`} style={{ background: "var(--byb-surface-sunken)", borderRadius: 6, padding: "8px 10px", marginBottom: 10, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
            <strong>Target {fmtAUD(target.targetAmount)} by {target.targetDate}</strong>
            <strong style={{ color: targetColour, whiteSpace: "nowrap" }}>{targetLabel}</strong>
          </div>
          <div className="byb-meter" style={{ height: 5, marginBottom: 5 }}>
            <div className="byb-meter-fill" style={{ width: `${Math.max(0, Math.min(100, (target.balance / target.targetAmount) * 100))}%`, background: targetColour }} />
          </div>
          <span style={{ color: styles.textMuted }}>
            {target.remaining === 0 ? "Fully funded" : `${fmtAUD(target.remaining)} left · ${fmtAUD(target.requiredMonthly)}/month needed`}
          </span>
        </div>
      )}
      <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
        <button style={{ ...styles.buttonGhost, fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={(e) => { e.stopPropagation(); onEdit(c); }}>Edit</button>
        {canFill && (
          <button style={{ ...styles.button, fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={(e) => { e.stopPropagation(); onFill(c.id); }} title={`Fill ${c.name} to target`}>Fill</button>
        )}
      </div>
    </div>
  );
}

export function EnvelopesView({ categories, editingCat, setEditingCat, catFormOpen, setCatFormOpen, saveCat, deleteCat, unallocatedBalance, onFillWithIncome, onFillSingleEnvelope, onSetupBaseAmounts, recurring, onReorderCats, onNavigateToCategory, styles }) {
  const mobile = styles.isMobile;
  const incomeCats = categories.filter((c) => c.type === "income");
  const rawExpenseCats = categories.filter((c) => c.type === "expense");
  const expenseCats = [...rawExpenseCats].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

  // Drag-to-reorder state
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [quickCat, setQuickCat] = useState(null);
  // Ref holds mutable drag state so document listeners avoid stale closures
  const ds = useRef({ id: null, overId: null });
  const doReorderRef = useRef(null);

  const doReorder = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId || !onReorderCats) return;
    const list = [...expenseCats];
    const fromIdx = list.findIndex((c) => c.id === fromId);
    const toIdx = list.findIndex((c) => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...list];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const newCats = categories.map((c) => {
      const newIdx = reordered.findIndex((x) => x.id === c.id);
      return newIdx !== -1 ? { ...c, sortOrder: newIdx } : c;
    });
    onReorderCats(newCats);
  };
  doReorderRef.current = doReorder;

  // Desktop drag handlers
  const dragHandlers = {
    start: (e, id) => { setDragId(id); ds.current.id = id; e.dataTransfer.effectAllowed = "move"; },
    over: (e, id) => { e.preventDefault(); if (id !== dragId) setDragOverId(id); },
    drop: (e, id) => { e.preventDefault(); doReorder(dragId, id); setDragId(null); setDragOverId(null); ds.current.id = null; },
    end: () => { setDragId(null); setDragOverId(null); ds.current.id = null; },
  };

  // Mobile: drag starts from the handle (touch). Document-level non-passive
  // listeners are attached only while a drag is active so e.preventDefault()
  // can block scrolling.
  useEffect(() => {
    if (!dragId) return;
    const onMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const envEl = el?.closest("[data-env-id]");
      if (envEl) {
        const overId = envEl.dataset.envId;
        if (overId !== ds.current.id && overId !== ds.current.overId) {
          ds.current.overId = overId;
          setDragOverId(overId);
        }
      }
    };
    const onEnd = () => {
      const { id, overId } = ds.current;
      if (id && overId && id !== overId) doReorderRef.current(id, overId);
      ds.current.id = null; ds.current.overId = null;
      setDragId(null); setDragOverId(null);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [dragId]);

  const handleTouchHandlers = {
    start: (e, id) => {
      if (editingCat) return;
      e.stopPropagation();
      ds.current.id = id; ds.current.overId = null;
      setDragId(id);
      if (navigator.vibrate) navigator.vibrate(20);
    },
    end: () => { /* document touchend listener finalises the drop */ },
  };

  const totalBase = expenseCats.reduce((s, c) => s + (c.baseAmount || 0), 0);
  const totalBalance = expenseCats.reduce((s, c) => s + (c.envelopeBalance || 0), 0);
  const isFirstTimeSetup = expenseCats.every((c) => (c.baseAmount || 0) === 0);

  const [fillPanelOpen, setFillPanelOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [addEnvOpen, setAddEnvOpen] = useState(false);
  const [fillAmounts, setFillAmounts] = useState({});

  const getRecurringAmount = (catId) => {
    const rules = (recurring || []).filter((r) => r.categoryId === catId && r.type === "income");
    return rules.length > 0 ? rules[0].amount : null;
  };

  const parseInput = (value) => { try { return parseAUDToCents(value); } catch { return 0; } };
  const totalFillAmount = incomeCats.reduce((s, c) => s + parseInput(fillAmounts[c.id] || "0"), 0);

  const applyAllIncomeFill = () => {
    const sources = incomeCats
      .map((c) => ({ catId: c.id, amount: parseInput(fillAmounts[c.id] || "0") }))
      .filter((s) => s.amount > 0);
    if (sources.length === 0) { return; }
    onFillWithIncome(sources);
    setFillAmounts({});
    setFillPanelOpen(false);
  };

  return (
    <div>
      {/* Unallocated summary */}
      <div style={{ ...styles.card, marginBottom: 20 }}>
        <div style={styles.kpiLabel}>Unallocated balance</div>
        <div style={{ fontSize: mobile ? 28 : 34, fontWeight: 800, letterSpacing: -1, color: unallocatedBalance < 0 ? "var(--byb-over)" : "var(--byb-ok)", lineHeight: 1.1 }}>
          <AnimatedCurrency value={unallocatedBalance} />
        </div>
        <div style={{ fontSize: 12, color: styles.textMuted, marginTop: 4 }}>{fmtAUD(totalBalance)} in envelopes · {fmtAUD(totalBase)}/mo base</div>
      </div>

      {/* Two primary action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <button
          style={{ ...styles.button, padding: mobile ? "18px 12px" : "20px 16px", fontSize: mobile ? 14 : 16, fontWeight: 700, borderRadius: 10, background: (fillPanelOpen || showWizard) ? PALETTE.primaryDeep : PALETTE.primary, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => {
            if (isFirstTimeSetup && !fillPanelOpen && !showWizard) {
              setShowWizard(true);
              setAddEnvOpen(false);
            } else {
              setFillPanelOpen((o) => !o);
              setShowWizard(false);
              setAddEnvOpen(false);
            }
          }}
        >
          {(fillPanelOpen || showWizard) ? <><IconClose size={16} /> Close</> : <><IconZap size={16} /> Fill Envelopes</>}
        </button>
        <button
          style={{ ...styles.buttonGhost, padding: mobile ? "18px 12px" : "20px 16px", fontSize: mobile ? 14 : 16, fontWeight: 700, borderRadius: 10, borderWidth: 2, background: addEnvOpen ? "var(--byb-primary-tint)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => { setAddEnvOpen((o) => !o); setFillPanelOpen(false); setEditingCat(null); if (!addEnvOpen) setCatFormOpen(true); else setCatFormOpen(false); }}
        >
          {addEnvOpen ? <><IconClose size={16} /> Cancel</> : <><IconPlus size={16} /> Add Envelope</>}
        </button>
      </div>

      {/* First-time setup wizard */}
      {showWizard && (
        <FirstTimeFillWizard
          categories={categories}
          onComplete={(amountsMap) => {
            onSetupBaseAmounts(amountsMap);
            setShowWizard(false);
          }}
          onSkip={() => setShowWizard(false)}
          styles={styles}
        />
      )}

      {/* Fill Envelopes panel */}
      {fillPanelOpen && !showWizard && (
        <div className="byb-panel" style={{ ...styles.card, marginBottom: 20, borderColor: PALETTE.primary, background: "var(--byb-primary-tint)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Fill all envelopes from income</div>
          <div style={{ fontSize: 12, color: styles.textMuted, marginBottom: 16 }}>
            Enter amounts from each income source. The combined total fills all envelopes at once.
          </div>
          {incomeCats.map((c) => {
            const recurringAmt = getRecurringAmount(c.id);
            return (
              <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${styles.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.colour, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {recurringAmt != null && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Recurring</div>
                      <button
                        style={{ ...styles.buttonGhost, fontSize: 12, padding: "7px 12px", borderColor: PALETTE.primary, color: PALETTE.primaryDeep }}
                        onClick={() => setFillAmounts((prev) => ({ ...prev, [c.id]: centsToInput(recurringAmt) }))}
                      >
                        Stay Consistent ({fmtAUD(recurringAmt)})
                      </button>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                      {recurringAmt != null ? "Custom amount" : "Amount received ($)"}
                    </div>
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={fillAmounts[c.id] || ""}
                      onChange={(e) => setFillAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {incomeCats.length === 0 && (
            <div style={{ fontSize: 13, color: styles.textMuted, marginBottom: 12 }}>No income sources. Add one via the Envelopes form below.</div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingTop: 4 }}>
            <button
              style={{ ...styles.button, flex: 1, padding: "13px 16px", fontSize: 15, fontWeight: 700, opacity: totalFillAmount <= 0 ? 0.5 : 1 }}
              onClick={applyAllIncomeFill}
              disabled={totalFillAmount <= 0}
            >
              Fill All Envelopes — {fmtAUD(totalFillAmount)}
            </button>
            <button style={{ ...styles.buttonGhost }} onClick={() => { setFillPanelOpen(false); setFillAmounts({}); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add envelope form */}
      {addEnvOpen && catFormOpen && !editingCat && (
        <div style={{ marginBottom: 20 }}>
          <CatForm cat={null} onSave={(cat) => { saveCat(cat); setAddEnvOpen(false); setCatFormOpen(false); }} onCancel={() => { setAddEnvOpen(false); setCatFormOpen(false); }} styles={styles} />
        </div>
      )}

      {/* Expense envelopes management */}
      <div style={styles.sectionTitle}>Expense envelopes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {expenseCats.map((c) => {
          if (editingCat?.id === c.id) return (
            <div key={c.id}>
              <CatForm
                cat={editingCat}
                onSave={saveCat}
                onCancel={() => setEditingCat(null)}
                onDelete={!editingCat.protected ? () => { setEditingCat(null); deleteCat(editingCat.id); } : undefined}
                styles={styles}
              />
            </div>
          );
          return (
            <EnvelopeCard
              key={c.id}
              c={c}
              styles={styles}
              editingCat={editingCat}
              dragId={dragId}
              dragOverId={dragOverId}
              dragHandlers={dragHandlers}
              handleTouchHandlers={handleTouchHandlers}
              onEdit={(cat) => { setEditingCat(cat); setCatFormOpen(false); }}
              onFill={onFillSingleEnvelope}
              canFill={!!onFillSingleEnvelope && (c.baseAmount || 0) > 0}
              onLongPress={setQuickCat}
            />
          );
        })}
        {expenseCats.length === 0 && (
          <div style={{ ...styles.card, gridColumn: "1 / -1", padding: 0 }}>
            <EmptyState
              icon={IconEnvelope}
              title="No envelopes yet"
              hint="Envelopes are where each month's money is set aside — rent, groceries, fuel. Create the first one and give it a monthly amount."
              action={{ label: "Add an envelope", onSelect: () => { setAddEnvOpen(true); setFillPanelOpen(false); setEditingCat(null); setCatFormOpen(true); } }}
              styles={styles}
            />
          </div>
        )}
      </div>

      {/* Long-press quick actions */}
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
              sub: "See spending from this envelope",
              icon: IconList,
              onSelect: () => onNavigateToCategory && onNavigateToCategory(quickCat.id),
            },
            {
              label: "Edit envelope",
              sub: "Name, monthly amount, saving toggle",
              icon: IconEdit,
              onSelect: () => { setEditingCat(quickCat); setCatFormOpen(false); },
            },
          ]}
        />
      )}
    </div>
  );
}
