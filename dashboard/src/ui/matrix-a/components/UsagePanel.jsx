import { Button } from "@base-ui/react/button";
import React from "react";
import { copy } from "../../../lib/copy";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";
import { MatrixButton } from "../../foundation/MatrixButton.jsx";
import { ScrambleText } from "../../foundation/ScrambleText.jsx";

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
  refreshing = false,
  error,
  rangeLabel,
  rangeTimeZoneLabel,
  statusLabel,
  summaryAnimate = true,
  summaryScrambleDurationMs = 2200,
  hideHeader = false,
  className = "",
}) {
  const tabs = normalizePeriods(periods);
  const toggleLabel = breakdownCollapsed ? expandLabel : collapseLabel;
  const toggleAriaLabel = breakdownCollapsed ? expandAriaLabel : collapseAriaLabel;
  const showBreakdownToggle = Boolean(onToggleBreakdown && toggleLabel);
  const showSummaryLoadingPlaceholder = loading && (!summaryValue || summaryValue === "—");
  const costLabelText = typeof costInfoIcon === "string" ? costInfoIcon : "";
  const costLabelMatch = costLabelText.match(/^\[\s*(.+?)\s*\]$/);
  const costLabelCore = costLabelMatch ? costLabelMatch[1] : null;
  let summaryDisplay = summaryValue;
  if (showSummaryLoadingPlaceholder) {
    summaryDisplay = (
      <span
        className="inline-flex h-12 w-24 items-center justify-center border border-ink-faint bg-surface-strong md:h-20 md:w-40"
        data-testid="usage-summary-loading"
        aria-label={copy("usage.button.loading")}
      >
        <span className="sr-only">{copy("usage.button.loading")}</span>
        <span className="h-3 w-12 bg-ink-bright/70 md:h-4 md:w-20" />
      </span>
    );
  } else if (summaryValue && summaryValue !== "—") {
    summaryDisplay = (
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
    );
  }
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
      {!hideHeader ? (
        <div className="flex flex-wrap items-center justify-between border-b border-ink-faint mb-3 pb-2 gap-4 px-2">
          <div className="flex flex-wrap gap-4">
            {tabs.map((p) => (
              <Button
                key={p.key}
                type="button"
                className={`text-caption uppercase font-bold ${
                  period === p.key
                    ? "text-ink-bright border-b-2 border-ink"
                    : "text-ink-text"
                }`}
                onClick={() => onPeriodChange?.(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {onRefresh || statusLabel ? (
            <div className="flex items-center gap-3">
              {statusLabel ? (
                <span className="text-caption uppercase font-bold text-ink">
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
                <MatrixButton primary disabled={loading || refreshing} onClick={onRefresh}>
                  {loading || refreshing
                    ? copy("usage.button.loading")
                    : copy("usage.button.refresh")}
                </MatrixButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="text-caption text-red-400/90 px-2 py-1">
          {copy("shared.error.prefix", { error })}
        </div>
      ) : null}

      {showSummary || useSummaryLayout ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-90 py-4">
          <div className="text-center relative">
            <div className="text-heading text-ink-text mb-2">{summaryLabel}</div>
            <div className="text-display-2 md:text-display-1 font-black text-ink-bright tracking-tight tabular-nums leading-none glow-text select-none -translate-y-[5px]">
              {summaryDisplay}
            </div>
            {summaryCostValue ? (
              <div className="flex items-center justify-center gap-3 mt-4 md:mt-6">
                <span className="sr-only">{copy("usage.metric.total_cost")}</span>
                <span className="text-heading md:text-display-3 font-bold text-gold leading-none drop-shadow-gold">
                  {summaryCostValue}
                </span>
                {onCostInfo ? (
                  <Button
                    type="button"
                    onClick={onCostInfo}
                    title={costInfoLabel}
                    aria-label={costInfoLabel}
                    className="group inline-flex items-center gap-1 text-micro uppercase font-black text-gold tracking-caps transition-all hover:text-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  >
                    {costLabelCore ? (
                      <>
                        <span className="transition-transform duration-150 group-hover:-translate-x-0.5">
                          [
                        </span>
                        <span className="group-hover:animate-pulse">{costLabelCore}</span>
                        <span className="transition-transform duration-150 group-hover:translate-x-0.5">
                          ]
                        </span>
                      </>
                    ) : (
                      <span>{costInfoIcon}</span>
                    )}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {summarySubLabel ? (
              <div className="text-caption text-ink-text mt-2">{summarySubLabel}</div>
            ) : null}
          </div>

          {!breakdownCollapsed && breakdownRows.length ? (
            <div className="w-full px-6">
              <div className="grid grid-cols-2 gap-3 border-t border-b border-ink-faint py-4 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-ink-faint"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-[1px] bg-ink-muted"></div>

                {breakdownRows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="flex flex-col items-center p-3 bg-surface-raised border border-ink-faint"
                  >
                    <span className="text-caption text-ink-text uppercase mb-1">
                      {row.label}
                    </span>
                    <span className="text-body font-bold text-ink tracking-tight">
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
              className="border border-ink-faint bg-surface-raised p-4 text-center"
            >
              <div className="text-caption uppercase text-ink-text mb-2">{row.label}</div>
              <div
                className={`text-body font-black text-ink-bright glow-text ${
                  row.valueClassName || ""
                }`}
              >
                {row.value}
              </div>
              {row.subValue ? (
                <div className="text-caption text-ink-text mt-2">{row.subValue}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {rangeLabel ? (
        <div className="mt-3 text-caption uppercase text-ink-muted font-bold px-2">
          {copy("usage.range_label", { range: rangeLabel })}
          {rangeTimeZoneLabel ? ` ${rangeTimeZoneLabel}` : ""}
        </div>
      ) : null}
    </AsciiBox>
  );
});
