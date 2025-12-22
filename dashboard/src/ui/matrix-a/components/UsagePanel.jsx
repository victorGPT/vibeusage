import React from "react";

import { copy } from "../../../lib/copy.js";
import { AsciiBox } from "./AsciiBox.jsx";
import { MatrixButton } from "./MatrixButton.jsx";

function normalizePeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods.map((p) => {
    if (typeof p === "string") {
      return { key: p, label: p.toUpperCase() };
    }
    return { key: p.key, label: p.label || String(p.key).toUpperCase() };
  });
}

export function UsagePanel({
  title = copy("usage.panel.title"),
  period,
  periods,
  onPeriodChange,
  metrics = [],
  showSummary = false,
  summaryLabel = copy("usage.summary.total_system_output"),
  summaryValue = "—",
  summarySubLabel,
  breakdown,
  useSummaryLayout = false,
  onRefresh,
  loading = false,
  error,
  rangeLabel,
  rangeTimeZoneLabel,
  statusLabel,
  className = "",
}) {
  const tabs = normalizePeriods(periods);
  const breakdownRows =
    breakdown && breakdown.length
      ? breakdown
      : [
          { key: copy("usage.metric.input"), label: copy("usage.metric.input") },
          { key: copy("usage.metric.output"), label: copy("usage.metric.output") },
          { key: copy("usage.metric.cached_input"), label: copy("usage.metric.cached_short") },
          {
            key: copy("usage.metric.reasoning_output"),
            label: copy("usage.metric.reasoning_short"),
          },
        ]
          .map((item) => {
            const match = metrics.find((row) => row.label === item.key);
            if (!match) return null;
            return { label: item.label, value: match.value };
          })
          .filter(Boolean);

  return (
    <AsciiBox title={title} className={className}>
      <div className="flex flex-wrap items-center justify-between border-b border-[#00FF41]/20 mb-2 pb-1 gap-4 px-2">
        <div className="flex flex-wrap gap-4">
          {tabs.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`text-[9px] font-black uppercase ${
                period === p.key
                  ? "text-white border-b-2 border-[#00FF41]"
                  : "text-[#00FF41]/40"
              }`}
              onClick={() => onPeriodChange?.(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {onRefresh || statusLabel ? (
          <div className="flex items-center gap-3">
            {statusLabel ? (
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-black">
                {statusLabel}
              </span>
            ) : null}
            {onRefresh ? (
              <MatrixButton primary disabled={loading} onClick={onRefresh}>
                {loading ? copy("usage.button.loading") : copy("usage.button.refresh")}
              </MatrixButton>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="text-[10px] text-red-400/90 px-2 py-1">
          {copy("shared.error.prefix", { error })}
        </div>
      ) : null}

      {showSummary || useSummaryLayout ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-90 py-4">
          <div className="text-center relative">
            <div className="text-[10px] uppercase opacity-50 tracking-widest mb-1">
              {summaryLabel}
            </div>
            <div className="text-5xl font-black text-white glow-text tracking-tighter">
              {summaryValue}
            </div>
            {summarySubLabel ? (
              <div className="text-[8px] opacity-40 mt-1 font-mono">
                {summarySubLabel}
              </div>
            ) : null}
          </div>

          {breakdownRows.length ? (
            <div className="w-full px-6">
              <div className="grid grid-cols-2 gap-3 border-t border-b border-[#00FF41]/10 py-4 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-[#00FF41]/10"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-[1px] bg-[#00FF41]/20"></div>

                {breakdownRows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="flex flex-col items-center p-2 bg-[#00FF41]/5 border border-[#00FF41]/10"
                  >
                    <span className="text-[8px] opacity-40 uppercase tracking-widest mb-1">
                      {row.label}
                    </span>
                    <span className="text-sm font-bold text-[#00FF41] font-mono tracking-tight">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-2">
          {metrics.map((row, idx) => (
            <div
              key={`${row.label}-${idx}`}
              className="border border-[#00FF41]/30 bg-[#00FF41]/5 p-4 text-center"
            >
              <div className="text-[10px] uppercase opacity-50 tracking-widest mb-2">
                {row.label}
              </div>
              <div
                className={`text-3xl md:text-4xl font-black text-white glow-text ${
                  row.valueClassName || ""
                }`}
              >
                {row.value}
              </div>
              {row.subValue ? (
                <div className="text-[8px] opacity-40 mt-1">
                  {row.subValue}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {rangeLabel ? (
        <div className="mt-3 text-[8px] opacity-30 uppercase tracking-widest font-black px-2">
          {copy("usage.range_label", { range: rangeLabel })}
          {rangeTimeZoneLabel ? ` ${rangeTimeZoneLabel}` : ""}
        </div>
      ) : null}
    </AsciiBox>
  );
}
