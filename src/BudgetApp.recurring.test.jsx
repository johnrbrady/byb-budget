import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

test("one press posts every overdue occurrence and applies every ledger effect exactly once", () => {
  const onSave = jest.fn();
  render(<BudgetApp onSave={onSave} initialData={{
    moneyScale: 100,
    users: [{ id: "u-1", name: "Tester", role: "owner", colour: "#7FB069", hasSeenWelcome: true }],
    categories: [
      { id: "salary", name: "Salary", type: "income", colour: "#A0B894" },
      { id: "rent", name: "Rent", type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 10000, isAccumulating: false },
    ],
    recurring: [{ id: "rule", label: "Rent", amount: 1000, type: "expense", categoryId: "rent", frequency: "monthly", nextDueDate: "2026-03-15", dueDay: 15, addedBy: "u-1" }],
    transactions: [], assets: [], transfers: [], reconcileLog: [], adjustments: [], budgetHistory: [], unallocatedBalance: 0,
  }} />);

  fireEvent.click(screen.getByTestId("nav-recurring"));
  expect(screen.getByTestId("due-banner")).toHaveTextContent("catches up every missed occurrence");
  fireEvent.click(screen.getByTestId("post-due"));

  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0];
  expect(saved.transactions.map((transaction) => transaction.date)).toEqual(["2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15"]);
  expect(saved.recurring[0]).toMatchObject({ nextDueDate: "2026-07-15", dueDay: 15 });
  expect(saved.categories.find((category) => category.id === "rent").envelopeBalance).toBe(6000);
});
