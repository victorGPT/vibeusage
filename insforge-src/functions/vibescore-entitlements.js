// Edge function: vibescore-entitlements
// Admin-only endpoint to grant entitlements.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken, isProjectAdminBearer } = require('../shared/auth');
const { getBaseUrl, getAnonKey, getServiceRoleKey } = require('../shared/env');
const { withRequestLogging } = require('../shared/logging');

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

  if (!userId) return json({ error: 'user_id is required' }, 400);
  if (!source || !ALLOWED_SOURCES.has(source)) return json({ error: 'invalid source' }, 400);
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
  const row = {
    id: crypto.randomUUID(),
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

  const { error } = await dbClient.database.from('vibescore_user_entitlements').insert([row]);
  if (error) return json({ error: error.message }, 500);

  return json(row, 200);
});

function isValidIso(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}
