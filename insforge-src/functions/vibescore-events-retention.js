// Edge function: vibescore-events-retention
// Purges legacy events older than a cutoff (default 30 days).
// Requires service role token in Authorization header.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken } = require('../shared/auth');
const { getBaseUrl, getServiceRoleKey } = require('../shared/env');

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: 'Service role key missing' }, 500);

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer || bearer !== serviceRoleKey) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const days = clampDays(body.data?.days);
  const dryRun = Boolean(body.data?.dry_run);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(cutoff.getTime())) return json({ error: 'Invalid cutoff' }, 400);

  const baseUrl = getBaseUrl();
  const url = new URL('/api/database/rpc/vibescore_purge_events', baseUrl);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cutoff_ts: cutoff.toISOString(), dry_run: dryRun })
  });

  const { data, error } = await readApiJson(res);
  if (!res.ok) return json({ error: error || `HTTP ${res.status}` }, res.status || 500);

  const deleted = resolveDeletedCount(data);

  return json(
    {
      ok: true,
      dry_run: dryRun,
      days,
      cutoff: cutoff.toISOString(),
      deleted
    },
    200
  );
};

function resolveDeletedCount(data) {
  if (Array.isArray(data) && data.length > 0) {
    return toSafeInt(data[0]?.deleted_count);
  }
  return toSafeInt(data?.deleted_count);
}

function toSafeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function clampDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  if (n <= 0) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.floor(n));
}

async function readApiJson(res) {
  const text = await res.text();
  if (!text) return { data: null, error: null };
  try {
    const parsed = JSON.parse(text);
    return { data: parsed, error: parsed?.message || parsed?.error || null };
  } catch (_e) {
    return { data: null, error: text.slice(0, 300) };
  }
}
