'use strict';

function isDate(s) {
  return typeof s === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
}

function toUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatDateUTC(d) {
  return toUtcDay(d).toISOString().slice(0, 10);
}

function normalizeDateRange(fromRaw, toRaw) {
  const today = new Date();
  const toDefault = formatDateUTC(today);
  const fromDefault = formatDateUTC(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 29))
  );

  const from = isDate(fromRaw) ? fromRaw : fromDefault;
  const to = isDate(toRaw) ? toRaw : toDefault;
  return { from, to };
}

function parseUtcDateString(yyyyMmDd) {
  if (!isDate(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split('-').map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return formatDateUTC(dt) === yyyyMmDd ? dt : null;
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function computeHeatmapWindowUtc({ weeks, weekStartsOn, to }) {
  const end = parseUtcDateString(to) || new Date();
  const desired = weekStartsOn === 'mon' ? 1 : 0;
  const endDow = end.getUTCDay();
  const endWeekStart = addUtcDays(end, -((endDow - desired + 7) % 7));
  const gridStart = addUtcDays(endWeekStart, -7 * (weeks - 1));
  return { from: formatDateUTC(gridStart), gridStart, end };
}

const TIMEZONE_FORMATTERS = new Map();

function getTimeZoneFormatter(timeZone) {
  if (TIMEZONE_FORMATTERS.has(timeZone)) return TIMEZONE_FORMATTERS.get(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  TIMEZONE_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function parseDateParts(yyyyMmDd) {
  if (!isDate(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split('-').map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { year: y, month: m, day: d };
}

function formatDateParts(parts) {
  if (!parts) return null;
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dateFromPartsUTC(parts) {
  if (!parts) return null;
  const y = Number(parts.year);
  const m = Number(parts.month) - 1;
  const d = Number(parts.day);
  const h = Number(parts.hour || 0);
  const min = Number(parts.minute || 0);
  const s = Number(parts.second || 0);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m, d, h, min, s));
}

function datePartsFromDateUTC(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds()
  };
}

function addDatePartsDays(parts, days) {
  const base = dateFromPartsUTC(parts);
  if (!base) return null;
  return datePartsFromDateUTC(addUtcDays(base, days));
}

function addDatePartsMonths(parts, months) {
  if (!parts) return null;
  const y = Number(parts.year);
  const m = Number(parts.month) - 1 + Number(months || 0);
  const d = Number(parts.day || 1);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m, d));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate()
  };
}

function parseOffsetMinutes(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!/^-?\\d+$/.test(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  if (v < -840 || v > 840) return null;
  return Math.trunc(v);
}

function normalizeTimeZone(tzRaw, offsetRaw) {
  const tz = typeof tzRaw === 'string' ? tzRaw.trim() : '';
  let timeZone = null;
  if (tz) {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        getTimeZoneFormatter(tz).format(new Date(0));
        timeZone = tz;
      }
    } catch (_e) {
      timeZone = null;
    }
  }

  const offsetMinutes = parseOffsetMinutes(offsetRaw);
  if (timeZone) return { timeZone, offsetMinutes: null, source: 'iana' };
  if (offsetMinutes != null) return { timeZone: null, offsetMinutes, source: 'offset' };
  return { timeZone: null, offsetMinutes: 0, source: 'utc' };
}

function getUsageTimeZoneContext(_url) {
  // Phase 1: ignore tz parameters to avoid partial aggregates.
  return normalizeTimeZone();
}

function isUtcTimeZone(tzContext) {
  if (!tzContext) return true;
  const tz = tzContext.timeZone;
  if (tz) {
    const upper = tz.toUpperCase();
    return upper === 'UTC' || upper === 'ETC/UTC' || upper === 'ETC/GMT';
  }
  return Number(tzContext.offsetMinutes || 0) === 0;
}

function getTimeZoneParts(date, timeZone) {
  const formatter = getTimeZoneFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value);
    if (part.type === 'month') month = Number(part.value);
    if (part.type === 'day') day = Number(part.value);
    if (part.type === 'hour') hour = Number(part.value);
    if (part.type === 'minute') minute = Number(part.value);
    if (part.type === 'second') second = Number(part.value);
  }

  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function getLocalParts(date, tzContext) {
  if (tzContext?.timeZone) {
    return getTimeZoneParts(date, tzContext.timeZone);
  }
  const offsetMinutes = Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : 0;
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function formatLocalDateKey(date, tzContext) {
  return formatDateParts(getLocalParts(date, tzContext));
}

function localDatePartsToUtc(parts, tzContext) {
  const baseUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour || 0),
    Number(parts.minute || 0),
    Number(parts.second || 0)
  );
  if (tzContext?.timeZone) {
    let offset = getTimeZoneOffsetMinutes(new Date(baseUtc), tzContext.timeZone);
    let utc = baseUtc - offset * 60000;
    const offset2 = getTimeZoneOffsetMinutes(new Date(utc), tzContext.timeZone);
    if (offset2 !== offset) {
      utc = baseUtc - offset2 * 60000;
    }
    return new Date(utc);
  }
  const offsetMinutes = Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : 0;
  return new Date(baseUtc - offsetMinutes * 60000);
}

function normalizeDateRangeLocal(fromRaw, toRaw, tzContext) {
  const todayParts = getLocalParts(new Date(), tzContext);
  const toDefault = formatDateParts(todayParts);
  const fromDefaultParts = addDatePartsDays(
    { year: todayParts.year, month: todayParts.month, day: todayParts.day },
    -29
  );
  const fromDefault = formatDateParts(fromDefaultParts);
  const from = isDate(fromRaw) ? fromRaw : fromDefault;
  const to = isDate(toRaw) ? toRaw : toDefault;
  return { from, to };
}

function listDateStrings(from, to) {
  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) return [];
  const start = dateFromPartsUTC(startParts);
  const end = dateFromPartsUTC(endParts);
  if (!start || !end || end < start) return [];
  const days = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    days.push(formatDateUTC(cursor));
  }
  return days;
}

module.exports = {
  isDate,
  toUtcDay,
  formatDateUTC,
  normalizeDateRange,
  parseUtcDateString,
  addUtcDays,
  computeHeatmapWindowUtc,
  parseDateParts,
  formatDateParts,
  dateFromPartsUTC,
  datePartsFromDateUTC,
  addDatePartsDays,
  addDatePartsMonths,
  normalizeTimeZone,
  getUsageTimeZoneContext,
  isUtcTimeZone,
  getTimeZoneOffsetMinutes,
  getLocalParts,
  formatLocalDateKey,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  listDateStrings
};
