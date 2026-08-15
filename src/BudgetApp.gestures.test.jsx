import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BudgetApp from "./BudgetApp.jsx";

// Gesture and mobile-shell behaviour. Kept apart from BudgetApp.test.jsx, which
// is about what the app computes; this file is about how it moves.

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
  baseAmount: 400, envelopeBalance: 200, isAccumulating: false, ...extra,
});

function renderApp(data = {}) {
  return render(
    <BudgetApp
      initialData={{
        users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [],
        reconcileLog: [], unallocatedBalance: 0,
        categories: [env("c-a", "Alpha"), env("c-b", "Bravo"), env("c-c", "Charlie")],
        ...data,
      }}
      onSave={jest.fn()}
    />
  );
}

async function settle() {
  await act(async () => { await Promise.resolve(); });
}

// Which tab the shell is on, read the way a user reads it — the highlighted nav item.
const currentView = () => {
  const el = document.querySelector('[data-testid^="nav-"][aria-current="page"]');
  return el ? el.getAttribute("data-testid").replace("nav-", "") : null;
};

// The element the shell listens on. Everything the user touches is inside it.
const swipeSurface = () => document.querySelector("[data-swipe-surface]") || screen.getByTestId("sidebar").parentElement;

// A horizontal drag, delivered the way a finger delivers one: down, a few moves,
// then up. `target` is what is under the finger, which is the whole point of the
// Envelopes case — the card, not the gap between cards.
function drag(target, { from = 300, to = 120, y = 400, steps = 4 } = {}) {
  fireEvent.touchStart(target, { touches: [{ clientX: from, clientY: y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    fireEvent.touchMove(target, { touches: [{ clientX: x, clientY: y }] });
  }
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: to, clientY: y }] });
}

const goToEnvelopes = () => fireEvent.click(screen.getByTestId("nav-categories"));

// A committed swipe navigates on a timer (useSwipeNavigation times the exit off
// the finger's speed), and jest.setup.js leaves the timer APIs real. Flushing
// microtasks therefore proves nothing about a swipe that should NOT have
// happened — it has not happened yet either way. Waiting past the longest exit
// is what makes "it did not navigate" mean something.
const pastSettle = () => new Promise((r) => setTimeout(r, 400));

const dragHandleIn = (card) => card.querySelector("[aria-label='Drag to reorder']");

// jsdom implements no layout, so it has no elementFromPoint — which the mobile
// reorder path hit-tests with. Point it wherever the test needs the finger to be.
function withHitTarget(el, fn) {
  const real = document.elementFromPoint;
  document.elementFromPoint = () => el;
  try { return fn(); } finally {
    if (real) document.elementFromPoint = real; else delete document.elementFromPoint;
  }
}

