// Edge function: vibescore-link-code-exchange
// Exchanges a link code for a device token.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { sha256Hex } = require('../shared/crypto');
const { withRequestLogging } = require('../shared/logging');

module.exports = withRequestLogging('vibescore-link-code-exchange', async function(request, ctx) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const linkCode = sanitizeText(body.data?.link_code, 256);
  const requestId = sanitizeText(body.data?.request_id, 128);
  const deviceName = sanitizeText(body.data?.device_name, 128);
  const platform = sanitizeText(body.data?.platform, 32);

  if (!linkCode) return json({ error: 'link_code is required' }, 400);
  if (!requestId) return json({ error: 'request_id is required' }, 400);

  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: 'Missing service role key' }, 500);

  const codeHash = await sha256Hex(linkCode);
  const token = await deriveToken({ secret: serviceRoleKey, codeHash, requestId });
  const tokenHash = await sha256Hex(token);

  const url = new URL('/rpc/vibescore_exchange_link_code', baseUrl);
  const res = await ctx.fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_code_hash: codeHash,
      p_request_id: requestId,
      p_device_name: deviceName,
      p_platform: platform,
      p_token_hash: tokenHash
    })
  });

  const { data, error } = await readApiJson(res);
  if (!res.ok) {
    const msg = error || 'Link code exchange failed';
    return json({ error: msg }, res.status >= 400 ? res.status : 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.device_id !== 'string' || typeof row.user_id !== 'string') {
    return json({ error: 'Link code exchange failed' }, 500);
  }

  return json({ token, device_id: row.device_id, user_id: row.user_id }, 200);
});

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s.length === 0) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function deriveToken({ secret, codeHash, requestId }) {
  const input = `${secret}:${codeHash}:${requestId}`;
  return sha256Hex(input);
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
