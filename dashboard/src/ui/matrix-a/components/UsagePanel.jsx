import React from "react";

import { copy } from "../../../lib/copy.js";
import { AsciiBox } from "./AsciiBox.jsx";
import { MatrixButton } from "./MatrixButton.jsx";
import { ScrambleText } from "./ScrambleText.jsx";

function normalizePeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods.map((p) => {
    if (typeof p === "string") {
      return { key: p, label: p.toUpperCase() };
    }
    return { key: p.key, label: p.label || String(p.key).toUpperCase() };
  });
}

export const UsagePanel = React.memo(function UsagePanel({
  title = copy("usage.panel.title"),
  period,
  periods,
  onPeriodChange,
  metrics = [],
  showSummary = false,
  summaryLabel = copy("usage.summary.total_system_output"),
  summaryValue = "—",
  summaryCostValue,
  onCostInfo,
  costInfoLabel = copy("usage.cost_info.label"),
  costInfoIcon = copy("usage.cost_info.icon"),
  summarySubLabel,
  breakdown,
  breakdownCollapsed = false,
  onToggleBreakdown,
  collapseLabel,
  expandLabel,
  collapseAriaLabel,
  expandAriaLabel,
  useSummaryLayout = false,
  onRefresh,
  loading = false,
  error,
  rangeLabel,
  rangeTimeZoneLabel,
  statusLabel,
  summaryAnimate = true,
  summaryScrambleDurationMs = 2200,
  className = "",
}) {
  const tabs = normalizePeriods(periods);
  const toggleLabel = breakdownCollapsed ? expandLabel : collapseLabel;
  const toggleAriaLabel = breakdownCollapsed
    ? expandAriaLabel
    : collapseAriaLabel;
  const showBreakdownToggle = Boolean(onToggleBreakdown && toggleLabel);
  const costLabelText = typeof costInfoIcon === "string" ? costInfoIcon : "";
  const costLabelMatch = costLabelText.match(/^\[\s*(.+?)\s*\]$/);
  const costLabelCore = costLabelMatch ? costLabelMatch[1] : null;
  const breakdownRows =
    breakdown && breakdown.length
      ? breakdown
      : [
          {
            key: copy("usage.metric.input"),
            label: copy("usage.metric.input"),
          },
          {
            key: copy("usage.metric.output"),
            label: copy("usage.metric.output"),
          },
          {
            key: copy("usage.metric.cached_input"),
            label: copy("usage.metric.cached_short"),
          },
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
      <div className="flex flex-wrap items-center justify-between border-b border-matrix-ghost mb-3 pb-2 gap-4 px-2">
        <div className="flex flex-wrap gap-4">
          {tabs.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`text-caption uppercase font-bold ${
                period === p.key
                  ? "text-matrix-bright border-b-2 border-matrix-primary"
                  : "text-matrix-muted"
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
              <span className="text-caption uppercase font-bold text-matrix-muted">
                {statusLabel}
              </span>
            ) : null}
            {showBreakdownToggle ? (
              <MatrixButton
                className="px-2 py-1"
                aria-label={toggleAriaLabel}
                title={toggleAriaLabel}
                onClick={onToggleBreakdown}
              >
                {toggleLabel}
              </MatrixButton>
            ) : null}
            {onRefresh ? (
              <MatrixButton primary disabled={loading} onClick={onRefresh}>
                {loading
                  ? copy("usage.button.loading")
                  : copy("usage.button.refresh")}
              </MatrixButton>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="text-caption text-red-400/90 px-2 py-1">
          {copy("shared.error.prefix", { error })}
        </div>
      ) : null}

      {showSummary || useSummaryLayout ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-90 py-4">
          <div className="text-center relative">
            <div className="text-heading text-matrix-muted mb-2">
              {summaryLabel}
            </div>
            <div className="text-5xl md:text-8xl font-black text-white tracking-[-0.06em] tabular-nums leading-none glow-text select-none">
              {summaryValue && summaryValue !== "—" ? (
                <span className="relative inline-block leading-none">
                  {summaryAnimate ? (
                    <ScrambleText
                      text={summaryValue}
                      durationMs={summaryScrambleDurationMs}
                      startScrambled
                      respectReducedMotion
                    />
                  ) : (
                    summaryValue
                  )}
                </span>
              ) : (
                summaryValue
              )}
            </div>
            {summaryCostValue ? (
              <div className="flex items-center justify-center gap-3 mt-4 md:mt-6">
                <span className="sr-only">
                  {copy("usage.metric.total_cost")}
                </span>
                <span className="text-xl md:text-2xl font-bold text-gold leading-none drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                  {summaryCostValue}
                </span>
                {onCostInfo ? (
                  <button
                    type="button"
                    onClick={onCostInfo}
                    title={costInfoLabel}
                    aria-label={costInfoLabel}
                    className="group inline-flex items-center gap-1 text-[10px] uppercase font-black text-gold tracking-[0.25em] transition-all hover:text-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  >
                    {costLabelCore ? (
                      <>
                        <span className="transition-transform duration-150 group-hover:-translate-x-0.5">
                          [
                        </span>
                        <span className="group-hover:animate-pulse">
                          {costLabelCore}
                        </span>
                        <span className="transition-transform duration-150 group-hover:translate-x-0.5">
                          ]
                        </span>
                      </>
                    ) : (
                      <span>{costInfoIcon}</span>
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
            {summarySubLabel ? (
              <div className="text-caption text-matrix-muted mt-2">
                {summarySubLabel}
              </div>
            ) : null}
          </div>

          {!breakdownCollapsed && breakdownRows.length ? (
            <div className="w-full px-6">
              <div className="grid grid-cols-2 gap-3 border-t border-b border-matrix-ghost py-4 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-matrix-ghost"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-[1px] bg-matrix-dim"></div>

                {breakdownRows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="flex flex-col items-center p-3 bg-matrix-panel border border-matrix-ghost"
                  >
                    <span className="text-caption text-matrix-muted uppercase mb-1">
                      {row.label}
                    </span>
                    <span className="text-body font-bold text-matrix-primary tracking-tight">
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
              className="border border-matrix-ghost bg-matrix-panel p-4 text-center"
            >
              <div className="text-caption uppercase text-matrix-muted mb-2">
                {row.label}
              </div>
              <div
                className={`text-body font-black text-matrix-bright glow-text ${
                  row.valueClassName || ""
                }`}
              >
                {row.value}
              </div>
              {row.subValue ? (
                <div className="text-caption text-matrix-muted mt-2">
                  {row.subValue}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {rangeLabel ? (
        <div className="mt-3 text-caption uppercase text-matrix-dim font-bold px-2">
          {copy("usage.range_label", { range: rangeLabel })}
          {rangeTimeZoneLabel ? ` ${rangeTimeZoneLabel}` : ""}
        </div>
      ) : null}
    </AsciiBox>
  );
});
