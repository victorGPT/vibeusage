// Edge function: vibescore-device-token-issue
// Issues a long-lived device token for the authenticated user.
//
// Auth modes:
// - User mode (default): Authorization: Bearer <user_jwt>
// - Admin mode (bootstrap): Authorization: Bearer <service_role_key> with JSON body { user_id: "<uuid>" }

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { withRequestLogging } = require('../shared/logging');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl, getAnonKey, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');

const ISSUE_ERROR_MESSAGE = 'Failed to issue device token';

module.exports = withRequestLogging('vibescore-device-token-issue', async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  const adminMode = Boolean(serviceRoleKey && bearer === serviceRoleKey);
  let userId = null;
  let dbClient = null;

  if (adminMode) {
    userId = typeof body.data?.user_id === 'string' ? body.data.user_id : null;
    if (!userId) return json({ error: 'user_id is required (admin mode)' }, 400);
    const anonKey = getAnonKey();
    dbClient = createClient({
      baseUrl,
      anonKey: anonKey || serviceRoleKey,
      edgeFunctionToken: serviceRoleKey
    });
  } else {
    const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
    if (!auth.ok) return json({ error: 'Unauthorized' }, 401);
    userId = auth.userId;
    dbClient = auth.edgeClient;
  }

  const deviceName =
    sanitizeText(body.data?.device_name, 128) ||
    (Deno.env.get('HOSTNAME') ? `macOS (${Deno.env.get('HOSTNAME')})` : 'macOS');
  const platform = sanitizeText(body.data?.platform, 32) || 'macos';

  const deviceId = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const token = generateToken();
  const tokenHash = await sha256Hex(token);

  const { error: deviceErr } = await dbClient.database
    .from('vibescore_tracker_devices')
    .insert([
      {
        id: deviceId,
        user_id: userId,
        device_name: deviceName,
        platform
      }
    ]);
  if (deviceErr) {
    logIssueError('device insert failed', ISSUE_ERROR_MESSAGE);
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }

  const { error: tokenErr } = await dbClient.database
    .from('vibescore_tracker_device_tokens')
    .insert([
      {
        id: tokenId,
        user_id: userId,
        device_id: deviceId,
        token_hash: tokenHash
      }
    ]);
  if (tokenErr) {
    logIssueError('token insert failed', ISSUE_ERROR_MESSAGE);
    await bestEffortDeleteDevice({ dbClient, deviceId, userId });
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }

  return json(
    {
      device_id: deviceId,
      token,
      created_at: new Date().toISOString()
    },
    200
  );
});

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s.length === 0) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

async function bestEffortDeleteDevice({ dbClient, deviceId, userId }) {
  try {
    let query = dbClient.database.from('vibescore_tracker_devices').delete().eq('id', deviceId);
    if (userId) query = query.eq('user_id', userId);
    const { error } = await query;
    if (error) {
      logIssueError('compensation delete failed', ISSUE_ERROR_MESSAGE);
    }
  } catch (_err) {
    logIssueError('compensation delete threw', ISSUE_ERROR_MESSAGE);
  }
}

function logIssueError(stage, message) {
  console.error(`device token issue ${stage}: ${message}`);
}
