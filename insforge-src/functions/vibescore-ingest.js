// Edge function: vibescore-ingest
// Accepts half-hour token usage aggregates from a device token and stores them idempotently.
//
// Auth:
// - Authorization: Bearer <device_token> (opaque, stored as sha256 hash server-side)

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { withRequestLogging } = require('../shared/logging');
const { createConcurrencyGuard } = require('../shared/concurrency');
const { getBearerToken } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');
const { normalizeSource } = require('../shared/source');
const { normalizeModel } = require('../shared/model');
const { computeBillableTotalTokens } = require('../shared/usage-billable');

const MAX_BUCKETS = 500;
const DEFAULT_MODEL = 'unknown';
const BILLABLE_RULE_VERSION = 1;

const ingestGuard = createConcurrencyGuard({
  name: 'vibescore-ingest',
  envKey: ['VIBEUSAGE_INGEST_MAX_INFLIGHT', 'VIBESCORE_INGEST_MAX_INFLIGHT'],
  defaultMax: 0,
  retryAfterEnvKey: ['VIBEUSAGE_INGEST_RETRY_AFTER_MS', 'VIBESCORE_INGEST_RETRY_AFTER_MS'],
  defaultRetryAfterMs: 1000
});

module.exports = withRequestLogging('vibescore-ingest', async function(request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const deviceToken = getBearerToken(request.headers.get('Authorization'));
  if (!deviceToken) return json({ error: 'Missing bearer token' }, 401);

  const guard = ingestGuard?.acquire();
  if (guard && !guard.ok) {
    return json({ error: 'Too many requests' }, 429, guard.headers);
  }

  const fetcher = logger?.fetch || fetch;
  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const serviceClient = serviceRoleKey
    ? createClient({
        baseUrl,
        anonKey: anonKey || serviceRoleKey,
        edgeFunctionToken: serviceRoleKey
      })
    : null;

  try {
    const tokenHash = await sha256Hex(deviceToken);
    let tokenRow = null;
    try {
      tokenRow = serviceClient
        ? await getTokenRowWithServiceClient(serviceClient, tokenHash)
        : await getTokenRowWithAnonKey({ baseUrl, anonKey, tokenHash, fetcher });
    } catch (e) {
      return json({ error: e?.message || 'Internal error' }, 500);
    }
    if (!tokenRow) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(request);
    if (body.error) return json({ error: body.error }, body.status);

    const hourly = normalizeHourly(body.data);
    if (!Array.isArray(hourly)) {
      return json({ error: 'Invalid payload: expected {hourly:[...]} or [...]' }, 400);
    }
    if (hourly.length > MAX_BUCKETS) return json({ error: `Too many buckets (max ${MAX_BUCKETS})` }, 413);

    const nowIso = new Date().toISOString();
    const rows = buildRows({ hourly, tokenRow, nowIso });
    if (rows.error) return json({ error: rows.error }, 400);

    if (rows.data.length === 0) {
      await recordIngestBatchMetrics({
        serviceClient,
        baseUrl,
        anonKey,
        tokenHash,
        tokenRow,
        bucketCount: 0,
        inserted: 0,
        skipped: 0,
        source: null,
        fetcher
      });
      return json({ success: true, inserted: 0, skipped: 0 }, 200);
    }

    const upsert = serviceClient
      ? await upsertWithServiceClient({
          serviceClient,
          tokenRow,
          rows: rows.data,
          nowIso,
          baseUrl,
          serviceRoleKey,
          tokenHash,
          fetcher
        })
      : await upsertWithAnonKey({ baseUrl, anonKey, tokenHash, tokenRow, rows: rows.data, nowIso, fetcher });

    if (!upsert.ok) return json({ error: upsert.error }, 500);

    await recordIngestBatchMetrics({
      serviceClient,
      baseUrl,
      anonKey,
      tokenHash,
      tokenRow,
      bucketCount: rows.data.length,
      inserted: upsert.inserted,
      skipped: upsert.skipped,
      source: deriveMetricsSource(rows.data),
      fetcher
    });

    return json(
      {
        success: true,
        inserted: upsert.inserted,
        skipped: upsert.skipped
      },
      200
    );
  } finally {
    if (guard && typeof guard.release === 'function') guard.release();
  }
});

