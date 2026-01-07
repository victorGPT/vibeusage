# VibeUsage Dashboard API Contract

This document is a front-end friendly reference for the VibeUsage tracker dashboard APIs.

## Base URL

- Use `VITE_VIBEUSAGE_INSFORGE_BASE_URL` when available.
- Fallback to the default InsForge base URL used by the CLI/back end.

## Function Path

- Dashboard SHOULD call `/functions/<slug>` first.
- If `/functions` returns `404`, fallback to `/api/functions/<slug>`.

## Auth

All endpoints require a user JWT:

```
Authorization: Bearer <user_jwt>
```

If the token is missing or invalid, responses return 401 with:

```json
{ "error": "Missing bearer token" }
```
or:
```json
{ "error": "Unauthorized" }
```

## Common Query Parameters

- `source` (optional): `codex|every-code|claude|...` (case-insensitive on input; stored lowercase)
- `model` (optional): usage model identifier string. Input is trimmed and lowercased; vendor prefixes are preserved (for example `aws/gpt-4o`). Omit to aggregate across models.
- `tz` (optional): IANA timezone, e.g. `America/Los_Angeles`
- `tz_offset_minutes` (optional): fixed offset in minutes from UTC, e.g. `-480`

Notes:
- If both `tz` and `tz_offset_minutes` are provided, `tz` wins.
- Date params are `YYYY-MM-DD`.
- Token totals are returned as **strings** (bigint-safe).
- `model` filters are strict; only explicit alias mappings can expand the match scope.

## Endpoints

### GET /functions/vibeusage-usage-summary

Totals for a date range.

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today)
- `source` (optional)
- `model` (optional)
- `tz`, `tz_offset_minutes` (optional)

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "days": 30,
  "totals": {
    "total_tokens": "0",
    "input_tokens": "0",
    "cached_input_tokens": "0",
    "output_tokens": "0",
    "reasoning_output_tokens": "0",
    "total_cost_usd": "0.000000"
  },
  "pricing": {
    "model": "gpt-5.2-codex",
    "pricing_mode": "overlap",
    "source": "openrouter",
    "effective_from": "2025-12-23",
    "rates_per_million_usd": {
      "input": "1.750000",
      "cached_input": "0.175000",
      "output": "14.000000",
      "reasoning_output": "14.000000"
    }
  }
}
```

Notes:
- Pricing metadata is resolved from `vibescore_pricing_profiles` (latest effective row, `active=true`) using the configured default model/source.
- If the pricing table is empty, the backend falls back to the default profile.

### GET /functions/vibeusage-usage-model-breakdown

Per-source and per-model aggregates for a date range (used by model mix + cost breakdown UI).

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today)
- `source` (optional; omit to aggregate all sources)
- `tz`, `tz_offset_minutes` (optional)

Notes:
- `model` is not accepted because this endpoint already returns per-model groups.
- Pricing metadata is resolved from `vibescore_pricing_profiles` with fallback to default profile when no match exists.

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "days": 30,
  "sources": [
    {
      "source": "codex",
      "totals": {
        "total_tokens": "0",
        "input_tokens": "0",
        "cached_input_tokens": "0",
        "output_tokens": "0",
        "reasoning_output_tokens": "0",
        "total_cost_usd": "0.000000"
      },
      "models": [
        {
          "model": "gpt-5.2-codex",
          "totals": {
            "total_tokens": "0",
            "input_tokens": "0",
            "cached_input_tokens": "0",
            "output_tokens": "0",
            "reasoning_output_tokens": "0",
            "total_cost_usd": "0.000000"
          }
        }
      ]
    }
  ],
  "pricing": {
    "model": "gpt-5.2-codex",
    "pricing_mode": "overlap",
    "source": "openrouter",
    "effective_from": "2025-12-23",
    "rates_per_million_usd": {
      "input": "1.750000",
      "cached_input": "0.175000",
      "output": "14.000000",
      "reasoning_output": "14.000000"
    }
  }
}
```

### GET /functions/vibeusage-usage-daily

Daily aggregates for a date range.

