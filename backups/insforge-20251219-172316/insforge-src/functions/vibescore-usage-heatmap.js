// Edge function: vibescore-usage-heatmap
// Returns a GitHub-inspired activity heatmap derived from UTC daily token usage.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { addUtcDays, computeHeatmapWindowUtc, formatDateUTC, parseUtcDateString } = require('../shared/date');
const { toBigInt } = require('../shared/numbers');

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const url = new URL(request.url);

  const weeksRaw = url.searchParams.get('weeks');
  const weeks = normalizeWeeks(weeksRaw);
  if (!weeks) return json({ error: 'Invalid weeks' }, 400);

  const weekStartsOnRaw = url.searchParams.get('week_starts_on');
  const weekStartsOn = normalizeWeekStartsOn(weekStartsOnRaw);
  if (!weekStartsOn) return json({ error: 'Invalid week_starts_on' }, 400);

  const toRaw = url.searchParams.get('to');
  const to = normalizeToDate(toRaw);
  if (!to) return json({ error: 'Invalid to' }, 400);

  const { from, gridStart, end } = computeHeatmapWindowUtc({
    weeks,
    weekStartsOn,
    to
  });

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const { data, error } = await auth.edgeClient.database
    .from('vibescore_tracker_daily')
    .select('day,total_tokens')
    .eq('user_id', auth.userId)
    .gte('day', from)
    .lte('day', to)
    .order('day', { ascending: true });

  if (error) return json({ error: error.message }, 500);

  const valuesByDay = new Map();
  for (const row of Array.isArray(data) ? data : []) {
    const day = typeof row?.day === 'string' ? row.day : null;
    if (!day) continue;
    valuesByDay.set(day, toBigInt(row?.total_tokens));
  }

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
};

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

