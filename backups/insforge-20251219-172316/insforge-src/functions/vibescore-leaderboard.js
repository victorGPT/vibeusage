// Edge function: vibescore-leaderboard
// Returns token usage leaderboards (UTC calendar day/week/month/total) for authenticated users.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { isDate, toUtcDay, addUtcDays, formatDateUTC } = require('../shared/date');
const { toBigInt, toPositiveInt, toPositiveIntOrNull } = require('../shared/numbers');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const period = normalizePeriod(url.searchParams.get('period'));
  if (!period) return json({ error: 'Invalid period' }, 400);

  const limit = normalizeLimit(url.searchParams.get('limit'));

  let from;
  let to;
  try {
    ({ from, to } = await computeWindow({ period, edgeClient: auth.edgeClient }));
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }

  const entriesView = `vibescore_leaderboard_${period}_current`;
  const meView = `vibescore_leaderboard_me_${period}_current`;

  const { data: rawEntries, error: entriesErr } = await auth.edgeClient.database
    .from(entriesView)
    .select('rank,is_me,display_name,avatar_url,total_tokens')
    .order('rank', { ascending: true });

  if (entriesErr) return json({ error: entriesErr.message }, 500);

  const { data: rawMe, error: meErr } = await auth.edgeClient.database
    .from(meView)
    .select('rank,total_tokens')
    .maybeSingle();

  if (meErr) return json({ error: meErr.message }, 500);

  const entries = (rawEntries || []).slice(0, limit).map(normalizeEntry);
  const me = normalizeMe(rawMe);

  return json(
    {
      period,
      from,
      to,
      generated_at: new Date().toISOString(),
      entries,
      me
    },
    200
  );
};

function normalizePeriod(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'day' || v === 'week' || v === 'month' || v === 'total') return v;
  return null;
}

function normalizeLimit(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const i = Math.floor(n);
  if (i < 1) return 1;
  if (i > MAX_LIMIT) return MAX_LIMIT;
  return i;
}

async function computeWindow({ period, edgeClient }) {
  const now = new Date();
  const today = toUtcDay(now);

  if (period === 'day') {
    const day = formatDateUTC(today);
    return { from: day, to: day };
  }

  if (period === 'week') {
    const dow = today.getUTCDay(); // 0=Sunday
    const from = addUtcDays(today, -dow);
    const to = addUtcDays(from, 6);
    return { from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (period === 'month') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  const { data: meta, error } = await edgeClient.database
    .from('vibescore_leaderboard_meta_total_current')
    .select('from_day,to_day')
    .maybeSingle();

  if (error) throw new Error(error.message);

  const from = isDate(meta?.from_day) ? meta.from_day : formatDateUTC(today);
  const to = isDate(meta?.to_day) ? meta.to_day : formatDateUTC(today);
  return { from, to };
}

function normalizeEntry(row) {
  return {
    rank: toPositiveInt(row?.rank),
    is_me: Boolean(row?.is_me),
    display_name: typeof row?.display_name === 'string' && row.display_name ? row.display_name : 'Anonymous',
    avatar_url: typeof row?.avatar_url === 'string' && row.avatar_url ? row.avatar_url : null,
    total_tokens: toBigInt(row?.total_tokens).toString()
  };
}

function normalizeMe(row) {
  const rank = toPositiveIntOrNull(row?.rank);
  const totalTokens = toBigInt(row?.total_tokens);
  return { rank, total_tokens: totalTokens.toString() };
}

