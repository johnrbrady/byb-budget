import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";

// Horizontal swipe between top-level tabs, tracking the finger.
//
// The view is moved by writing `transform` straight onto the track element
// rather than by holding the offset in state. A gesture produces a touchmove
// every frame, and BudgetApp rebuilds its whole styles object on every render,
// so re-rendering the app sixty times a second to drag a panel is precisely the
// lag the gesture is supposed to remove.
//
// The transform is removed again once the view is at rest. A live `transform`
// (and `will-change: transform`) makes the element a containing block, which
// would re-anchor the `position: fixed` FAB and the long-press sheets that live
// inside the view. They are only re-anchored while a gesture is actually in
// flight, where they travel with the page, which is what a page transition
// should look like anyway.

const SWIPING_CLASS = "byb-swiping";

// Below this much travel the gesture has not declared itself yet.
const AXIS_LOCK_PX = 10;
// Horizontal has to beat vertical by this much to be a swipe rather than a
// scroll. Same ratio the previous release-time check used.
const AXIS_RATIO = 1.5;

// Commit thresholds. Either far enough, or fast enough to mean it.
const COMMIT_FRACTION = 0.22;
const COMMIT_MIN_PX = 56;
const COMMIT_MAX_PX = 120;
const FLICK_VELOCITY = 0.45; // px per ms
const FLICK_MIN_PX = 24;

// Past the first or last tab there is nowhere to go, so the view resists rather
// than sliding away from something that will not arrive.
const EDGE_RESISTANCE = 0.32;

// The exit is timed off the distance still to travel at the speed the finger
// left at, so a hard flick finishes quickly and a slow drag lands gently.
const EXIT_MIN_MS = 90;
const EXIT_MAX_MS = 220;
const ENTER_MS = 230;
const CANCEL_MS = 190;

const now = () =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param enabled    false while a modal is open or a view owns the gesture itself
 * @param index      index of the current view within the tab order
 * @param count      how many tabs there are
 * @param onNavigate called with the index to move to
 * @param ignore     extra CSS selector for elements that own horizontal drags
 */
