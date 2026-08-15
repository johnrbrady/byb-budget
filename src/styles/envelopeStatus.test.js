import fs from "fs";
import path from "path";
import {
  envelopeStatus, fillFraction, statusColour, statusSoft,
  STATUS_OK, STATUS_LOW, STATUS_OVER,
} from "./envelopeStatus.js";

describe("envelopeStatus", () => {
  test("an envelope holding its base is on track", () => {
    expect(envelopeStatus(400, 400)).toBe(STATUS_OK);
  });

  test("comfortably above a fifth of base is on track", () => {
    expect(envelopeStatus(81, 400)).toBe(STATUS_OK);
  });

  test("under a fifth of base is running low", () => {
    expect(envelopeStatus(79, 400)).toBe(STATUS_LOW);
  });

  test("exactly a fifth is not yet low", () => {
    expect(envelopeStatus(80, 400)).toBe(STATUS_OK);
  });

  test("a negative balance is overspent whatever the base", () => {
    expect(envelopeStatus(-1, 400)).toBe(STATUS_OVER);
    expect(envelopeStatus(-1, 0)).toBe(STATUS_OVER);
  });

  // The pre-token code read `balance < base * 0.2`, which with base 0 is
  // `balance < 0` and therefore never low. Same answer here, deliberately: an
  // envelope with no monthly amount set is not "running low", it is unset.
  test("an envelope with no base set is never low, only overspent or fine", () => {
    expect(envelopeStatus(0, 0)).toBe(STATUS_OK);
    expect(envelopeStatus(5, 0)).toBe(STATUS_OK);
    expect(envelopeStatus(-5, 0)).toBe(STATUS_OVER);
  });
});

describe("fillFraction", () => {
  test("is the plain ratio in the ordinary case", () => {
    expect(fillFraction(200, 400)).toBe(0.5);
  });

  test("clamps at full rather than overflowing the bar", () => {
    expect(fillFraction(900, 400)).toBe(1);
  });

  test("clamps at empty for an overdrawn envelope", () => {
    expect(fillFraction(-50, 400)).toBe(0);
  });

  test("is empty when there is no base to measure against", () => {
    expect(fillFraction(100, 0)).toBe(0);
  });
});

describe("status colours resolve to tokens, not literals", () => {
  test("each status maps to its own custom property", () => {
    expect(statusColour(STATUS_OK)).toBe("var(--byb-ok)");
    expect(statusColour(STATUS_LOW)).toBe("var(--byb-low)");
    expect(statusColour(STATUS_OVER)).toBe("var(--byb-over)");
    expect(statusSoft(STATUS_OVER)).toBe("var(--byb-over-soft)");
  });
});

// The stylesheet is the only place these values exist, and jsdom does not apply
// it (CSS is stubbed for the component suite), so the contract is checked
// against the source. It is the guard that matters: the whole point of the
// status palette is that it is not the brand green, and nothing else would
// notice if someone set --byb-ok back to #7FB069.
describe("design tokens in global.css", () => {
  const css = fs.readFileSync(path.join(__dirname, "global.css"), "utf8");

  const block = (selector) => {
    const i = css.indexOf(selector);
    expect(i).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf("}", i));
  };
  const value = (scope, name) => {
    const m = scope.match(new RegExp(`${name}:\\s*([^;]+);`));
    return m ? m[1].trim().toLowerCase() : null;
  };

  const light = block(":root {");
  const dark = block('[data-theme="dark"] {');

  test("the brand green is unchanged", () => {
    expect(value(light, "--byb-primary")).toBe("#7fb069");
    expect(value(light, "--byb-secondary")).toBe("#b8d4ae");
  });

  test.each([["--byb-ok"], ["--byb-low"], ["--byb-over"]])(
    "%s is defined in both themes and is not the brand green",
    (token) => {
      const l = value(light, token);
      const d = value(dark, token);
      expect(l).toMatch(/^#[0-9a-f]{6}$/);
      expect(d).toMatch(/^#[0-9a-f]{6}$/);
      expect(l).not.toBe("#7fb069");
      expect(d).not.toBe("#7fb069");
      // and not the deep brand green either, which is what used to stand in
      // for "positive" and caused the muddle.
      expect(l).not.toBe("#5f8a4f");
      expect(d).not.toBe("#5f8a4f");
    }
  );

  test("the three statuses are distinguishable from each other", () => {
    for (const theme of [light, dark]) {
      const trio = ["--byb-ok", "--byb-low", "--byb-over"].map((t) => value(theme, t));
      expect(new Set(trio).size).toBe(3);
    }
  });

  test.each([
    ["--byb-space-4"], ["--byb-radius"], ["--byb-elev-1"],
    ["--byb-text-base"], ["--byb-header-h"], ["--byb-bottom-nav-h"],
  ])("the %s primitive is defined", (token) => {
    expect(value(light, token)).toBeTruthy();
  });

  test("both themes redefine the surface ramp and elevation", () => {
    for (const token of ["--byb-surface", "--byb-surface-alt", "--byb-surface-sunken", "--byb-elev-1"]) {
      expect(value(dark, token)).toBeTruthy();
    }
    // Dark is a ramp, not one flat near-black repeated.
    const ramp = ["--byb-surface", "--byb-surface-alt", "--byb-surface-sunken"].map((t) => value(dark, t));
    expect(new Set(ramp).size).toBe(3);
  });

  test("the header height token has a phone value as well", () => {
    const mq = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(mq).toMatch(/--byb-header-h:\s*\d+px;/);
  });

  // The whole reason the token exists: a heading pinned at top:0 slides under
  // the sticky app header.
  test("sticky month headings pin to the header-height token, not to zero", () => {
    const heading = block(".byb-month-heading {");
    expect(heading).toMatch(/position:\s*sticky/);
    expect(heading).toMatch(/top:\s*var\(--byb-header-h\)/);

    const cell = block(".byb-month-heading-cell {");
    expect(cell).toMatch(/top:\s*var\(--byb-header-h\)/);
  });

  test("reduced motion is still honoured globally", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});

// buildStyles is meant to hold layout, not primitives. This is the check that
// it stays that way — a stray hex or px radius creeping back in is exactly the
// drift the token layer was introduced to stop.
describe("buildStyles holds no primitives", () => {
  const src = fs.readFileSync(path.join(__dirname, "buildStyles.js"), "utf8");
  const code = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  test("no literal hex colours", () => {
    // #FFF on white-on-primary button text is the one deliberate literal.
    const hexes = (code.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).filter((h) => h.toUpperCase() !== "#FFF");
    expect(hexes).toEqual([]);
  });

  test("colours, radii and shadows all come through custom properties", () => {
    for (const token of ["--byb-surface", "--byb-radius", "--byb-elev-1", "--byb-text-base", "--byb-header-h"]) {
      expect(code).toContain(token);
    }
  });
});
