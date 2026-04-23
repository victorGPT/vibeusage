import React from "react";
import { copy } from "../../../lib/copy";

export function TrendChart({
  data,
  unitLabel = copy("trend.chart.unit_label"),
  leftLabel = copy("trend.chart.left_label"),
  rightLabel = copy("trend.chart.right_label"),
}) {
  const values = Array.isArray(data) ? data.map((n) => Number(n) || 0) : [];
  const max = Math.max(...values, 1);

  if (!values.length) {
    return <div className="text-caption text-ink-text">{copy("trend.chart.empty")}</div>;
  }

  const peakLabel = copy("trend.chart.peak", {
    value: max.toLocaleString(),
    unit: unitLabel,
  });

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-end h-24 space-x-1 border-b border-ink-faint pb-2 relative">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
          <div className="border-t border-ink-faint w-full"></div>
          <div className="border-t border-ink-faint w-full"></div>
          <div className="border-t border-ink-faint w-full"></div>
        </div>
        {values.map((val, i) => (
          <div key={i} className="flex-1 bg-surface-raised relative group">
            <div
              style={{ height: `${(val / max) * 100}%` }}
              className="w-full bg-ink opacity-50 group-hover:opacity-100 group-hover:bg-ink-bright transition-all duration-300 shadow-glow-sm"
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-caption text-ink-text uppercase font-bold">
        <span>{leftLabel}</span>
        <span>{peakLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
