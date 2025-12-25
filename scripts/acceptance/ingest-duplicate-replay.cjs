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

  const { handler, calls } = buildFetchStub();
  global.fetch = handler;

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

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.inserted, 2);
  assert.equal(data.skipped, 0);
  assert.equal(calls.insert, 1, 'expected a single bulk insert call');
  assert.ok(calls.mergeDuplicates, 'expected merge-duplicates upsert path');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        inserted: data.inserted,
        skipped: data.skipped,
        insert_calls: calls.insert,
        merge_duplicates: calls.mergeDuplicates
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
      model: 'unknown',
      hour_start: ts,
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 3
    },
    {
      model: 'unknown',
      hour_start: ts,
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
      total_tokens: 6
    },
    {
      model: 'unknown',
      hour_start: '2025-12-21T00:30:00.000Z',
      input_tokens: 3,
      cached_input_tokens: 0,
      output_tokens: 6,
      reasoning_output_tokens: 0,
      total_tokens: 9
    }
  ];
}

function buildFetchStub() {
  const calls = { insert: 0, mergeDuplicates: false };

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
      calls.insert += 1;
      const prefer = String(init.headers?.Prefer || init.headers?.prefer || '');
      if (prefer.includes('resolution=merge-duplicates')) {
        calls.mergeDuplicates = true;
      }
      if (!prefer.includes('return=representation')) {
        return jsonResponse(400, { error: 'missing return=representation' });
      }
    if (url.searchParams.get('on_conflict') !== 'user_id,device_id,source,model,hour_start') {
      return jsonResponse(400, { error: 'missing on_conflict' });
    }
      const raw = init.body ? JSON.parse(init.body) : [];
      const inserted = [];
      for (const row of Array.isArray(raw) ? raw : []) {
        const hourStart = row?.hour_start;
        if (!hourStart) continue;
        if (hourStart === '2025-12-21T00:00:00.000Z') {
          inserted.push({ hour_start: hourStart });
        } else {
          inserted.push({ hour_start: hourStart });
        }
      }
      return jsonResponse(201, inserted);
    }

    return jsonResponse(404, { error: 'not found' });
  }

  return { handler, calls };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
