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

describe("Melbourne dates", () => {
  // 2026-08-31T22:00:00Z is 8:00am AEST on Tuesday 1 September 2026. Dating the
  // transaction from the UTC clock filed it into August, where it dropped out of
  // the September list the app was showing.
  test("a transaction entered at 8am on the 1st is dated the 1st", async () => {
    jest.setSystemTime(new Date("2026-08-31T22:00:00Z"));
    const onSave = jest.fn();
    render(
      <BudgetApp
        initialData={{ users: baseUsers, transactions: [], categories: [], recurring: [], assets: [], transfers: [], reconcileLog: [], unallocatedBalance: 0 }}
        onSave={onSave}
      />
    );
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByTestId("add-tx"));

    const form = screen.getByTestId("tx-form");
    fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "50" } });
    fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: "Grocery shop" } });
    fireEvent.click(screen.getByTestId("tx-save"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    const tx = saved.transactions.find((t) => t.description === "Grocery shop");
    expect(tx.date).toBe("2026-09-01");
    // ...and it is still on screen, because the month being viewed is September too.
    expect(screen.getByText("Grocery shop")).toBeInTheDocument();
  });
});

describe("Recurring rules across a short month", () => {
  const groceries = { id: "c-groceries", name: "Groceries", type: "expense", colour: "#7FB069", baseAmount: 100, envelopeBalance: 500, isAccumulating: false };

  function renderWithRule(rule) {
    const onSave = jest.fn();
    render(
      <BudgetApp
        initialData={{ users: baseUsers, transactions: [], categories: [groceries], recurring: [rule], assets: [], transfers: [], reconcileLog: [], unallocatedBalance: 0 }}
        onSave={onSave}
      />
    );
    return onSave;
  }

  // The old addPeriod overflowed 31 January into 3 March, skipping February
  // altogether and then firing on the 3rd of every month thereafter.
  test("a rule due on the 31st advances to the last day of February", async () => {
    jest.setSystemTime(new Date("2026-02-15T00:00:00Z"));
    const onSave = renderWithRule({
      id: "r1", label: "Mortgage", amount: 1000, type: "expense", categoryId: "c-groceries",
      frequency: "monthly", startDate: "2026-01-31", nextDueDate: "2026-01-31", addedBy: "u-user1",
    });
    await settle();
    fireEvent.click(screen.getByTestId("nav-recurring"));
    fireEvent.click(screen.getByTestId("post-due"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.recurring[0].nextDueDate).toBe("2026-02-28");
    // The intended day is remembered so the next cycle can return to it.
    expect(saved.recurring[0].dueDay).toBe(31);
    // The posted transaction keeps the date the rule was actually due on.
    expect(saved.transactions[0].date).toBe("2026-01-31");
  });

  test("the rule returns to the 31st the month after February", async () => {
    jest.setSystemTime(new Date("2026-03-15T00:00:00Z"));
    const onSave = renderWithRule({
      id: "r1", label: "Mortgage", amount: 1000, type: "expense", categoryId: "c-groceries",
      frequency: "monthly", startDate: "2026-01-31", nextDueDate: "2026-02-28", dueDay: 31, addedBy: "u-user1",
    });
    await settle();
    fireEvent.click(screen.getByTestId("nav-recurring"));
    fireEvent.click(screen.getByTestId("post-due"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.recurring[0].nextDueDate).toBe("2026-03-31");
  });

  // Rules saved before the anchor existed pick it up from wherever they are.
  test("a legacy rule with no anchor backfills one when it is posted", async () => {
    jest.setSystemTime(new Date("2026-02-15T00:00:00Z"));
    const onSave = renderWithRule({
      id: "r1", label: "Rent", amount: 500, type: "expense", categoryId: "c-groceries",
      frequency: "monthly", startDate: "2026-01-30", nextDueDate: "2026-01-30", addedBy: "u-user1",
    });
    await settle();
    fireEvent.click(screen.getByTestId("nav-recurring"));
    fireEvent.click(screen.getByTestId("post-due"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.recurring[0].dueDay).toBe(30);
    expect(saved.recurring[0].nextDueDate).toBe("2026-02-28");
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

// ─────────────────────────────────────────────────────────────────────────────
// Money-movement integrity (DEF-004, DEF-005, DEF-010)
//
// The rule these all serve: household money = unallocatedBalance + the sum of
// every envelopeBalance. Nothing but adding or removing a real transaction may
// change that total, and nothing may move money between the two halves without
// telling the user first. Each test asserts the total AND the distribution,
// because two of these defects conserve the total while quietly relocating the
// money — a total-only check would pass on the broken code.
// ─────────────────────────────────────────────────────────────────────────────
describe("Money movement integrity", () => {
  const salary = { id: "c-inc", name: "Salary", type: "income", colour: "#7FB069", monthlyBudget: null };
  // The protected envelope orphaned items are reassigned to, spelled out here so
  // the test pins the id rather than borrowing the app's own constant.
  const INCIDENTALS = { id: "c-incidentals", name: "Household Incidentals", type: "expense", colour: "#9CA3AF", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, protected: true };
  const envelope = (id, name, balance, base = 100) =>
    ({ id, name, type: "expense", colour: "#7FB069", baseAmount: base, envelopeBalance: balance, isAccumulating: false });

  // Household total as the app itself defines it, read off a persisted payload.
  const householdTotal = (saved) =>
    saved.categories.reduce((s, c) => s + (c.envelopeBalance || 0), 0) + saved.unallocatedBalance;

  const balanceOf = (saved, id) => saved.categories.find((c) => c.id === id).envelopeBalance;
  const lastSave = (onSave) => onSave.mock.calls[onSave.mock.calls.length - 1][0];

  function renderWith(data) {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{ users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [], reconcileLog: [], ...data }}
      />
    );
    return onSave;
  }

  // ── DEF-004 ───────────────────────────────────────────────────────────────
  describe("editing an allocated income transaction", () => {
    const incomeTx = (allocations, amount) => ({
      id: "t-inc", date: "2026-06-01", amount, type: "income", categoryId: "c-inc",
      description: "Payslip", isRecurring: false, recurringId: null, allocations,
      addedBy: "u-user1", createdAt: "2026-06-01T00:00:00Z",
    });

    // Retype only the description and save. Nothing about the money changed, so
    // nothing about the money may move.
    const editDescription = (text) => {
      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.click(within(screen.getByTestId("tx-row-t-inc")).getByText("Edit"));
      const form = screen.getByTestId("tx-form");
      fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: text } });
      fireEvent.click(within(form).getByTestId("tx-save"));
    };

    test("changing only the description leaves a single-envelope allocation where it is", async () => {
      const onSave = renderWith({
        unallocatedBalance: 50,
        categories: [salary, envelope("c-a", "Rent", 300), envelope("c-b", "Food", 200)],
        transactions: [incomeTx([{ catId: "c-a", amount: 300 }], 300)],
      });
      await settle();
      editDescription("Payslip — June");

      const saved = lastSave(onSave);
      expect(saved.transactions.find((t) => t.id === "t-inc").description).toBe("Payslip — June");
      expect(balanceOf(saved, "c-a")).toBe(300);
      expect(balanceOf(saved, "c-b")).toBe(200);
      expect(saved.unallocatedBalance).toBe(50);
      expect(householdTotal(saved)).toBe(550);
    });

    test("the allocation survives a round trip through the form as an allocation, not just a balance", async () => {
      const onSave = renderWith({
        unallocatedBalance: 50,
        categories: [salary, envelope("c-a", "Rent", 300)],
        transactions: [incomeTx([{ catId: "c-a", amount: 300 }], 300)],
      });
      await settle();
      editDescription("Payslip — June");

      const saved = lastSave(onSave);
      expect(saved.transactions.find((t) => t.id === "t-inc").allocations).toEqual([{ catId: "c-a", amount: 300 }]);
    });

    test("changing only the description leaves a multi-envelope split intact", async () => {
      const onSave = renderWith({
        unallocatedBalance: 0,
        categories: [salary, envelope("c-a", "Rent", 300), envelope("c-b", "Food", 200)],
        transactions: [incomeTx([{ catId: "c-a", amount: 300 }, { catId: "c-b", amount: 200 }], 500)],
      });
      await settle();
      editDescription("Payslip — June");

      const saved = lastSave(onSave);
      expect(balanceOf(saved, "c-a")).toBe(300);
      expect(balanceOf(saved, "c-b")).toBe(200);
      expect(saved.unallocatedBalance).toBe(0);
      expect(householdTotal(saved)).toBe(500);
      expect(saved.transactions.find((t) => t.id === "t-inc").allocations)
        .toEqual([{ catId: "c-a", amount: 300 }, { catId: "c-b", amount: 200 }]);
    });

    test("clearing the envelope select returns a single allocation to unallocated", async () => {
      const onSave = renderWith({
        unallocatedBalance: 50,
        categories: [salary, envelope("c-a", "Rent", 300)],
        transactions: [incomeTx([{ catId: "c-a", amount: 300 }], 300)],
      });
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.click(within(screen.getByTestId("tx-row-t-inc")).getByText("Edit"));
      const form = screen.getByTestId("tx-form");
      // The select must show the envelope the money is actually in…
      expect(within(form).getByTestId("tx-allocate-envelope")).toHaveValue("c-a");
      // …and clearing it is the one way to pull the money back out.
      fireEvent.change(within(form).getByTestId("tx-allocate-envelope"), { target: { value: "" } });
      fireEvent.click(within(form).getByTestId("tx-save"));

      const saved = lastSave(onSave);
      expect(balanceOf(saved, "c-a")).toBe(0);
      expect(saved.unallocatedBalance).toBe(350);
      expect(householdTotal(saved)).toBe(350);
    });
  });

  // ── DEF-005 ───────────────────────────────────────────────────────────────
  describe("deleting an envelope that holds money", () => {
    const openDelete = (catId) => {
      fireEvent.click(screen.getByTestId("nav-categories"));
      fireEvent.click(within(document.querySelector(`[data-env-id="${catId}"]`)).getByText("Edit"));
      fireEvent.click(screen.getByText("Delete envelope"));
    };

    test("a positive balance is returned to unallocated, and the dialog says so", async () => {
      const onSave = renderWith({
        unallocatedBalance: 100,
        categories: [envelope("c-a", "Holiday", 250), envelope("c-b", "Food", 80)],
      });
      await settle();
      openDelete("c-a");

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent(/\$250\.00/);
      expect(dialog).toHaveTextContent(/[Uu]nallocated/);
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();

      const saved = lastSave(onSave);
      expect(saved.categories.some((c) => c.id === "c-a")).toBe(false);
      expect(saved.unallocatedBalance).toBe(350);
      expect(householdTotal(saved)).toBe(430); // 100 + 250 + 80, unchanged
    });

    test("an overdrawn envelope takes its shortfall out of unallocated, and the dialog says so", async () => {
      const onSave = renderWith({
        unallocatedBalance: 100,
        categories: [envelope("c-a", "Car repairs", -75), envelope("c-b", "Food", 80)],
      });
      await settle();
      openDelete("c-a");

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent(/\$75\.00/);
      expect(dialog).toHaveTextContent(/[Uu]nallocated/);
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();

      const saved = lastSave(onSave);
      expect(saved.categories.some((c) => c.id === "c-a")).toBe(false);
      expect(saved.unallocatedBalance).toBe(25);
      expect(householdTotal(saved)).toBe(105); // 100 - 75 + 80, unchanged
    });

    test("a balance is carried across even when transactions have to be reassigned", async () => {
      const onSave = renderWith({
        unallocatedBalance: 0,
        categories: [envelope("c-a", "Holiday", 250), { ...INCIDENTALS, envelopeBalance: 40 }],
        transactions: [
          { id: "t1", date: "2026-06-02", amount: 10, type: "expense", categoryId: "c-a", description: "Sunscreen", isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: "2026-06-02T00:00:00Z" },
        ],
      });
      await settle();
      openDelete("c-a");

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent(/\$250\.00/);
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();

      const saved = lastSave(onSave);
      expect(saved.transactions[0].categoryId).toBe("c-incidentals");
      expect(saved.unallocatedBalance).toBe(250);
      expect(householdTotal(saved)).toBe(290); // 250 + 40, unchanged
    });

    test("cancelling the dialog moves nothing", async () => {
      const onSave = renderWith({
        unallocatedBalance: 100,
        categories: [envelope("c-a", "Holiday", 250)],
      });
      await settle();
      openDelete("c-a");

      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByText("Cancel"));
      await settle();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // ── DEF-010 ───────────────────────────────────────────────────────────────
  describe("filling a single envelope past the unallocated balance", () => {
    const clickFill = (catId) => {
      fireEvent.click(screen.getByTestId("nav-categories"));
      fireEvent.click(within(document.querySelector(`[data-env-id="${catId}"]`)).getByText("Fill"));
    };

    test("warns before driving unallocated negative, and does nothing if declined", async () => {
      const onSave = renderWith({
        unallocatedBalance: 40,
        categories: [envelope("c-a", "Rent", 0, 100)],
      });
      await settle();
      clickFill("c-a");

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent(/[Uu]nallocated/);
      fireEvent.click(within(dialog).getByText("Cancel"));
      await settle();
      expect(onSave).not.toHaveBeenCalled();
    });

    test("proceeds when confirmed, conserving the household total", async () => {
      const onSave = renderWith({
        unallocatedBalance: 40,
        categories: [envelope("c-a", "Rent", 0, 100)],
      });
      await settle();
      clickFill("c-a");

      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();

      const saved = lastSave(onSave);
      expect(balanceOf(saved, "c-a")).toBe(100);
      expect(saved.unallocatedBalance).toBe(-60);
      expect(householdTotal(saved)).toBe(40); // unchanged
    });

    test("a fill that the unallocated balance covers asks nothing", async () => {
      const onSave = renderWith({
        unallocatedBalance: 500,
        categories: [envelope("c-a", "Rent", 0, 100)],
      });
      await settle();
      clickFill("c-a");
      await settle();

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      const saved = lastSave(onSave);
      expect(balanceOf(saved, "c-a")).toBe(100);
      expect(saved.unallocatedBalance).toBe(400);
      expect(householdTotal(saved)).toBe(500);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Transaction history and range reports
//
// TransactionsView used to hard-filter every row to `activeMonth`, the global
// month the header selector sets and every other view shares. Opening an
// envelope therefore showed only what was spent in the month currently being
// viewed, and the only way to see anything older was to move the global month —
// which moved the Dashboard, Envelopes and Recurring views with it.
//
// The whole history is already in the data (every transaction carries a full ISO
// date), so these tests span a year boundary (Nov 2025 → Jun 2026) to pin month
// ordering and grouping rather than just "two adjacent months happen to work".
// ─────────────────────────────────────────────────────────────────────────────
describe("Transaction history and range reports", () => {
  const groceries = { id: "c-groceries", name: "Groceries", type: "expense", colour: "#7FB069", baseAmount: 400, envelopeBalance: 400, isAccumulating: false };
  const fuel = { id: "c-fuel", name: "Fuel", type: "expense", colour: "#5F8A4F", baseAmount: 200, envelopeBalance: 200, isAccumulating: false };

  const shop = (id, date, amount, description, categoryId = "c-groceries") => ({
    id, date, amount, type: "expense", categoryId, description,
    isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: `${date}T00:00:00Z`,
  });

  // Six Groceries months, newest first, crossing from 2025 into 2026. The clock
  // is pinned to 2026-06-15 (jest.setup.js), so "2026-06" is the active month.
  const history = [
    shop("t-jun", "2026-06-02", 60, "June shop"),
    shop("t-may", "2026-05-04", 55, "May shop"),
    shop("t-feb", "2026-02-10", 40, "February shop"),
    shop("t-jan", "2026-01-08", 35, "January shop"),
    shop("t-dec", "2025-12-20", 30, "December shop"),
    shop("t-nov", "2025-11-15", 25, "November shop"),
    shop("t-fuel", "2026-02-11", 90, "Petrol", "c-fuel"),
  ];

  const renderHistory = (extra = {}) =>
    renderApp({ categories: [groceries, fuel], transactions: history, ...extra });

  // The Dashboard envelope row is the stakeholder's entry point: tap Groceries.
  const openGroceriesFromDashboard = () => fireEvent.click(screen.getByText("Groceries"));

  const rowIds = () =>
    Array.from(document.querySelectorAll("[data-testid^='tx-row-']"))
      .map((el) => el.getAttribute("data-testid").replace("tx-row-", ""));

  describe("envelope drill-down", () => {
    test("tapping Groceries shows earlier months, not only the active one", async () => {
      renderHistory();
      await settle();
      openGroceriesFromDashboard();

      // The active month was always reachable…
      expect(screen.getByTestId("tx-row-t-jun")).toBeInTheDocument();
      // …these were not: they are in earlier months, and the view hard-filtered
      // every row to the global active month.
      expect(screen.getByTestId("tx-row-t-may")).toBeInTheDocument();
      expect(screen.getByTestId("tx-row-t-feb")).toBeInTheDocument();
      // Another envelope's spending never leaks in.
      expect(screen.queryByTestId("tx-row-t-fuel")).not.toBeInTheDocument();
    });

    test("months are headed and subtotalled, newest first, across the year boundary", async () => {
      renderHistory();
      await settle();
      openGroceriesFromDashboard();
      fireEvent.click(screen.getByTestId("tx-load-more"));

      const headings = Array.from(document.querySelectorAll("[data-testid^='tx-month-heading-']"))
        .map((el) => el.getAttribute("data-testid").replace("tx-month-heading-", ""));
      expect(headings).toEqual(["2026-06", "2026-05", "2026-02", "2026-01", "2025-12", "2025-11"]);

      expect(screen.getByTestId("tx-month-heading-2026-02")).toHaveTextContent("February 2026");
      expect(screen.getByTestId("tx-month-total-2026-02")).toHaveTextContent("$40.00");
      expect(screen.getByTestId("tx-month-total-2025-11")).toHaveTextContent("$25.00");
    });

    test("the global month selector is not touched by the drill-down", async () => {
      renderHistory();
      await settle();
      expect(screen.getByTestId("month-select")).toHaveValue("2026-06");
      openGroceriesFromDashboard();

      expect(screen.getByTestId("tx-row-t-feb")).toBeInTheDocument();
      expect(screen.getByTestId("month-select")).toHaveValue("2026-06");
    });
  });

  // The escape hatch belongs to the transactions list alone. A Dashboard that
  // quietly started reporting all-time spending would look plausible and be
  // wrong, so its month gate is asserted in both directions.
  describe("the Dashboard still obeys the global month", () => {
    const groceriesRow = () => screen.getByText("Groceries").closest(".byb-hover-row");

    test("it reports the selected month's spend, and follows the selector when it moves", async () => {
      renderHistory();
      await settle();
      expect(within(groceriesRow()).getByText("$60.00")).toBeInTheDocument(); // June

      fireEvent.change(screen.getByTestId("month-select"), { target: { value: "2026-02" } });
      expect(within(groceriesRow()).getByText("$40.00")).toBeInTheDocument(); // February
      expect(within(groceriesRow()).queryByText("$60.00")).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId("month-select"), { target: { value: "2026-03" } });
      expect(within(groceriesRow()).getByText("$0.00")).toBeInTheDocument(); // nothing in March
    });

    test("visiting an envelope's history and coming back leaves the Dashboard on the month", async () => {
      renderHistory();
      await settle();
      openGroceriesFromDashboard();
      fireEvent.click(screen.getByTestId("tx-load-more"));
      expect(screen.getByTestId("tx-row-t-nov")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("nav-dashboard"));
      expect(within(groceriesRow()).getByText("$60.00")).toBeInTheDocument();
    });
  });

  describe("progressive loading", () => {
    test("the initial render is bounded and older months arrive on demand", async () => {
      renderHistory();
      await settle();
      openGroceriesFromDashboard();

      // Three newest months only — the older three are not in the DOM at all,
      // so this is a real bound and not a hidden-by-CSS pretence.
      expect(rowIds()).toEqual(["t-jun", "t-may", "t-feb"]);
      expect(document.querySelectorAll("[data-testid^='tx-month-heading-']")).toHaveLength(3);
      expect(screen.queryByTestId("tx-row-t-nov")).not.toBeInTheDocument();
      expect(screen.getByTestId("tx-load-more")).toHaveTextContent("3");

      fireEvent.click(screen.getByTestId("tx-load-more"));
      expect(rowIds()).toEqual(["t-jun", "t-may", "t-feb", "t-jan", "t-dec", "t-nov"]);
      expect(screen.queryByTestId("tx-load-more")).not.toBeInTheDocument();
    });

    // The bound has to hold against a real history, not just a six-row fixture.
    test("two years of history still render three months on first paint", async () => {
      // One shop a month, 2026-06 walking back to 2024-07.
      const long = [];
      for (let i = 0; i < 24; i++) {
        let y = 2026;
        let m = 6 - i;
        while (m <= 0) { m += 12; y -= 1; }
        long.push(shop(`t-${i}`, `${y}-${String(m).padStart(2, "0")}-05`, 10 + i, `Shop ${i}`));
      }
      renderApp({ categories: [groceries, fuel], transactions: long });
      await settle();
      openGroceriesFromDashboard();

      expect(document.querySelectorAll("[data-testid^='tx-row-']")).toHaveLength(3);
      expect(document.querySelectorAll("[data-testid^='tx-month-heading-']")).toHaveLength(3);
      expect(screen.getByTestId("tx-load-more")).toHaveTextContent("21 more");
    });

    // On a phone the control loads itself when it scrolls into view. jsdom has no
    // IntersectionObserver, so the button is what the suite otherwise exercises;
    // this stubs one in to pin the scroll path too.
    test("scrolling the control into view loads the next page without a click", async () => {
      let fire;
      const observe = jest.fn();
      global.IntersectionObserver = class {
        constructor(cb) { fire = cb; }
        observe(...args) { observe(...args); }
        disconnect() {}
      };
      try {
        renderHistory();
        await settle();
        openGroceriesFromDashboard();
        expect(rowIds()).toHaveLength(3);
        expect(observe).toHaveBeenCalled();

        act(() => { fire([{ isIntersecting: true }]); });
        expect(rowIds()).toEqual(["t-jun", "t-may", "t-feb", "t-jan", "t-dec", "t-nov"]);
      } finally {
        delete global.IntersectionObserver;
      }
    });
  });

  describe("custom date-range report", () => {
    const setRange = (start, end) => {
      fireEvent.change(screen.getByTestId("tx-range-start"), { target: { value: start } });
      fireEvent.change(screen.getByTestId("tx-range-end"), { target: { value: end } });
    };
    const chooseGroceries = () =>
      fireEvent.change(screen.getByTestId("tx-filter-category"), { target: { value: "c-groceries" } });

    test("both boundaries are inclusive, and the range total is shown", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      chooseGroceries();
      // Exactly on t-jan's date and exactly on t-may's date.
      setRange("2026-01-08", "2026-05-04");

      expect(rowIds()).toEqual(["t-may", "t-feb", "t-jan"]);
      expect(screen.queryByTestId("tx-row-t-dec")).not.toBeInTheDocument();
      expect(screen.queryByTestId("tx-row-t-jun")).not.toBeInTheDocument();
      // 55 + 40 + 35
      expect(screen.getByTestId("filter-expense")).toHaveTextContent("$130.00");
    });

    test("an inverted range collapses to the start day rather than showing nothing arbitrary", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      chooseGroceries();
      setRange("2026-05-04", "2026-01-08");

      expect(rowIds()).toEqual(["t-may"]);
    });

    test("a range with nothing in it says so", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      chooseGroceries();
      setRange("2026-03-01", "2026-04-30");

      expect(rowIds()).toEqual([]);
      expect(screen.getByText("No transactions match the current filter.")).toBeInTheDocument();
      expect(screen.getByTestId("filter-expense")).toHaveTextContent("$0.00");
    });

    test("a range beats the global month without changing it", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      setRange("2025-11-01", "2025-12-31");

      expect(rowIds()).toEqual(["t-dec", "t-nov"]);
      expect(screen.getByTestId("month-select")).toHaveValue("2026-06");
    });
  });

  // jsdom has no matchMedia, so useIsMobile reports desktop and everything above
  // exercises the table. The phone is the primary interface for this app, and
  // the card list is a separate branch of the same component, so it gets its own
  // pass over the same behaviour.
  describe("on a phone", () => {
    beforeEach(() => {
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: true, media: query, onchange: null,
        addEventListener: jest.fn(), removeEventListener: jest.fn(),
        addListener: jest.fn(), removeListener: jest.fn(), dispatchEvent: jest.fn(),
      }));
    });
    afterEach(() => { delete window.matchMedia; });

    test("the card list groups into months, subtotals them, and pages", async () => {
      renderHistory();
      await settle();
      openGroceriesFromDashboard();

      expect(rowIds()).toEqual(["t-jun", "t-may", "t-feb"]);
      expect(screen.getByTestId("tx-month-heading-2026-02")).toHaveTextContent("February 2026");
      expect(screen.getByTestId("tx-month-total-2026-02")).toHaveTextContent("$40.00");

      fireEvent.click(screen.getByTestId("tx-load-more"));
      expect(rowIds()).toEqual(["t-jun", "t-may", "t-feb", "t-jan", "t-dec", "t-nov"]);
      expect(screen.getByTestId("tx-month-heading-2025-11")).toHaveTextContent("November 2025");
    });

    test("the date range is reachable from the mobile filter panel", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.click(screen.getByText("Filter"));
      fireEvent.change(screen.getByTestId("tx-filter-category"), { target: { value: "c-groceries" } });
      fireEvent.change(screen.getByTestId("tx-range-start"), { target: { value: "2026-01-08" } });
      fireEvent.change(screen.getByTestId("tx-range-end"), { target: { value: "2026-05-04" } });

      expect(rowIds()).toEqual(["t-may", "t-feb", "t-jan"]);
      expect(screen.getByTestId("filter-expense")).toHaveTextContent("$130.00");
    });
  });

  describe("defaults are unchanged", () => {
    test("with no category and no range the list is still the active month alone", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));

      expect(rowIds()).toEqual(["t-jun"]);
      expect(document.querySelectorAll("[data-testid^='tx-month-heading-']")).toHaveLength(0);
    });

    test("moving the global month moves the default list with it", async () => {
      renderHistory();
      await settle();
      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.change(screen.getByTestId("month-select"), { target: { value: "2026-02" } });

      expect(rowIds()).toEqual(["t-fuel", "t-feb"]);
    });
  });
});
