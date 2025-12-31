// Edge function: vibescore-entitlements
// Admin-only endpoint to grant entitlements.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken, isProjectAdminBearer } = require('../shared/auth');
const { getBaseUrl, getAnonKey, getServiceRoleKey } = require('../shared/env');
const { withRequestLogging } = require('../shared/logging');
const { sha256Hex } = require('../shared/crypto');

const ALLOWED_SOURCES = new Set(['paid', 'override', 'manual']);

module.exports = withRequestLogging('vibescore-entitlements', async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const serviceRoleKey = getServiceRoleKey();
  const isServiceRole = Boolean(serviceRoleKey && bearer === serviceRoleKey);
  const isProjectAdmin = isProjectAdminBearer(bearer);
  if (!isServiceRole && !isProjectAdmin) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const data = body.data || {};
  const userId = typeof data.user_id === 'string' ? data.user_id : null;
  const source = typeof data.source === 'string' ? data.source.trim().toLowerCase() : null;
  const effectiveFrom = typeof data.effective_from === 'string' ? data.effective_from : null;
  const effectiveTo = typeof data.effective_to === 'string' ? data.effective_to : null;
  const note = typeof data.note === 'string' ? data.note.trim() : null;
  const providedId = normalizeUuid(data.id);
  const idempotencyKey = normalizeIdempotencyKey(data.idempotency_key);

  if (!userId) return json({ error: 'user_id is required' }, 400);
  if (!source || !ALLOWED_SOURCES.has(source)) return json({ error: 'invalid source' }, 400);
  if (data.id != null && !providedId) return json({ error: 'id must be a UUID' }, 400);
  if (data.idempotency_key != null && !idempotencyKey) {
    return json({ error: 'idempotency_key must be a non-empty string' }, 400);
  }
  if (!isValidIso(effectiveFrom) || !isValidIso(effectiveTo)) {
    return json({ error: 'effective_from/effective_to must be ISO timestamps' }, 400);
  }
  if (Date.parse(effectiveFrom) >= Date.parse(effectiveTo)) {
    return json({ error: 'effective_to must be after effective_from' }, 400);
  }

  const anonKey = getAnonKey();
  if (!anonKey && !serviceRoleKey) return json({ error: 'Admin key missing' }, 500);

  const baseUrl = getBaseUrl();
  const dbClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: isServiceRole ? serviceRoleKey : bearer
  });

  const nowIso = new Date().toISOString();
  const entitlementId = await resolveEntitlementId({
    userId,
    providedId,
    idempotencyKey
  });
  const row = {
    id: entitlementId || crypto.randomUUID(),
    user_id: userId,
    source,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    revoked_at: null,
    note: note && note.length > 0 ? note : null,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: null
  };

  const { error: insertError } = await dbClient.database.from('vibescore_user_entitlements').insert([row]);
  if (!insertError) return json(row, 200);

  if (entitlementId && isConflictError(insertError)) {
    const existing = await loadEntitlementById({ dbClient, id: entitlementId });
    if (existing.error) return json({ error: existing.error }, 500);
    if (existing.row) {
      if (existing.row.user_id !== userId) {
        return json({ error: 'entitlement id already exists for a different user' }, 409);
      }
      return json(existing.row, 200);
    }
  }

  return json({ error: insertError.message || 'Insert failed' }, 500);
});

function isValidIso(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function normalizeUuid(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return re.test(trimmed) ? trimmed : null;
}

function normalizeIdempotencyKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 128 ? trimmed.slice(0, 128) : trimmed;
}

async function resolveEntitlementId({ userId, providedId, idempotencyKey }) {
  if (providedId) return providedId;
  if (!idempotencyKey) return null;
  const hash = await sha256Hex(`${userId}:${idempotencyKey}`);
  return formatUuidFromHash(hash);
}

function formatUuidFromHash(hex) {
  if (typeof hex !== 'string' || hex.length < 32) return null;
  const s = hex.slice(0, 32).toLowerCase();
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function isConflictError(error) {
  if (!error) return false;
  if (error.code === '23505') return true;
  if (error.status === 409) return true;
  const message = String(error.message || error).toLowerCase();
  return message.includes('duplicate') || message.includes('unique') || message.includes('conflict');
}

async function loadEntitlementById({ dbClient, id }) {
  const { data, error } = await dbClient.database
    .from('vibescore_user_entitlements')
    .select(
      'id,user_id,source,effective_from,effective_to,revoked_at,note,created_at,updated_at,created_by'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  return { row: data || null, error: null };
}
