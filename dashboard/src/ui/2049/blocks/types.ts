// The data the blocks render, as the existing hooks and endpoints return it. Blocks format and
// derive; they never fetch. Token counts arrive as numbers or digit strings.

type TokenCount = number | string;

export type UsagePeriod = "day" | "week" | "month" | "total";
export type LeaderboardPeriod = "week" | "month" | "total";
export type LeaderboardMetric = "all" | "gpt" | "claude";

// useUsageData().summary (the hook already stores summaryRes.totals there)
export type UsageTotals = {
  total_tokens?: TokenCount;
  billable_total_tokens?: TokenCount;
  input_tokens?: TokenCount;
  output_tokens?: TokenCount;
  cached_input_tokens?: TokenCount;
  reasoning_output_tokens?: TokenCount;
  total_cost_usd?: TokenCount;
};

// useUsageData().daily and useTrendData().rows
export type DailyRow = UsageTotals & { day?: string; hour?: string; month?: string; missing?: boolean; future?: boolean };
export type DateKey = "day" | "hour" | "month";

// useUsageData().rolling
type RollingWindow = { totals?: { billable_total_tokens?: TokenCount }; avg_per_active_day?: TokenCount };
export type UsageRolling = { last_7d?: RollingWindow; last_30d?: RollingWindow };

// useActivityHeatmap().heatmap
export type HeatmapCell = { day: string; value: number | string; level: number };
export type Heatmap = { from: string; to: string; weeks: (HeatmapCell | null)[][]; active_days?: number };

// useUsageModelBreakdown().breakdown
export type ModelEntry = { model?: string; model_id?: string; display_model?: string; totals?: UsageTotals };
export type ModelBreakdown = { sources?: { source?: string; totals?: UsageTotals; models?: ModelEntry[] }[] };

// useProjectUsageSummary().entries
export type ProjectEntry = {
  project_key: string;
  project_ref?: string;
  total_tokens?: TokenCount;
  billable_total_tokens?: TokenCount;
};

// getLeaderboard() entries and me, as LeaderboardPage reads them.
export type LeaderboardEntry = {
  rank: number;
  is_me?: boolean;
  is_public?: boolean;
  avatar_url?: string | null;
  display_name?: string | null;
  user_id?: string | null;
  total_tokens: TokenCount;
  gpt_tokens?: TokenCount;
  claude_tokens?: TokenCount;
  other_tokens?: TokenCount;
};
export type LeaderboardMe = Omit<LeaderboardEntry, "rank"> & { rank: number | null };
