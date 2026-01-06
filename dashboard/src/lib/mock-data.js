import { formatDateLocal, formatDateUTC } from "./date-range.js";
import {
  buildActivityHeatmap,
  computeActiveStreakDays,
  getHeatmapRangeLocal,
} from "./activity-heatmap.js";

const DEFAULT_MOCK_SEED = "vibeusage";

export function isMockEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const flag = String(import.meta.env.VITE_VIBESCORE_MOCK || "").toLowerCase();
    if (flag === "1" || flag === "true") return true;
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const flag = String(params.get("mock") || "").toLowerCase();
    if (flag === "1" || flag === "true") return true;
  }
  return false;
}

function readMockNowRaw() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const envNow = String(import.meta.env.VITE_VIBESCORE_MOCK_NOW || "").trim();
    if (envNow) return envNow;
    const envToday = String(import.meta.env.VITE_VIBESCORE_MOCK_TODAY || "").trim();
    if (envToday) return envToday;
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const queryNow = String(params.get("mock_now") || "").trim();
    if (queryNow) return queryNow;
    const queryToday = String(params.get("mock_today") || "").trim();
    if (queryToday) return queryToday;
  }
  return "";
}

function parseMockNow(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return null;
    }
    const localNoon = new Date(y, m - 1, d, 12, 0, 0);
    return Number.isFinite(localNoon.getTime()) ? localNoon : null;
  }
  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function getMockNow() {
  if (!isMockEnabled()) return null;
  return parseMockNow(readMockNowRaw());
}

function readMockSeed() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const seed = String(import.meta.env.VITE_VIBESCORE_MOCK_SEED || "").trim();
    if (seed) return seed;
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const seed = String(params.get("mock_seed") || "").trim();
    if (seed) return seed;
  }
  return DEFAULT_MOCK_SEED;
}

function readMockMissingCount() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const raw = String(import.meta.env.VITE_VIBESCORE_MOCK_MISSING || "").trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const raw = String(params.get("mock_missing") || "").trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 0;
}

