import { copy } from "#src/lib/copy.ts";

import { periodItems } from "./shared";
import { Tabs } from "./Tabs";
import type { LeaderboardMetric, LeaderboardPeriod } from "./types";

type LeaderboardFiltersProps = {
  period: LeaderboardPeriod;
  onPeriodChange: (period: LeaderboardPeriod) => void;
  metric: LeaderboardMetric;
  onMetricChange: (metric: LeaderboardMetric) => void;
};

// SSOT: design/2049/source/LeaderboardFilters.dc.html.
export function LeaderboardFilters({ period, onPeriodChange, metric, onMetricChange }: LeaderboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
      <Tabs
        label={copy("ui2049.readout.period_aria")}
        value={period}
        items={periodItems(["week", "month", "total"] as LeaderboardPeriod[])}
        onChange={onPeriodChange}
      />
      <div className="border-l border-border pl-8">
        <Tabs
          label={copy("ui2049.leaderboard_filters.metric_aria")}
          value={metric}
          items={[
            { value: "all", label: copy("ui2049.leaderboard_filters.all") },
            { value: "gpt", label: copy("leaderboard.metric.gpt") },
            { value: "claude", label: copy("ui2049.leaderboard_filters.claude") },
          ]}
          onChange={onMetricChange}
        />
      </div>
    </div>
  );
}
