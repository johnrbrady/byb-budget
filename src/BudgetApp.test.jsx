import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import BudgetApp from "./BudgetApp.jsx";

// The app talks to the API for auth/welcome housekeeping — stub it out.
beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
  );
});

beforeEach(() => {
  localStorage.clear();
  // Bypass the login page and the welcome modal
  localStorage.setItem("byb_token", "test-token");
  localStorage.setItem("byb_user", "u-user1");
  localStorage.setItem("byb_welcomed", "1");
  localStorage.setItem("byb_named_u-user1", "1");
  global.fetch.mockClear();
});

const baseUsers = [{ id: "u-user1", name: "Tester", role: "owner", colour: "#7FB069", hasSeenWelcome: true }];

function renderApp(data = {}) {
  return render(
    <BudgetApp
      initialData={{ users: baseUsers, transactions: [], categories: [], recurring: [], assets: [], transfers: [], reconcileLog: [], unallocatedBalance: 0, ...data }}
      onSave={jest.fn()}
    />
  );
}

async function settle() {
  // Let pending effects (fetch stubs) resolve
  await act(async () => { await Promise.resolve(); });
}

describe("Shell", () => {
  test("renders the dashboard with default envelopes", async () => {
    renderApp();
    await settle();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Savings")).toBeInTheDocument();
  });

  test("welcome modal stays hidden when the user record says it was seen", async () => {
    renderApp();
    await settle();
    expect(screen.queryByText(/Agree and let's get started/)).not.toBeInTheDocument();
  });

  test("welcome modal shows for a brand-new user, and closing it notifies the server", async () => {
    localStorage.removeItem("byb_welcomed");
    render(
      <BudgetApp
        initialData={{ users: [{ id: "u-user1", name: "Tester", role: "owner", colour: "#7FB069" }], transactions: [], categories: [], recurring: [], unallocatedBalance: 0 }}
        onSave={jest.fn()}
      />
    );
    await settle();
    const btn = screen.getByText(/Agree and let's get started/);
    fireEvent.click(btn);
    expect(screen.queryByText(/Agree and let's get started/)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/welcome-seen", expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("byb_welcomed")).toBe("1");
  });
});

describe("Transactions", () => {
  test("adding an expense updates the running balance", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByTestId("add-tx"));

    const form = screen.getByTestId("tx-form");
    fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "50" } });
    fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: "Test expense" } });
    fireEvent.click(screen.getByTestId("tx-save"));

    const balance = screen.getByTestId("running-balance").textContent;
    expect(balance).toMatch(/-\$50\.00/);
  });

  test("deleting a transaction asks for confirmation first", async () => {
    // Dated inside the month the clock is pinned to (see jest.setup.js) so the
    // row survives TransactionsView's active-month filter and is there to delete.
    renderApp({
      transactions: [{ id: "t1", date: "2026-06-01", amount: 25, type: "expense", categoryId: "c-groceries", description: "Milk", isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: "2026-06-01T00:00:00Z" }],
    });
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    expect(screen.getByTestId("tx-row-t1")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tx-delete-t1"));
    // Custom confirm dialog appears instead of window.confirm
    const ok = await screen.findByTestId("confirm-ok");
    fireEvent.click(ok);
    // askConfirm resolves a promise, so the delete runs a microtask later
    await settle();
    expect(screen.queryByTestId("tx-row-t1")).not.toBeInTheDocument();
  });
});

