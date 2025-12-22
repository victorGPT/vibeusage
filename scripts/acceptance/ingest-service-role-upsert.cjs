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
  const events = buildEvents();
  const req = new Request('http://local/functions/vibescore-ingest', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer device-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ events })
  });

  const res = await ingest(req);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.inserted, 2);
  assert.equal(data.skipped, 1);
  assert.equal(calls.eventInsert, 1, 'expected a single records insert');
  assert.equal(calls.eventSelect, 0, 'expected no pre-read select');
  assert.ok(calls.preferIgnore, 'expected ignore-duplicates prefer');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        inserted: data.inserted,
        skipped: data.skipped,
        event_insert_calls: calls.eventInsert,
        event_select_calls: calls.eventSelect
      },
      null,
      2
    ) + '\n'
  );
}

function buildEvents() {
  const ts = new Date('2025-12-21T00:00:00.000Z').toISOString();
  return [
    {
      event_id: 'dup_event_1',
      token_timestamp: ts,
      model: 'dup-test',
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 3
    },
    {
      event_id: 'dup_event_2',
      token_timestamp: ts,
      model: 'dup-test',
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
      total_tokens: 6
    },
    {
      event_id: 'dup_event_3',
      token_timestamp: ts,
      model: 'dup-test',
      input_tokens: 3,
      cached_input_tokens: 0,
      output_tokens: 6,
      reasoning_output_tokens: 0,
      total_tokens: 9
    }
  ];
}

function buildFetchStub() {
  const calls = { eventInsert: 0, eventSelect: 0, preferIgnore: false };

  async function handler(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();

    if (url.pathname === '/api/database/records/vibescore_tracker_events' && method === 'POST') {
      calls.eventInsert += 1;
      const prefer = String(init.headers?.Prefer || init.headers?.prefer || '');
      if (prefer.includes('resolution=ignore-duplicates')) {
        calls.preferIgnore = true;
      }
      if (url.searchParams.get('on_conflict') !== 'user_id,event_id') {
        return jsonResponse(400, { error: 'missing on_conflict' });
      }
      if (!url.searchParams.get('select')) {
        return jsonResponse(400, { error: 'missing select' });
      }
      const raw = init.body ? JSON.parse(init.body) : [];
      const inserted = [];
      for (const row of Array.isArray(raw) ? raw : []) {
        const id = row?.event_id;
        if (!id) continue;
        if (id === 'dup_event_2') continue;
        inserted.push({ event_id: id });
      }
      return jsonResponse(201, inserted);
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_events' && method === 'GET') {
      calls.eventSelect += 1;
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
