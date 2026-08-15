import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BudgetApp from "./BudgetApp.jsx";
import { EnvelopesView } from "./views/EnvelopesView.jsx";
import { buildStyles } from "./styles/buildStyles.js";

// What the restyle put on screen: the envelope fill meter, semantic status,
// sticky month headings, and the empty states — each exercised on the phone
// branch as well as the desktop one, since the phone is the primary interface
// and every mobile branch was previously unreachable in jsdom.

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

const env = (id, name, base, balance, extra = {}) => ({
  id, name, type: "expense", colour: "#7FB069",
  baseAmount: base, envelopeBalance: balance, isAccumulating: false, ...extra,
});

// A healthy envelope, one nearly empty, one overdrawn, one holding more than base.
const cats = [
  env("c-ok", "Groceries", 400, 200),
  env("c-low", "Fuel", 400, 40),
  env("c-over", "Medical", 400, -25),
  env("c-full", "Savings pot", 400, 900),
];

function renderApp(data = {}) {
  return render(
    <BudgetApp
      initialData={{
        users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [],
        reconcileLog: [], unallocatedBalance: 0, categories: cats, ...data,
      }}
      onSave={jest.fn()}
    />
  );
}

async function settle() {
  await act(async () => { await Promise.resolve(); });
}

const goToEnvelopes = () => fireEvent.click(screen.getByTestId("nav-categories"));
const statusOf = (id) => document.querySelector(`[data-env-id='${id}']`).getAttribute("data-env-status");
const fillWidth = (id) => screen.getByTestId(`env-meter-fill-${id}`).style.width;

// Both branches of every appearance assertion below. `describe.each` is what
// makes "the mobile path is tested too" structural rather than a habit.
describe.each([
  ["desktop", false],
  ["phone", true],
])("Envelope cards (%s)", (_label, mobile) => {
  beforeEach(() => { if (mobile) global.setMobileViewport(); });

  test("each card carries a fill meter measured against its base", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    expect(fillWidth("c-ok")).toBe("50%");
    expect(fillWidth("c-low")).toBe("10%");
    // Overdrawn reads as empty, not as a bar running backwards.
    expect(fillWidth("c-over")).toBe("0%");
    // Holding more than base is full, not overflowing off the end.
    expect(fillWidth("c-full")).toBe("100%");
  });

  test("status is stated in words, not only in colour", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    expect(screen.getByTestId("env-status-c-ok")).toHaveTextContent("On track");
    expect(screen.getByTestId("env-status-c-low")).toHaveTextContent("Running low");
    expect(screen.getByTestId("env-status-c-over")).toHaveTextContent("Overspent");
  });

  test("the three statuses are distinct on the card itself", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    expect(statusOf("c-ok")).toBe("ok");
    expect(statusOf("c-low")).toBe("low");
    expect(statusOf("c-over")).toBe("over");
  });

  test("the balance is shown against the base it is measured against", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-ok']");
    expect(card).toHaveTextContent("$200.00");
    expect(card).toHaveTextContent("/ $400.00");
    expect(card).toHaveTextContent("50% of $400.00/mo");
  });

  test("the meter is described for a screen reader", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    expect(screen.getByTestId("env-meter-c-low"))
      .toHaveAttribute("aria-label", "Running low — $40.00 of $400.00");
  });

  test("an envelope with no monthly amount says so instead of showing a bar at zero", async () => {
    renderApp({ categories: [env("c-unset", "Unset", 0, 0)] });
    await settle();
    goToEnvelopes();

    expect(statusOf("c-unset")).toBe("ok");
    expect(document.querySelector("[data-env-id='c-unset']")).toHaveTextContent("No monthly amount set");
  });
});

describe.each([
  ["desktop", false],
  ["phone", true],
])("Dashboard envelope rows (%s)", (_label, mobile) => {
  beforeEach(() => { if (mobile) global.setMobileViewport(); });

  test("the Dashboard reads the same status as the Envelopes tab", async () => {
    renderApp();
    await settle();

    const meters = document.querySelectorAll(".byb-meter[data-env-status]");
    const statuses = Array.from(meters).map((m) => m.getAttribute("data-env-status"));
    // Groceries, Fuel, Medical, Savings pot — in category order.
    expect(statuses).toEqual(["ok", "low", "over", "ok"]);
  });
});