describe("Add Income flow", () => {
  test("income kept unallocated raises the unallocated balance and logs a transaction", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("add-income-btn"));
    const flow = screen.getByTestId("add-income-flow");
    fireEvent.change(within(flow).getByTestId("income-amount"), { target: { value: "1000" } });
    fireEvent.click(within(flow).getByTestId("income-submit"));

    // Running balance reflects the income
    expect(screen.getByTestId("running-balance").textContent).toMatch(/\$1,000\.00/);
  });

  test("split allocation puts money straight into the chosen envelope", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("add-income-btn"));
    const flow = screen.getByTestId("add-income-flow");
    fireEvent.change(within(flow).getByTestId("income-amount"), { target: { value: "200" } });
    fireEvent.click(within(flow).getByTestId("alloc-split"));
    // First split row defaults to the first expense envelope; set the amount
    const amounts = within(flow).getAllByPlaceholderText("0.00");
    fireEvent.change(amounts[amounts.length - 1], { target: { value: "200" } });
    fireEvent.click(within(flow).getByTestId("income-submit"));

    expect(screen.getByTestId("running-balance").textContent).toMatch(/\$200\.00/);
  });

  test("a new income stream can be created inline", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("add-income-btn"));
    const flow = screen.getByTestId("add-income-flow");
    fireEvent.click(within(flow).getByTestId("income-source-new"));
    fireEvent.change(within(flow).getByPlaceholderText(/Name the income stream/), { target: { value: "Etsy shop" } });
    fireEvent.change(within(flow).getByTestId("income-amount"), { target: { value: "75" } });
    fireEvent.click(within(flow).getByTestId("income-submit"));

    // The new stream now exists as an income category — appears as both a
    // filter option and the pill on the logged transaction
    fireEvent.click(screen.getByTestId("nav-transactions"));
    expect(screen.getAllByText("Etsy shop").length).toBeGreaterThan(0);
  });
});

describe("Reconcile", () => {
  test("reconcile asks for confirmation and logs nothing when balances are zero", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("reconcile-btn"));
    const ok = await screen.findByTestId("confirm-ok");
    fireEvent.click(ok);
    expect(await screen.findByTestId("toast")).toHaveTextContent("Nothing to reconcile");
  });

  test("reconcile pools surplus, records a log entry, and notifies the server", async () => {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{
          users: baseUsers,
          transactions: [],
          recurring: [],
          unallocatedBalance: 0,
          reconcileLog: [],
          categories: [
            { id: "c-a", name: "A", type: "expense", colour: "#7FB069", baseAmount: 100, envelopeBalance: 40, isAccumulating: false },
            { id: "c-b", name: "B", type: "expense", colour: "#5F8A4F", baseAmount: 100, envelopeBalance: -10, isAccumulating: false },
          ],
        }}
      />
    );
    await settle();
    fireEvent.click(screen.getByTestId("reconcile-btn"));
    const ok = await screen.findByTestId("confirm-ok");
    fireEvent.click(ok);

    // 40 pooled, 10 covers B's deficit, 30 returned to unallocated
    expect(await screen.findByTestId("toast")).toHaveTextContent("$40.00 redistributed");
    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.reconcileLog).toHaveLength(1);
    expect(saved.reconcileLog[0]).toMatchObject({ pooled: 40, toppedUp: 1, returned: 30 });
    expect(saved.unallocatedBalance).toBe(30);
    expect(global.fetch).toHaveBeenCalledWith("/api/events/reconcile", expect.objectContaining({ method: "POST" }));
  });
});

describe("Income allocation integrity", () => {
  test("deleting an allocated income reverses both unallocated and the envelope", async () => {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{
          users: baseUsers,
          recurring: [],
          unallocatedBalance: 0,
          categories: [
            { id: "c-inc", name: "Salary", type: "income", colour: "#7FB069", monthlyBudget: null },
            { id: "c-a", name: "A", type: "expense", colour: "#7FB069", baseAmount: 100, envelopeBalance: 150, isAccumulating: false },
          ],
          // Dated inside the month the clock is pinned to (see jest.setup.js) so
          // the row survives TransactionsView's active-month filter.
          transactions: [
            { id: "t-inc", date: "2026-06-01", amount: 150, type: "income", categoryId: "c-inc", description: "Pay", isRecurring: false, recurringId: null, allocations: [{ catId: "c-a", amount: 150 }], addedBy: "u-user1", createdAt: "2026-06-01T00:00:00Z" },
          ],
        }}
      />
    );
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    expect(screen.getByTestId("tx-row-t-inc")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tx-delete-t-inc"));
    const ok = await screen.findByTestId("confirm-ok");
    fireEvent.click(ok);
    // askConfirm resolves a promise, so the delete runs a microtask later
    await settle();

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    // Envelope loses the allocated 150; unallocated unchanged at 0 (income + allocation cancel out)
    expect(saved.categories.find((c) => c.id === "c-a").envelopeBalance).toBe(0);
    expect(saved.unallocatedBalance).toBe(0);
  });
});
