import { toFiniteNumber } from "./format.js";

export const DAILY_SORT_COLUMNS = [
  { key: "day", label: "Date", title: "Sort by Date" },
  { key: "total_tokens", label: "Total", title: "Sort by Total" },
  { key: "input_tokens", label: "Input", title: "Sort by Input" },
  { key: "output_tokens", label: "Output", title: "Sort by Output" },
  {
    key: "cached_input_tokens",
    label: "Cached",
    title: "Sort by Cached input",
  },
  {
    key: "reasoning_output_tokens",
    label: "Reasoning",
    title: "Sort by Reasoning output",
  },
];

function toDigitString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const stripped = s.replace(/^0+/, "");
  return stripped.length === 0 ? "0" : stripped;
}

function compareIntLike(a, b) {
  const sa = toDigitString(a);
  const sb = toDigitString(b);
  if (sa && sb) {
    if (sa.length !== sb.length) return sa.length < sb.length ? -1 : 1;
    if (sa === sb) return 0;
    return sa < sb ? -1 : 1;
  }

  const na = toFiniteNumber(a);
  const nb = toFiniteNumber(b);
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  if (na === nb) return 0;
  return na < nb ? -1 : 1;
}

function compareDayString(a, b) {
  const sa = typeof a === "string" ? a : String(a || "");
  const sb = typeof b === "string" ? b : String(b || "");
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

export function sortDailyRows(rows, { key, dir }) {
  const direction = dir === "asc" ? 1 : -1;
  const items = Array.isArray(rows) ? rows : [];

  const cmp = key === "day" ? compareDayString : compareIntLike;

  return items
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = a.row?.[key];
      const bv = b.row?.[key];

      const aMissing = av == null;
      const bMissing = bv == null;
      if (aMissing && bMissing) return a.index - b.index;
      if (aMissing) return 1;
      if (bMissing) return -1;

      const base = cmp(av, bv);
      if (base !== 0) return base * direction;
      return a.index - b.index;
    })
    .map((x) => x.row);
}

