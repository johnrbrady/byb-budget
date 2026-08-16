import { envelopeTarget } from "./targets.js";

test("a $900 March target set in September needs six $150 future monthly fills", () => {
  expect(envelopeTarget({ targetAmount: 90000, targetDate: "2027-03-31", envelopeBalance: 0, baseAmount: 15000 }, "2026-09-10")).toEqual({
    targetAmount: 90000, targetDate: "2027-03-31", balance: 0, remaining: 90000,
    monthsRemaining: 6, requiredMonthly: 15000, monthlyFill: 15000, status: "on-track",
  });
});

test("existing savings reduce what is needed and indivisible cents round up", () => {
  expect(envelopeTarget({ targetAmount: 10000, targetDate: "2026-11-30", envelopeBalance: 3333, baseAmount: 3000 }, "2026-08-16")).toMatchObject({
    remaining: 6667, monthsRemaining: 3, requiredMonthly: 2223, status: "on-track",
  });
});

test.each([
  [{ targetAmount: 10000, targetDate: "2026-09-30", envelopeBalance: 10000, baseAmount: 0 }, "complete"],
  [{ targetAmount: 10000, targetDate: "2026-07-31", envelopeBalance: 5000, baseAmount: 10000 }, "overdue"],
  [{ targetAmount: 10000, targetDate: "2026-10-31", envelopeBalance: 0, baseAmount: 4000 }, "behind"],
])("reports complete, overdue and underfunded targets", (category, status) => {
  expect(envelopeTarget(category, "2026-08-16").status).toBe(status);
});

test("an incomplete target in the current month requires the whole remainder now", () => {
  expect(envelopeTarget({ targetAmount: 10001, targetDate: "2026-08-31", envelopeBalance: 1, baseAmount: 10000 }, "2026-08-16")).toMatchObject({ monthsRemaining: 1, requiredMonthly: 10000, status: "on-track" });
});

test("missing or invalid targets are absent rather than inventing a plan", () => {
  expect(envelopeTarget({}, "2026-08-16")).toBeNull();
  expect(envelopeTarget({ targetAmount: 100, targetDate: "soon" }, "2026-08-16")).toBeNull();
});
