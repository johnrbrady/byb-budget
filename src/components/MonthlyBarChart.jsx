import React from "react";
import { fmtAUD, formatMonth, formatMonthShort } from "../lib/utils.js";

export function MonthlyBarChart({ series, colour, label }) {
  const width = 360;
  const height = 176;
  const plotTop = 18;
  const baseline = 132;
  const plotHeight = baseline - plotTop;
  const slot = width / Math.max(1, series.length);
  const barWidth = Math.max(10, Math.min(34, slot * 0.58));
  const maxAmount = Math.max(0, ...series.map((point) => point.amount));
  if (maxAmount === 0) {
    return (
      <div role="img" aria-label={`${label} spending by month: no spending in this period`}
        style={{ minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--byb-text-muted)", fontSize: 12 }}>
        No spending in this period.
      </div>
    );
  }
  const max = maxAmount;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`${label} spending by month`}
      style={{ display: "block", overflow: "visible" }}
    >
      <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="var(--byb-border-strong)" strokeWidth="1" />
      {series.map((point, index) => {
        const barHeight = (point.amount / max) * plotHeight;
        const x = (index * slot) + ((slot - barWidth) / 2);
        const y = baseline - barHeight;
        const current = index === series.length - 1;
        return (
          <g key={point.month} data-testid={`spending-bar-${point.month}`} data-value={point.amount}>
            <title>{formatMonth(point.month)}: {fmtAUD(point.amount)}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="3"
              fill={colour || "var(--byb-primary)"}
              opacity={current ? 1 : 0.72}
            />
            <text
              x={(index * slot) + (slot / 2)}
              y={baseline + 18}
              textAnchor="middle"
              fill="var(--byb-text-muted)"
              fontSize={series.length > 5 ? 9 : 10}
            >
              {formatMonthShort(point.month).split(" ")[0].slice(0, 3)}
            </text>
          </g>
        );
      })}
      <text x="0" y="10" fill="var(--byb-text-muted)" fontSize="9">{fmtAUD(max)}</text>
      <text x="0" y={baseline - 4} fill="var(--byb-text-muted)" fontSize="9">$0</text>
    </svg>
  );
}
