#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';
  process.env.INSFORGE_SERVICE_ROLE_KEY = '';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  const { handler, state } = buildFetchStub();
  global.fetch = handler;

  await runScenario({
    name: 'metrics-ok',
    state,
    failMetrics: false,
    expectMetrics: true
  });

  await runScenario({
    name: 'metrics-fail',
    state,
    failMetrics: true,
    expectMetrics: false
  });
}

async function runScenario({ name, state, failMetrics, expectMetrics }) {
  state.failMetrics = failMetrics;
  state.metricsInserts = 0;
  state.lastMetricsRow = null;

  const ingest = require('../../insforge-src/functions/vibescore-ingest.js');
  const hourly = buildBuckets();
  const req = new Request('http://local/functions/vibescore-ingest', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer device-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ hourly })
  });

  const res = await ingest(req);
  const data = await res.json();

  assert.equal(res.status, 200, `${name}: status`);
  assert.equal(data.success, true, `${name}: success`);
  assert.equal(data.inserted, 2, `${name}: inserted`);
  assert.equal(data.skipped, 0, `${name}: skipped`);

  assert.equal(state.metricsInserts, 1, `${name}: metrics insert count`);
  if (expectMetrics) {
    const row = state.lastMetricsRow;
    assert.ok(row, `${name}: metrics row`);
    assert.equal(row.bucket_count, 2, `${name}: bucket_count`);
    assert.equal(row.inserted, 2, `${name}: metrics inserted`);
    assert.equal(row.skipped, 0, `${name}: metrics skipped`);
    assert.equal(row.source, 'mixed', `${name}: metrics source`);
    assert.equal(row.user_id, 'user-id', `${name}: metrics user_id`);
    assert.equal(row.device_id, 'device-id', `${name}: metrics device_id`);
    assert.equal(row.device_token_id, 'token-id', `${name}: metrics device_token_id`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        scenario: name,
        inserted: data.inserted,
        skipped: data.skipped,
        metrics_inserted: Boolean(state.lastMetricsRow),
        metrics_source: state.lastMetricsRow?.source || null
      },
      null,
      2
    ) + '\n'
  );
}

function buildBuckets() {
  const ts = new Date('2025-12-21T00:00:00.000Z').toISOString();
  return [
    {
      hour_start: ts,
      source: 'codex',
      model: 'unknown',
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 3
    },
    {
      hour_start: ts,
      source: 'codex',
      model: 'unknown',
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
      total_tokens: 6
    },
    {
      hour_start: '2025-12-21T00:30:00.000Z',
      source: 'every-code',
      model: 'unknown',
      input_tokens: 3,
      cached_input_tokens: 0,
      output_tokens: 6,
      reasoning_output_tokens: 0,
      total_tokens: 9
    }
  ];
}

function buildFetchStub() {
  const state = {
    failMetrics: false,
    metricsInserts: 0,
    lastMetricsRow: null
  };

  async function handler(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();

    if (url.pathname === '/api/database/records/vibescore_tracker_device_tokens' && method === 'GET') {
      return jsonResponse(200, [
        {
          id: 'token-id',
          user_id: 'user-id',
          device_id: 'device-id',
          revoked_at: null
        }
      ]);
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_hourly' && method === 'POST') {
      const prefer = String(init.headers?.Prefer || init.headers?.prefer || '');
      if (!prefer.includes('return=representation')) {
        return jsonResponse(400, { error: 'missing return=representation' });
      }
      if (url.searchParams.get('on_conflict') !== 'user_id,device_id,source,model,hour_start') {
        return jsonResponse(400, { error: 'missing on_conflict' });
      }
      const raw = init.body ? JSON.parse(init.body) : [];
      const inserted = [];
      for (const row of Array.isArray(raw) ? raw : []) {
        if (row?.hour_start) inserted.push({ hour_start: row.hour_start });
      }
      return jsonResponse(201, inserted);
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_ingest_batches' && method === 'POST') {
      state.metricsInserts += 1;
      if (state.failMetrics) {
        return jsonResponse(500, { error: 'metrics insert failed' });
      }
      const row = init.body ? JSON.parse(init.body) : null;
      state.lastMetricsRow = row;
      return jsonResponse(201, row ? [row] : []);
    }

    if (url.pathname === '/api/database/rpc/vibescore_touch_device_token_sync' && method === 'POST') {
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(404, { error: 'not found' });
  }

  return { handler, state };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