Query:
- `from=YYYY-MM-DD` (optional; default last 30 days)
- `to=YYYY-MM-DD` (optional; default today)
- `source` (optional)
- `model` (optional)
- `tz`, `tz_offset_minutes` (optional)

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "data": [
    {
      "day": "YYYY-MM-DD",
      "total_tokens": "0",
      "input_tokens": "0",
      "cached_input_tokens": "0",
      "output_tokens": "0",
      "reasoning_output_tokens": "0"
    }
  ],
  "summary": {
    "totals": {
      "total_tokens": "0",
      "input_tokens": "0",
      "cached_input_tokens": "0",
      "output_tokens": "0",
      "reasoning_output_tokens": "0",
      "total_cost_usd": "0.000000"
    },
    "pricing": {
      "model": "gpt-5.2-codex",
      "pricing_mode": "overlap",
      "source": "openrouter",
      "effective_from": "2025-12-23",
      "rates_per_million_usd": {
        "input": "1.750000",
        "cached_input": "0.175000",
        "output": "14.000000",
        "reasoning_output": "14.000000"
      }
    }
  }
}
```

Notes:
- The dashboard should use `summary.totals` directly and MUST NOT compute totals locally.

### GET /functions/vibeusage-usage-hourly

Half-hour buckets for a local day (48 buckets).

Query:
- `day=YYYY-MM-DD` (optional; default today)
- `source` (optional)
- `model` (optional)
- `tz`, `tz_offset_minutes` (optional)

Response:

```json
{
  "day": "YYYY-MM-DD",
  "data": [
    {
      "hour": "YYYY-MM-DDTHH:00:00",
      "total_tokens": "0",
      "input_tokens": "0",
      "cached_input_tokens": "0",
      "output_tokens": "0",
      "reasoning_output_tokens": "0",
      "missing": true
    }
  ],
  "sync": {
    "last_sync_at": "2025-12-22T12:30:00Z",
    "min_interval_minutes": 30
  }
}
```

### GET /functions/vibeusage-usage-monthly

Monthly aggregates aligned to local months.

Query:
- `months=1..24` (optional; default 24)
- `to=YYYY-MM-DD` (optional; default today)
- `source` (optional)
- `model` (optional)
- `tz`, `tz_offset_minutes` (optional)

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "months": 24,
  "data": [
    {
      "month": "YYYY-MM",
      "total_tokens": "0",
      "input_tokens": "0",
      "cached_input_tokens": "0",
      "output_tokens": "0",
      "reasoning_output_tokens": "0"
    }
  ]
}
```

### GET /functions/vibeusage-usage-heatmap

GitHub-style activity heatmap.

Query:
- `weeks=1..104` (optional; default 52)
- `to=YYYY-MM-DD` (optional; default today)
- `week_starts_on=sun|mon` (optional; default sun)
- `source` (optional)
- `model` (optional)
- `tz`, `tz_offset_minutes` (optional)

Response:

```json
{
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "week_starts_on": "sun",
  "thresholds": { "t1": "0", "t2": "0", "t3": "0" },
  "active_days": 0,
  "streak_days": 0,
  "weeks": [
    [
      { "day": "YYYY-MM-DD", "value": "0", "level": 0 },
      null
    ]
  ]
}
```

### GET /functions/vibeusage-leaderboard

Leaderboard entries for a UTC window.

Query:
- `period=day|week|month|total` (required)
- `limit=1..100` (optional; default 20)

Response:

```json
{
  "period": "week",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "generated_at": "iso",
  "entries": [
    { "rank": 1, "is_me": false, "display_name": "Anonymous", "avatar_url": null, "total_tokens": "0" }
  ],
  "me": { "rank": null, "total_tokens": "0" }
}
```

### POST /functions/vibeusage-leaderboard-settings

Update current user privacy setting.

Request body:

```json
{ "leaderboard_public": true }
```

Response:

```json
{ "leaderboard_public": true, "updated_at": "iso" }
```

## TypeScript Types