function buildRows({ hourly, tokenRow, nowIso }) {
  const byHour = new Map();

  for (const raw of hourly) {
    const parsed = parseHourlyBucket(raw);
    if (!parsed.ok) return { error: parsed.error, data: [] };
    const source = parsed.value.source || 'codex';
    const model = parsed.value.model || DEFAULT_MODEL;
    const dedupeKey = `${parsed.value.hour_start}::${source}::${model}`;
    byHour.set(dedupeKey, { ...parsed.value, source, model });
  }

  const rows = [];
  for (const bucket of byHour.values()) {
    const billable = computeBillableTotalTokens({ source: bucket.source, totals: bucket });
    rows.push({
      user_id: tokenRow.user_id,
      device_id: tokenRow.device_id,
      device_token_id: tokenRow.id,
      source: bucket.source,
      model: bucket.model,
      hour_start: bucket.hour_start,
      input_tokens: bucket.input_tokens,
      cached_input_tokens: bucket.cached_input_tokens,
      output_tokens: bucket.output_tokens,
      reasoning_output_tokens: bucket.reasoning_output_tokens,
      total_tokens: bucket.total_tokens,
      billable_total_tokens: billable.toString(),
      billable_rule_version: BILLABLE_RULE_VERSION,
      updated_at: nowIso
    });
  }

  return { error: null, data: rows };
}

function deriveMetricsSource(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sources = new Set();
  for (const row of rows) {
    const source = typeof row?.source === 'string' ? row.source.trim() : '';
    if (source) sources.add(source);
  }
  if (sources.size === 1) return Array.from(sources)[0];
  if (sources.size > 1) return 'mixed';
  return null;
}

