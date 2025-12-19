import React from "react";

import { AsciiBox } from "./AsciiBox.jsx";
import { LeaderboardRow } from "./LeaderboardRow.jsx";

const DEFAULT_PERIODS = [
  { key: "24H", label: "Cycle_24h" },
  { key: "ALL", label: "Legacy_All" },
];

export function LeaderboardPanel({
  title = "Zion_Index",
  period = "ALL",
  periods = DEFAULT_PERIODS,
  onPeriodChange,
  rows = [],
  summary,
  summaryPeriod = "ALL",
  loadMoreLabel = "-- LOAD_NEXT_BATCH --",
  onLoadMore,
  className = "",
}) {
  const showSummary = summary && period === summaryPeriod;
  const stats = Array.isArray(summary?.stats) ? summary.stats : [];

  return (
    <AsciiBox title={title} className={className}>
      <div className="flex border-b border-[#00FF41]/20 mb-2 pb-1 gap-4 px-2">
        {periods.map((p) => (
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

      {showSummary ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-90 py-4">
          <div className="text-center">
            <div className="text-[10px] uppercase opacity-50 tracking-widest mb-2">
              {summary?.totalLabel}
            </div>
            <div className="text-4xl font-black text-white">
              {summary?.totalValue}
            </div>
            {summary?.sinceLabel ? (
              <div className="text-[8px] opacity-40 mt-1">
                {summary.sinceLabel}
              </div>
            ) : null}
          </div>
          {stats.length ? (
            <div
              className={`grid gap-4 w-full px-8 ${
                stats.length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {stats.map((stat, idx) => (
                <div
                  key={`${stat.label || "stat"}-${idx}`}
                  className="border border-[#00FF41]/30 bg-[#00FF41]/5 p-3 text-center"
                >
                  <div className="text-[8px] opacity-50 uppercase">
                    {stat.label}
                  </div>
                  <div className="text-xl font-bold text-white">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-1">
          {rows.length ? (
            rows.map((row) => (
              <LeaderboardRow
                key={`${row.rank}-${row.name}`}
                rank={row.rank}
                name={row.name}
                value={row.value}
                isAnon={row.isAnon}
                isSelf={row.isSelf}
                isTheOne={row.isTheOne}
              />
            ))
          ) : (
            <div className="text-center text-[9px] opacity-40 py-2">
              No leaderboard data.
            </div>
          )}
          {rows.length && loadMoreLabel ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="w-full text-center text-[8px] opacity-40 py-2 hover:text-[#00FF41]"
            >
              {loadMoreLabel}
            </button>
          ) : null}
        </div>
      )}
    </AsciiBox>
  );
}
