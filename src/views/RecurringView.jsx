import React from "react";
import { PALETTE } from "../lib/constants.js";
import { fmtAUD, todayISO } from "../lib/utils.js";
import { RuleForm } from "../components/forms.jsx";
import { askConfirm } from "../components/ConfirmDialog.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { IconRepeat } from "../components/Icons.jsx";

export function RecurringView({ recurring, categories, users, categoriesById, activeUserId, editingRule, setEditingRule, ruleFormOpen, setRuleFormOpen, saveRule, deleteRule, postDueRecurrences, styles }) {
  const due = recurring.filter((r) => r.nextDueDate <= todayISO());
  const mobile = styles.isMobile;

  const confirmDelete = async (id) => {
    const ok = await askConfirm({ title: "Delete this recurring rule?", message: "Already-posted transactions are kept.", confirmLabel: "Delete", danger: true });
    if (ok) deleteRule(id);
  };

  return (
    <div>
      {due.length > 0 && (
        <div className="byb-panel" style={{ ...styles.card, background: PALETTE.secondary + "44", borderColor: PALETTE.primary, display: "flex", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", alignItems: mobile ? "stretch" : "center", marginBottom: 16, gap: 10 }} data-testid="due-banner">
          <div><strong>{due.length}</strong> recurring rule(s) due. Posting advances each rule by one cycle.</div>
          <button style={styles.button} onClick={postDueRecurrences} data-testid="post-due">Post due transactions</button>
        </div>
      )}
      {!mobile && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button style={styles.button} onClick={() => { setEditingRule(null); setRuleFormOpen(true); }}>Add recurring rule</button>
        </div>
      )}
      {(ruleFormOpen || editingRule) && <RuleForm rule={editingRule} categories={categories} users={users} activeUserId={activeUserId} onSave={saveRule} onCancel={() => { setRuleFormOpen(false); setEditingRule(null); }} styles={styles} />}
      {mobile ? (
        <>
          {!ruleFormOpen && !editingRule && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button style={{ ...styles.button, flex: 1, fontSize: 15, fontWeight: 700 }} onClick={() => { setEditingRule(null); setRuleFormOpen(true); }}>
                + Add rule
              </button>
            </div>
          )}
          {recurring.map((r) => {
            const cat = categoriesById[r.categoryId];
            const overdue = r.nextDueDate <= todayISO();
            return (
              <div key={r.id} style={{ ...styles.txCard, borderLeft: overdue ? `3px solid ${PALETTE.warn}` : styles.txCard.borderLeft }} onClick={() => { setEditingRule(r); setRuleFormOpen(false); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{r.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, color: r.type === "income" ? "var(--byb-ok)" : styles.text }}>
                    {r.type === "income" ? "+" : "−"}{fmtAUD(r.amount)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span>
                  <span style={{ fontSize: 11, color: styles.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.frequency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: styles.textMuted }}>
                  <span>Next: {r.nextDueDate}{overdue && " · due"}</span>
                  <button style={{ ...styles.buttonDanger, padding: "4px 10px", fontSize: 11, minHeight: "auto" }} onClick={(e) => { e.stopPropagation(); confirmDelete(r.id); }}>Del</button>
                </div>
              </div>
            );
          })}
          {recurring.length === 0 && (
            <div style={{ ...styles.card, padding: 0 }}>
              <EmptyState icon={IconRepeat} title="No recurring rules yet." hint="Add your regular bills and income here and BYB! posts them on their due date, so nothing sneaks up on you." styles={styles} />
            </div>
          )}
          {!ruleFormOpen && !editingRule && (
            <button style={styles.fab} onClick={() => { setEditingRule(null); setRuleFormOpen(true); }} aria-label="Add recurring rule">+</button>
          )}
        </>
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Label</th><th style={styles.th}>Type</th><th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                <th style={styles.th}>Category</th><th style={styles.th}>Frequency</th><th style={styles.th}>Next due</th><th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((r) => {
                const cat = categoriesById[r.categoryId];
                return (
                  <tr key={r.id} className="byb-hover-row">
                    <td style={styles.td}>{r.label}</td>
                    <td style={styles.td}>{r.type}</td>
                    <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtAUD(r.amount)}</td>
                    <td style={styles.td}><span style={styles.pill(cat?.colour || "#999")}>{cat?.name || "?"}</span></td>
                    <td style={styles.td}>{r.frequency}</td>
                    <td style={styles.td}>{r.nextDueDate}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.buttonGhost} onClick={() => { setEditingRule(r); setRuleFormOpen(false); }}>Edit</button>
                      <button style={{ ...styles.buttonDanger, marginLeft: 6 }} onClick={() => confirmDelete(r.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {recurring.length === 0 && (
                <tr><td style={{ ...styles.td, padding: 0 }} colSpan={7}>
                  <EmptyState icon={IconRepeat} title="No recurring rules yet." hint="Add your regular bills and income here and BYB! posts them on their due date, so nothing sneaks up on you." styles={styles} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
