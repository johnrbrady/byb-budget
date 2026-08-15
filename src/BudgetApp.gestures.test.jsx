import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
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

  test("the envelope-context swipe-back still leaves the envelope, without changing tab", async () => {
    renderApp({
      transactions: [{ id: "t1", date: "2026-06-02", amount: 25, type: "expense", categoryId: "c-a", description: "Milk", isRecurring: false, recurringId: null, addedBy: "u-user1", createdAt: "2026-06-02T00:00:00Z" }],
    });
    await settle();
    fireEvent.click(screen.getByTestId("nav-transactions"));
    fireEvent.click(screen.getByText("Filter"));
    fireEvent.change(screen.getByTestId("tx-filter-category"), { target: { value: "c-a" } });
    expect(screen.getByTestId("tx-scope")).toHaveTextContent("All months");

    drag(screen.getByTestId("tx-table"));
    await settle();
    // Back to all categories, still on Transactions — the shell swipe must not
    // have fired as well and thrown the user onto another tab.
    expect(currentView()).toBe("transactions");
    await waitFor(() => expect(screen.getByTestId("tx-filter-category")).toHaveValue("all"));
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
