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

module.exports = {
  isDate,
  toUtcDay,
  formatDateUTC,
  normalizeDateRange,
  parseUtcDateString,
  addUtcDays,
  computeHeatmapWindowUtc
};

