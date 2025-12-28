// Edge function: vibescore-user-status
// Returns Pro status for the authenticated user.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { computeProStatus } = require('../shared/pro-status');
const { withRequestLogging } = require('../shared/logging');

module.exports = withRequestLogging('vibescore-user-status', async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const { data: userData, error: userErr } = await auth.edgeClient.auth.getCurrentUser();
  if (userErr || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);

  let createdAt = userData.user.created_at;
  let partial = false;
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    const serviceRoleKey = getServiceRoleKey();
    if (!serviceRoleKey) {
      createdAt = null;
      partial = true;
    } else {
      const anonKey = getAnonKey();
      const serviceClient = createClient({
        baseUrl,
        anonKey: anonKey || serviceRoleKey,
        edgeFunctionToken: serviceRoleKey
      });

      const { data: userRow, error: userRowErr } = await serviceClient.database
        .from('users')
        .select('created_at')
        .eq('id', auth.userId)
        .maybeSingle();

      if (userRowErr) return json({ error: userRowErr.message }, 500);
      if (typeof userRow?.created_at !== 'string' || userRow.created_at.length === 0) {
        return json({ error: 'Missing user created_at' }, 500);
      }
      createdAt = userRow.created_at;
    }
  }

  const { data: entitlements, error: entErr } = await auth.edgeClient.database
    .from('vibescore_user_entitlements')
    .select('source,effective_from,effective_to,revoked_at')
    .eq('user_id', auth.userId)
    .order('effective_to', { ascending: false });

  if (entErr) return json({ error: entErr.message }, 500);

  const asOf = new Date().toISOString();
  const status = computeProStatus({ createdAt, entitlements, now: asOf });

  return json(
    {
      user_id: auth.userId,
      created_at: createdAt ?? null,
      pro: {
        active: status.active,
        sources: status.sources,
        expires_at: status.expires_at,
        partial,
        as_of: asOf
      }
    },
    200
  );
});
