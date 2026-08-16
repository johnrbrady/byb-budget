import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AddIncomeFlow } from "./AddIncomeFlow.jsx";
import { FirstTimeFillWizard } from "./FirstTimeFillWizard.jsx";
import { CatForm, RuleForm, TxForm } from "./forms.jsx";
import { buildStyles } from "../styles/buildStyles.js";

const styles = buildStyles("light", false);
const categories = [
  { id: "c-income", name: "Salary", type: "income", envelopeBalance: 0, baseAmount: 0 },
  { id: "c-food", name: "Food", type: "expense", envelopeBalance: 1234, baseAmount: 50000, suggestedPct: 50 },
];

test("transaction edit displays dollars but submits integer cents", () => {
  const onSave = jest.fn();
  render(<TxForm
    tx={{ id: "t-1", date: "2026-06-15", type: "expense", categoryId: "c-food", amount: 1234, description: "Shop" }}
    categories={categories} activeUserId="u-1" onSave={onSave} onCancel={() => {}} styles={styles}
  />);
  const input = screen.getByTestId("tx-amount");
  expect(input).toHaveValue(12.34);
  fireEvent.change(input, { target: { value: "19.99" } });
  fireEvent.click(screen.getByTestId("tx-save"));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amount: 1999 }));
});

test("interactive transaction input rejects more than two decimals", () => {
  const onSave = jest.fn();
  render(<TxForm tx={null} categories={categories} activeUserId="u-1" onSave={onSave} onCancel={() => {}} styles={styles} />);
  fireEvent.change(screen.getByTestId("tx-amount"), { target: { value: "1.005" } });
  fireEvent.click(screen.getByTestId("tx-save"));
  expect(onSave).not.toHaveBeenCalled();
});

test("category and recurring forms round-trip their edit values at the boundary", () => {
  const saveCategory = jest.fn();
  const { unmount } = render(<CatForm cat={categories[1]} onSave={saveCategory} onCancel={() => {}} styles={styles} />);
  const categoryAmount = screen.getByDisplayValue("500.00");
  fireEvent.change(categoryAmount, { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(saveCategory).toHaveBeenCalledWith(expect.objectContaining({ baseAmount: 1234, monthlyBudget: 1234 }));
  unmount();

  const saveRule = jest.fn();
  render(<RuleForm rule={{ label: "Rent", amount: 1234, type: "expense", categoryId: "c-food", frequency: "monthly", startDate: "2026-06-15", nextDueDate: "2026-07-15" }} categories={categories} users={[]} activeUserId="u-1" onSave={saveRule} onCancel={() => {}} styles={styles} />);
  const ruleAmount = screen.getByDisplayValue("12.34");
  fireEvent.change(ruleAmount, { target: { value: "19.99" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(saveRule).toHaveBeenCalledWith(expect.objectContaining({ amount: 1999 }));
});

test("Add Income submits cents and exact split totals", () => {
  const onSubmit = jest.fn();
  render(<AddIncomeFlow categories={categories} recurring={[]} unallocatedBalance={0} onSubmit={onSubmit} onCancel={() => {}} styles={styles} />);
  fireEvent.change(screen.getByTestId("income-amount"), { target: { value: "19.99" } });
  fireEvent.click(screen.getByTestId("alloc-split"));
  const flow = screen.getByTestId("add-income-flow");
  const amountInputs = within(flow).getAllByPlaceholderText("0.00");
  fireEvent.change(amountInputs[amountInputs.length - 1], { target: { value: "19.99" } });
  fireEvent.click(screen.getByTestId("income-submit"));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 1999, splits: [{ catId: "c-food", amount: 1999 }] }));
});

test("first-time wizard submits integer-cents base amounts", () => {
  const onComplete = jest.fn();
  render(<FirstTimeFillWizard categories={[categories[1]]} onComplete={onComplete} onSkip={() => {}} styles={styles} />);
  fireEvent.click(screen.getByRole("button", { name: /Fill one by one/i }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  expect(onComplete).toHaveBeenCalledWith({ "c-food": 1234 });
});
