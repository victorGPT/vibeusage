// Edge function: vibescore-leaderboard-refresh
// Rebuilds leaderboard snapshots for current UTC windows (day/week/month/total).
// Auth: Authorization: Bearer <service_role_key>

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { isDate, toUtcDay, addUtcDays, formatDateUTC } = require('../shared/date');
const { toBigInt, toPositiveInt } = require('../shared/numbers');

const PERIODS = ['day', 'week', 'month', 'total'];
const INSERT_BATCH_SIZE = 500;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: 'Service role key missing' }, 500);

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer || bearer !== serviceRoleKey) return json({ error: 'Unauthorized' }, 401);

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey
  });

  const url = new URL(request.url);
  const requested = normalizePeriod(url.searchParams.get('period'));
  if (url.searchParams.has('period') && !requested) return json({ error: 'Invalid period' }, 400);

  const targetPeriods = requested ? [requested] : PERIODS;
  const generatedAt = new Date().toISOString();
  const results = [];

  try {
    for (const period of targetPeriods) {
      const window = await computeWindow({ period, serviceClient });
      if (!window.ok) return json({ error: window.error }, 500);

      const { from, to } = window;
      const { inserted } = await refreshPeriod({
        serviceClient,
        period,
        from,
        to,
        generatedAt
      });

      results.push({ period, from, to, inserted });
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }

  return json({ success: true, generated_at: generatedAt, results }, 200);
};

function normalizePeriod(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return PERIODS.includes(v) ? v : null;
}

async function computeWindow({ period, serviceClient }) {
  const now = new Date();
  const today = toUtcDay(now);

  if (period === 'day') {
    const day = formatDateUTC(today);
    return { ok: true, from: day, to: day };
  }

  if (period === 'week') {
    const dow = today.getUTCDay();
    const from = addUtcDays(today, -dow);
    const to = addUtcDays(from, 6);
    return { ok: true, from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (period === 'month') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { ok: true, from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  const { data: meta, error } = await serviceClient.database
    .from('vibescore_leaderboard_meta_total_current')
    .select('from_day,to_day')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  const from = isDate(meta?.from_day) ? meta.from_day : formatDateUTC(today);
  const to = isDate(meta?.to_day) ? meta.to_day : formatDateUTC(today);
  return { ok: true, from, to };
}

async function refreshPeriod({ serviceClient, period, from, to, generatedAt }) {
  const deleteRes = await serviceClient.database
    .from('vibescore_leaderboard_snapshots')
    .delete()
    .eq('period', period)
    .eq('from_day', from)
    .eq('to_day', to);

  if (deleteRes.error) {
    throw new Error(deleteRes.error.message);
  }

  const sourceView = `vibescore_leaderboard_source_${period}`;
  const { data: rows, error } = await serviceClient.database
    .from(sourceView)
    .select('user_id,rank,total_tokens,display_name,avatar_url,from_day,to_day')
    .order('rank', { ascending: true });

  if (error) throw new Error(error.message);

  const normalized = (rows || [])
    .map((row) => normalizeSnapshotRow({ row, period, from, to, generatedAt }))
    .filter(Boolean);

  for (const batch of chunkRows(normalized, INSERT_BATCH_SIZE)) {
    const { error: insertErr } = await serviceClient.database.from('vibescore_leaderboard_snapshots').insert(batch);
    if (insertErr) throw new Error(insertErr.message);
  }

  return { inserted: normalized.length };
}

function normalizeSnapshotRow({ row, period, from, to, generatedAt }) {
  if (!row?.user_id) return null;
  const rank = toPositiveInt(row.rank);
  if (rank <= 0) return null;

  const totalTokens = toBigInt(row.total_tokens).toString();
  const displayName = normalizeDisplayName(row.display_name);
  const avatarUrl = normalizeAvatarUrl(row.avatar_url);

  return {
    period,
    from_day: from,
    to_day: to,
    user_id: row.user_id,
    rank,
    total_tokens: totalTokens,
    display_name: displayName,
    avatar_url: avatarUrl,
    generated_at: generatedAt
  };
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return 'Anonymous';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'Anonymous';
}

function normalizeAvatarUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function chunkRows(rows, size) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
