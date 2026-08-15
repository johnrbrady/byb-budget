import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BudgetApp from "./BudgetApp.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// The last two unguarded ways to change the household's money.
//
// `resetAllBalances` zeroed every envelope and unallocated on the strength of a
// dialog that said the same words whether the household held nothing or held
// four thousand dollars — and wrote nothing down, so afterwards no report could
// say the money had ever existed. `setUnallocatedManually` overwrote the balance
// with no record at all.
//
// Both are legitimate features. Starting over is a real thing to want, and
// correcting against a bank statement is routine. What they lacked was the two
// things every other money movement in this app already has: a question that
// states what is at stake, and a record that survives it.
//
// The record's own integrity is the point of most of what follows. Every
// assertion about an adjustment is made against the balances as they actually
// are, not against a second copy of the app's arithmetic — a log that disagrees
// with the ledger is worse than no log, because it will be believed.
// ─────────────────────────────────────────────────────────────────────────────

// SettingsModal renders the Vite-injected __BUILD_TIME__, which does not exist
// under Jest. Everything in this file that reaches the reset button goes through
// that modal, so it is defined here rather than the tests being routed around
// the real UI.
global.__BUILD_TIME__ = "2026-06-15T09:00:00.000Z";

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

const env = (id, name, extra = {}) => ({
  id, name, type: "expense", colour: "#7FB069",
  baseAmount: 0, envelopeBalance: 0, isAccumulating: false, ...extra,
});

const salary = { id: "c-inc", name: "Salary", type: "income", colour: "#7FB069", monthlyBudget: null };

async function settle() { await act(async () => { await Promise.resolve(); }); }

// Computed here rather than imported, so a bug in money.js's householdTotal
// cannot make these assertions agree with the code they are checking.
const householdTotalOf = ({ categories, unallocatedBalance }) =>
  (categories || []).reduce((s, c) => s + (c.envelopeBalance || 0), 0) + (unallocatedBalance || 0);

const balanceOf = (saved, id) => saved.categories.find((c) => c.id === id).envelopeBalance;

const lastSave = (onSave) => {
  if (onSave.mock.calls.length === 0) throw new Error("nothing was persisted");
  return onSave.mock.calls[onSave.mock.calls.length - 1][0];
};

// A household with real money in it, the way the stakeholder's instance is:
// 640 + 110 + 0 in envelopes, 250 unallocated, $1,000 in all.
const liveHousehold = (extra = {}) => ({
  users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [],
  reconcileLog: [], unallocatedBalance: 250,
  categories: [
    salary,
    env("c-a", "Groceries", { baseAmount: 800, envelopeBalance: 640 }),
    env("c-b", "Fuel", { baseAmount: 300, envelopeBalance: 110 }),
    env("c-c", "Rates", { baseAmount: 500, envelopeBalance: 0 }),
  ],
  ...extra,
});

const renderApp = (onSave, data) => render(<BudgetApp onSave={onSave} initialData={data} />);

const openReset = () => {
  fireEvent.click(screen.getByTestId("settings-btn"));
  fireEvent.click(screen.getByText("Reset all balances to zero"));
};

const openUnallocatedEditor = () => {
  fireEvent.click(screen.getByTestId("nav-reports"));
  fireEvent.click(screen.getByText(/Edit Unallocated/));
};

const typeUnallocated = (value) => {
  fireEvent.change(document.querySelector('input[type="number"]'), { target: { value: String(value) } });
  fireEvent.click(screen.getByText("Set"));
};

// THE invariant, asserted against the real ledger either side rather than
// against the record's own account of itself.
const expectRecordExplainsMove = (entry, totalBefore, savedAfter) => {
  const totalAfter = householdTotalOf(savedAfter);
  expect(entry.before).toBe(totalBefore);
  expect(entry.after).toBe(totalAfter);
  expect(entry.amount).toBe(totalAfter - totalBefore);
};