describe.each([
  ["desktop", false],
  ["phone", true],
])("Month headings in the history list (%s)", (_label, mobile) => {
  beforeEach(() => { if (mobile) global.setMobileViewport(); });

  const transactions = [
    { id: "t-jun", date: "2026-06-02", amount: 60, type: "expense", categoryId: "c-ok", description: "Shop", isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: "2026-06-02T00:00:00Z" },
    { id: "t-may", date: "2026-05-04", amount: 55, type: "expense", categoryId: "c-ok", description: "Shop", isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: "2026-05-04T00:00:00Z" },
  ];

  const openGroceries = () => {
    fireEvent.click(screen.getByTestId("nav-transactions"));
    if (mobile) fireEvent.click(screen.getByText("Filter"));
    fireEvent.change(screen.getByTestId("tx-filter-category"), { target: { value: "c-ok" } });
  };

  test("each month heading is marked sticky", async () => {
    renderApp({ transactions });
    await settle();
    openGroceries();

    const heading = screen.getByTestId("tx-month-heading-2026-06");
    const sticky = mobile ? heading : heading.querySelector(".byb-month-heading-cell");
    const cls = mobile ? heading.className : sticky.className;
    expect(cls).toMatch(/byb-month-heading/);
  });

  // Sticky offsets are relative to the nearest containing block, so every
  // heading sharing one parent would pin at the same place and stack. Each
  // month therefore has to be its own element.
  test("each month is its own container, so one heading pushes the last one out", async () => {
    renderApp({ transactions });
    await settle();
    openGroceries();

    const jun = screen.getByTestId("tx-month-heading-2026-06");
    const may = screen.getByTestId("tx-month-heading-2026-05");
    // On mobile the heading is the group's own child; on desktop the heading row
    // sits in its month's own tbody.
    const group = (el) => (mobile ? el.closest(".byb-month-group") : el.closest("tbody"));
    expect(group(jun)).not.toBeNull();
    expect(group(may)).not.toBeNull();
    expect(group(jun)).not.toBe(group(may));
  });

  test("the subtotals are still the subtotals", async () => {
    renderApp({ transactions });
    await settle();
    openGroceries();

    expect(screen.getByTestId("tx-month-total-2026-06")).toHaveTextContent("$60.00");
    expect(screen.getByTestId("tx-month-total-2026-05")).toHaveTextContent("$55.00");
  });
});

describe.each([
  ["desktop", false],
  ["phone", true],
])("Empty states (%s)", (_label, mobile) => {
  beforeEach(() => { if (mobile) global.setMobileViewport(); });

  test("an empty transaction list explains itself and offers a way out", async () => {
    renderApp({ categories: [env("c-ok", "Groceries", 400, 200)] });
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));

    const empty = screen.getByTestId("empty-state");
    expect(empty).toHaveTextContent("No transactions match the current filter.");
    expect(empty).toHaveTextContent(/Try clearing the filters/);
    expect(within(empty).getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  test("an empty Recurring tab says what the tab is for", async () => {
    renderApp({ recurring: [] });
    await settle();
    fireEvent.click(screen.getByTestId("nav-recurring"));

    expect(screen.getByTestId("empty-state")).toHaveTextContent("No recurring rules yet.");
    expect(screen.getByTestId("empty-state")).toHaveTextContent(/posts them on their due date/);
  });

  // BudgetApp always injects Household Incidentals and Savings, so an envelope
  // grid with nothing in it cannot be reached through the shell. The view is
  // rendered on its own to cover the branch.
  test("an Envelopes grid with nothing in it offers to create the first envelope", () => {
    const setCatFormOpen = jest.fn();
    render(
      <EnvelopesView
        categories={[]}
        editingCat={null} setEditingCat={() => {}}
        catFormOpen={false} setCatFormOpen={setCatFormOpen}
        saveCat={() => {}} deleteCat={() => {}}
        unallocatedBalance={0}
        onFillWithIncome={() => {}} onFillSingleEnvelope={() => {}}
        onSetupBaseAmounts={() => {}}
        recurring={[]} onReorderCats={() => {}} onNavigateToCategory={() => {}}
        styles={buildStyles("light", mobile)}
      />
    );

    const empty = screen.getByTestId("empty-state");
    expect(empty).toHaveTextContent("No envelopes yet");
    expect(empty).toHaveTextContent(/rent, groceries, fuel/);
    // The action is wired to the same "add envelope" path the header button uses.
    fireEvent.click(within(empty).getByRole("button", { name: "Add an envelope" }));
    expect(setCatFormOpen).toHaveBeenCalledWith(true);
  });
});
