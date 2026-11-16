import { copy } from "#src/lib/copy.ts";

import type { DateKey, HeatmapCell } from "./types";

// Five by five cells from a hash of the handle; columns 3 and 4 mirror 1 and 0.
export function identicon(handle: string): boolean[] {
  let x = 7;
  for (const c of handle) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: 25 }, (_, i) => {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const col = c < 3 ? c : 4 - c;
    return ((x >> (r * 3 + col)) & 1) === 1;
  });
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

// One label per twelfth of the columns: the month of that column's first day.
export function monthLabels(weeks: (HeatmapCell | null)[][], count = 12): string[] {
  return Array.from({ length: count }, (_, i) => {
    const day = weeks[Math.floor((i * weeks.length) / count)]?.find((cell) => cell)?.day;
    return day ? MONTH.format(new Date(`${day}T00:00:00Z`)) : "";
  });
}

// Points in a 560 x 120 box; the peak sits 8 from the top, zero 2 above the baseline.
export function trendPath(values: number[]) {
  if (!values.length) return { line: "", area: "" };
  const max = Math.max(...values) || 1;
  const step = values.length > 1 ? 560 / (values.length - 1) : 0;
  const points = values.map((v, i) => `${(i * step).toFixed(1)} ${(118 - (v / max) * 110).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  return { line, area: `${line} L${Math.round((values.length - 1) * step)} 120 L0 120 Z` };
}

export function axisLabel(value: string, dateKey: DateKey): string {
  if (dateKey === "day") return value.slice(5, 10);
  if (dateKey === "hour") return value.slice(11, 16);
  return value;
}

const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

// Keyboard walk over the week-major dot grid: a day up or down, a week left or right, past empty
// slots. Returns null for keys it does not handle, and stays put at the edges.
export function stepDay(cells: (HeatmapCell | null)[], index: number, key: string): number | null {
  const filled = cells.flatMap((cell, i) => (cell ? [i] : []));
  if (key === "Home") return filled[0] ?? index;
  if (key === "End") return filled[filled.length - 1] ?? index;
  const step = STEP[key];
  if (!step) return null;
  for (let i = index + step; i >= 0 && i < cells.length; i += step) if (cells[i]) return i;
  return index;
}

export function dateCell(value: string, dateKey: DateKey): string {
  return dateKey === "hour" ? value.replace("T", " ").slice(0, 16) : value;
}

function titleWords(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// user-status subscriptions.items, rows like { tool: "claude_code", plan_type: "max_20x" }, as
// "Claude Code Max 20x". Rows without a tool or plan are dropped, repeats merged, six at most.
export function subscriptionLabels(items: unknown): string[] {
  const rows = (Array.isArray(items) ? items : []) as ({ tool?: unknown; plan_type?: unknown; planType?: unknown } | null)[];
  const labels = rows.map((row) => {
    const tool = titleWords(row?.tool);
    const plan = titleWords(row?.plan_type ?? row?.planType);
    return tool && plan ? copy("identity_card.subscription_item", { tool, plan }) : "";
  });
  return [...new Set(labels.filter(Boolean))].slice(0, 6);
}