describe("Resetting all balances", () => {
  describe("the question", () => {
    test("states what is actually about to be destroyed", async () => {
      renderApp(jest.fn(), liveHousehold());
      await settle();
      openReset();

      const dialog = await screen.findByRole("alertdialog");
      // Two of the three envelopes hold money; Rates holds nothing and is not
      // counted as though it did.
      expect(dialog).toHaveTextContent("2 envelopes hold $750.00");
      expect(dialog).toHaveTextContent("Unallocated holds $250.00");
      expect(dialog).toHaveTextContent("$1,000.00 in all");
      expect(dialog).toHaveTextContent("cannot be undone");
      expect(within(dialog).getByTestId("confirm-ok")).toHaveTextContent("Reset balances");
    });

    test("a single envelope holding money is not called envelopes", async () => {
      renderApp(jest.fn(), liveHousehold({
        unallocatedBalance: 0,
        categories: [salary, env("c-a", "Groceries", { envelopeBalance: 640 })],
      }));
      await settle();
      openReset();

      expect(await screen.findByRole("alertdialog")).toHaveTextContent("1 envelope holds $640.00");
    });

    // Declining is the outcome a stray tap and Escape both produce, so it is the
    // one that must move nothing.
    test("declining changes nothing, records nothing, and leaves Settings open", async () => {
      const onSave = jest.fn();
      renderApp(onSave, liveHousehold());
      await settle();
      onSave.mockClear();
      openReset();

      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByText("Cancel"));
      await settle();

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      // The balances on screen are still the household's own.
      fireEvent.click(screen.getByText("Close"));
      fireEvent.click(screen.getByTestId("nav-reports"));
      expect(screen.getByText(/Edit Unallocated \(\$250\.00\)/)).toBeInTheDocument();
    });

    test("Escape dismisses it the same way Cancel does", async () => {
      const onSave = jest.fn();
      renderApp(onSave, liveHousehold());
      await settle();
      onSave.mockClear();
      openReset();
      await screen.findByRole("alertdialog");

      fireEvent.keyDown(document, { key: "Escape" });
      await settle();

      expect(onSave).not.toHaveBeenCalled();
    });

    // A reset with nothing to destroy is not a question, and an entry saying
    // "$0.00 became $0.00" is a row in the log that says nothing.
    test("a household holding nothing is not asked, and nothing is recorded", async () => {
      const onSave = jest.fn();
      renderApp(onSave, liveHousehold({
        unallocatedBalance: 0,
        categories: [salary, env("c-a", "Groceries"), env("c-b", "Fuel")],
      }));
      await settle();
      onSave.mockClear();
      openReset();
      await settle();

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByTestId("toast")).toHaveTextContent("already zero");
    });
  });

  describe("the record, once it is confirmed", () => {
    let onSave;
    let saved;

    beforeEach(async () => {
      onSave = jest.fn();
      renderApp(onSave, liveHousehold());
      await settle();
      openReset();
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByTestId("confirm-ok"));
      await settle();
      saved = lastSave(onSave);
    });

    test("every balance really is zero", () => {
      expect(householdTotalOf(saved)).toBe(0);
      expect(saved.unallocatedBalance).toBe(0);
      expect(balanceOf(saved, "c-a")).toBe(0);
      expect(balanceOf(saved, "c-b")).toBe(0);
    });

    test("the amount recorded is the household total's actual change", () => {
      expect(saved.adjustments).toHaveLength(1);
      expectRecordExplainsMove(saved.adjustments[0], 1000, saved);
      expect(saved.adjustments[0].amount).toBe(-1000);
    });

    test("it says what it destroyed, envelope by envelope, matching the real balances", () => {
      const entry = saved.adjustments[0];
      expect(entry.kind).toBe("reset");
      expect(entry.entries).toEqual([
        { catId: "c-a", before: 640, amount: -640, after: 0 },
        { catId: "c-b", before: 110, amount: -110, after: 0 },
      ]);
      expect(entry.unallocated).toEqual({ before: 250, after: 0 });
      // The detail accounts for every cent of the household's move.
      const detailled = entry.entries.reduce((s, e) => s + e.amount, 0)
        + (entry.unallocated.after - entry.unallocated.before);
      expect(detailled).toBe(entry.amount);
    });

    test("an envelope that held nothing is not claimed to have lost anything", () => {
      expect(saved.adjustments[0].entries.map((e) => e.catId)).toEqual(["c-a", "c-b"]);
    });

    test("it says when it happened and who did it", () => {
      const entry = saved.adjustments[0];
      expect(entry.date).toBe("2026-06-15");
      expect(entry.userId).toBe("u-user1");
      expect(entry.id).toEqual(expect.any(String));
      expect(entry.at).toEqual(expect.any(String));
    });

    test("it is not a transaction — history is untouched, as the dialog promised", () => {
      expect(saved.transactions).toEqual([]);
      expect(saved.transfers).toEqual([]);
      expect(saved.reconcileLog).toEqual([]);
    });

    test("the toast says how much was cleared", () => {
      expect(screen.getByTestId("toast")).toHaveTextContent("$1,000.00 cleared");
    });
  });

  // Overdrawn envelopes are money already spent. Clearing them RAISES the
  // household total, and a record that assumed a reset can only destroy would
  // be wrong about the direction as well as the amount.
  test("a reset that clears an overdraft records a rise, not a fall", async () => {
    const onSave = jest.fn();
    renderApp(onSave, liveHousehold({
      unallocatedBalance: 0,
      categories: [salary, env("c-a", "Groceries", { envelopeBalance: 100 }), env("c-b", "Fuel", { envelopeBalance: -300 })],
    }));
    await settle();
    openReset();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByTestId("confirm-ok"));
    await settle();

    const saved = lastSave(onSave);
    expectRecordExplainsMove(saved.adjustments[0], -200, saved);
    expect(saved.adjustments[0].amount).toBe(200);
  });
});