describe("Swipe between tabs", () => {
  beforeEach(() => { global.setMobileViewport(); });

  // ── The reported defect ────────────────────────────────────────────────────
  test("a swipe that starts on an envelope card navigates", async () => {
    renderApp();
    await settle();
    goToEnvelopes();
    expect(currentView()).toBe("categories");

    const card = document.querySelector("[data-env-id='c-a']");
    expect(card).not.toBeNull();

    drag(card);
    await waitFor(() => expect(currentView()).toBe("recurring"));
  });

  test("a swipe that starts on the card's title text navigates too", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const title = screen.getByText("Bravo");
    drag(title);
    await waitFor(() => expect(currentView()).toBe("recurring"));
  });

  test("swiping right goes back a tab", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    drag(card, { from: 120, to: 300 });
    await waitFor(() => expect(currentView()).toBe("transactions"));
  });

  // ── Guards that must survive the fix ───────────────────────────────────────
  test("a drag that starts on a select does not navigate", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByText("Filter"));

    const select = screen.getByTestId("tx-filter-category");
    drag(select);
    await settle();
    expect(currentView()).toBe("transactions");
  });

  test("a drag that starts on a text input does not navigate", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByText("Filter"));

    const input = screen.getByTestId("tx-search");
    drag(input);
    await settle();
    expect(currentView()).toBe("transactions");
  });

  test("a drag that starts on the reorder handle does not navigate", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    const handle = dragHandleIn(card);
    expect(handle).not.toBeNull();
    withHitTarget(card, () => drag(handle));
    await settle();
    expect(currentView()).toBe("categories");
  });

  test("a mostly-vertical drag scrolls rather than navigating", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    // 60px across, 200px down — a scroll, not a swipe.
    fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 285, clientY: 260 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 260, clientY: 340 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 240, clientY: 400 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 240, clientY: 400 }] });
    await settle();
    expect(currentView()).toBe("categories");
  });

  test("a short drag below the threshold snaps back instead of navigating", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    drag(card, { from: 300, to: 280, steps: 2 });
    await settle();
    expect(currentView()).toBe("categories");
  });

  // The shell hands the gesture back while a modal owns the screen. (The welcome
  // modal, not Settings: SettingsModal reads the Vite-injected __BUILD_TIME__,
  // which does not exist under Jest, so it cannot be rendered here at all.)
  test("a swipe while a modal is open does not change tab", async () => {
    localStorage.removeItem("byb_welcomed");
    render(
      <BudgetApp
        onSave={jest.fn()}
        initialData={{
          users: [{ id: "u-user1", name: "Tester", role: "owner", colour: "#7FB069" }],
          transactions: [], recurring: [], assets: [], transfers: [], reconcileLog: [],
          unallocatedBalance: 0, categories: [env("c-a", "Alpha")],
        }}
      />
    );
    await settle();
    expect(screen.getByText(/Agree and let's get started/)).toBeInTheDocument();
    expect(currentView()).toBe("dashboard");

    const track = document.querySelector(".byb-swipe-track");
    drag(swipeSurface());
    // The shell never took the gesture, so the view was never moved at all…
    expect(track.style.transform).toBe("");
    // …and it is still on the same tab once a settle would have finished.
    await pastSettle();
    expect(currentView()).toBe("dashboard");
  });

  test("swiping past the last tab stays on the last tab", async () => {
    renderApp();
    await settle();
    fireEvent.click(screen.getByTestId("nav-reports"));

    drag(swipeSurface());
    await settle();
    expect(currentView()).toBe("reports");
  });

  // ── Follow-the-finger ──────────────────────────────────────────────────────
  test("the view tracks the finger during the drag and is released afterwards", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    const track = document.querySelector(".byb-swipe-track");
    expect(track).not.toBeNull();

    fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 400 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 270, clientY: 400 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 220, clientY: 400 }] });

    // Mid-gesture the content has moved with the finger, and is doing so without
    // a transition — a transition here is exactly the lag that makes it feel cheap.
    expect(track.style.transform).toBe("translate3d(-80px, 0, 0)");
    expect(track.style.transitionDuration === "" || track.style.transitionDuration === "0ms").toBe(true);
    expect(track.className).toContain("byb-swiping");

    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 220, clientY: 400 }] });
    // Once settled the transform is gone entirely, so the element stops being a
    // containing block for the fixed-position FAB and sheets inside it.
    await waitFor(() => expect(track.style.transform).toBe(""));
    expect(track.className).not.toContain("byb-swiping");
  });

  test("a cancelled drag returns the view to rest without navigating", async () => {
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    const track = document.querySelector(".byb-swipe-track");

    fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 400 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 280, clientY: 400 }] });
    fireEvent.touchCancel(card, { changedTouches: [{ clientX: 280, clientY: 400 }] });

    await waitFor(() => expect(track.style.transform).toBe(""));
    expect(currentView()).toBe("categories");
  });

  // ── Reduced motion ─────────────────────────────────────────────────────────
  test("reduced motion navigates instantly, with no settle animation", async () => {
    global.setMedia({ reducedMotion: true });
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    const track = document.querySelector(".byb-swipe-track");

    drag(card);
    // Instant: the view has already changed by the time touchend returns, and
    // nothing is left mid-transition.
    expect(currentView()).toBe("recurring");
    expect(track.style.transform).toBe("");
    expect(track.style.transitionDuration).toBe("");
    expect(track.className).not.toContain("byb-swiping");
  });

  test("reduced motion does not move the view during the drag either", async () => {
    global.setMedia({ reducedMotion: true });
    renderApp();
    await settle();
    goToEnvelopes();

    const card = document.querySelector("[data-env-id='c-a']");
    const track = document.querySelector(".byb-swipe-track");

    fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 400 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 240, clientY: 400 }] });
    expect(track.style.transform).toBe("");
    expect(track.className).not.toContain("byb-swiping");
  });

  // ── Coexisting gestures ────────────────────────────────────────────────────
  test("drag-to-reorder from the handle still reorders", async () => {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{
          users: baseUsers, transactions: [], recurring: [], assets: [], transfers: [],
          reconcileLog: [], unallocatedBalance: 0,
          categories: [env("c-a", "Alpha"), env("c-b", "Bravo"), env("c-c", "Charlie")],
        }}
      />
    );
    await settle();
    goToEnvelopes();

    const cardA = document.querySelector("[data-env-id='c-a']");
    const cardC = document.querySelector("[data-env-id='c-c']");
    const handle = dragHandleIn(cardA);

    // The reorder path hit-tests with elementFromPoint; point it at Charlie.
    withHitTarget(cardC, () => {
      fireEvent.touchStart(handle, { touches: [{ clientX: 20, clientY: 200 }] });
      act(() => {
        document.dispatchEvent(Object.assign(new Event("touchmove", { bubbles: true }), {
          touches: [{ clientX: 20, clientY: 600 }],
        }));
        document.dispatchEvent(new Event("touchend", { bubbles: true }));
      });
    });

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    const order = [...saved.categories]
      .filter((c) => c.type === "expense")
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
      .map((c) => c.id);
    // Alpha has moved behind Charlie. (The two protected envelopes BudgetApp
    // always injects trail the list and take no part in the reorder.)
    expect(order.slice(0, 3)).toEqual(["c-b", "c-c", "c-a"]);
    // And it did not also navigate away.
    expect(currentView()).toBe("categories");
  });

  test("a long press on an envelope card still opens quick actions", async () => {
    jest.useFakeTimers({ now: new Date("2026-06-15T09:00:00Z") });
    try {
      renderApp();
      await act(async () => { await Promise.resolve(); });
      goToEnvelopes();

      const card = document.querySelector("[data-env-id='c-a']");
      fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 400 }] });
      act(() => { jest.advanceTimersByTime(600); });
      expect(screen.getByText("Fill to target")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEF-015 — the swipe used to die inside an envelope drill-down.
//
// TransactionsView substituted its own gesture there: swipe-left cleared the
// category filter, swipe-right did nothing at all. From the stakeholder's seat
// that is a swipe that "works sometimes and doesn't work sometimes". A swipe now
// means one thing everywhere — change tab — and leaving an envelope is a control
// on screen (DEC-010).
// ─────────────────────────────────────────────────────────────────────────────
describe("Swipe inside an envelope drill-down", () => {
  beforeEach(() => { global.setMobileViewport(); });

  const spend = (id, date, amount, description, categoryId = "c-a") => ({
    id, date, amount, type: "expense", categoryId, description,
    isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: `${date}T00:00:00Z`,
  });

  const withHistory = () => renderApp({
    transactions: [
      spend("t-jun", "2026-06-02", 60, "June shop"),
      spend("t-may", "2026-05-04", 55, "May shop"),
      spend("t-apr", "2026-04-04", 45, "April shop"),
    ],
  });

  // The stakeholder's own route in: tap the envelope on the Dashboard.
  const drillIntoAlpha = () => fireEvent.click(screen.getByText("Alpha"));

  test("swiping left inside an envelope changes tab, exactly as it does outside one", async () => {
    withHistory();
    await settle();
    drillIntoAlpha();
    expect(currentView()).toBe("transactions");
    expect(screen.getByTestId("tx-scope")).toHaveTextContent("All months");

    drag(screen.getByTestId("tx-table"));
    await waitFor(() => expect(currentView()).toBe("categories"));
  });

  test("swiping right inside an envelope goes back a tab", async () => {
    withHistory();
    await settle();
    drillIntoAlpha();

    drag(screen.getByTestId("tx-table"), { from: 120, to: 300 });
    await waitFor(() => expect(currentView()).toBe("dashboard"));
  });

  test("a swipe that starts on a transaction row navigates too", async () => {
    withHistory();
    await settle();
    drillIntoAlpha();

    drag(screen.getByTestId("tx-row-t-jun"));
    await waitFor(() => expect(currentView()).toBe("categories"));
  });

  test("the way out of the envelope is a control on screen, not a hidden gesture", async () => {
    withHistory();
    await settle();
    drillIntoAlpha();

    // No instruction to swipe, because swiping no longer does this.
    expect(screen.queryByText(/Swipe left to go back/)).not.toBeInTheDocument();

    const back = screen.getByTestId("tx-exit-envelope");
    expect(back).toBeInTheDocument();
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByTestId("tx-scope")).not.toHaveTextContent("All months"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEF-016 — tapping a transaction appeared to do nothing.
//
// The tap always opened the editor; the editor was rendered above the list, so
// a user scrolled down through months of history got a form off the top of his
// screen. On a phone the editor is now a bottom sheet over the list (DEC-011).
// ─────────────────────────────────────────────────────────────────────────────
describe("Tapping a transaction on a phone", () => {
  beforeEach(() => { global.setMobileViewport(); });

  const spend = (id, date, amount, description) => ({
    id, date, amount, type: "expense", categoryId: "c-a", description,
    isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: `${date}T00:00:00Z`,
  });

  // Three months of history, so the row being tapped is a long way down the page.
  const history = [
    spend("t-jun-1", "2026-06-14", 60, "June shop"),
    spend("t-jun-2", "2026-06-08", 22, "Bakery"),
    spend("t-jun-3", "2026-06-02", 31, "Butcher"),
    spend("t-may-1", "2026-05-20", 55, "May shop"),
    spend("t-may-2", "2026-05-11", 18, "Market"),
    spend("t-apr-1", "2026-04-18", 47, "April shop"),
    spend("t-apr-2", "2026-04-03", 12, "Corner store"),
  ];

  const renderHistory = () => renderApp({ transactions: history });
  const drillIntoAlpha = () => fireEvent.click(screen.getByText("Alpha"));

  // Where the list sits among its siblings. An editor inserted into the flow
  // above the list pushes it down — which is the defect, seen structurally.
  const listIndex = () => {
    const list = screen.getByTestId("tx-table");
    return Array.prototype.indexOf.call(list.parentElement.children, list);
  };

  test("the editor opens over the list rather than above it", async () => {
    renderHistory();
    await settle();
    drillIntoAlpha();

    const before = listIndex();
    // The last row on screen — the far end of the scroll, where the stakeholder was.
    fireEvent.click(screen.getByTestId("tx-row-t-apr-2"));

    const sheet = screen.getByTestId("tx-edit-sheet");
    expect(sheet).toBeInTheDocument();
    // Fixed to the viewport, so it is over the list wherever the list is scrolled to…
    expect(sheet.style.position).toBe("fixed");
    // …and it is the app's own sheet, not a second one: byb-overlay/byb-sheet are
    // what carry the entrance animation in global.css, and therefore what the
    // prefers-reduced-motion rule there already reaches. (jsdom loads no CSS, so
    // the class is the only part of that this can assert.)
    expect(sheet.className).toContain("byb-overlay");
    expect(sheet.querySelector(".byb-sheet")).not.toBeNull();
    // …and the list has not been pushed down to make room for it.
    expect(listIndex()).toBe(before);
    // The form comes after the row in the document, not above the whole list.
    const form = screen.getByTestId("tx-form");
    const row = screen.getByTestId("tx-row-t-apr-2");
    expect(form.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  // The FAB is fixed to the screen, so it is reachable from anywhere in the
  // history — and it opened the same off-screen form the tap did. Adding uses
  // the sheet too; one form, one presentation, on the viewport that needs it.
  test("the add button opens the same sheet, with nothing to delete in it", async () => {
    renderHistory();
    await settle();
    drillIntoAlpha();
    fireEvent.click(screen.getByTestId("add-tx"));

    expect(screen.getByTestId("tx-edit-sheet")).toBeInTheDocument();
    expect(screen.queryByTestId("tx-sheet-delete")).not.toBeInTheDocument();
    // Adding from inside an envelope still lands in that envelope.
    expect(within(screen.getByTestId("tx-form")).getByTestId("tx-category")).toHaveValue("c-a");
  });

  test("the sheet opens on the tapped transaction's own values", async () => {
    renderHistory();
    await settle();
    drillIntoAlpha();
    fireEvent.click(screen.getByTestId("tx-row-t-may-2"));

    const form = screen.getByTestId("tx-form");
    expect(form.querySelector('input[type="date"]')).toHaveValue("2026-05-11");
    expect(within(form).getByDisplayValue("Expense")).toBeInTheDocument();
    expect(within(form).getByTestId("tx-amount")).toHaveValue(18);
    expect(within(form).getByTestId("tx-description")).toHaveValue("Market");
    expect(within(form).getByTestId("tx-category")).toHaveValue("c-a");
  });

  test("editing and saving from the sheet updates the transaction and closes it", async () => {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{
          users: baseUsers, transactions: history, recurring: [], assets: [], transfers: [],
          reconcileLog: [], unallocatedBalance: 0,
          categories: [env("c-a", "Alpha"), env("c-b", "Bravo"), env("c-c", "Charlie")],
        }}
      />
    );
    await settle();
    drillIntoAlpha();
    fireEvent.click(screen.getByTestId("tx-row-t-may-2"));

    const form = screen.getByTestId("tx-form");
    fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: "Farmers market" } });
    fireEvent.change(within(form).getByTestId("tx-amount"), { target: { value: "24" } });
    fireEvent.click(within(form).getByTestId("tx-save"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    const tx = saved.transactions.find((t) => t.id === "t-may-2");
    expect(tx.description).toBe("Farmers market");
    expect(tx.amount).toBe(24);
    expect(screen.queryByTestId("tx-edit-sheet")).not.toBeInTheDocument();
  });

  test("deleting from the sheet asks first, then removes the row and closes the sheet", async () => {
    renderHistory();
    await settle();
    drillIntoAlpha();
    fireEvent.click(screen.getByTestId("tx-row-t-may-2"));

    fireEvent.click(screen.getByTestId("tx-sheet-delete"));
    const ok = await screen.findByTestId("confirm-ok");
    fireEvent.click(ok);
    await settle();

    expect(screen.queryByTestId("tx-row-t-may-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tx-edit-sheet")).not.toBeInTheDocument();
  });

  test("declining the delete keeps both the transaction and the open sheet", async () => {
    renderHistory();
    await settle();
    drillIntoAlpha();
    fireEvent.click(screen.getByTestId("tx-row-t-may-2"));

    fireEvent.click(screen.getByTestId("tx-sheet-delete"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByText("Cancel"));
    await settle();

    expect(screen.getByTestId("tx-row-t-may-2")).toBeInTheDocument();
    expect(screen.getByTestId("tx-edit-sheet")).toBeInTheDocument();
  });

  test("a swipe over the open sheet does not change tab underneath it", async () => {
    renderHistory();
    await settle();
    drillIntoAlpha();
    fireEvent.click(screen.getByTestId("tx-row-t-may-2"));

    const track = document.querySelector(".byb-swipe-track");
    drag(screen.getByTestId("tx-edit-sheet"));
    // A sheet is a modal: the shell never took the gesture, so nothing moved…
    expect(track.style.transform).toBe("");
    // …and the tab underneath is still the one the sheet was opened from.
    await pastSettle();
    expect(currentView()).toBe("transactions");
    expect(screen.getByTestId("tx-edit-sheet")).toBeInTheDocument();
  });

  // ── The Package 3 guard, on the path this package adds ─────────────────────
  //
  // DEF-004 was an income edit silently draining an envelope. The desktop form
  // is covered in BudgetApp.test.jsx; the sheet is a second door onto the same
  // form and has to be just as safe.
  test("editing an allocated income's description through the sheet moves no money", async () => {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{
          users: baseUsers, recurring: [], assets: [], transfers: [], reconcileLog: [],
          unallocatedBalance: 50,
          categories: [
            { id: "c-inc", name: "Salary", type: "income", colour: "#7FB069", monthlyBudget: null },
            env("c-a", "Alpha", { envelopeBalance: 300 }),
            env("c-b", "Bravo", { envelopeBalance: 200 }),
          ],
          transactions: [{
            id: "t-inc", date: "2026-06-01", amount: 300, type: "income", categoryId: "c-inc",
            description: "Payslip", isRecurring: false, recurringId: null,
            allocations: [{ catId: "c-a", amount: 300 }], addedBy: "u-user1", createdAt: "2026-06-01T00:00:00Z",
          }],
        }}
      />
    );
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByTestId("tx-row-t-inc"));

    const form = screen.getByTestId("tx-form");
    expect(within(form).getByTestId("tx-allocate-envelope")).toHaveValue("c-a");
    fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: "Payslip — June" } });
    fireEvent.click(within(form).getByTestId("tx-save"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.transactions.find((t) => t.id === "t-inc").allocations).toEqual([{ catId: "c-a", amount: 300 }]);
    expect(saved.categories.find((c) => c.id === "c-a").envelopeBalance).toBe(300);
    expect(saved.categories.find((c) => c.id === "c-b").envelopeBalance).toBe(200);
    expect(saved.unallocatedBalance).toBe(50);
  });

  test("a multi-envelope split stays read-only in the sheet and survives the save", async () => {
    const onSave = jest.fn();
    render(
      <BudgetApp
        onSave={onSave}
        initialData={{
          users: baseUsers, recurring: [], assets: [], transfers: [], reconcileLog: [],
          unallocatedBalance: 0,
          categories: [
            { id: "c-inc", name: "Salary", type: "income", colour: "#7FB069", monthlyBudget: null },
            env("c-a", "Alpha", { envelopeBalance: 300 }),
            env("c-b", "Bravo", { envelopeBalance: 200 }),
          ],
          transactions: [{
            id: "t-inc", date: "2026-06-01", amount: 500, type: "income", categoryId: "c-inc",
            description: "Payslip", isRecurring: false, recurringId: null,
            allocations: [{ catId: "c-a", amount: 300 }, { catId: "c-b", amount: 200 }],
            addedBy: "u-user1", createdAt: "2026-06-01T00:00:00Z",
          }],
        }}
      />
    );
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByTestId("tx-row-t-inc"));

    const form = screen.getByTestId("tx-form");
    // A split cannot be collapsed into one select, so it is shown as what it is.
    expect(within(form).getByTestId("tx-allocate-split")).toBeInTheDocument();
    expect(within(form).queryByTestId("tx-allocate-envelope")).not.toBeInTheDocument();
    fireEvent.change(within(form).getByTestId("tx-description"), { target: { value: "Payslip — June" } });
    fireEvent.click(within(form).getByTestId("tx-save"));

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.transactions.find((t) => t.id === "t-inc").allocations)
      .toEqual([{ catId: "c-a", amount: 300 }, { catId: "c-b", amount: 200 }]);
    expect(saved.categories.find((c) => c.id === "c-a").envelopeBalance).toBe(300);
    expect(saved.categories.find((c) => c.id === "c-b").envelopeBalance).toBe(200);
    expect(saved.unallocatedBalance).toBe(0);
  });
});

// The other half of DEC-011: a phone gets the sheet, a desktop does not. The
// table is compact, the editor lands in view beside the row's Edit button, and
// the money-movement tests in BudgetApp.test.jsx drive exactly this path.
describe("The transaction editor on a desktop", () => {
  test("the row's Edit button still opens the inline form, with no sheet involved", async () => {
    renderApp({
      transactions: [{
        id: "t1", date: "2026-06-02", amount: 25, type: "expense", categoryId: "c-a",
        description: "Milk", isRecurring: false, recurringId: null, addedBy: "u-user1",
        createdAt: "2026-06-02T00:00:00Z",
      }],
    });
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(within(screen.getByTestId("tx-row-t1")).getByText("Edit"));

    const form = screen.getByTestId("tx-form");
    expect(within(form).getByTestId("tx-description")).toHaveValue("Milk");
    expect(screen.queryByTestId("tx-edit-sheet")).not.toBeInTheDocument();
    // In the page, above the table — which is where a desktop reader is looking.
    expect(form.closest("[style*='position: fixed']")).toBeNull();
  });
});
