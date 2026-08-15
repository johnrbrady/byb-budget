import React from "react";
import { Sheet } from "./Sheet.jsx";
import { TxForm } from "./forms.jsx";

// The transaction editor, presented as a bottom sheet on phones.
//
// The history behind an envelope is months long, so the editor cannot live above
// the list: a tap on a row the user had scrolled down to opened a form off the
// top of his screen, which reads as the tap having done nothing at all
// (DEF-016). A sheet comes up over whatever the list is scrolled to, and puts
// nothing into the document flow, so the list does not move under the finger.
//
// The form inside is TxForm itself rather than a copy of it, deliberately.
// TxForm is where the income-allocation rules live (DEF-004): the "Allocate to
// envelope" select is seeded from the transaction's `allocations` and never from
// a stored `allocatedEnvelopeId`, and a multi-envelope split is shown read-only
// and carried through the save untouched. A second implementation of that here
// is exactly how editing a payslip's description drains an envelope again.
//
// The form's own container styling is flattened: inside a sheet it is the sheet
// that is the surface, and a bordered card within it would be a box in a box.
const FORM_IN_SHEET = { background: "transparent", border: "none", boxShadow: "none", padding: 0, marginBottom: 0 };

export function TxSheet({ tx, categories, activeUserId, defaultCategoryId, onSave, onTransfer, onDelete, onClose, styles }) {
  return (
    <Sheet title={tx ? "Edit transaction" : "Add transaction"} onClose={onClose} styles={styles} testId="tx-edit-sheet">
      <TxForm
        tx={tx}
        categories={categories}
        activeUserId={activeUserId}
        onSave={onSave}
        onTransfer={onTransfer}
        onCancel={onClose}
        defaultCategoryId={defaultCategoryId}
        styles={styles}
        style={FORM_IN_SHEET}
      />
      {tx && onDelete && (
        <button
          type="button"
          style={{ ...styles.buttonDanger, width: "100%", marginTop: 12, textAlign: "center" }}
          onClick={onDelete}
          data-testid="tx-sheet-delete"
        >
          Delete transaction
        </button>
      )}
    </Sheet>
  );
}