```ts
export type Source = 'codex' | 'every-code' | 'claude' | string;
export type ModelId = string;

export interface UsageTotals {
  total_tokens: string;
  input_tokens: string;
  cached_input_tokens: string;
  output_tokens: string;
  reasoning_output_tokens: string;
}

export interface UsageSummaryResponse {
  from: string;
  to: string;
  days: number;
  totals: UsageTotals & { total_cost_usd: string };
  pricing: {
    model: string;
    pricing_mode: 'add' | 'overlap' | 'mixed';
    source: string;
    effective_from: string;
    rates_per_million_usd: {
      input: string;
      cached_input: string;
      output: string;
      reasoning_output: string;
    };
  };
}

export interface UsageModelBreakdownModel {
  model: ModelId;
  totals: UsageTotals & { total_cost_usd: string };
}

export interface UsageModelBreakdownSource {
  source: Source;
  totals: UsageTotals & { total_cost_usd: string };
  models: UsageModelBreakdownModel[];
}

export interface UsageModelBreakdownResponse {
  from: string;
  to: string;
  days: number;
  sources: UsageModelBreakdownSource[];
  pricing: UsageSummaryResponse['pricing'];
}

export interface DailyUsageRow extends UsageTotals {
  day: string;
}

export interface UsageDailyResponse {
  from: string;
  to: string;
  data: DailyUsageRow[];
}

export interface HourlyUsageRow extends UsageTotals {
  hour: string; // YYYY-MM-DDTHH:00:00 or YYYY-MM-DDTHH:30:00
  missing?: boolean;
}

export interface UsageHourlyResponse {
  day: string;
  data: HourlyUsageRow[];
  sync: {
    last_sync_at: string | null;
    min_interval_minutes: number;
  };
}

export interface MonthlyUsageRow extends UsageTotals {
  month: string; // YYYY-MM
}

export interface UsageMonthlyResponse {
  from: string;
  to: string;
  months: number;
  data: MonthlyUsageRow[];
}

export interface HeatmapCell {
  day: string;
  value: string;
  level: number;
}

export interface UsageHeatmapResponse {
  from: string;
  to: string;
  week_starts_on: 'sun' | 'mon';
  thresholds: {
    t1: string;
    t2: string;
    t3: string;
  };
  active_days: number;
  streak_days: number;
  weeks: Array<Array<HeatmapCell | null>>;
}

export interface LeaderboardEntry {
  rank: number | null;
  is_me: boolean;
  display_name: string;
  avatar_url: string | null;
  total_tokens: string;
}

export interface LeaderboardResponse {
  period: 'day' | 'week' | 'month' | 'total';
  from: string;
  to: string;
  generated_at: string;
  entries: LeaderboardEntry[];
  me: { rank: number | null; total_tokens: string };
}

export interface LeaderboardSettingsRequest {
  leaderboard_public: boolean;
}

export interface LeaderboardSettingsResponse {
  leaderboard_public: boolean;
  updated_at: string;
}
```

## Example Requests (TypeScript)

```ts
const baseUrl = import.meta.env.VITE_VIBEUSAGE_INSFORGE_BASE_URL;
const authHeader = { Authorization: `Bearer ${userJwt}` };

// Model breakdown for a date range
const breakdown = await fetch(
  `${baseUrl}/functions/vibeusage-usage-model-breakdown?from=2025-12-01&to=2025-12-31`,
  { headers: authHeader }
).then((r) => r.json());

// Daily usage filtered by model
const daily = await fetch(
  `${baseUrl}/functions/vibeusage-usage-daily?from=2025-12-01&to=2025-12-31&model=gpt-5.2-codex`,
  { headers: authHeader }
).then((r) => r.json());

// Hourly usage for a local day
const hourly = await fetch(
  `${baseUrl}/functions/vibeusage-usage-hourly?day=2025-12-25&tz=America/Los_Angeles`,
  { headers: authHeader }
).then((r) => r.json());

// Summary usage for a model
const summary = await fetch(
  `${baseUrl}/functions/vibeusage-usage-summary?from=2025-12-25&to=2025-12-25&model=moonshotai%2FKimi-K2-Thinking`,
  { headers: authHeader }
).then((r) => r.json());
```
