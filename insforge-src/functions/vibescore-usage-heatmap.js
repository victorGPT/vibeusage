// Edge function: vibescore-usage-heatmap
// Returns a GitHub-inspired activity heatmap derived from timezone-aware daily token usage.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam } = require('../shared/source');
const { getModelParam } = require('../shared/model');
const {
  addDatePartsDays,
  addUtcDays,
  computeHeatmapWindowUtc,
  dateFromPartsUTC,
  formatDateParts,
  formatDateUTC,
  formatLocalDateKey,
  getLocalParts,
  isUtcTimeZone,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts,
  parseUtcDateString
} = require('../shared/date');
const { toBigInt } = require('../shared/numbers');
const { forEachPage } = require('../shared/pagination');
const { logSlowQuery, withRequestLogging } = require('../shared/logging');

module.exports = withRequestLogging('vibescore-usage-heatmap', async function(request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const url = new URL(request.url);
  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return json({ error: sourceResult.error }, 400);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return json({ error: modelResult.error }, 400);
  const model = modelResult.model;

  const weeksRaw = url.searchParams.get('weeks');
  const weeks = normalizeWeeks(weeksRaw);
  if (!weeks) return json({ error: 'Invalid weeks' }, 400);

  const weekStartsOnRaw = url.searchParams.get('week_starts_on');
  const weekStartsOn = normalizeWeekStartsOn(weekStartsOnRaw);
  if (!weekStartsOn) return json({ error: 'Invalid week_starts_on' }, 400);

  const toRaw = url.searchParams.get('to');

  if (isUtcTimeZone(tzContext)) {
    const to = normalizeToDate(toRaw);
    if (!to) return json({ error: 'Invalid to' }, 400);

    const { from, gridStart, end } = computeHeatmapWindowUtc({
      weeks,
      weekStartsOn,
      to
    });

    const baseUrl = getBaseUrl();
    const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
    if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

    const startIso = gridStart.toISOString();
    const endUtc = addUtcDays(end, 1);
    const endIso = endUtc.toISOString();

    const valuesByDay = new Map();
    const queryStartMs = Date.now();
    let rowCount = 0;
    const { error } = await forEachPage({
      createQuery: () => {
        let query = auth.edgeClient.database
          .from('vibescore_tracker_hourly')
          .select('hour_start,total_tokens')
          .eq('user_id', auth.userId);
        if (source) query = query.eq('source', source);
        if (model) query = query.eq('model', model);
        return query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour_start', { ascending: true });
      },
      onPage: (rows) => {
        const pageRows = Array.isArray(rows) ? rows : [];
        rowCount += pageRows.length;
        for (const row of pageRows) {
          const ts = row?.hour_start;
          if (!ts) continue;
          const dt = new Date(ts);
          if (!Number.isFinite(dt.getTime())) continue;
          const day = formatDateUTC(dt);
          const prev = valuesByDay.get(day) || 0n;
          valuesByDay.set(day, prev + toBigInt(row?.total_tokens));
        }
      }
    });
    const queryDurationMs = Date.now() - queryStartMs;
    logSlowQuery(logger, {
      query_label: 'usage_heatmap',
      duration_ms: queryDurationMs,
      row_count: rowCount,
      range_weeks: weeks,
      range_days: weeks * 7,
      source: source || null,
      model: model || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
    });

    if (error) return json({ error: error.message }, 500);

    const nz = [];
    let activeDays = 0;
    for (let i = 0; i < weeks * 7; i++) {
      const dt = addUtcDays(gridStart, i);
      if (dt.getTime() > end.getTime()) break;
      const value = valuesByDay.get(formatDateUTC(dt)) || 0n;
      if (value > 0n) {
        activeDays += 1;
        nz.push(value);
      }
    }

    nz.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const t1 = quantileNearestRank(nz, 0.5);
    const t2 = quantileNearestRank(nz, 0.75);
    const t3 = quantileNearestRank(nz, 0.9);

    const levelFor = (value) => {
      if (!value || value <= 0n) return 0;
      if (value <= t1) return 1;
      if (value <= t2) return 2;
      if (value <= t3) return 3;
      return 4;
    };

    const weeksOut = [];
    for (let w = 0; w < weeks; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dt = addUtcDays(gridStart, w * 7 + d);
        if (dt.getTime() > end.getTime()) {
          week.push(null);
          continue;
        }
        const day = formatDateUTC(dt);
        const value = valuesByDay.get(day) || 0n;
        week.push({ day, value: value.toString(), level: levelFor(value) });
      }
      weeksOut.push(week);
    }

    const streakDays = computeActiveStreakDays({
      valuesByDay,
      to: end
    });

    return json(
      {
        from,
        to,
        week_starts_on: weekStartsOn,
        thresholds: { t1: t1.toString(), t2: t2.toString(), t3: t3.toString() },
        active_days: activeDays,
        streak_days: streakDays,
        weeks: weeksOut
      },
      200
    );
  }

  const todayParts = getLocalParts(new Date(), tzContext);
  const toParts = toRaw ? parseDateParts(toRaw) : {
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day
  };
  if (!toParts) return json({ error: 'Invalid to' }, 400);

  const end = dateFromPartsUTC(toParts);
  if (!end) return json({ error: 'Invalid to' }, 400);

  const desired = weekStartsOn === 'mon' ? 1 : 0;
  const endDow = end.getUTCDay();
  const endWeekStart = addUtcDays(end, -((endDow - desired + 7) % 7));
  const gridStart = addUtcDays(endWeekStart, -7 * (weeks - 1));
  const from = formatDateUTC(gridStart);
  const to = formatDateParts(toParts);

  const startParts = parseDateParts(from);
  if (!startParts) return json({ error: 'Invalid to' }, 400);

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const valuesByDay = new Map();
  const queryStartMs = Date.now();
  let rowCount = 0;
  const { error } = await forEachPage({
    createQuery: () => {
      let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select('hour_start,total_tokens')
        .eq('user_id', auth.userId);
      if (source) query = query.eq('source', source);
      if (model) query = query.eq('model', model);
      return query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour_start', { ascending: true });
    },
    onPage: (rows) => {
      const pageRows = Array.isArray(rows) ? rows : [];
      rowCount += pageRows.length;
      for (const row of pageRows) {
        const ts = row?.hour_start;
        if (!ts) continue;
        const dt = new Date(ts);
        if (!Number.isFinite(dt.getTime())) continue;
        const key = formatLocalDateKey(dt, tzContext);
        const prev = valuesByDay.get(key) || 0n;
        valuesByDay.set(key, prev + toBigInt(row?.total_tokens));
      }
    }
  });
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_heatmap',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_weeks: weeks,
    range_days: weeks * 7,
    source: source || null,
    model: model || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
  });

  if (error) return json({ error: error.message }, 500);

  const nz = [];
  let activeDays = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const dt = addUtcDays(gridStart, i);
    if (dt.getTime() > end.getTime()) break;
    const value = valuesByDay.get(formatDateUTC(dt)) || 0n;
    if (value > 0n) {
      activeDays += 1;
      nz.push(value);
    }
  }

  nz.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const t1 = quantileNearestRank(nz, 0.5);
  const t2 = quantileNearestRank(nz, 0.75);
  const t3 = quantileNearestRank(nz, 0.9);

  const levelFor = (value) => {
    if (!value || value <= 0n) return 0;
    if (value <= t1) return 1;
    if (value <= t2) return 2;
    if (value <= t3) return 3;
    return 4;
  };

  const weeksOut = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = addUtcDays(gridStart, w * 7 + d);
      if (dt.getTime() > end.getTime()) {
        week.push(null);
        continue;
      }
      const day = formatDateUTC(dt);
      const value = valuesByDay.get(day) || 0n;
      week.push({ day, value: value.toString(), level: levelFor(value) });
    }
    weeksOut.push(week);
  }

  const streakDays = computeActiveStreakDays({
    valuesByDay,
    to: end
  });

  return json(
    {
      from,
      to,
      week_starts_on: weekStartsOn,
      thresholds: { t1: t1.toString(), t2: t2.toString(), t3: t3.toString() },
      active_days: activeDays,
      streak_days: streakDays,
      weeks: weeksOut
    },
    200
  );
});

