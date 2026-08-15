import { todayISO, monthKey, addPeriod, dayOfMonth, MELBOURNE_TZ } from "./utils.js";

// The household is in Melbourne, so every stored date means a Melbourne
// calendar date. These tests pin specific instants rather than relying on the
// suite-wide clock in jest.setup.js, because the interesting cases are the ones
// where the UTC date and the Melbourne date disagree.
//
// Expectations are written two ways on purpose:
//  - hard-coded literals, derived by hand from the known offsets
//    (AEST = UTC+10, AEDT = UTC+11), and
//  - a formatter built here in the test from Intl directly,
// so a bug in the helper cannot make the assertion agree with it by
// construction.
const melbourneDate = (instant) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));

const at = (instant) => {
  jest.setSystemTime(new Date(instant));
  return todayISO();
};

describe("todayISO — Melbourne calendar dates", () => {
  test("the zone is fixed to Melbourne, not taken from the host", () => {
    expect(MELBOURNE_TZ).toBe("Australia/Melbourne");
  });

  // DEF-002. 2026-08-31T22:00:00Z is 8:00am AEST on Tuesday 1 September 2026.
  // The old helper returned the UTC date, 2026-08-31, so a grocery shop entered
  // on the morning of the 1st was filed into August and vanished from the
  // September list.
  test("8am on the 1st (AEST) is dated the 1st, not the last day of the previous month", () => {
    expect(at("2026-08-31T22:00:00Z")).toBe("2026-09-01");
    expect(at("2026-08-31T22:00:00Z")).toBe(melbourneDate("2026-08-31T22:00:00Z"));
    expect(monthKey(todayISO())).toBe("2026-09");
  });

  // The same boundary during daylight saving: 2026-12-31T21:00:00Z is 8:00am
  // AEDT on Friday 1 January 2027 — a different day, month AND year in UTC.
  test("8am on the 1st (AEDT) crosses the year boundary correctly", () => {
    expect(at("2026-12-31T21:00:00Z")).toBe("2027-01-01");
    expect(at("2026-12-31T21:00:00Z")).toBe(melbourneDate("2026-12-31T21:00:00Z"));
    expect(monthKey(todayISO())).toBe("2027-01");
  });

  // Same UTC time of day, six months apart. Melbourne has already rolled over
  // at 13:30Z in January (UTC+11) but not in June (UTC+10), so a fixed offset
  // cannot satisfy both.
  test("the offset differs between AEST and AEDT", () => {
    expect(at("2026-06-15T13:30:00Z")).toBe("2026-06-15"); // 11:30pm AEST
    expect(at("2026-01-15T13:30:00Z")).toBe("2026-01-16"); // 12:30am AEDT
  });

  // Daylight saving starts at 2am on Sunday 4 October 2026. Held at 13:30Z, the
  // Melbourne date jumps from the 3rd straight to the 5th. A hard-coded +10
  // would give 3rd then 4th; a hard-coded +11 would give 4th then 5th. Only
  // real zone data gives 3rd then 5th.
  test("handles the AEST->AEDT transition (October 2026)", () => {
    expect(at("2026-10-03T13:30:00Z")).toBe("2026-10-03");
    expect(at("2026-10-04T13:30:00Z")).toBe("2026-10-05");
  });

  // Daylight saving ends at 3am on Sunday 5 April 2026. Held at 13:30Z the same
  // Melbourne date repeats, for the mirror-image reason.
  test("handles the AEDT->AEST transition (April 2026)", () => {
    expect(at("2026-04-04T13:30:00Z")).toBe("2026-04-05");
    expect(at("2026-04-05T13:30:00Z")).toBe("2026-04-05");
  });

  test("agrees with Intl across a full year of morning instants", () => {
    for (let month = 0; month < 12; month++) {
      // 22:00Z on the last day of each month is early morning in Melbourne.
      const instant = new Date(Date.UTC(2026, month + 1, 0, 22, 0, 0)).toISOString();
      expect(at(instant)).toBe(melbourneDate(instant));
    }
  });

  test("always returns a YYYY-MM-DD string", () => {
    expect(at("2026-08-31T22:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addPeriod — monthly clamps to the last valid day", () => {
  // DEF-003. setUTCMonth overflowed: 31 January + 1 month became 3 March,
  // skipping February entirely and then firing on the 3rd of every month after.
  test("31 January lands on the last day of February", () => {
    expect(addPeriod("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  test("31 January lands on 29 February in a leap year", () => {
    expect(addPeriod("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  test("31 March lands on 30 April", () => {
    expect(addPeriod("2026-03-31", "monthly")).toBe("2026-04-30");
  });

  test("30 January lands on the last day of February", () => {
    expect(addPeriod("2026-01-30", "monthly")).toBe("2026-02-28");
    expect(addPeriod("2028-01-30", "monthly")).toBe("2028-02-29");
  });

  test("a day that exists in the target month is left alone", () => {
    expect(addPeriod("2026-01-15", "monthly")).toBe("2026-02-15");
    expect(addPeriod("2026-02-28", "monthly")).toBe("2026-03-28");
  });

  test("rolls over the year", () => {
    expect(addPeriod("2026-12-31", "monthly")).toBe("2027-01-31");
    expect(addPeriod("2026-12-15", "monthly")).toBe("2027-01-15");
  });
});

describe("addPeriod — the anchor keeps the intended day of month", () => {
  // Clamping the stored date and advancing from it would degrade a rule due on
  // the 31st to the 28th forever. The anchor is the day the rule is meant to
  // fall on; it survives the clamp.
  test("an anchored rule returns to its day after a short month", () => {
    expect(addPeriod("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(addPeriod("2026-04-30", "monthly", 31)).toBe("2026-05-31");
  });

  test("the anchor still clamps when the target month is short", () => {
    expect(addPeriod("2027-01-31", "monthly", 31)).toBe("2027-02-28");
  });

  test("without an anchor the day of the given date is used", () => {
    expect(addPeriod("2026-02-28", "monthly")).toBe("2026-03-28");
  });

  test("a 31st rule holds its day for two years without drifting", () => {
    const anchor = 31;
    let date = "2026-01-31";
    // 26 cycles from January 2026 runs February 2026 through March 2028, so the
    // window covers two ordinary Februaries and the leap one in 2028.
    const seen = [];
    for (let i = 0; i < 26; i++) {
      date = addPeriod(date, "monthly", anchor);
      seen.push(date);
    }

    // Every occurrence is either the 31st or the last day of a shorter month —
    // never the 2nd or the 3rd, which is where the old overflow landed.
    for (const iso of seen) {
      const [y, m] = iso.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      expect(dayOfMonth(iso)).toBe(Math.min(anchor, lastDay));
    }

    // One occurrence per month, no month skipped and none doubled.
    const months = seen.map(monthKey);
    expect(new Set(months).size).toBe(26);
    expect(months[0]).toBe("2026-02");
    expect(months[25]).toBe("2028-03");

    // The specific dates the old code got wrong.
    expect(seen.slice(0, 5)).toEqual([
      "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
    ]);
    expect(seen[12]).toBe("2027-02-28"); // ordinary February
    expect(seen[24]).toBe("2028-02-29"); // leap February
  });
});

describe("addPeriod — weekly and fortnightly are unchanged", () => {
  test("weekly adds seven days", () => {
    expect(addPeriod("2026-01-31", "weekly")).toBe("2026-02-07");
    expect(addPeriod("2026-06-15", "weekly")).toBe("2026-06-22");
    expect(addPeriod("2026-12-28", "weekly")).toBe("2027-01-04");
  });

  test("fortnightly adds fourteen days", () => {
    expect(addPeriod("2026-01-31", "fortnightly")).toBe("2026-02-14");
    expect(addPeriod("2026-06-15", "fortnightly")).toBe("2026-06-29");
    expect(addPeriod("2026-12-28", "fortnightly")).toBe("2027-01-11");
  });

  test("day counting is unaffected by daylight saving", () => {
    // 4 October 2026 is the day Melbourne loses an hour. A weekly rule either
    // side of it still advances by exactly seven calendar days.
    expect(addPeriod("2026-10-01", "weekly")).toBe("2026-10-08");
    expect(addPeriod("2026-04-02", "weekly")).toBe("2026-04-09");
  });

  test("weekly and fortnightly ignore the anchor", () => {
    expect(addPeriod("2026-01-31", "weekly", 31)).toBe("2026-02-07");
    expect(addPeriod("2026-01-31", "fortnightly", 31)).toBe("2026-02-14");
  });

  test("leap day is counted", () => {
    expect(addPeriod("2028-02-25", "weekly")).toBe("2028-03-03");
    expect(addPeriod("2026-02-25", "weekly")).toBe("2026-03-04");
  });
});

describe("dayOfMonth", () => {
  test("reads the day out of an ISO date", () => {
    expect(dayOfMonth("2026-01-31")).toBe(31);
    expect(dayOfMonth("2026-02-01")).toBe(1);
  });

  test("returns 0 for a missing date so callers can fall back", () => {
    expect(dayOfMonth("")).toBe(0);
    expect(dayOfMonth(undefined)).toBe(0);
  });
});
