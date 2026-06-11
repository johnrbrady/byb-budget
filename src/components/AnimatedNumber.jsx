import React, { useEffect, useRef, useState } from "react";
import { fmtAUD } from "../lib/utils.js";

// Animates currency values with a short tick when they change.
export function AnimatedCurrency({ value, duration = 400, style, ...props }) {
  const [display, setDisplay] = useState(value || 0);
  const prevRef = useRef(value || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value || 0;
    prevRef.current = to;
    if (from === to) { setDisplay(to); return; }

    // Respect reduced-motion preferences
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }} {...props}>{fmtAUD(display)}</span>;
}
