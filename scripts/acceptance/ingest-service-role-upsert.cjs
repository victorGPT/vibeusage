#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor() {
    this._table = null;
    this._op = null;
  }

  from(table) {
    this._table = table;
    this._op = null;
    return this;
  }

  select() {
    this._op = 'select';
    return this;
  }

  eq() {
    return this;
  }

  maybeSingle() {
    if (this._table === 'vibescore_tracker_device_tokens') {
      return {
        data: {
          id: 'token-id',
          user_id: 'user-id',
          device_id: 'device-id',
          revoked_at: null
        },
        error: null
      };
    }
    return { data: null, error: null };
  }

  insert() {
    if (this._table === 'vibescore_tracker_events') {
      throw new Error('expected service-role path to avoid SDK insert');
    }
    return { error: null };
  }

  update() {
    return { error: null };
  }
}

function createClientStub() {
  return {
    auth: {
      async getCurrentUser() {
        return { data: { user: { id: 'user-id' } }, error: null };
      }
    },
    database: new DatabaseStub()
  };
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';
  process.env.INSFORGE_SERVICE_ROLE_KEY = 'service-role-key';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  global.createClient = createClientStub;

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
  assert.equal(calls.hourlyInsert, 1, 'expected a single records insert');
  assert.equal(calls.hourlySelect, 0, 'expected no pre-read select');
  assert.ok(calls.preferMerge, 'expected merge-duplicates prefer');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        inserted: data.inserted,
        skipped: data.skipped,
        hourly_insert_calls: calls.hourlyInsert,
        hourly_select_calls: calls.hourlySelect
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
  const calls = { hourlyInsert: 0, hourlySelect: 0, preferMerge: false };

  async function handler(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();

    if (url.pathname === '/api/database/records/vibescore_tracker_hourly' && method === 'POST') {
      calls.hourlyInsert += 1;
      const prefer = String(init.headers?.Prefer || init.headers?.prefer || '');
      if (prefer.includes('resolution=merge-duplicates')) {
        calls.preferMerge = true;
      }
    if (url.searchParams.get('on_conflict') !== 'user_id,device_id,source,model,hour_start') {
      return jsonResponse(400, { error: 'missing on_conflict' });
    }
      if (!url.searchParams.get('select')) {
        return jsonResponse(400, { error: 'missing select' });
      }
      const raw = init.body ? JSON.parse(init.body) : [];
      const inserted = [];
      for (const row of Array.isArray(raw) ? raw : []) {
        const hourStart = row?.hour_start;
        if (!hourStart) continue;
        inserted.push({ hour_start: hourStart });
      }
      return jsonResponse(201, inserted);
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_hourly' && method === 'GET') {
      calls.hourlySelect += 1;
      return jsonResponse(200, []);
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

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
