// Edge function: vibescore-ingest
// Accepts token usage events from a device token and stores them idempotently.
//
// Auth:
// - Authorization: Bearer <device_token> (opaque, stored as sha256 hash server-side)

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');

const MAX_EVENTS = 500;
const MAX_EVENT_ID_LEN = 256;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const deviceToken = getBearerToken(request.headers.get('Authorization'));
  if (!deviceToken) return json({ error: 'Missing bearer token' }, 401);

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

  const tokenHash = await sha256Hex(deviceToken);
  let tokenRow = null;
  try {
    tokenRow = serviceClient
      ? await getTokenRowWithServiceClient(serviceClient, tokenHash)
      : await getTokenRowWithAnonKey({ baseUrl, anonKey, tokenHash });
  } catch (e) {
    return json({ error: e?.message || 'Internal error' }, 500);
  }
  if (!tokenRow) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const events = normalizeEvents(body.data);
  if (!Array.isArray(events)) return json({ error: 'Invalid payload: expected {events:[...] } or [...]' }, 400);
  if (events.length > MAX_EVENTS) return json({ error: `Too many events (max ${MAX_EVENTS})` }, 413);

  const nowIso = new Date().toISOString();
  const rows = [];
  const seen = new Set();

  for (const ev of events) {
    const parsed = parseEvent(ev);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    if (seen.has(parsed.value.event_id)) continue;
    seen.add(parsed.value.event_id);

    rows.push({
      user_id: tokenRow.user_id,
      device_id: tokenRow.device_id,
      device_token_id: tokenRow.id,
      event_id: parsed.value.event_id,
      token_timestamp: parsed.value.token_timestamp,
      model: parsed.value.model,
      input_tokens: parsed.value.input_tokens,
      cached_input_tokens: parsed.value.cached_input_tokens,
      output_tokens: parsed.value.output_tokens,
      reasoning_output_tokens: parsed.value.reasoning_output_tokens,
      total_tokens: parsed.value.total_tokens,
      meta: null,
      created_at: nowIso
    });
  }

  if (rows.length === 0) {
    return json({ success: true, inserted: 0, skipped: 0 }, 200);
  }

  const ingest = serviceClient
    ? await ingestWithServiceClient({
        serviceClient,
        tokenRow,
        rows,
        nowIso,
        baseUrl,
        serviceRoleKey,
        tokenHash
      })
    : await ingestWithAnonKey({ baseUrl, anonKey, tokenHash, tokenRow, rows });
  if (!ingest.ok) return json({ error: ingest.error }, 500);

  return json(
    {
      success: true,
      inserted: ingest.inserted,
      skipped: ingest.skipped
    },
    200
  );
};

