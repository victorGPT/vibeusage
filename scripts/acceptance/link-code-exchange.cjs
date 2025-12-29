#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');

const SERVICE_ROLE_KEY = 'srk_test_123';
const BASE_URL = 'http://insforge:7130';

function setDenoEnv() {
  globalThis.Deno = {
    env: {
      get(key) {
        if (key === 'INSFORGE_INTERNAL_URL') return BASE_URL;
        if (key === 'INSFORGE_SERVICE_ROLE_KEY') return SERVICE_ROLE_KEY;
        return undefined;
      }
    }
  };
}

async function main() {
  setDenoEnv();

  const repoRoot = path.resolve(__dirname, '..', '..');
  const fn = require(path.join(repoRoot, 'insforge-functions', 'vibescore-link-code-exchange.js'));

  const linkCode = 'link_code_test';
  const requestId = 'req_123';
  const deviceId = 'device_abc';
  const userId = '77777777-7777-7777-7777-777777777777';

  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ device_id: deviceId, user_id: userId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const req = new Request('http://localhost/functions/vibescore-link-code-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link_code: linkCode, request_id: requestId })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  const codeHash = createHash('sha256').update(linkCode).digest('hex');
  const expectedToken = createHash('sha256')
    .update(`${SERVICE_ROLE_KEY}:${codeHash}:${requestId}`)
    .digest('hex');
  const expectedTokenHash = createHash('sha256').update(expectedToken).digest('hex');

  assert.equal(body.token, expectedToken);
  assert.equal(body.device_id, deviceId);
  assert.equal(body.user_id, userId);

  assert.equal(calls.length, 1);
  assert.ok(String(calls[0].url).includes('/rpc/vibescore_exchange_link_code'));
  const payload = JSON.parse(calls[0].init?.body || '{}');
  assert.equal(payload.p_code_hash, codeHash);
  assert.equal(payload.p_request_id, requestId);
  assert.equal(payload.p_token_hash, expectedTokenHash);

  process.stdout.write('ok: link code exchange uses /rpc and returns device token\n');
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
  process.exitCode = 1;
});
