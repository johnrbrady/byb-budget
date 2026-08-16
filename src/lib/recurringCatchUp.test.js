import { recurringCatchUp } from "./recurringCatchUp.js";

test("one monthly catch-up includes every missed occurrence and restores a 31st anchor", () => {
  expect(recurringCatchUp({ nextDueDate: "2026-01-31", frequency: "monthly", dueDay: 31 }, "2026-04-15")).toEqual({
    dates: ["2026-01-31", "2026-02-28", "2026-03-31"],
    nextDueDate: "2026-04-30",
    dueDay: 31,
  });
});

test("weekly and fortnightly catch up inclusively through today", () => {
  expect(recurringCatchUp({ nextDueDate: "2026-08-01", frequency: "weekly" }, "2026-08-15").dates).toEqual(["2026-08-01", "2026-08-08", "2026-08-15"]);
  expect(recurringCatchUp({ nextDueDate: "2026-08-01", frequency: "fortnightly" }, "2026-08-15")).toMatchObject({ dates: ["2026-08-01", "2026-08-15"], nextDueDate: "2026-08-29" });
});

test("future rules produce no rows and do not move", () => {
  expect(recurringCatchUp({ nextDueDate: "2026-09-01", frequency: "monthly" }, "2026-08-15")).toMatchObject({ dates: [], nextDueDate: "2026-09-01" });
});

test("invalid or pathological rules fail instead of looping or partially posting", () => {
  expect(() => recurringCatchUp({ nextDueDate: "2026-08-01", frequency: "yearly" }, "2026-08-15")).toThrow("invalid frequency");
  expect(() => recurringCatchUp({ nextDueDate: "2026-08-01", frequency: "weekly" }, "2030-08-15", 2)).toThrow("too many missed");
});
