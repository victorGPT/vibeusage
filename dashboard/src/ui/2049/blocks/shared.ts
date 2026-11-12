import { copy } from "#src/lib/copy.ts";

import type { UsagePeriod } from "./types";

export function periodLabel(period: UsagePeriod): string {
  return {
    day: copy("ui2049.readout.day"),
    week: copy("ui2049.readout.week"),
    month: copy("ui2049.readout.month"),
    total: copy("daily.sort.total.label"),
  }[period];
}

export function periodItems(periods: UsagePeriod[]) {
  return periods.map((value) => ({ value, label: periodLabel(value) }));
}

// The landing badge list is the one place the CLI names are spelled; its order is SOURCES.
const SOURCES = ["codex", "claude", "gemini", "opencode", "kimi", "hermes", "openclaw"];

export function cliNames(): Record<string, string> {
  const names = copy("ui2049.landing_hero.clis").split(",");
  return Object.fromEntries(SOURCES.map((source, i) => [source, names[i]]));
}

export const you = (handle: string) => copy("ui2049.rank_list.you", { handle });
export const displayName = (entry: { display_name?: string | null }) =>
  entry.display_name ?? copy("shared.placeholder.short");
export const rankText = (rank: number | null | undefined) =>
  rank == null ? copy("shared.placeholder.short") : `#${rank}`;

// ScreenFx's inner wrapper is its last child; stretching it lets the Stamp sit at the bottom.
export const SCREEN_FILL = "flex flex-col *:last:flex *:last:flex-auto *:last:flex-col";
