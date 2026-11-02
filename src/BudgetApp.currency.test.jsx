import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import BudgetApp from "./BudgetApp.jsx";
import { setActiveCurrency } from "./lib/currency.js";

global.__BUILD_TIME__ = "2026-06-15T09:00:00.000Z";

const OWNER = { id: "u-user1", name: "Tester", role: "owner", colour: "#7FB069", hasSeenWelcome: true };
const MEMBER = { id: "u-user1", name: "Tester", role: "member", colour: "#7FB069", hasSeenWelcome: true };
const food = { id: "c-food", name: "Food", type: "expense", envelopeBalance: 5000, baseAmount: 10000, monthlyBudget: 10000, suggestedPct: 50 };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("byb_token", "test-token");
  localStorage.setItem("byb_user", "u-user1");
  localStorage.setItem("byb_welcomed", "1");
  localStorage.setItem("byb_named_u-user1", "1");
  setActiveCurrency("AUD");
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }));
});

function renderApp(data = {}) {
  const onSave = jest.fn();
  const result = render(
    <BudgetApp
      initialData={{
        moneyScale: 100,
        dataVersion: 0,
        users: [OWNER],
        transactions: [],
        categories: [food],
        recurring: [],
        assets: [],
        transfers: [],
        reconcileLog: [],
        adjustments: [],
        budgetHistory: [],
        unallocatedBalance: 10000,
        ...data,
      }}
      onSave={onSave}
    />
  );
  return { onSave, ...result };
}

async function settle() {
  await act(async () => { await Promise.resolve(); });
}

async function confirmDialog() {
  const ok = await screen.findByTestId("confirm-ok");
  fireEvent.click(ok);
  await settle();
}

async function changeCurrency(next, rate) {
  fireEvent.click(screen.getByTestId("settings-btn"));
  fireEvent.change(screen.getByTestId("settings-currency-select"), { target: { value: next } });
  fireEvent.change(screen.getByTestId("settings-currency-rate"), { target: { value: rate } });
  fireEvent.click(screen.getByTestId("settings-currency-change"));
  await confirmDialog();
}

test("an admin converts the whole household and records the change", async () => {
  const { onSave } = renderApp();
  await changeCurrency("USD", "0.5");

  const saved = onSave.mock.calls.at(-1)[0];
  expect(saved.moneyScale).toBe(100);
  expect(saved.settings).toEqual({ currency: "USD" });
  expect(saved.unallocatedBalance).toBe(5000);
  expect(saved.categories.find((category) => category.id === "c-food").envelopeBalance).toBe(2500);
  expect(saved.categories.find((category) => category.id === "c-food").baseAmount).toBe(5000);
  expect(saved.budgetHistory[0].categories.find((category) => category.categoryId === "c-food").baseAmount).toBe(5000);
  expect(saved.currencyHistory[0]).toMatchObject({ from: "AUD", to: "USD", rate: 0.5 });
  expect(screen.getByText(/Current:/)).toHaveTextContent("USD");
  expect(screen.getByTestId("toast")).toHaveTextContent("Household currency is now USD");
});

test("cancelling the confirmation leaves every amount untouched", async () => {
  const { onSave } = renderApp();
  fireEvent.click(screen.getByTestId("settings-btn"));
  fireEvent.change(screen.getByTestId("settings-currency-select"), { target: { value: "USD" } });
  fireEvent.change(screen.getByTestId("settings-currency-rate"), { target: { value: "0.5" } });
  fireEvent.click(screen.getByTestId("settings-currency-change"));

  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await settle();

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText(/Current:/)).toHaveTextContent("AUD");
});

test("an invalid or zero rate cannot be submitted, and the same currency is a no-op", async () => {
  renderApp();
  fireEvent.click(screen.getByTestId("settings-btn"));
  const button = screen.getByTestId("settings-currency-change");
  expect(button).toBeDisabled();

  fireEvent.change(screen.getByTestId("settings-currency-select"), { target: { value: "USD" } });
  fireEvent.change(screen.getByTestId("settings-currency-rate"), { target: { value: "0" } });
  expect(button).toBeDisabled();
  expect(screen.getByTestId("settings-currency-preview")).toHaveTextContent("positive rate");

  fireEvent.change(screen.getByTestId("settings-currency-rate"), { target: { value: "0.65" } });
  expect(button).not.toBeDisabled();
});

test("a non-admin never sees the household currency control", async () => {
  renderApp({ users: [MEMBER] });
  fireEvent.click(screen.getByTestId("settings-btn"));
  expect(screen.queryByTestId("settings-currency-select")).not.toBeInTheDocument();
});