async function getTokenRowWithServiceClient(serviceClient, tokenHash) {
  const { data: tokenRow, error: tokenErr } = await serviceClient.database
    .from('vibescore_tracker_device_tokens')
    .select('id,user_id,device_id,revoked_at,last_sync_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (tokenErr) throw new Error(tokenErr.message);
  if (!tokenRow || tokenRow.revoked_at) return null;
  return tokenRow;
}

async function getTokenRowWithAnonKey({ baseUrl, anonKey, tokenHash, fetcher }) {
  if (!anonKey) throw new Error('Anon key missing');
  const url = new URL('/api/database/records/vibescore_tracker_device_tokens', baseUrl);
  url.searchParams.set('select', 'id,user_id,device_id,revoked_at,last_sync_at');
  url.searchParams.set('token_hash', `eq.${tokenHash}`);
  url.searchParams.set('limit', '1');

  const res = await (fetcher || fetch)(url.toString(), {
    method: 'GET',
    headers: buildAnonHeaders({ anonKey, tokenHash })
  });
  const { data, error } = await readApiJson(res);
  if (!res.ok) throw new Error(error || `HTTP ${res.status}`);

  const rows = normalizeRows(data);
  const tokenRow = rows?.[0] || null;
  if (!tokenRow || tokenRow.revoked_at) return null;
  return tokenRow;
}

async function upsertWithServiceClient({
  serviceClient,
  tokenRow,
  rows,
  nowIso,
  baseUrl,
  serviceRoleKey,
  tokenHash,
  fetcher
}) {
  if (serviceRoleKey && baseUrl) {
    const url = new URL('/api/database/records/vibescore_tracker_hourly', baseUrl);
    const res = await recordsUpsert({
      url,
      anonKey: serviceRoleKey,
      tokenHash,
      rows,
      onConflict: 'user_id,device_id,source,model,hour_start',
      prefer: 'return=representation',
      resolution: 'merge-duplicates',
      select: 'hour_start',
      fetcher
    });

    if (res.ok) {
      const insertedRows = normalizeRows(res.data);
      const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
      await bestEffortTouchWithServiceClient(serviceClient, tokenRow, nowIso);
      return { ok: true, inserted, skipped: 0 };
    }

    if (!isUpsertUnsupported(res)) {
      return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
    }
  }

  const table = serviceClient.database.from('vibescore_tracker_hourly');
  if (typeof table?.upsert === 'function') {
    const { error } = await table.upsert(rows, { onConflict: 'user_id,device_id,source,model,hour_start' });
    if (error) return { ok: false, error: error.message, inserted: 0, skipped: 0 };
    await bestEffortTouchWithServiceClient(serviceClient, tokenRow, nowIso);
    return { ok: true, inserted: rows.length, skipped: 0 };
  }

  return { ok: false, error: 'Half-hour upsert unsupported', inserted: 0, skipped: 0 };
}

async function upsertWithAnonKey({ baseUrl, anonKey, tokenHash, tokenRow, rows, nowIso, fetcher }) {
  if (!anonKey) return { ok: false, error: 'Anon key missing', inserted: 0, skipped: 0 };

  const url = new URL('/api/database/records/vibescore_tracker_hourly', baseUrl);
  const res = await recordsUpsert({
    url,
    anonKey,
    tokenHash,
    rows,
    onConflict: 'user_id,device_id,source,model,hour_start',
    prefer: 'return=representation',
    resolution: 'merge-duplicates',
    select: 'hour_start',
    fetcher
  });

  if (res.ok) {
    const insertedRows = normalizeRows(res.data);
    const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
    await bestEffortTouchWithAnonKey({ baseUrl, anonKey, tokenHash, fetcher });
    return { ok: true, inserted, skipped: 0 };
  }

  if (isUpsertUnsupported(res)) {
    return { ok: false, error: res.error || 'Half-hour upsert unsupported', inserted: 0, skipped: 0 };
  }

  return { ok: false, error: res.error || `HTTP ${res.status}`, inserted: 0, skipped: 0 };
}

async function recordIngestBatchMetrics({
  serviceClient,
  baseUrl,
  anonKey,
  tokenHash,
  tokenRow,
  bucketCount,
  inserted,
  skipped,
  source,
  fetcher
}) {
  if (!tokenRow) return;
  const row = {
    user_id: tokenRow.user_id,
    device_id: tokenRow.device_id,
    device_token_id: tokenRow.id,
    source: typeof source === 'string' ? source : null,
    bucket_count: toNonNegativeInt(bucketCount) ?? 0,
    inserted: toNonNegativeInt(inserted) ?? 0,
    skipped: toNonNegativeInt(skipped) ?? 0
  };

  try {
    if (serviceClient) {
      const { error } = await serviceClient.database.from('vibescore_tracker_ingest_batches').insert(row);
      if (error) throw new Error(error.message);
      return;
    }
    if (!anonKey || !baseUrl) return;
    const url = new URL('/api/database/records/vibescore_tracker_ingest_batches', baseUrl);
    const res = await (fetcher || fetch)(url.toString(), {
      method: 'POST',
      headers: {
        ...buildAnonHeaders({ anonKey, tokenHash }),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const { error } = await readApiJson(res);
      throw new Error(error || `HTTP ${res.status}`);
    }
  } catch (_e) {
    // best-effort metrics; ignore failures
  }
}

async function bestEffortTouchWithServiceClient(serviceClient, tokenRow, nowIso) {
  const lastSyncAt = normalizeIso(tokenRow?.last_sync_at);
  const shouldUpdateSync = !lastSyncAt || !isWithinInterval(lastSyncAt, 30);
  try {
    await serviceClient.database
      .from('vibescore_tracker_device_tokens')
      .update(shouldUpdateSync ? { last_used_at: nowIso, last_sync_at: nowIso } : { last_used_at: nowIso })
      .eq('id', tokenRow.id);
  } catch (_e) {}
  try {
    await serviceClient.database
      .from('vibescore_tracker_devices')
      .update({ last_seen_at: nowIso })
      .eq('id', tokenRow.device_id);
  } catch (_e) {}
}

async function bestEffortTouchWithAnonKey({ baseUrl, anonKey, tokenHash, fetcher }) {
  if (!anonKey) return;
  try {
    const url = new URL('/api/database/rpc/vibescore_touch_device_token_sync', baseUrl);
    await (fetcher || fetch)(url.toString(), {
      method: 'POST',
      headers: {
        ...buildAnonHeaders({ anonKey, tokenHash }),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ min_interval_minutes: 30 })
    });
  } catch (_e) {}
}

function buildAnonHeaders({ anonKey, tokenHash }) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'x-vibeusage-device-token-hash': tokenHash
  };
}