describe("Setting the unallocated balance by hand", () => {
  // The everyday use: the app says $250.00, the bank says $263.40. Asking about
  // this every time is how a household learns to dismiss dialogs, which is
  // exactly what must not happen to the reset dialog.
  describe("a correction, below the threshold", () => {
    let onSave;
    let saved;

    beforeEach(async () => {
      onSave = jest.fn();
      renderApp(onSave, liveHousehold());
      await settle();
      openUnallocatedEditor();
      typeUnallocated(263.4);
      await settle();
      saved = lastSave(onSave);
    });

    test("is not confirmed", () => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    test("is recorded all the same, with the before and the after", () => {
      expect(saved.adjustments).toHaveLength(1);
      const entry = saved.adjustments[0];
      expect(entry.kind).toBe("set-unallocated");
      expect(entry.unallocated).toEqual({ before: 250, after: 263.4 });
      expect(entry.userId).toBe("u-user1");
      expect(entry.date).toBe("2026-06-15");
    });

    test("the amount recorded is the household total's actual change", () => {
      expect(saved.unallocatedBalance).toBe(263.4);
      expectRecordExplainsMove(saved.adjustments[0], 1000, saved);
      expect(saved.adjustments[0].amount).toBeCloseTo(13.4, 10);
    });

    test("no envelope moved, and the record does not pretend one did", () => {
      expect(balanceOf(saved, "c-a")).toBe(640);
      expect(saved.adjustments[0].entries).toEqual([]);
    });
  });

  describe("a restatement, at or above the threshold", () => {
    test("is confirmed, and the question states the change and the new total", async () => {
      renderApp(jest.fn(), liveHousehold());
      await settle();
      openUnallocatedEditor();
      typeUnallocated(9500);

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Unallocated goes from $250.00 to $9,500.00");
      expect(dialog).toHaveTextContent("add $9,250.00");
      expect(dialog).toHaveTextContent("from $1,000.00 to $10,250.00");
    });

    test("declining changes nothing and records nothing", async () => {
      const onSave = jest.fn();
      renderApp(onSave, liveHousehold());
      await settle();
      onSave.mockClear();
      openUnallocatedEditor();
      typeUnallocated(9500);

      fireEvent.click(within(await screen.findByRole("alertdialog")).getByText("Cancel"));
      await settle();

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText(/Edit Unallocated \(\$250\.00\)/)).toBeInTheDocument();
    });

    test("confirming records it, and the record matches the ledger", async () => {
      const onSave = jest.fn();
      renderApp(onSave, liveHousehold());
      await settle();
      openUnallocatedEditor();
      typeUnallocated(9500);
      fireEvent.click(within(await screen.findByRole("alertdialog")).getByTestId("confirm-ok"));
      await settle();

      const saved = lastSave(onSave);
      expect(saved.unallocatedBalance).toBe(9500);
      expectRecordExplainsMove(saved.adjustments[0], 1000, saved);
      expect(saved.adjustments[0].amount).toBe(9250);
      expect(saved.adjustments[0].unallocated).toEqual({ before: 250, after: 9500 });
    });

    // A reduction of the same size is the same size.
    test("a large reduction is confirmed too", async () => {
      renderApp(jest.fn(), liveHousehold());
      await settle();
      openUnallocatedEditor();
      typeUnallocated(0);

      expect(await screen.findByRole("alertdialog")).toHaveTextContent("remove $250.00");
    });

    // The line itself, from both sides — a threshold nobody has pinned down is
    // a threshold that drifts.
    test("the line is drawn at $100: $99.99 passes silently, $100 asks", async () => {
      renderApp(jest.fn(), liveHousehold());
      await settle();
      openUnallocatedEditor();
      typeUnallocated(349.99);
      await settle();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText(/Edit Unallocated/));
      typeUnallocated(449.99);
      expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    });
  });

  test("setting it to the balance it already holds records nothing", async () => {
    const onSave = jest.fn();
    renderApp(onSave, liveHousehold());
    await settle();
    onSave.mockClear();
    openUnallocatedEditor();
    typeUnallocated(250);
    await settle();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("toast")).toHaveTextContent("already");
  });
});

