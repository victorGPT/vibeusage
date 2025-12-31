// Edge function: vibescore-sync-ping
// Records a throttled sync heartbeat for a device token.
//
// Auth:
// - Authorization: Bearer <device_token>

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { withRequestLogging } = require('../shared/logging');
const { getBearerToken } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');

const MIN_INTERVAL_MINUTES = 30;

module.exports = withRequestLogging('vibescore-sync-ping', async function(request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const deviceToken = getBearerToken(request.headers.get('Authorization'));
  if (!deviceToken) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const fetcher = logger?.fetch || fetch;

  if (!serviceRoleKey && !anonKey) {
    return json({ error: 'Missing anon key' }, 500);
  }

  const tokenHash = await sha256Hex(deviceToken);
  const nowIso = new Date().toISOString();

  if (serviceRoleKey) {
    const serviceClient = createClient({
      baseUrl,
      anonKey: anonKey || serviceRoleKey,
      edgeFunctionToken: serviceRoleKey
    });

    const { data: tokenRow, error: tokenErr } = await serviceClient.database
      .from('vibescore_tracker_device_tokens')
      .select('id,revoked_at,last_sync_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tokenErr) return json({ error: tokenErr.message }, 500);
    if (!tokenRow || tokenRow.revoked_at) return json({ error: 'Unauthorized' }, 401);

    const lastSyncAt = normalizeIso(tokenRow.last_sync_at);
    if (lastSyncAt && isWithinInterval(lastSyncAt, MIN_INTERVAL_MINUTES)) {
      return json(
        {
          success: true,
          updated: false,
          last_sync_at: lastSyncAt,
          min_interval_minutes: MIN_INTERVAL_MINUTES
        },
        200
      );
    }

    const { error: updateErr } = await serviceClient.database
      .from('vibescore_tracker_device_tokens')
      .update({ last_sync_at: nowIso, last_used_at: nowIso })
      .eq('id', tokenRow.id);

    if (updateErr) return json({ error: updateErr.message }, 500);

    return json(
      {
        success: true,
        updated: true,
        last_sync_at: nowIso,
        min_interval_minutes: MIN_INTERVAL_MINUTES
      },
      200
    );
  }

  try {
    const touch = await touchSyncWithAnonKey({ baseUrl, anonKey, tokenHash, fetcher });
    if (!touch) return json({ error: 'Unauthorized' }, 401);

    return json(
      {
        success: true,
        updated: Boolean(touch.updated),
        last_sync_at: touch.last_sync_at || nowIso,
        min_interval_minutes: MIN_INTERVAL_MINUTES
      },
      200
    );
  } catch (e) {
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});

async function touchSyncWithAnonKey({ baseUrl, anonKey, tokenHash, fetcher }) {
  const url = new URL('/api/database/rpc/vibescore_touch_device_token_sync', baseUrl);
  const res = await (fetcher || fetch)(url.toString(), {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'x-vibescore-device-token-hash': tokenHash,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ min_interval_minutes: MIN_INTERVAL_MINUTES })
  });

  const { data, error } = await readApiJson(res);
  if (!res.ok) throw new Error(error || `HTTP ${res.status}`);

  if (Array.isArray(data) && data.length > 0) return data[0];
  if (data && typeof data === 'object') return data;
  return null;
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