async function recordsUpsert({ url, anonKey, tokenHash, rows, onConflict, prefer, resolution, select, fetcher }) {
  const target = new URL(url.toString());
  if (onConflict) target.searchParams.set('on_conflict', onConflict);
  if (select) target.searchParams.set('select', select);
  const preferParts = [];
  if (prefer) preferParts.push(prefer);
  if (resolution) preferParts.push(`resolution=${resolution}`);
  const preferHeader = preferParts.filter(Boolean).join(',');

  const res = await (fetcher || fetch)(target.toString(), {
    method: 'POST',
    headers: {
      ...buildAnonHeaders({ anonKey, tokenHash }),
      ...(preferHeader ? { Prefer: preferHeader } : {}),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(rows)
  });

  const { data, error, code } = await readApiJson(res);
  return { ok: res.ok, status: res.status, data, error, code };
}

async function readApiJson(res) {
  const text = await res.text();
  if (!text) return { data: null, error: null, code: null };
  try {
    const parsed = JSON.parse(text);
    return { data: parsed, error: parsed?.message || parsed?.error || null, code: parsed?.code || null };
  } catch (_e) {
    return { data: null, error: text.slice(0, 300), code: null };
  }
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.data)) return data.data;
  return null;
}

function normalizeIso(value) {
  if (typeof value !== 'string') return null;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toISOString();
}

function isWithinInterval(lastSyncAt, minutes) {
  const lastMs = Date.parse(lastSyncAt);
  if (!Number.isFinite(lastMs)) return false;
  const windowMs = Math.max(0, minutes) * 60 * 1000;
  return windowMs > 0 && Date.now() - lastMs < windowMs;
}

function isUpsertUnsupported(result) {
  const status = Number(result?.status || 0);
  if (status !== 400 && status !== 404 && status !== 405 && status !== 409 && status !== 422) return false;
  const msg = String(result?.error || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('on_conflict') ||
    msg.includes('resolution') ||
    msg.includes('prefer') ||
    msg.includes('unknown') ||
    msg.includes('invalid')
  );
}

function normalizeHourly(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.hourly)) return data.hourly;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object' && Array.isArray(data.data.hourly)) {
      return data.data.hourly;
    }
  }
  return null;
}

function parseHourlyBucket(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid half-hour bucket' };

  const hourStart = parseUtcHalfHourStart(raw.hour_start);
  if (!hourStart) {
    return { ok: false, error: 'hour_start must be an ISO timestamp at UTC half-hour boundary' };
  }

  const source = normalizeSource(raw.source);
  const model = normalizeModel(raw.model) || DEFAULT_MODEL;
  const input = toNonNegativeInt(raw.input_tokens);
  const cached = toNonNegativeInt(raw.cached_input_tokens);
  const output = toNonNegativeInt(raw.output_tokens);
  const reasoning = toNonNegativeInt(raw.reasoning_output_tokens);
  const total = toNonNegativeInt(raw.total_tokens);

  if ([input, cached, output, reasoning, total].some((n) => n == null)) {
    return { ok: false, error: 'Token fields must be non-negative integers' };
  }

  return {
    ok: true,
    value: {
      source,
      model,
      hour_start: hourStart,
      input_tokens: input,
      cached_input_tokens: cached,
      output_tokens: output,
      reasoning_output_tokens: reasoning,
      total_tokens: total
    }
  };
}

function parseUtcHalfHourStart(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  const minutes = dt.getUTCMinutes();
  if ((minutes !== 0 && minutes !== 30) || dt.getUTCSeconds() !== 0 || dt.getUTCMilliseconds() !== 0) {
    return null;
  }
  const hourStart = new Date(
    Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      dt.getUTCHours(),
      minutes >= 30 ? 30 : 0,
      0,
      0
    )
  );
  return hourStart.toISOString();
}

function toNonNegativeInt(n) {
  if (typeof n !== 'number') return null;
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < 0) return null;
  return n;
}
