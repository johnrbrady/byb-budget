import { useRef, useCallback } from "react";

// Long-press detection for touch devices. Returns handlers to spread onto an
// element. Fires onLongPress after `ms` if the finger hasn't moved more than
// `tolerance` px. A normal tap still triggers click as usual.
export function useLongPress(onLongPress, { ms = 500, tolerance = 8 } = {}) {
  const state = useRef({ timer: null, startX: 0, startY: 0, fired: false });

  const clear = useCallback(() => {
    if (state.current.timer) { clearTimeout(state.current.timer); state.current.timer = null; }
  }, []);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    state.current.startX = t.clientX;
    state.current.startY = t.clientY;
    state.current.fired = false;
    clear();
    state.current.timer = setTimeout(() => {
      state.current.fired = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onLongPress(e);
    }, ms);
  }, [onLongPress, ms, clear]);

  const onTouchMove = useCallback((e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - state.current.startX) > tolerance || Math.abs(t.clientY - state.current.startY) > tolerance) {
      clear();
    }
  }, [tolerance, clear]);

  const onTouchEnd = useCallback((e) => {
    clear();
    // Suppress the synthetic click that follows a long press
    if (state.current.fired) {
      e.preventDefault();
    }
  }, [clear]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: clear, longPressFired: () => state.current.fired };
}
