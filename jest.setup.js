import "@testing-library/jest-dom";

// The app derives visible state from the wall clock: BudgetApp's `activeMonth`
// defaults to todayISO().slice(0, 7), and views filter their rows against it.
// A suite seeded with fixed dates therefore drifts red as the calendar advances,
// which is exactly what happened to the transaction-delete tests. Pin the clock
// so every run sees the same "today" regardless of when it is run.
const FIXED_NOW = new Date("2026-06-15T09:00:00Z");

// Fake `Date` only. Every timer API stays real so React Testing Library's async
// helpers (findBy*, waitFor) and the app's own toast dismissal (setTimeout, 2.4s
// in BudgetApp.jsx) keep the timing behaviour they have in the browser.
const REAL_TIMER_APIS = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "setImmediate",
  "clearImmediate",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "queueMicrotask",
  "nextTick",
  "performance",
  "hrtime",
];

// ── Media queries ───────────────────────────────────────────────────────────
//
// jsdom ships no matchMedia at all. Without it `useIsMobile` can only ever
// report desktop, so every mobile branch in the app — which is the primary
// interface for this household — went unexercised, and the reduced-motion
// checks in AnimatedCurrency and the swipe gesture were never taken either.
//
// The stub answers by query rather than returning one fixed `matches` for
// everything, so a test can ask for a phone without also claiming the user has
// asked for reduced motion. `setMedia` is the switch; it is re-installed and
// reset before every test, so a test that overrides or deletes
// window.matchMedia locally cannot leak into the next one.
const MEDIA_DEFAULTS = { mobile: false, reducedMotion: false };
let mediaState = { ...MEDIA_DEFAULTS };

const mediaListeners = new Set();

function queryMatches(query) {
  if (/prefers-reduced-motion:\s*reduce/.test(query)) return mediaState.reducedMotion;
  if (/max-width/.test(query)) return mediaState.mobile;
  if (/min-width/.test(query)) return !mediaState.mobile;
  return false;
}

function installMatchMedia() {
  mediaListeners.clear();
  window.matchMedia = (query) => {
    const mql = {
      media: query,
      onchange: null,
      get matches() { return queryMatches(query); },
      addEventListener: (type, fn) => { if (type === "change") mediaListeners.add({ query, fn }); },
      removeEventListener: (type, fn) => {
        for (const l of mediaListeners) if (l.fn === fn) mediaListeners.delete(l);
      },
      addListener: (fn) => mediaListeners.add({ query, fn }),
      removeListener: (fn) => { for (const l of mediaListeners) if (l.fn === fn) mediaListeners.delete(l); },
      dispatchEvent: () => false,
    };
    return mql;
  };
}

// Switch the emulated device/preference mid-test. Listeners registered through
// the stub are notified, so a component that subscribes (useIsMobile) updates
// the same way it would when a phone is rotated across the breakpoint.
global.setMedia = (next) => {
  mediaState = { ...mediaState, ...next };
  for (const { query, fn } of mediaListeners) {
    fn({ matches: queryMatches(query), media: query });
  }
};

// Render on a phone. Call before render() — useIsMobile reads matchMedia in its
// lazy initial state, so switching afterwards costs an extra effect pass.
global.setMobileViewport = () => global.setMedia({ mobile: true });

beforeEach(() => {
  jest.useFakeTimers({ now: FIXED_NOW, doNotFake: REAL_TIMER_APIS });
  mediaState = { ...MEDIA_DEFAULTS };
  installMatchMedia();
});

afterEach(() => {
  jest.useRealTimers();
});