describe("The adjustments log as a whole", () => {
  // Every existing production file. Nothing migrates, and nothing appears from
  // nowhere.
  test("a file with no adjustment key loads and saves an empty list", async () => {
    const onSave = jest.fn();
    const data = liveHousehold();
    expect(data.adjustments).toBeUndefined();
    renderApp(onSave, data);
    await settle();

    openUnallocatedEditor();
    typeUnallocated(255);
    await settle();

    const saved = lastSave(onSave);
    expect(saved.adjustments).toHaveLength(1);
    expect(saved.openingBalances).toBeUndefined();
  });

  test("a file with no adjustment key shows the log as empty rather than breaking", async () => {
    renderApp(jest.fn(), liveHousehold());
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    expect(screen.getByTestId("adjustments-empty")).toBeInTheDocument();
  });

  // `openingBalances` was this log's predecessor and never reached a deployed
  // instance, so it is folded in on read rather than migrated. A household that
  // ran that build keeps its history; the key falls away on the next save.
  test("a legacy openingBalances record is folded in, not dropped", async () => {
    const onSave = jest.fn();
    const legacy = [{ id: "ob-1", date: "2026-01-01", at: "2026-01-01T00:00:00Z", userId: "u-user1", total: 40, entries: [{ catId: "c-a", amount: 40 }] }];
    renderApp(onSave, liveHousehold({ openingBalances: legacy }));
    await settle();

    openUnallocatedEditor();
    typeUnallocated(255);
    await settle();

    const saved = lastSave(onSave);
    expect(saved.openingBalances).toBeUndefined();
    const folded = saved.adjustments.find((a) => a.id === "ob-1");
    expect(folded.kind).toBe("opening");
    expect(folded.amount).toBe(40);
  });

  // Several adjustments in a row must still add up: the household total's whole
  // journey is the sum of what the log claims for it.
  test("a sequence of adjustments accounts for the whole move, newest first", async () => {
    const onSave = jest.fn();
    renderApp(onSave, liveHousehold());
    await settle();

    openUnallocatedEditor();
    typeUnallocated(9500);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByTestId("confirm-ok"));
    await settle();

    openReset();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByTestId("confirm-ok"));
    await settle();

    const saved = lastSave(onSave);
    expect(saved.adjustments.map((a) => a.kind)).toEqual(["reset", "set-unallocated"]);
    expect(householdTotalOf(saved)).toBe(0);
    // Started at $1,000, ended at $0, and the log accounts for the difference.
    expect(saved.adjustments.reduce((s, a) => s + a.amount, 0)).toBe(0 - 1000);
    // Each entry's after is the next one's before, read oldest-first.
    const oldestFirst = [...saved.adjustments].reverse();
    expect(oldestFirst[0].before).toBe(1000);
    expect(oldestFirst[0].after).toBe(oldestFirst[1].before);
    expect(oldestFirst[1].after).toBe(householdTotalOf(saved));
  });

  test("a record survives an unrelated change", async () => {
    const onSave = jest.fn();
    renderApp(onSave, liveHousehold());
    await settle();
    openUnallocatedEditor();
    typeUnallocated(255);
    await settle();

    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByTestId("add-tx"));
    const form = screen.getByTestId("tx-form");
    fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "10" } });
    fireEvent.change(within(form).getByTestId("tx-category"), { target: { value: "c-a" } });
    fireEvent.click(within(form).getByTestId("tx-save"));
    await settle();

    expect(lastSave(onSave).adjustments).toHaveLength(1);
  });
});

