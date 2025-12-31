#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');

const BASE_URL = 'http://insforge:7130';
const ANON_KEY = 'anon_test_123';

setDenoEnv({
  INSFORGE_INTERNAL_URL: BASE_URL,
  ANON_KEY,
  VIBESCORE_INGEST_MAX_INFLIGHT: '1',
  VIBESCORE_INGEST_RETRY_AFTER_MS: '1000'
});

const fn = require('../../insforge-functions/vibescore-ingest');

const tokenRow = {
  id: 'token-id',
  user_id: '33333333-3333-3333-3333-333333333333',
  device_id: '44444444-4444-4444-4444-444444444444',
  revoked_at: null
};

let releaseHold;
const hold = new Promise((resolve) => {
  releaseHold = resolve;
});

globalThis.fetch = async (url, init) => {
  const u = new URL(url);

  if (u.pathname.endsWith('/api/database/records/vibescore_tracker_device_tokens')) {
    await hold;
    return new Response(JSON.stringify([tokenRow]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (u.pathname.endsWith('/api/database/records/vibescore_tracker_hourly')) {
    return new Response(JSON.stringify([{ hour_start: '2025-12-31T00:00:00.000Z' }]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (u.pathname.endsWith('/api/database/records/vibescore_tracker_ingest_batches')) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (u.pathname.endsWith('/api/database/rpc/vibescore_touch_device_token_sync')) {
    return new Response(JSON.stringify({ updated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('not found', { status: 404 });
};

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

async function run() {
  const req1 = buildRequest();
  const req2 = buildRequest();

  const first = fn(req1);
  await sleep(10);
  const res2 = await fn(req2);

  assert.equal(res2.status, 429, 'expected 429 for concurrent ingest');
  assert.equal(res2.headers.get('Retry-After'), '1');

  releaseHold();
  const res1 = await first;
  assert.equal(res1.status, 200, 'expected first ingest to succeed');

  console.log('OK');
}

function buildRequest() {
  const bucket = {
    hour_start: new Date('2025-12-31T00:00:00.000Z').toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 1
  };

  return new Request('http://localhost/functions/vibescore-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer device_token_test' },
    body: JSON.stringify({ hourly: [bucket] })
  });
}

function setDenoEnv(env) {
  globalThis.Deno = {
    env: {
      get(key) {
        return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
      }
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
