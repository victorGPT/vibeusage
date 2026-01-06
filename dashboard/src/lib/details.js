import { sortDetailRows } from "./detail-sort.js";

export const DETAILS_PAGE_SIZE = 12;

const TOKEN_KEYS = [
  "total_tokens",
  "billable_total_tokens",
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
];

function isNonZeroToken(value) {
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (value == null) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  if (!/^-?\d+$/.test(raw)) return false;
  const normalized = raw.startsWith("-") ? raw.slice(1) : raw;
  return /[1-9]/.test(normalized);
}

function hasNonZeroTokens(row) {
  return TOKEN_KEYS.some((key) => isNonZeroToken(row?.[key]));
}

export function trimLeadingZeroMonths(rows) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return [];
  const ordered = sortDetailRows(items, { key: "month", dir: "asc" });
  const firstIndex = ordered.findIndex(
    (row) => row?.month && hasNonZeroTokens(row)
  );
  if (firstIndex === -1) return items;
  return ordered.slice(firstIndex);
}

export function paginateRows(rows, page, pageSize = DETAILS_PAGE_SIZE) {
  const items = Array.isArray(rows) ? rows : [];
  const size = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DETAILS_PAGE_SIZE;
  const index = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const start = index * size;
  return items.slice(start, start + size);
}
