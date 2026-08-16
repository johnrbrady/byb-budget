import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BudgetApp from "./BudgetApp.jsx";

global.__BUILD_TIME__ = "2026-06-15T09:00:00.000Z";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("byb_token", "test-token");
  localStorage.setItem("byb_user", "u-1");
  localStorage.setItem("byb_welcomed", "1");
  localStorage.setItem("byb_named_u-1", "1");
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ ok: true }) }));
});

test("declining an overdraw transfer keeps the form and every typed value", async () => {
  const onSave = jest.fn();
  render(<BudgetApp onSave={onSave} initialData={{
    moneyScale: 100,
    users: [{ id: "u-1", name: "Tester", role: "owner", colour: "#7FB069", hasSeenWelcome: true }],
    categories: [
      { id: "a", name: "Groceries", type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 100, isAccumulating: false },
      { id: "b", name: "Fuel", type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false },
    ],
    transactions: [], recurring: [], assets: [], transfers: [], reconcileLog: [], adjustments: [], budgetHistory: [], unallocatedBalance: 0,
  }} />);

  fireEvent.click(screen.getByRole("button", { name: "+ Add Transaction" }));
  fireEvent.change(screen.getByDisplayValue("Expense"), { target: { value: "transfer" } });
  fireEvent.change(screen.getByTestId("tx-amount"), { target: { value: "2.00" } });
  fireEvent.change(screen.getByTestId("tx-from"), { target: { value: "a" } });
  fireEvent.change(screen.getByTestId("tx-to"), { target: { value: "b" } });
  fireEvent.change(screen.getByTestId("tx-description"), { target: { value: "Keep this note" } });
  fireEvent.click(screen.getByTestId("tx-save"));

  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("Groceries holds $1.00");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  await act(async () => {});
  expect(screen.getByTestId("tx-form")).toBeInTheDocument();
  expect(screen.getByTestId("tx-amount")).toHaveValue(2);
  expect(screen.getByTestId("tx-from")).toHaveValue("a");
  expect(screen.getByTestId("tx-to")).toHaveValue("b");
  expect(screen.getByTestId("tx-description")).toHaveValue("Keep this note");
  expect(onSave).not.toHaveBeenCalled();

  fireEvent.click(screen.getByTestId("tx-save"));
  fireEvent.click(await screen.findByRole("button", { name: "Transfer anyway" }));
  await waitFor(() => expect(screen.queryByTestId("tx-form")).not.toBeInTheDocument());
  expect(onSave).toHaveBeenCalledTimes(1);
});
