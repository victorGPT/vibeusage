// Edge function: vibescore-entitlements-revoke
// Admin-only endpoint to revoke an entitlement.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken, isProjectAdminBearer } = require('../shared/auth');
const { getBaseUrl, getAnonKey, getServiceRoleKey } = require('../shared/env');
const { withRequestLogging } = require('../shared/logging');

module.exports = withRequestLogging('vibescore-entitlements-revoke', async function(request) {
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
  const id = typeof data.id === 'string' ? data.id : null;
  const revokedAt = typeof data.revoked_at === 'string' ? data.revoked_at : null;

  if (!id) return json({ error: 'id is required' }, 400);
  if (revokedAt && !isValidIso(revokedAt)) {
    return json({ error: 'revoked_at must be ISO timestamp' }, 400);
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
  const update = {
    revoked_at: revokedAt || nowIso,
    updated_at: nowIso
  };

  const { error } = await dbClient.database.from('vibescore_user_entitlements').update(update).eq('id', id);
  if (error) return json({ error: error.message }, 500);

  return json({ id, revoked_at: update.revoked_at }, 200);
});

function isValidIso(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}
