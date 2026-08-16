import React from "react";
import { render, screen } from "@testing-library/react";
import { EnvelopesView } from "./EnvelopesView.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { buildStyles } from "../styles/buildStyles.js";

const styles = buildStyles("light", false);
const category = {
  id: "c-rego", name: "Car registration", type: "expense", colour: "#7FB069",
  envelopeBalance: 0, baseAmount: 15000, isAccumulating: true,
  targetAmount: 90000, targetDate: "2027-03-31",
};

test("the envelope card states target, deadline, remaining amount and required monthly fill", () => {
  render(<EnvelopesView
    categories={[category]} editingCat={null} setEditingCat={() => {}}
    catFormOpen={false} setCatFormOpen={() => {}} saveCat={() => {}} deleteCat={() => {}}
    unallocatedBalance={0} onFillWithIncome={() => {}} onFillSingleEnvelope={() => {}}
    onSetupBaseAmounts={() => {}} recurring={[]} onReorderCats={() => {}} onNavigateToCategory={() => {}} styles={styles}
  />);
  const target = screen.getByTestId("env-target-c-rego");
  expect(target).toHaveTextContent("Target $900.00 by 2027-03-31");
  expect(target).toHaveTextContent("$900.00 left · $100.00/month needed");
  expect(target).toHaveTextContent("On track");
});

test("the dashboard keeps the target visible at a glance", () => {
  render(<Dashboard
    activeMonth="2026-06" transactions={[]} categories={[category]} recurring={[]} styles={styles} unallocatedBalance={0}
    onTransferEnvelope={() => {}} onAddTx={() => {}} onAddIncome={() => {}} activeUserId="u-1"
    txFormOpen={false} setTxFormOpen={() => {}} setEditingTx={() => {}} onReconcile={() => {}}
    onNavigateToCategory={() => {}} onFillSingleEnvelope={() => {}} incomeFlowOpen={false} setIncomeFlowOpen={() => {}}
  />);
  expect(screen.getByTestId("dashboard-target-c-rego")).toHaveTextContent("$900.00 left by 2027-03-31 · $100.00/month");
});