describe("Balance adjustments in Reports", () => {
  const withHistory = (entries) => liveHousehold({ adjustments: entries });

  const resetEntry = {
    id: "adj-reset", date: "2026-05-02", at: "2026-05-02T00:00:00Z", userId: "u-user1",
    kind: "reset", before: 1000, after: 0, amount: -1000,
    unallocated: { before: 250, after: 0 },
    entries: [{ catId: "c-a", before: 640, amount: -640, after: 0 }],
  };
  const setEntry = {
    id: "adj-set", date: "2026-05-09", at: "2026-05-09T00:00:00Z", userId: "u-user1",
    kind: "set-unallocated", before: 0, after: 500, amount: 500,
    unallocated: { before: 0, after: 500 }, entries: [],
  };

  test("each adjustment says what happened, when, by whom and for how much", async () => {
    renderApp(jest.fn(), withHistory([setEntry, resetEntry]));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    const reset = screen.getByTestId("adjustment-entry-adj-reset");
    expect(reset).toHaveTextContent("2026-05-02");
    expect(reset).toHaveTextContent("by Tester");
    expect(reset).toHaveTextContent("All balances reset to zero");
    expect(reset).toHaveTextContent("total held $1,000.00 → $0.00");
    expect(screen.getByTestId("adjustment-amount-adj-reset")).toHaveTextContent("−$1,000.00");
    expect(screen.getByTestId("adjustment-amount-adj-set")).toHaveTextContent("+$500.00");
  });

  test("a reset expands to name the envelopes it emptied and what unallocated held", async () => {
    renderApp(jest.fn(), withHistory([resetEntry]));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));
    fireEvent.click(screen.getByTestId("adjustment-toggle-adj-reset"));

    const detail = screen.getByTestId("adjustment-detail-adj-reset");
    expect(within(detail).getByTestId("adjustment-move-adj-reset-c-a")).toHaveTextContent("Groceries");
    expect(within(detail).getByTestId("adjustment-move-adj-reset-c-a")).toHaveTextContent("$640.00 → $0.00");
    expect(detail).toHaveTextContent("Unallocated");
    expect(detail).toHaveTextContent("$250.00 → $0.00");
  });

  test("setting unallocated expands to the balance that was actually typed", async () => {
    renderApp(jest.fn(), withHistory([setEntry]));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));
    fireEvent.click(screen.getByTestId("adjustment-toggle-adj-set"));

    expect(screen.getByTestId("adjustment-detail-adj-set")).toHaveTextContent("$0.00 → $500.00");
  });

  // The default report range starts on 1 January. The opening balance a
  // household adopted the app with is by definition older than anything else,
  // and it is the single most useful row in this log — so unlike the transfers
  // above it, the list is not range-filtered.
  test("an adjustment from outside the report range is still shown", async () => {
    const old = { ...resetEntry, id: "adj-old", date: "2019-03-01", kind: "opening", entries: [{ catId: "c-a", before: 0, amount: 640, after: 640 }] };
    renderApp(jest.fn(), withHistory([old]));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    expect(screen.getByTestId("adjustment-entry-adj-old")).toHaveTextContent("2019-03-01");
    expect(screen.getByTestId("adjustment-entry-adj-old")).toHaveTextContent("Envelopes opened with money already held");
  });

  // A record migrated from openingBalances has no household totals to show,
  // the same way a reconcile run recorded before movements existed has no
  // detail. It must render rather than crash on the missing fields.
  test("a folded-in legacy record renders without its totals", async () => {
    const legacy = { id: "ob-1", date: "2026-01-01", at: "2026-01-01T00:00:00Z", userId: "u-user1", kind: "opening", amount: 40, entries: [{ catId: "c-a", amount: 40 }] };
    renderApp(jest.fn(), withHistory([legacy]));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    const row = screen.getByTestId("adjustment-entry-ob-1");
    expect(row).toHaveTextContent("Envelopes opened with money already held");
    expect(row).not.toHaveTextContent("total held");
    fireEvent.click(screen.getByTestId("adjustment-toggle-ob-1"));
    expect(screen.getByTestId("adjustment-move-ob-1-c-a")).toHaveTextContent("+$40.00");
  });

  test("an envelope deleted since the adjustment is named as such rather than crashing", async () => {
    const entry = { ...resetEntry, entries: [{ catId: "c-gone", before: 50, amount: -50, after: 0 }] };
    renderApp(jest.fn(), withHistory([entry]));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));
    fireEvent.click(screen.getByTestId("adjustment-toggle-adj-reset"));

    expect(screen.getByTestId("adjustment-move-adj-reset-c-gone")).toHaveTextContent("Deleted envelope");
  });

  test("a reset done now shows up in the log straight away", async () => {
    renderApp(jest.fn(), liveHousehold());
    await settle();
    openReset();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByTestId("confirm-ok"));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    // The row states the move the reset actually made — the toast says the same
    // thing in different words, so this matches on the report's own phrasing.
    expect(screen.getByText(/All balances reset to zero · total held \$1,000\.00 → \$0\.00/)).toBeInTheDocument();
    expect(screen.queryByTestId("adjustments-empty")).not.toBeInTheDocument();
  });

  // The phone is this household's primary interface, and both the dialog and
  // this section have a mobile branch.
  test("on a phone the question and the log both still say what happened", async () => {
    global.setMobileViewport();
    const onSave = jest.fn();
    renderApp(onSave, liveHousehold());
    await settle();

    openReset();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("2 envelopes hold $750.00");
    expect(dialog).toHaveTextContent("$1,000.00 in all");
    fireEvent.click(within(dialog).getByTestId("confirm-ok"));
    await settle();

    const id = lastSave(onSave).adjustments[0].id;
    fireEvent.click(screen.getByTestId("nav-reports"));
    const row = screen.getByTestId(`adjustment-entry-${id}`);
    expect(row).toHaveTextContent("All balances reset to zero");
    expect(screen.getByTestId(`adjustment-amount-${id}`)).toHaveTextContent("−$1,000.00");

    fireEvent.click(screen.getByTestId(`adjustment-toggle-${id}`));
    expect(screen.getByTestId(`adjustment-move-${id}-c-a`)).toHaveTextContent("$640.00 → $0.00");
  });

  // Not a refactor of records that already work.
  test("the reconcile and transfer sections are untouched", async () => {
    renderApp(jest.fn(), liveHousehold({
      reconcileLog: [{ id: "r-1", date: "2026-06-01", at: "2026-06-01T00:00:00Z", userId: "u-user1", pooled: 90, toppedUp: 1, returned: 40, movements: [] }],
      transfers: [{ id: "tr-1", date: "2026-06-02", fromId: "c-a", toId: "c-b", amount: 25, description: "" }],
    }));
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    expect(screen.getByTestId("reconcile-entry-r-1")).toHaveTextContent("$90.00");
    expect(screen.getByText("Envelope transfers")).toBeInTheDocument();
    expect(screen.getByText("Balance adjustments")).toBeInTheDocument();
  });
});
