import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import BudgetApp from "./BudgetApp.jsx";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("byb_token", "test-token");
  localStorage.setItem("byb_user", "u-user1");
  localStorage.setItem("byb_welcomed", "1");
  localStorage.setItem("byb_named_u-user1", "1");
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }));
});

test("a production-scale edit persists only integer cents", () => {
  const onSave = jest.fn();
  render(<BudgetApp
    initialData={{
      moneyScale: 100,
      dataVersion: 4,
      users: [{ id: "u-user1", name: "Tester", role: "owner", colour: "#7FB069", hasSeenWelcome: true }],
      transactions: [], categories: [], recurring: [], assets: [], transfers: [], reconcileLog: [], adjustments: [], unallocatedBalance: 0,
    }}
    onSave={onSave}
  />);

  fireEvent.click(screen.getByTestId("nav-transactions"));
  fireEvent.click(screen.getByTestId("add-tx"));
  const form = screen.getByTestId("tx-form");
  fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "19.99" } });
  fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: "Exact cents" } });
  fireEvent.click(within(form).getByTestId("tx-save"));

  const saved = onSave.mock.calls.at(-1)[0];
  expect(saved.moneyScale).toBe(100);
  expect(saved.transactions[0].amount).toBe(1999);
  expect(saved.categories.find((category) => category.id === saved.transactions[0].categoryId).envelopeBalance).toBe(-1999);
  expect(Number.isSafeInteger(saved.unallocatedBalance)).toBe(true);
  expect(saved.categories.every((category) => Number.isSafeInteger(category.envelopeBalance) && Number.isSafeInteger(category.baseAmount))).toBe(true);
});
