// Edge function: vibescore-link-code-init
// Issues a short-lived, single-use link code bound to the current session.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl, getAnonKey, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');
const { withRequestLogging } = require('../shared/logging');

const LINK_CODE_TTL_MS = 10 * 60_000;

module.exports = withRequestLogging('vibescore-link-code-init', async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const dbClient = serviceRoleKey
    ? createClient({ baseUrl, anonKey: anonKey || serviceRoleKey, edgeFunctionToken: serviceRoleKey })
    : auth.edgeClient;

  const linkCode = generateLinkCode();
  const codeHash = await sha256Hex(linkCode);
  const sessionId = await sha256Hex(bearer);
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();

  const { error: insertErr } = await dbClient.database.from('vibescore_link_codes').insert([
    {
      user_id: auth.userId,
      code_hash: codeHash,
      session_id: sessionId,
      expires_at: expiresAt,
      used_at: null,
      request_id: null
    }
  ]);

  if (insertErr) {
    return json({ error: 'Failed to issue link code' }, 500);
  }

  return json({ link_code: linkCode, expires_at: expiresAt }, 200);
});

function generateLinkCode() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
