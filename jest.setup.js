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

beforeEach(() => {
  jest.useFakeTimers({ now: FIXED_NOW, doNotFake: REAL_TIMER_APIS });
});

afterEach(() => {
  jest.useRealTimers();
});