function normalizeWeeks(raw) {
  if (raw == null || raw === '') return 52;
  const s = String(raw).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  if (v < 1 || v > 104) return null;
  return v;
}

function normalizeWeekStartsOn(raw) {
  const v = (raw == null || raw === '' ? 'sun' : String(raw)).trim().toLowerCase();
  if (v === 'sun' || v === 'mon') return v;
  return null;
}

function normalizeToDate(raw) {
  if (raw == null || raw === '') return formatDateUTC(new Date());
  const s = String(raw).trim();
  const dt = parseUtcDateString(s);
  return dt ? formatDateUTC(dt) : null;
}

function quantileNearestRank(sortedBigints, q) {
  if (!Array.isArray(sortedBigints) || sortedBigints.length === 0) return 0n;
  const n = sortedBigints.length;
  const pos = Math.floor((n - 1) * q);
  const idx = Math.min(n - 1, Math.max(0, pos));
  return sortedBigints[idx] || 0n;
}

function computeActiveStreakDays({ valuesByDay, to }) {
  let streak = 0;
  for (let i = 0; i < 370; i++) {
    const key = formatDateUTC(addUtcDays(to, -i));
    const value = valuesByDay.get(key) || 0n;
    if (value > 0n) streak += 1;
    else break;
  }
  return streak;
}