async function getTokenRowWithServiceClient(serviceClient, tokenHash) {
  const { data: tokenRow, error: tokenErr } = await serviceClient.database
    .from('vibescore_tracker_device_tokens')
    .select('id,user_id,device_id,revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (tokenErr) throw new Error(tokenErr.message);
  if (!tokenRow || tokenRow.revoked_at) return null;
  return tokenRow;
}

async function getTokenRowWithAnonKey({ baseUrl, anonKey, tokenHash }) {
  if (!anonKey) throw new Error('Anon key missing');
  const url = new URL('/api/database/records/vibescore_tracker_device_tokens', baseUrl);
  url.searchParams.set('select', 'id,user_id,device_id,revoked_at');
  url.searchParams.set('token_hash', `eq.${tokenHash}`);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
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

async function ingestWithServiceClient({
  serviceClient,
  tokenRow,
  rows,
  nowIso,
  baseUrl,
  serviceRoleKey,
  tokenHash
}) {
  if (serviceRoleKey && baseUrl) {
    const url = new URL('/api/database/records/vibescore_tracker_events', baseUrl);
    const ignore = await recordsInsert({
      url,
      anonKey: serviceRoleKey,
      tokenHash,
      rows,
      onConflict: 'user_id,event_id',
      prefer: 'return=representation',
      resolution: 'ignore-duplicates',
      select: 'event_id'
    });

    if (ignore.ok) {
      const insertedRows = normalizeRows(ignore.data);
      const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
      const skipped = Math.max(0, rows.length - inserted);
      await bestEffortTouchWithServiceClient(serviceClient, tokenRow, nowIso);
      return { ok: true, inserted, skipped };
    }

    if (!isUpsertUnsupported(ignore)) {
      if (ignore.status !== 409 || ignore.code !== '23505') {
        return { ok: false, error: ignore.error || `HTTP ${ignore.status}`, inserted: 0, skipped: 0 };
      }
    }
  }

  const eventIds = rows.map((r) => r.event_id);
  const { data: existingRows, error: existingErr } = await serviceClient.database
    .from('vibescore_tracker_events')
    .select('event_id')
    .eq('user_id', tokenRow.user_id)
    .in('event_id', eventIds);
  if (existingErr) return { ok: false, error: existingErr.message, inserted: 0, skipped: 0 };

  const existing = new Set((existingRows || []).map((r) => r.event_id).filter((v) => typeof v === 'string'));
  const toInsert = rows.filter((r) => !existing.has(r.event_id));

  if (toInsert.length > 0) {
    const { error: insertErr } = await serviceClient.database.from('vibescore_tracker_events').insert(toInsert);
    if (insertErr) return { ok: false, error: insertErr.message, inserted: 0, skipped: 0 };
  }

  await bestEffortTouchWithServiceClient(serviceClient, tokenRow, nowIso);

  return { ok: true, inserted: toInsert.length, skipped: rows.length - toInsert.length };
}

async function ingestWithAnonKey({ baseUrl, anonKey, tokenHash, rows }) {
  if (!anonKey) return { ok: false, error: 'Anon key missing', inserted: 0, skipped: 0 };

  const url = new URL('/api/database/records/vibescore_tracker_events', baseUrl);

  // Fast path: bulk insert with duplicate ignore (if supported by records API).
  const ignore = await recordsInsert({
    url,
    anonKey,
    tokenHash,
    rows,
    onConflict: 'user_id,event_id',
    prefer: 'return=representation',
    resolution: 'ignore-duplicates',
    select: 'event_id'
  });
  if (ignore.ok) {
    const insertedRows = normalizeRows(ignore.data);
    const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length;
    const skipped = Math.max(0, rows.length - inserted);
    return { ok: true, inserted, skipped };
  }

  if (!isUpsertUnsupported(ignore)) {
    if (ignore.status !== 409 || ignore.code !== '23505') {
      return { ok: false, error: ignore.error || `HTTP ${ignore.status}`, inserted: 0, skipped: 0 };
    }
  }

  // Legacy fast path: bulk insert. If any duplicates exist, Postgres will reject the whole batch with 23505.
  const bulk = await recordsInsert({ url, anonKey, tokenHash, rows, prefer: 'return=minimal' });
  if (bulk.ok) return { ok: true, inserted: rows.length, skipped: 0 };

  if (bulk.status !== 409 || bulk.code !== '23505') {
    return { ok: false, error: bulk.error || `HTTP ${bulk.status}`, inserted: 0, skipped: 0 };
  }

  // Slow path: retry row-by-row to preserve new events even if some are duplicates.
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const one = await recordsInsert({ url, anonKey, tokenHash, rows: [row], prefer: 'return=minimal' });
    if (one.ok) {
      inserted += 1;
      continue;
    }
    if (one.status === 409 && one.code === '23505') {
      skipped += 1;
      continue;
    }
    return { ok: false, error: one.error || `HTTP ${one.status}`, inserted: 0, skipped: 0 };
  }

  return { ok: true, inserted, skipped };
}

async function bestEffortTouchWithServiceClient(serviceClient, tokenRow, nowIso) {
  try {
    await serviceClient.database.from('vibescore_tracker_devices').update({ last_seen_at: nowIso }).eq('id', tokenRow.device_id);
  } catch (_e) {}
  try {
    await serviceClient.database
      .from('vibescore_tracker_device_tokens')
      .update({ last_used_at: nowIso })
      .eq('id', tokenRow.id);
  } catch (_e) {}
}

function buildAnonHeaders({ anonKey, tokenHash }) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'x-vibescore-device-token-hash': tokenHash
  };
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

async function recordsInsert({ url, anonKey, tokenHash, rows, prefer, onConflict, resolution, select }) {
  const target = new URL(url.toString());
  if (onConflict) target.searchParams.set('on_conflict', onConflict);
  if (select) target.searchParams.set('select', select);
  const preferParts = [];
  if (prefer) preferParts.push(prefer);
  if (resolution) preferParts.push(`resolution=${resolution}`);
  const preferHeader = preferParts.filter(Boolean).join(',');

  const res = await fetch(target.toString(), {
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

function normalizeEvents(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.events)) return data.events;
  return null;
}

function parseEvent(ev) {
  if (!ev || typeof ev !== 'object') return { ok: false, error: 'Invalid event' };

  const eventId = typeof ev.event_id === 'string' ? ev.event_id.trim() : '';
  if (!eventId) return { ok: false, error: 'event_id is required' };
  if (eventId.length > MAX_EVENT_ID_LEN) return { ok: false, error: `event_id too long (max ${MAX_EVENT_ID_LEN})` };

  const tsRaw = typeof ev.token_timestamp === 'string' ? ev.token_timestamp : '';
  const ts = parseIsoTimestamp(tsRaw);
  if (!ts) return { ok: false, error: 'token_timestamp must be a valid ISO timestamp' };

  const model = typeof ev.model === 'string' ? ev.model.slice(0, 128) : null;

  const input = toNonNegativeInt(ev.input_tokens);
  const cached = toNonNegativeInt(ev.cached_input_tokens);
  const output = toNonNegativeInt(ev.output_tokens);
  const reasoning = toNonNegativeInt(ev.reasoning_output_tokens);
  const total = toNonNegativeInt(ev.total_tokens);

  if ([input, cached, output, reasoning, total].some((n) => n === null)) {
    return { ok: false, error: 'Token fields must be non-negative integers' };
  }

  return {
    ok: true,
    value: {
      event_id: eventId,
      token_timestamp: ts,
      model,
      input_tokens: input,
      cached_input_tokens: cached,
      output_tokens: output,
      reasoning_output_tokens: reasoning,
      total_tokens: total
    }
  };
}

function parseIsoTimestamp(s) {
  if (typeof s !== 'string' || s.length === 0) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toNonNegativeInt(n) {
  if (typeof n !== 'number') return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  const i = Math.floor(n);
  return i === n ? i : null;
}