test("the first-run picker saves the chosen currency only for an empty household admin", async () => {
  localStorage.removeItem("byb_welcomed");
  const { onSave } = renderApp({ users: [{ ...OWNER, hasSeenWelcome: false }], categories: [], unallocatedBalance: 0 });
  await settle();
  const picker = screen.getByTestId("welcome-currency");
  fireEvent.change(picker, { target: { value: "USD" } });
  fireEvent.click(screen.getByRole("button", { name: /Agree and let's get started/ }));

  const saved = onSave.mock.calls.at(-1)[0];
  expect(saved.settings).toEqual({ currency: "USD" });
  expect(saved.unallocatedBalance).toBe(0);
});

test("the first-run picker is absent for an existing household and for a non-admin", async () => {
  localStorage.removeItem("byb_welcomed");
  const existing = renderApp({ users: [{ ...OWNER, hasSeenWelcome: false }] });
  await settle();
  expect(screen.queryByTestId("welcome-currency")).not.toBeInTheDocument();
  existing.unmount();

  localStorage.removeItem("byb_welcomed");
  renderApp({ users: [{ ...MEMBER, hasSeenWelcome: false }], categories: [] });
  await settle();
  expect(screen.queryByTestId("welcome-currency")).not.toBeInTheDocument();
});

test("a foreign expense stores the main amount, foreign original and implied rate", async () => {
  const { onSave } = renderApp();
  fireEvent.click(screen.getByTestId("nav-transactions"));
  fireEvent.click(screen.getByTestId("add-tx"));

  const form = screen.getByTestId("tx-form");
  fireEvent.change(within(form).getByTestId("tx-currency"), { target: { value: "EUR" } });
  fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "75" } });
  fireEvent.change(within(form).getByTestId("tx-charged"), { target: { value: "120" } });
  expect(within(form).getByTestId("tx-rate")).toHaveTextContent("1 EUR = 1.6 AUD");
  fireEvent.click(within(form).getByTestId("tx-save"));

  const saved = onSave.mock.calls.at(-1)[0];
  const transaction = saved.transactions[0];
  expect(transaction).toMatchObject({ type: "expense", amount: 12000, currency: "EUR", foreignAmount: 7500, exchangeRate: 1.6 });
  expect(saved.categories.find((category) => category.id === "c-food").envelopeBalance).toBe(-7000);
  expect(screen.getByTestId(`tx-foreign-${transaction.id}`)).toHaveTextContent("€75.00 @ 1.6000");
});

test("editing and deleting a foreign expense stays balanced", async () => {
  const initial = {
    unallocatedBalance: 12000,
    categories: [{ ...food, envelopeBalance: -12000 }],
    transactions: [{
      id: "t-foreign",
      date: "2026-06-15",
      type: "expense",
      amount: 12000,
      currency: "EUR",
      foreignAmount: 7500,
      exchangeRate: 1.6,
      categoryId: "c-food",
      description: "Overseas",
      addedBy: "u-user1",
      createdAt: "2026-06-15T00:00:00Z",
    }],
  };
  const { onSave } = renderApp(initial);
  fireEvent.click(screen.getByTestId("nav-transactions"));

  const row = screen.getByTestId("tx-row-t-foreign");
  fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
  const form = screen.getByTestId("tx-form");
  expect(within(form).getByTestId("tx-amount")).toHaveValue(75);
  expect(within(form).getByTestId("tx-charged")).toHaveValue(120);
  fireEvent.change(within(form).getByTestId("tx-charged"), { target: { value: "60" } });
  fireEvent.click(within(form).getByTestId("tx-save"));

  const edited = onSave.mock.calls.at(-1)[0];
  expect(edited.transactions[0]).toMatchObject({ amount: 6000, foreignAmount: 7500, exchangeRate: 0.8 });
  expect(edited.categories.find((category) => category.id === "c-food").envelopeBalance).toBe(-6000);

  const updatedRow = screen.getByTestId("tx-row-t-foreign");
  fireEvent.click(within(updatedRow).getByRole("button", { name: "Delete" }));
  await confirmDialog();

  const deleted = onSave.mock.calls.at(-1)[0];
  expect(deleted.transactions).toHaveLength(0);
  expect(deleted.categories.find((category) => category.id === "c-food").envelopeBalance).toBe(0);
});

test("changing the main currency keeps the foreign original and recomputes its rate", async () => {
  const { onSave } = renderApp({
    unallocatedBalance: 12000,
    categories: [{ ...food, envelopeBalance: -12000 }],
    transactions: [{
      id: "t-foreign",
      date: "2026-06-15",
      type: "expense",
      amount: 12000,
      currency: "EUR",
      foreignAmount: 7500,
      exchangeRate: 1.6,
      categoryId: "c-food",
      description: "Overseas",
      addedBy: "u-user1",
      createdAt: "2026-06-15T00:00:00Z",
    }],
  });
  await changeCurrency("USD", "0.5");

  const saved = onSave.mock.calls.at(-1)[0];
  expect(saved.transactions[0]).toMatchObject({
    amount: 6000,
    currency: "EUR",
    foreignAmount: 7500,
    exchangeRate: 0.8,
  });
});
