import React from "react";
import { Sheet } from "./Sheet.jsx";
import { AddIncomeFlow } from "./AddIncomeFlow.jsx";

// The Add Income flow, presented as a bottom sheet on phones.
//
// Package 7 moved the transaction editor into a sheet and left this path alone,
// so income kept the defect the editor had shed (DEF-016): opened from the FAB's
// long-press menu — or from an envelope's quick actions, thirty envelopes down a
// Dashboard — the flow was inserted inline near the top of the view, above
// wherever the user was reading. It pushed the list down and appeared, from the
// far end of a scroll, to have done nothing at all. A sheet comes up over
// whatever is on screen and puts nothing into the document flow, so the page
// under it does not move.
//
// The flow inside is AddIncomeFlow itself rather than a copy of it, for the same
// reason TxSheet renders TxForm: this is where a multi-envelope split is
// composed, and those splits are what the DEF-004 allocation rules carry through
// an edit untouched. A second implementation of it here is how a payslip
// silently drains an envelope again.
//
// The flow's own container styling is flattened: inside a sheet it is the sheet
// that is the surface, and a bordered, tinted card within it would be a box in a
// box.
const FLOW_IN_SHEET = { background: "transparent", border: "none", boxShadow: "none", padding: 0, marginBottom: 0 };

export function IncomeSheet({ categories, recurring, unallocatedBalance, onSubmit, onClose, styles }) {
  return (
    <Sheet title="Add income" onClose={onClose} styles={styles} testId="income-sheet">
      <AddIncomeFlow
        categories={categories}
        recurring={recurring}
        unallocatedBalance={unallocatedBalance}
        onSubmit={onSubmit}
        onCancel={onClose}
        styles={styles}
        style={FLOW_IN_SHEET}
      />
    </Sheet>
  );
}
