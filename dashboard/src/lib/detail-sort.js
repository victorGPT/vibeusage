import { toFiniteNumber } from "./format.js";

const DATE_KEYS = new Set(["day", "hour", "month"]);

export function isDetailDateKey(key) {
  return DATE_KEYS.has(key);
}

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

function compareString(a, b) {
  const sa = typeof a === "string" ? a : String(a || "");
  const sb = typeof b === "string" ? b : String(b || "");
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

function parseDayKey(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(dt.getTime())) return null;
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt.getTime();
}

function parseMonthKey(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  const dt = new Date(Date.UTC(year, month - 1, 1));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.getTime();
}

function parseHourKey(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z?$/
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.getTime();
}

function compareDateLike(a, b, key) {
  const parse =
    key === "hour" ? parseHourKey : key === "month" ? parseMonthKey : parseDayKey;
  const na = parse(a);
  const nb = parse(b);
  if (na != null && nb != null) {
    if (na === nb) return 0;
    return na < nb ? -1 : 1;
  }
  return compareString(a, b);
}

export function sortDetailRows(rows, { key, dir }) {
  const direction = dir === "asc" ? 1 : -1;
  const items = Array.isArray(rows) ? rows : [];

  const cmp = DATE_KEYS.has(key) ? (a, b) => compareDateLike(a, b, key) : compareIntLike;
  const pickValue = (row) => {
    if (key === "total_tokens" && row?.billable_total_tokens != null) {
      return row.billable_total_tokens;
    }
    return row?.[key];
  };

  return items
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = pickValue(a.row);
      const bv = pickValue(b.row);

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
