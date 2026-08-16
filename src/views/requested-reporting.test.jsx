import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TransactionsView } from "./TransactionsView.jsx";
import { ReportsView } from "./ReportsView.jsx";
import { buildStyles } from "../styles/buildStyles.js";

const styles = buildStyles("light", false);
const categories = [
  { id: "c-groceries", name: "Groceries", type: "expense", colour: "#7FB069", envelopeBalance: 0, baseAmount: 0 },
  { id: "c-fuel", name: "Fuel", type: "expense", colour: "#C27B3F", envelopeBalance: 0, baseAmount: 0 },
];
const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]));
const expense = (id, date, amount, categoryId = "c-groceries") => ({ id, date, amount, categoryId, type: "expense", description: id, addedBy: "u-1" });

test("an explicit transaction date filter shows the total spent prominently", () => {
  render(<TransactionsView
    transactions={[
      expense("inside-1", "2026-06-01", 1234),
      expense("inside-2", "2026-08-10", 766),
      expense("outside", "2026-08-11", 9999),
      { ...expense("income", "2026-07-01", 50000), type: "income" },
    ]}
    categories={categories}
    users={[{ id: "u-1", name: "John", colour: "#7FB069" }]}
    categoriesById={categoriesById}
    usersById={{ "u-1": { id: "u-1", name: "John", colour: "#7FB069" } }}
    activeMonth="2026-08"
    activeUserId="u-1"
    txFilters={{ type: "all", categoryId: "all", addedBy: "all", search: "", start: "2026-06-01", end: "2026-08-10" }}
    setTxFilters={() => {}}
    editingTx={null}
    setEditingTx={() => {}}
    txFormOpen={false}
    setTxFormOpen={() => {}}
    saveTx={() => {}}
    deleteTx={() => {}}
    onTransferEnvelope={() => {}}
    onAddIncome={() => {}}
    incomeFlowOpen={false}
    setIncomeFlowOpen={() => {}}
    unallocatedBalance={0}
    recurring={[]}
    reconcileLog={[]}
    styles={styles}
  />);

  const total = screen.getByTestId("filtered-spend-total");
  expect(total).toHaveTextContent("Total spent in filtered period");
  expect(total).toHaveTextContent("2026-06-01 → 2026-08-10");
  expect(total).toHaveTextContent("$20.00");
});

function ReportsHarness() {
  const [reportRange, setReportRange] = useState({ start: "2026-01-01", end: "2026-03-31" });
  return <ReportsView
    transactions={[
      expense("jan", "2026-01-15", 1000),
      expense("feb", "2026-02-15", 3000, "c-fuel"),
      expense("mar", "2026-03-15", 2000),
    ]}
    categories={categories}
    categoriesById={categoriesById}
    usersById={{}}
    reportRange={reportRange}
    setReportRange={setReportRange}
    handleExport={() => {}}
    assets={[]}
    onSaveAsset={() => {}}
    onDeleteAsset={() => {}}
    transfers={[]}
    reconcileLog={[]}
    adjustments={[]}
    unallocatedBalance={0}
    onSetUnallocated={() => {}}
    onImportJSON={() => ({ count: 0 })}
    onNavigateToCategory={() => {}}
    activeMonth="2026-03"
    styles={styles}
  />;
}

test("the distribution pie switches from one month to any custom date range", () => {
  render(<ReportsHarness />);
  const card = screen.getByTestId("spending-distribution-card");

  fireEvent.change(within(card).getByRole("combobox", { name: "Distribution period" }), { target: { value: "range" } });
  expect(within(card).getByTestId("distribution-scope")).toHaveTextContent("2026-01-01 → 2026-03-31");
  expect(within(card).getAllByTestId("pie-legend-item").map((item) => item.getAttribute("data-label"))).toEqual(["Groceries", "Fuel"]);

  fireEvent.change(within(card).getByLabelText("Distribution from"), { target: { value: "2026-02-01" } });
  fireEvent.change(within(card).getByLabelText("Distribution to"), { target: { value: "2026-02-28" } });
  const items = within(card).getAllByTestId("pie-legend-item");
  expect(items).toHaveLength(1);
  expect(items[0]).toHaveAttribute("data-label", "Fuel");
  expect(items[0]).toHaveAttribute("data-value", "3000");
});
