import { copy } from "#src/lib/copy.ts";

import type { UsageTotals } from "./types";

// Token counts arrive as numbers or digit strings; anything unparseable counts as zero.
export function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// The headline count everywhere: billable when the API sends it, raw total otherwise.
export function tokens(totals: UsageTotals | undefined): number {
  return num(totals?.billable_total_tokens ?? totals?.total_tokens);
}

// A value that rounds up to 1000 of a unit moves to the next unit (999.96M reads 1.00B).
export function abbr(value: unknown): string {
  const n = num(value);
  if (n >= 1e9 || Number((n / 1e6).toFixed(1)) >= 1000) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6 || Math.round(n / 1e3) >= 1000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3 || Math.round(n) >= 1000) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

const FULL = new Intl.NumberFormat("en-US");
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const full = (value: unknown) => FULL.format(num(value));
export const cost = (value: unknown) => USD.format(num(value));
export const pct = (value: number) => `${value.toFixed(1)}%`;

const DAY_MS = 86_400_000;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

// The leaderboard's Total window starts at the epoch; a date there means "no start".
export function range(from: string, to: string, form: "full" | "short" = "full"): string {
  if (from <= "1970-01-01") return copy("leaderboard.range.total");
  return form === "short" ? `${from.slice(5)} → ${to.slice(5)}` : `${from} → ${to}`;
}
