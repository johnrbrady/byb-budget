import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BudgetApp from "./BudgetApp.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// DEF-013 — the first-time wizard used to create money out of nothing.
//
// It set every envelope's balance to its base amount and deducted nothing,
// so `unallocatedBalance + Σ envelopeBalance` rose by the sum of every base
// amount — twenty envelopes at $500 invented $10,000 — with no record of it
// anywhere in the file. The household total was simply larger than it had been,
// and nothing could explain why.
//
// The money was never the error. A household adopting this app mid-life really
// does hold money against these envelopes; it is in their bank account. Doing it
// silently was. So setup now says what it is about to do, asks, and writes the
// answer down.
//
// These tests are about the arithmetic and the record. The wizard's own
// collection of amounts is unchanged and is not what is under test here; what is
// under test is what happens to the household's money when it finishes.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
  );
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("byb_token", "test-token");
  localStorage.setItem("byb_user", "u-user1");
  localStorage.setItem("byb_welcomed", "1");
  localStorage.setItem("byb_named_u-user1", "1");
  global.fetch.mockClear();
});

const baseUsers = [{ id: "u-user1", name: "Tester", role: "owner", colour: "#7FB069", hasSeenWelcome: true }];

// A fresh envelope, as a household starting out has them: no base amount and no
// balance. That is what makes the Envelopes tab offer the wizard at all.
const env = (id, name, extra = {}) => ({
  id, name, type: "expense", colour: "#7FB069",
  baseAmount: 0, envelopeBalance: 0, isAccumulating: false, ...extra,
});

const salary = { id: "c-inc", name: "Salary", type: "income", colour: "#7FB069", monthlyBudget: null };

async function settle() {
  await act(async () => { await Promise.resolve(); });
}

// The household total, computed here rather than imported, so a bug in
// money.js's own householdTotal cannot make these assertions agree with the code
// they are checking.
const householdTotalOf = ({ categories, unallocatedBalance }) =>
  (categories || []).reduce((s, c) => s + (c.envelopeBalance || 0), 0) + (unallocatedBalance || 0);

const balanceOf = (saved, id) => saved.categories.find((c) => c.id === id).envelopeBalance;
const baseOf = (saved, id) => saved.categories.find((c) => c.id === id).baseAmount;

