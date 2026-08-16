import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BudgetApp from "./BudgetApp.jsx";

global.__BUILD_TIME__ = "2026-08-16T00:00:00.000Z";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("byb_token", "test-token");
  localStorage.setItem("byb_user", "u-1");
  localStorage.setItem("byb_welcomed", "1");
  localStorage.setItem("byb_named_u-1", "1");
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ ok: true }) }));
});

const initialData = {
  moneyScale: 100,
  users: [{ id: "u-1", name: "Tester", colour: "#7FB069", role: "owner", hasSeenWelcome: true }],
  categories: [
    { id: "c-salary", name: "Salary", type: "income", colour: "#A0B894" },
    { id: "c-groceries", name: "Groceries", type: "expense", colour: "#7FB069", envelopeBalance: 10000, baseAmount: 0 },
  ],
  transactions: [], recurring: [], assets: [], transfers: [], reconcileLog: [], adjustments: [],
  unallocatedBalance: 5000,
};

const statement = {
  name: "bank.csv",
  text: async () => "Date,Description,Debit,Credit\n16/08/2026,Groceries,12.50,\n16/08/2026,Salary,,200.00",
};

test("CSV approval persists rows and their exact expense/income ledger effects together", async () => {
  const onSave = jest.fn();
  render(<BudgetApp initialData={initialData} onSave={onSave} />);
  fireEvent.click(screen.getByTestId("nav-reports"));
  fireEvent.click(screen.getByText("Import Transactions"));
  fireEvent.change(screen.getByLabelText("Choose bank CSV"), { target: { files: [statement] } });
  await screen.findByText("Import 2 transactions");

  fireEvent.click(screen.getByText("Import 2 transactions"));
  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0];
  expect(saved.moneyScale).toBe(100);
  expect(saved.transactions).toEqual(expect.arrayContaining([
    expect.objectContaining({ description: "Groceries", amount: 1250, type: "expense", categoryId: "c-groceries" }),
    expect.objectContaining({ description: "Salary", amount: 20000, type: "income", categoryId: "c-salary" }),
  ]));
  expect(saved.categories.find((category) => category.id === "c-groceries").envelopeBalance).toBe(8750);
  expect(saved.unallocatedBalance).toBe(25000);
  expect(saved.budgetHistory).toEqual(expect.arrayContaining([
    expect.objectContaining({ month: "2026-06", categories: expect.arrayContaining([expect.objectContaining({ categoryId: "c-groceries", baseAmount: 0 })]) }),
  ]));

  // Selecting the same statement again is an idempotent no-op, including for
  // the ledger: both existing occurrences are reported, not offered twice.
  fireEvent.click(screen.getByText("Import Transactions"));
  fireEvent.change(screen.getByLabelText("Choose bank CSV"), { target: { files: [statement] } });
  await waitFor(() => expect(screen.getByTestId("csv-preview")).toHaveTextContent("0 new · 2 already imported"));
  expect(onSave).toHaveBeenCalledTimes(1);
});
