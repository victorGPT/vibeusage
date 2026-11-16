import { copy } from "#src/lib/copy.ts";

import type { DailyRow, DateKey, UsagePeriod } from "./types";

export type Option<T extends string> = { value: T; label: string };

export function periodOptions(): Option<UsagePeriod>[] {
  return [
    { value: "day", label: copy("vu1.period.day") },
    { value: "week", label: copy("vu1.period.week") },
    { value: "month", label: copy("vu1.period.month") },
    { value: "total", label: copy("vu1.period.total") },
  ];
}

// Source ids as the API sends them; one not listed reads as its id.
export function sourceLabel(id: string): string {
  const labels: Record<string, string> = {
    all: copy("vu1.source.all"),
    claude: copy("vu1.source.claude"),
    codex: copy("vu1.source.codex"),
    gemini: copy("vu1.source.gemini"),
    opencode: copy("vu1.source.opencode"),
    kimi: copy("vu1.source.kimi"),
    hermes: copy("vu1.source.hermes"),
    openclaw: copy("vu1.source.openclaw"),
    other: copy("vu1.source.other"),
  };
  return labels[id] ?? id;
}

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// A bucket's label on the screen: "Nov 16" for a day, "14:00" for an hour, the month as sent.
export function pointLabel(row: DailyRow | undefined, dateKey: DateKey): string {
  const value = String(row?.[dateKey] ?? "");
  if (!value) return "";
  if (dateKey === "hour") return value.slice(11, 16);
  if (dateKey === "day") return MONTH_DAY.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
  return value;
}
