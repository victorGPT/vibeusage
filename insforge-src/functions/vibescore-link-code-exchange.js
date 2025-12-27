// Edge function: vibescore-link-code-exchange
// Exchanges a link code for a long-lived device token.
//
// Auth:
// - No Authorization header (link code in body). Requires service role on server.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBaseUrl, getAnonKey, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');

const EXCHANGE_ERROR_MESSAGE = 'Failed to exchange link code';

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const payload = body.data || {};
  const linkCode = sanitizeText(payload.link_code, 256);
  if (!linkCode) return json({ error: 'link_code is required' }, 400);

  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  if (!serviceRoleKey) {
    console.error('link code exchange missing service role key');
    return json({ error: EXCHANGE_ERROR_MESSAGE }, 500);
  }

  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey
  });

  const codeHash = await sha256Hex(linkCode);
  const deviceName =
    sanitizeText(payload.device_name, 128) ||
    (Deno.env.get('HOSTNAME') ? `macOS (${Deno.env.get('HOSTNAME')})` : 'macOS');
  const platform = sanitizeText(payload.platform, 32) || 'macos';

  const deviceId = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const token = generateToken();
  const tokenHash = await sha256Hex(token);

  const { data: exchangeData, error: exchangeErr } = await serviceClient.database.rpc(
    'vibescore_exchange_link_code',
    {
      p_code_hash: codeHash,
      p_device_id: deviceId,
      p_device_name: deviceName,
      p_platform: platform,
      p_token_id: tokenId,
      p_token_hash: tokenHash
    }
  );

  if (exchangeErr) {
    console.error(`link code exchange rpc failed: ${EXCHANGE_ERROR_MESSAGE}`);
    return json({ error: EXCHANGE_ERROR_MESSAGE }, 500);
  }

  const exchangeRow = Array.isArray(exchangeData) ? exchangeData[0] : exchangeData;
  if (!exchangeRow?.user_id) {
    return json({ error: 'Invalid or expired link code' }, 401);
  }

  const usedAt = exchangeRow.used_at || new Date().toISOString();
  return json(
    {
      device_id: deviceId,
      token,
      created_at: usedAt
    },
    200
  );
};

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s.length === 0) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
