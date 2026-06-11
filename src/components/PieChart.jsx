import React from "react";

export function PieChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (total <= 0) return <div style={{ fontSize: 13, color: "#9AA09A", textAlign: "center", padding: 20 }}>No data</div>;
  let angle = -Math.PI / 2;
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;
  const segments = data.filter((d) => d.value > 0).map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    return { path: `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`, colour: d.colour, label: d.label, value: d.value, pct: (d.value / total) * 100 };
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {segments.map((s, i) => <path key={i} d={s.path} fill={s.colour} />)}
      </svg>
      <div style={{ flex: 1, minWidth: 120 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.colour, flexShrink: 0 }} />
            <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