function toSeed(seed) {
  const raw = seed == null ? readMockSeed() : String(seed);
  return raw.trim() || DEFAULT_MOCK_SEED;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseUtcDate(yyyyMmDd) {
  if (typeof yyyyMmDd !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return formatDateUTC(dt) === yyyyMmDd.trim() ? dt : null;
}

function addUtcDays(date, days) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function addUtcMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildDailyRows({ from, to, seed }) {
  const today = parseUtcDate(formatDateLocal(new Date())) || new Date();
  const start = parseUtcDate(from) || today;
  const end = parseUtcDate(to) || start;
  const rows = [];
  const seedValue = toSeed(seed);
  const totalDays =
    Math.floor(
      (Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) /
        86400000
    ) + 1;

  for (let i = 0; i < totalDays; i += 1) {
    const dt = addUtcDays(start, i);
    const day = formatDateUTC(dt);
    const hash = hashString(`${seedValue}:${day}`);
    const jitter = (hash % 1000) / 1000;
    const seasonal = 0.6 + 0.4 * Math.sin((i / 6) * Math.PI * 0.5);
    const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6 ? 0.65 : 1;
    const base = 18000 + Math.round(12000 * jitter);
    const total = Math.max(0, Math.round(base * seasonal * weekend));

    const input = Math.round(total * 0.46);
    const output = Math.round(total * 0.34);
    const cached = Math.round(total * 0.14);
    const reasoning = Math.max(0, total - input - output - cached);

    rows.push({
      day,
      total_tokens: total,
      input_tokens: input,
      output_tokens: output,
      cached_input_tokens: cached,
      reasoning_output_tokens: reasoning,
    });
  }

  return rows;
}

function buildHourlyRows({ day, seed }) {
  const base = parseUtcDate(day) || parseUtcDate(formatDateLocal(new Date())) || new Date();
  const dayKey = formatDateUTC(base);
  const seedValue = toSeed(seed);
  const rows = Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 === 0 ? 0 : 30;
    const hash = hashString(`${seedValue}:${dayKey}:${hour}:${minute}`);
    const jitter = (hash % 1000) / 1000;
    const hourFraction = (hour + minute / 60) / 24;
    const wave = 0.4 + 0.6 * Math.sin(hourFraction * Math.PI * 2);
    const baseValue = 900 + Math.round(700 * jitter);
    const total = Math.max(0, Math.round(baseValue * wave));

    const input = Math.round(total * 0.46);
    const output = Math.round(total * 0.34);
    const cached = Math.round(total * 0.14);
    const reasoning = Math.max(0, total - input - output - cached);

    return {
      hour: `${dayKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
      total_tokens: total,
      input_tokens: input,
      output_tokens: output,
      cached_input_tokens: cached,
      reasoning_output_tokens: reasoning,
    };
  });

  const missingCount = Math.max(0, Math.min(48, readMockMissingCount()));
  if (missingCount > 0) {
    const nowMs = Date.now();
    const candidates = rows
      .map((row, index) => {
        const ts = Date.parse(row.hour);
        return Number.isFinite(ts) && ts <= nowMs ? { index, ts } : null;
      })
      .filter(Boolean);
    const sliceStart = Math.max(0, candidates.length - missingCount);
    const targets = candidates.slice(sliceStart);
    for (const target of targets) {
      rows[target.index] = { ...rows[target.index], missing: true };
    }
  }

  return rows;
}

function buildMonthlyRows({ months = 24, to, seed }) {
  const end = parseUtcDate(to) || parseUtcDate(formatDateLocal(new Date())) || new Date();
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const seedValue = toSeed(seed);
  const rows = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const dt = addUtcMonths(endMonth, -i);
    const monthKey = formatMonthKey(dt);
    const hash = hashString(`${seedValue}:${monthKey}`);
    const jitter = (hash % 1000) / 1000;
    const seasonal = 0.7 + 0.3 * Math.sin((rows.length / 6) * Math.PI * 0.5);
    const base = 360000 + Math.round(200000 * jitter);
    const total = Math.max(0, Math.round(base * seasonal));

    const input = Math.round(total * 0.46);
    const output = Math.round(total * 0.34);
    const cached = Math.round(total * 0.14);
    const reasoning = Math.max(0, total - input - output - cached);

    rows.push({
      month: monthKey,
      total_tokens: total,
      input_tokens: input,
      output_tokens: output,
      cached_input_tokens: cached,
      reasoning_output_tokens: reasoning,
    });
  }

  return rows;
}

function sumDailyRows(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.total_tokens += Number(row.total_tokens || 0);
      acc.input_tokens += Number(row.input_tokens || 0);
      acc.output_tokens += Number(row.output_tokens || 0);
      acc.cached_input_tokens += Number(row.cached_input_tokens || 0);
      acc.reasoning_output_tokens += Number(row.reasoning_output_tokens || 0);
      return acc;
    },
    {
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      reasoning_output_tokens: 0,
    }
  );
}

function formatUsdFromTokens(totalTokens, ratePerMillion = 1.75) {
  const tokens = Number(totalTokens || 0);
  if (!Number.isFinite(tokens) || tokens <= 0) return "0.000000";
  const cost = (tokens * ratePerMillion) / 1_000_000;
  return cost.toFixed(6);
}

function scaleTotals(totals, weight) {
  const safeWeight = Number.isFinite(weight) ? weight : 0;
  return {
    total_tokens: Math.max(0, Math.round(totals.total_tokens * safeWeight)),
    input_tokens: Math.max(0, Math.round(totals.input_tokens * safeWeight)),
    output_tokens: Math.max(0, Math.round(totals.output_tokens * safeWeight)),
    cached_input_tokens: Math.max(
      0,
      Math.round(totals.cached_input_tokens * safeWeight)
    ),
    reasoning_output_tokens: Math.max(
      0,
      Math.round(totals.reasoning_output_tokens * safeWeight)
    ),
  };
}

function withCost(totals) {
  return {
    ...totals,
    total_cost_usd: formatUsdFromTokens(totals.total_tokens),
  };
}

export function getMockUsageDaily({ from, to, seed } = {}) {
  const rows = buildDailyRows({ from, to, seed });
  return { from, to, data: rows };
}

export function getMockUsageHourly({ day, seed } = {}) {
  const base = parseUtcDate(day) || new Date();
  const dayKey = formatDateUTC(base);
  const rows = buildHourlyRows({ day: dayKey, seed });
  return { day: dayKey, data: rows };
}

export function getMockUsageMonthly({ months = 24, to, seed } = {}) {
  const end = parseUtcDate(to) || parseUtcDate(formatDateLocal(new Date())) || new Date();
  const endDay = formatDateUTC(end);
  const rows = buildMonthlyRows({ months, to: endDay, seed });
  const startMonth = addUtcMonths(
    new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)),
    -(months - 1)
  );
  return { from: formatDateUTC(startMonth), to: endDay, months, data: rows };
}

export function getMockUsageSummary({ from, to, seed } = {}) {
  const rows = buildDailyRows({ from, to, seed });
  const totals = sumDailyRows(rows);
  const totalsWithCost = withCost(totals);
  return {
    from,
    to,
    days: rows.length,
    totals: totalsWithCost,
  };
}

export function getMockUsageHeatmap({ weeks = 52, to, weekStartsOn = "sun", seed } = {}) {
  const range = getHeatmapRangeLocal({
    weeks,
    now: parseUtcDate(to) || parseUtcDate(formatDateLocal(new Date())) || new Date(),
    weekStartsOn,
  });
  const rows = buildDailyRows({ from: range.from, to: range.to, seed });
  const heatmap = buildActivityHeatmap({
    dailyRows: rows,
    weeks,
    to: range.to,
    weekStartsOn,
  });

  return {
    ...heatmap,
    week_starts_on: weekStartsOn,
    active_days: rows.filter((r) => Number(r.total_tokens) > 0).length,
    streak_days: computeActiveStreakDays({ dailyRows: rows, to: range.to }),
  };
}

export function getMockUsageModelBreakdown({ from, to, seed } = {}) {
  const rows = buildDailyRows({ from, to, seed });
  const totals = sumDailyRows(rows);

  const sources = [
    {
      source: "codex",
      weight: 0.7,
      models: [
        { model: "gpt-5.2-codex", model_id: "gpt-5.2-codex", weight: 0.2 },
        { model: "unknown", model_id: "unknown", weight: 0.8 },
      ],
    },
    {
      source: "claude",
      weight: 0.2,
      models: [
        { model: "claude-3.5", model_id: "claude-3.5", weight: 0.3 },
        { model: "unknown", model_id: "unknown", weight: 0.7 },
      ],
    },
    {
      source: "every-code",
      weight: 0.1,
      models: [{ model: "unknown", model_id: "unknown", weight: 1 }],
    },
  ];

  const sourcesData = sources.map((source) => {
    const sourceTotals = scaleTotals(totals, source.weight);
    const models = source.models.map((model) => {
      const modelTotals = scaleTotals(sourceTotals, model.weight);
      return {
        model: model.model,
        model_id: model.model_id || model.model,
        totals: withCost(modelTotals),
      };
    });
    return {
      source: source.source,
      totals: withCost(sourceTotals),
      models,
    };
  });

  return {
    from,
    to,
    days: rows.length,
    sources: sourcesData,
    pricing: {
      model: "mock",
      pricing_mode: "add",
      source: "mock",
      effective_from: formatDateLocal(new Date()),
      rates_per_million_usd: {
        input: "1.750000",
        cached_input: "0.175000",
        output: "14.000000",
        reasoning_output: "14.000000",
      },
    },
  };
}
