import { formatDateLocal, formatDateUTC } from "./date-range.js";
import {
  buildActivityHeatmap,
  computeActiveStreakDays,
  getHeatmapRangeLocal,
} from "./activity-heatmap.js";

const DEFAULT_MOCK_SEED = "vibescore";

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

  return Array.from({ length: 48 }, (_, index) => {
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
  return {
    from,
    to,
    days: rows.length,
    totals,
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
