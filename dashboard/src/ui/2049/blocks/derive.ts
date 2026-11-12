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
