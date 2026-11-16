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
// The full form drops the end's year when both ends share it, as the boards draw it.
export function range(from: string, to: string, form: "full" | "short" = "full"): string {
  if (from <= "1970-01-01") return copy("leaderboard.range.total");
  if (form === "short") return `${from.slice(5)} → ${to.slice(5)}`;
  return `${from} → ${from.slice(0, 4) === to.slice(0, 4) ? to.slice(5) : to}`;
}

// How long ago a snapshot was taken, for the page meta. A little clock skew still reads "just now".
export function updated(iso: unknown, now: number): string | null {
  const at = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return null;
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return copy("ui2049.page_header.updated_now");
  if (min < 60) return copy("ui2049.page_header.updated_min", { n: min });
  if (min < 48 * 60) return copy("ui2049.page_header.updated_h", { n: Math.floor(min / 60) });
  return copy("ui2049.page_header.updated_d", { n: Math.floor(min / 1440) });
}

// PageHeader meta for a board snapshot: its date range, then how fresh it is.
export function boardMeta(from: string, to: string, generatedAt: unknown, now = Date.now()): string {
  return [range(from, to), updated(generatedAt, now)].filter(Boolean).join(" · ");
}
