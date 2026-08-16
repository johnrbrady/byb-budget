import React, { useEffect, useMemo, useRef, useState } from "react";
import { fmtAUD, formatMonth, todayISO } from "../lib/utils.js";
import { categorySpendingReport } from "../lib/reporting.js";
import { MonthlyBarChart } from "./MonthlyBarChart.jsx";

const PAGE_SIZE = 4;

function Comparison({ report, styles }) {
  const latest = report.series[report.series.length - 1].month;
  const prior = report.series.length > 1 ? report.series[report.series.length - 2].month : null;
  const change = Math.abs(report.change);
  let summary = "No change from last month";
  if (report.direction !== "steady") {
    const verb = report.direction === "up" ? "Up" : "Down";
    const percent = report.percentChange == null ? "" : ` (${Math.abs(report.percentChange).toFixed(0)}%)`;
    summary = `${verb} ${fmtAUD(change)}${percent} from last month`;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: styles.isMobile ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))", gap: 8, margin: "12px 0 4px" }}>
      <div>
        <div style={styles.kpiLabel}>{formatMonth(latest)}</div>
        <div style={{ fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>{fmtAUD(report.current)}</div>
      </div>
      {prior && (
        <div>
          <div style={styles.kpiLabel}>{formatMonth(prior)}</div>
          <div style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums", color: styles.textMuted }}>{fmtAUD(report.previous)}</div>
        </div>
      )}
      <div style={{ gridColumn: styles.isMobile ? "1 / -1" : "auto" }}>
        <div style={styles.kpiLabel}>Month to month</div>
        <div
          data-testid={`category-change-${report.category.id}`}
          style={{ fontWeight: 700, color: report.direction === "up" ? "var(--byb-low)" : report.direction === "down" ? "var(--byb-ok)" : styles.textMuted }}
        >
          {summary}
        </div>
      </div>
    </div>
  );
}

function CategorySection({ report, onNavigateToCategory, styles }) {
  const id = `category-spending-${report.category.id}`;
  return (
    <section aria-labelledby={`${id}-title`} data-testid={id} style={{ ...styles.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div id={`${id}-title`} style={{ fontSize: 17, fontWeight: 750, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={styles.pill(report.category.colour || "#999")}>{report.category.name}</span>
            <span style={{ fontSize: 12, color: styles.textMuted, fontWeight: 500 }}>{fmtAUD(report.total)} in this period</span>
          </div>
        </div>
        {!report.category.deleted && onNavigateToCategory && (
          <button
            style={{ ...styles.buttonGhost, padding: "5px 9px", minHeight: 36, whiteSpace: "nowrap", fontSize: 12 }}
            onClick={() => onNavigateToCategory(report.category.id)}
          >
            View entries
          </button>
        )}
      </div>
      <Comparison report={report} styles={styles} />
      <MonthlyBarChart series={report.series} colour={report.category.colour} label={report.category.name} />
    </section>
  );
}

export function CategorySpendingTrends({ transactions, categories, activeMonth, onNavigateToCategory, styles }) {
  const [months, setMonths] = useState(5);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);
  const endMonth = activeMonth || todayISO().slice(0, 7);
  const reports = useMemo(
    () => categorySpendingReport(transactions, categories, { endMonth, months }),
    [transactions, categories, endMonth, months],
  );
  const hasMore = visibleCount < reports.length;

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [months, endMonth]);
  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver !== "function" || !sentinelRef.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((count) => Math.min(count + PAGE_SIZE, reports.length));
    }, { rootMargin: "180px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, reports.length, visibleCount]);

  return (
    <div>
      <div style={{ ...styles.sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span>Spending by category</span>
        <span role="group" aria-label="Category chart period" style={{ display: "inline-flex", gap: 4, padding: 3, border: `1px solid ${styles.border}`, borderRadius: "var(--byb-radius-sm)", background: "var(--byb-surface-sunken)" }}>
          {[[5, "5 months"], [12, "1 year"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={months === value}
              onClick={() => setMonths(value)}
              style={{ ...styles.buttonGhost, minHeight: 36, padding: "5px 10px", border: "none", background: months === value ? "var(--byb-surface)" : "transparent", boxShadow: months === value ? "var(--byb-elev-1)" : "none", fontSize: 12 }}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      <div style={{ color: styles.textMuted, fontSize: 12, lineHeight: 1.5, margin: "-4px 0 12px" }}>
        Spending only. BYB does not yet retain past budget amounts, so these charts compare what left each envelope, not whether it was over or under budget.
      </div>
      {reports.slice(0, visibleCount).map((report) => (
        <CategorySection key={report.category.id} report={report} onNavigateToCategory={onNavigateToCategory} styles={styles} />
      ))}
      {reports.length === 0 && <div style={{ ...styles.card, color: styles.textMuted }}>No expense categories yet.</div>}
      {hasMore && (
        <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: "4px 0 12px" }}>
          <button style={styles.buttonGhost} onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, reports.length))}>
            Show more categories ({reports.length - visibleCount})
          </button>
        </div>
      )}
    </div>
  );
}