// What the app would report as this month's income — the same expression
// server.js's /api/integrations/summary uses, and the same one txQuery's totals()
// and the Reports trend are built on.
const incomeReported = (saved) =>
  (saved.transactions || []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

function renderFresh(onSave, extra = {}) {
  return render(
    <BudgetApp
      onSave={onSave}
      initialData={{
        users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [],
        reconcileLog: [], unallocatedBalance: 0,
        categories: [salary, env("c-a", "Alpha"), env("c-b", "Bravo")],
        ...extra,
      }}
    />
  );
}

// ── Driving the wizard ───────────────────────────────────────────────────────
//
// The wizard shows the envelope it is on as a bold 15px name inside its panel,
// and offers Next until the last one, then Finish. BudgetApp always injects the
// two protected envelopes, so the walk covers four: Alpha, Bravo, Household
// Incidentals and Savings. Anything not named in `amounts` is left blank, which
// is how a real household leaves the envelopes it does not use.
const wizardPanel = () => screen.getByText("Fill one by one").closest(".byb-panel");

const currentEnvelope = () => {
  const nameSpan = Array.from(wizardPanel().querySelectorAll("span"))
    .find((s) => s.style.fontWeight === "700" && s.style.fontSize === "15px");
  return nameSpan ? nameSpan.textContent : null;
};

const openWizard = () => {
  fireEvent.click(screen.getByTestId("nav-categories"));
  fireEvent.click(screen.getByText("Fill Envelopes"));
};

function runWizard(amounts) {
  openWizard();
  fireEvent.click(screen.getByText("Fill one by one"));
  for (let guard = 0; guard < 40; guard++) {
    const name = currentEnvelope();
    if (amounts[name] !== undefined) {
      fireEvent.change(wizardPanel().querySelector('input[placeholder="0.00"]'), {
        target: { value: String(amounts[name]) },
      });
    }
    const next = screen.queryByText("Next");
    if (next) { fireEvent.click(next); continue; }
    fireEvent.click(screen.getByText("Finish"));
    return;
  }
  throw new Error("the wizard never reached its last step");
}

const lastSave = (onSave) => {
  if (onSave.mock.calls.length === 0) throw new Error("nothing was persisted");
  return onSave.mock.calls[onSave.mock.calls.length - 1][0];
};

describe("First-time setup: opening balances", () => {
  describe("when the household says the money is already there", () => {
    let onSave;
    let saved;

    beforeEach(async () => {
      onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      runWizard({ Alpha: 500, Bravo: 300 });
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();
      saved = lastSave(onSave);
    });

    // The invariant, asserted directly. Before is zero because a household
    // arriving at the wizard has nothing in the app yet; after must be the
    // recorded total and not a cent more.
    test("the household total moves by exactly the amount recorded", () => {
      const recorded = saved.adjustments[0];
      expect(householdTotalOf(saved)).toBe(800);
      expect(recorded.amount).toBe(800);
      expect(householdTotalOf(saved) - 0).toBe(recorded.amount);
    });

    // A bug can conserve the total while putting the money in the wrong
    // envelope, so the split is checked envelope by envelope against the record
    // rather than only in aggregate.
    test("every envelope holds what the record says it was given", () => {
      const recorded = saved.adjustments[0];
      expect(recorded.entries).toEqual([
        { catId: "c-a", before: 0, amount: 500, after: 500 },
        { catId: "c-b", before: 0, amount: 300, after: 300 },
      ]);
      for (const e of recorded.entries) expect(balanceOf(saved, e.catId)).toBe(e.amount);
      expect(balanceOf(saved, "c-a")).toBe(500);
      expect(balanceOf(saved, "c-b")).toBe(300);
    });

    test("unallocated is untouched — the money is declared as sitting in the envelopes", () => {
      expect(saved.unallocatedBalance).toBe(0);
    });

    test("envelopes left blank in the wizard are given nothing and recorded as nothing", () => {
      expect(balanceOf(saved, "c-incidentals")).toBe(0);
      expect(balanceOf(saved, "c-savings")).toBe(0);
      expect(saved.adjustments[0].entries.map((e) => e.catId)).toEqual(["c-a", "c-b"]);
    });

    // The budget and the balance are two different things. The old code set them
    // from one number and that is where the conflation started.
    test("the base amounts the wizard collected are still set", () => {
      expect(baseOf(saved, "c-a")).toBe(500);
      expect(baseOf(saved, "c-b")).toBe(300);
      expect(saved.categories.find((c) => c.id === "c-a").monthlyBudget).toBe(500);
    });

    // The whole reason this is not an income transaction.
    test("it is not income: no transaction is written and reported income stays zero", () => {
      expect(saved.transactions).toEqual([]);
      expect(incomeReported(saved)).toBe(0);
    });

    test("the record says when it happened and who did it", () => {
      const recorded = saved.adjustments[0];
      expect(recorded.date).toBe("2026-06-15");
      expect(recorded.userId).toBe("u-user1");
      expect(recorded.id).toEqual(expect.any(String));
      expect(recorded.at).toEqual(expect.any(String));
    });

    test("the toast says what happened, with the amount", () => {
      expect(screen.getByTestId("toast")).toHaveTextContent("$800.00 opening balance recorded");
    });
  });

  describe("when the household says the money is not there yet", () => {
    let onSave;
    let saved;

    beforeEach(async () => {
      onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      runWizard({ Alpha: 500, Bravo: 300 });
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByText("Start empty"));
      await settle();
      saved = lastSave(onSave);
    });

    test("nothing enters the budget at all", () => {
      expect(householdTotalOf(saved)).toBe(0);
      expect(balanceOf(saved, "c-a")).toBe(0);
      expect(balanceOf(saved, "c-b")).toBe(0);
      expect(saved.unallocatedBalance).toBe(0);
    });

    test("the budget is still set up, so the trip through the wizard was not wasted", () => {
      expect(baseOf(saved, "c-a")).toBe(500);
      expect(baseOf(saved, "c-b")).toBe(300);
    });

    test("nothing is recorded, because nothing happened", () => {
      expect(saved.adjustments).toEqual([]);
      expect(saved.transactions).toEqual([]);
    });

    test("the toast does not claim the envelopes were filled", () => {
      expect(screen.getByTestId("toast")).toHaveTextContent("balances start empty");
      expect(screen.getByTestId("toast")).not.toHaveTextContent(/filled/i);
    });
  });

  describe("the question itself", () => {
    test("states the exact total before the user agrees to it", async () => {
      const onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      runWizard({ Alpha: 500, Bravo: 300 });

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Your envelopes add up to $800.00");
      expect(within(dialog).getByTestId("confirm-ok")).toHaveTextContent("Yes, open with $800.00");
      expect(within(dialog).getByText("Start empty")).toBeInTheDocument();
    });

    // Backing out has to be the outcome that moves no money, because it is what
    // Escape and a stray tap on the ground both do.
    test("dismissing it with Escape leaves the envelopes empty", async () => {
      const onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      runWizard({ Alpha: 500, Bravo: 300 });
      await screen.findByRole("alertdialog");

      fireEvent.keyDown(document, { key: "Escape" });
      await settle();

      const saved = lastSave(onSave);
      expect(householdTotalOf(saved)).toBe(0);
      expect(saved.adjustments).toEqual([]);
      expect(baseOf(saved, "c-a")).toBe(500);
    });

    // Nothing is committed while the question is on screen. Until it is
    // answered, the household's money has not moved and neither has its budget.
    test("nothing is persisted until it is answered", async () => {
      const onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      onSave.mockClear();
      runWizard({ Alpha: 500, Bravo: 300 });
      await screen.findByRole("alertdialog");

      expect(onSave).not.toHaveBeenCalled();
    });

    // A household that walks the wizard entering nothing is stating a budget of
    // zero, not asking for a dialog about $0.00.
    test("a setup with no amounts at all is not worth asking about", async () => {
      const onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      runWizard({});
      await settle();

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      const saved = lastSave(onSave);
      expect(householdTotalOf(saved)).toBe(0);
      expect(saved.adjustments).toEqual([]);
      expect(screen.getByTestId("toast")).toHaveTextContent("Envelopes set up");
    });
  });

  // The wizard has two ways in and they must not disagree about money.
  describe("the automatic mode goes through the same gate", () => {
    test("suggested amounts are opened only once the household confirms them", async () => {
      const onSave = jest.fn();
      render(
        <BudgetApp
          onSave={onSave}
          initialData={{
            users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [],
            reconcileLog: [], unallocatedBalance: 0,
            categories: [
              salary,
              env("c-a", "Alpha", { suggestedPct: 40 }),
              env("c-b", "Bravo", { suggestedPct: 10 }),
            ],
          }}
        />
      );
      await settle();
      openWizard();
      fireEvent.click(screen.getByText("Fill automatically"));

      const panel = screen.getByText("Fill automatically").closest(".byb-panel");
      fireEvent.change(panel.querySelector('input[placeholder="e.g. 8000"]'), { target: { value: "1000" } });
      fireEvent.click(screen.getByText("Apply"));

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Your envelopes add up to $500.00"); // 40% + 10% of 1000
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();

      const saved = lastSave(onSave);
      expect(householdTotalOf(saved)).toBe(500);
      expect(saved.adjustments[0].amount).toBe(500);
      expect(saved.adjustments[0].entries).toEqual([
        { catId: "c-a", before: 0, amount: 400, after: 400 },
        { catId: "c-b", before: 0, amount: 100, after: 100 },
      ]);
      expect(balanceOf(saved, "c-a")).toBe(400);
      expect(balanceOf(saved, "c-b")).toBe(100);
      expect(incomeReported(saved)).toBe(0);
    });
  });

  // A record that vanishes on the next save explains nothing.
  describe("the record persists", () => {
    test("it is still in the payload after an unrelated change", async () => {
      const onSave = jest.fn();
      renderFresh(onSave);
      await settle();
      runWizard({ Alpha: 500 });
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();

      // Spend from the envelope that was just opened.
      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.click(screen.getByTestId("add-tx"));
      const form = screen.getByTestId("tx-form");
      fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "120" } });
      fireEvent.change(within(form).getByTestId("tx-category"), { target: { value: "c-a" } });
      fireEvent.click(within(form).getByTestId("tx-save"));
      await settle();

      const saved = lastSave(onSave);
      expect(saved.adjustments).toHaveLength(1);
      expect(saved.adjustments[0].amount).toBe(500);
      // And the spend behaves like any other: it comes out of the envelope, so
      // the household total is the opening balance less what was spent.
      expect(balanceOf(saved, "c-a")).toBe(380);
      expect(householdTotalOf(saved)).toBe(380);
    });

    test("a record already in the file is carried forward, not dropped", async () => {
      const onSave = jest.fn();
      const existing = [{ id: "ob-1", date: "2026-01-01", at: "2026-01-01T00:00:00Z", userId: "u-user1", kind: "opening", before: 0, after: 40, amount: 40, entries: [{ catId: "c-a", before: 0, amount: 40, after: 40 }] }];
      renderFresh(onSave, { adjustments: existing, categories: [salary, env("c-a", "Alpha", { baseAmount: 100, envelopeBalance: 40 })] });
      await settle();

      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.click(screen.getByTestId("add-tx"));
      const form = screen.getByTestId("tx-form");
      fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "10" } });
      fireEvent.change(within(form).getByTestId("tx-category"), { target: { value: "c-a" } });
      fireEvent.click(within(form).getByTestId("tx-save"));
      await settle();

      expect(lastSave(onSave).adjustments).toEqual(existing);
    });

    // Nothing migrates. A file written before this existed has no such key and
    // must not grow one out of nowhere.
    test("a file with no record at all persists an empty list, not undefined", async () => {
      const onSave = jest.fn();
      renderFresh(onSave, { categories: [salary, env("c-a", "Alpha", { baseAmount: 100 })] });
      await settle();

      fireEvent.click(screen.getByTestId("nav-transactions"));
      fireEvent.click(screen.getByTestId("add-tx"));
      const form = screen.getByTestId("tx-form");
      fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "10" } });
      fireEvent.change(within(form).getByTestId("tx-category"), { target: { value: "c-a" } });
      fireEvent.click(within(form).getByTestId("tx-save"));
      await settle();

      expect(lastSave(onSave).adjustments).toEqual([]);
    });
  });
});