export function useSwipeNavigation({ enabled = true, index, count, onNavigate, ignore = "" }) {
  const trackRef = useRef(null);
  // The DOM node touchstart/touchmove/touchend are bound to (data-swipe-surface
  // in BudgetApp.jsx). Holds the node itself so the surfaceRef callback below
  // can find the previous element to unbind from — trackRef is what the
  // gesture actually moves.
  const surfaceEl = useRef(null);

  // Gesture state is a ref, not state: none of it should cause a render.
  const g = useRef({ active: false, axis: null, startX: 0, startY: 0, dx: 0, lastX: 0, lastT: 0, v: 0, animating: false });

  // Handlers are spread onto a JSX element, so they are recreated cheaply; the
  // props they close over are read through a ref so a mid-gesture re-render
  // cannot leave a settle animation navigating from a stale index.
  const latest = useRef(null);
  latest.current = { enabled, index, count, onNavigate, ignore };

  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const trackWidth = () => {
    const el = trackRef.current;
    // Both jsdom and a first paint before layout report 0.
    return (el && el.offsetWidth) || (typeof window !== "undefined" && window.innerWidth) || 360;
  };

  const setX = (px, ms) => {
    const el = trackRef.current;
    if (!el) return;
    if (ms) el.style.transitionDuration = `${ms}ms`;
    else el.style.removeProperty("transition-duration");
    el.style.transform = `translate3d(${px}px, 0, 0)`;
  };

  // Back to rest: no transform, no transition, no containing block.
  const rest = () => {
    const el = trackRef.current;
    g.current.animating = false;
    if (!el) return;
    el.style.removeProperty("transform");
    el.style.removeProperty("transition-duration");
    // Safe to touch classList directly: React renders this element with a
    // constant className, so it never diffs and never overwrites what we set.
    el.classList.remove(SWIPING_CLASS);
  };

  const disarm = () => {
    g.current.active = false;
    g.current.axis = null;
    g.current.dx = 0;
    g.current.v = 0;
  };

  const onTouchStart = useCallback((e) => {
    const { enabled: on, ignore: extra } = latest.current;
    disarm();
    if (!on || g.current.animating) return;
    if (!e.touches || e.touches.length !== 1) return;

    // Elements that own the horizontal axis themselves.
    //
    // This guard used to include `[data-env-id]`, which sits on every envelope
    // card. The card grid fills the Envelopes screen, so the guard killed swipe
    // on the one tab where it was most obviously expected — only the gaps
    // between cards responded. Reordering starts from the drag handle, so the
    // handle is what needs protecting, and it says so itself.
    const sel = `input, select, textarea, [data-swipe-ignore]${extra ? `, ${extra}` : ""}`;
    if (e.target && e.target.closest && e.target.closest(sel)) return;

    const t = e.touches[0];
    g.current.active = true;
    g.current.startX = t.clientX;
    g.current.startY = t.clientY;
    g.current.lastX = t.clientX;
    g.current.lastT = now();
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!g.current.active) return;
    if (!e.touches || e.touches.length !== 1) { disarm(); rest(); return; }

    const t = e.touches[0];
    const dx = t.clientX - g.current.startX;
    const dy = t.clientY - g.current.startY;

    // Decide the axis once, then commit to it. Re-deciding every frame is what
    // makes a gesture fight the scroller halfway down a long list.
    if (!g.current.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) { disarm(); return; } // it is a scroll
      g.current.axis = "h";
      // Reduced motion gets the destination, not the journey: no tracking, and
      // on release the change is instant.
      if (!prefersReducedMotion()) {
        const el = trackRef.current;
        if (el) el.classList.add(SWIPING_CLASS);
      }
    }

    // Hold the axis against native scrolling. touch-action: pan-y (buildStyles.js)
    // lets the browser start a native vertical pan on its own timetable, without
    // waiting for this handler, the moment early finger travel looks even
    // slightly vertical — which is nearly every real swipe's first frame or two
    // once the page is scrolled and there is somewhere for a pan to go. By the
    // time the axis above has actually locked "h", the browser may already have
    // claimed the gesture, and once it has, nothing here can take it back. What
    // preventDefault CAN still do is stop that claim on every subsequent frame
    // of this same gesture — including the one that just locked — so the browser
    // is not free to (re)commit to a vertical pan while this drag continues. A
    // "v" axis already returned above without reaching here, and an undecided
    // one returned even earlier: only a swipe ever cancels anything.
    if (g.current.axis === "h" && e.cancelable) e.preventDefault();

    const dt = now() - g.current.lastT;
    if (dt >= 1) {
      g.current.v = (t.clientX - g.current.lastX) / dt;
      g.current.lastX = t.clientX;
      g.current.lastT = now();
    }
    g.current.dx = dx;

    if (prefersReducedMotion()) return;

    // Rubber-band when there is no tab in that direction.
    const { index: i, count: n } = latest.current;
    const blocked = (dx < 0 && i >= n - 1) || (dx > 0 && i <= 0);
    setX(blocked ? dx * EDGE_RESISTANCE : dx, 0);
  }, []);

  // touchmove is bound here, natively and non-passively, instead of through the
  // JSX handlers below. React itself attaches touchmove as a passive listener
  // (see the touch-action comment on `content` in buildStyles.js) — inside a
  // passive listener e.preventDefault() is a silently-ignored no-op, so the
  // conditional call above would do nothing if this were an onTouchMove prop.
  // { passive: false } is what makes it live. touchstart/end/cancel stay as
  // ordinary JSX handlers in the object returned below: none of them ever calls
  // preventDefault, so passive (React's default) costs them nothing.
  //
  // A callback ref, not a plain ref plus a mount-time effect: BudgetApp only
  // renders this surface once the shell replaces the login screen, which can
  // happen on the first render (a token already in localStorage) or many
  // renders later (signing in fresh, with no reload in between). A useEffect
  // keyed on this stable, empty-deps onTouchMove would run exactly once and
  // could easily take that one run before the surface ever exists — after
  // which its unchanging dependency array would never fire it again for the
  // rest of the session. A callback ref instead runs exactly when the DOM
  // node itself appears or disappears, whichever render that turns out to be,
  // so login timing cannot skip it.
  const surfaceRef = useCallback((el) => {
    if (surfaceEl.current) surfaceEl.current.removeEventListener("touchmove", onTouchMove);
    surfaceEl.current = el;
    if (el) el.addEventListener("touchmove", onTouchMove, { passive: false });
  }, [onTouchMove]);

  const settle = useCallback((committed, dir) => {
    const { index: i, onNavigate: go } = latest.current;
    const el = trackRef.current;
    const dx = g.current.dx;
    const speed = Math.max(Math.abs(g.current.v), 1.4);

    if (!committed) {
      g.current.animating = true;
      setX(0, CANCEL_MS);
      later(rest, CANCEL_MS);
      return;
    }

    const target = i + (dir < 0 ? 1 : -1);
    const w = trackWidth();
    const out = dir < 0 ? -w : w;
    const exitMs = Math.min(EXIT_MAX_MS, Math.max(EXIT_MIN_MS, Math.abs(out - dx) / speed));

    g.current.animating = true;
    setX(out, exitMs);

    later(() => {
      // The view has to be swapped before the track is repositioned, or it is
      // the outgoing view that slides back in for a frame.
      flushSync(() => go(target));
      setX(-out, 0);
      // Force a style flush so the jump is recorded as a start position rather
      // than being collapsed into the transition that follows it.
      if (el) void el.offsetWidth;
      setX(0, ENTER_MS);
      later(rest, ENTER_MS);
    }, exitMs);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!g.current.active) return;
    const horizontal = g.current.axis === "h";
    const dx = g.current.dx;
    const v = g.current.v;
    disarm();
    if (!horizontal) return;

    const { index: i, count: n, onNavigate: go } = latest.current;
    const dir = dx < 0 ? -1 : 1;
    const target = i + (dir < 0 ? 1 : -1);
    const reachable = target >= 0 && target < n;

    const distance = Math.min(COMMIT_MAX_PX, Math.max(COMMIT_MIN_PX, trackWidth() * COMMIT_FRACTION));
    const committed =
      reachable && (Math.abs(dx) >= distance || (Math.abs(v) >= FLICK_VELOCITY && Math.abs(dx) >= FLICK_MIN_PX));

    if (prefersReducedMotion()) {
      rest();
      if (committed) go(target);
      return;
    }
    settle(committed, dir);
  }, [settle]);

  const onTouchCancel = useCallback(() => {
    if (!g.current.active) return;
    const horizontal = g.current.axis === "h";
    disarm();
    if (!horizontal || prefersReducedMotion()) { rest(); return; }
    settle(false, 0);
  }, [settle]);

  // onTouchMove is not in here: the surfaceRef callback above binds it
  // imperatively so it can be non-passive, instead of spreading it onto the
  // JSX element with the rest.
  return { trackRef, surfaceRef, handlers: { onTouchStart, onTouchEnd, onTouchCancel } };
}
