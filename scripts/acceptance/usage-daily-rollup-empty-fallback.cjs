#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const HOURLY_ROWS = [
  {
    hour_start: '2025-12-01T12:00:00.000Z',
    source: 'codex',
    model: 'gpt-5.2-codex',
    total_tokens: '10',
    input_tokens: '4',
    cached_input_tokens: '1',
    output_tokens: '5',
    reasoning_output_tokens: '0'
  }
];

class DatabaseStub {
  from(table) {
    this._table = table;
    return this;
  }
  select() { return this; }
  eq() { return this; }
  gte() { return this; }
  lte() { return this; }
  lt() { return this; }
  order() { return this; }
  range() {
    if (this._table === 'vibescore_tracker_hourly') {
      return { data: HOURLY_ROWS, error: null };
    }
    return { data: [], error: null };
  }
  limit() {
    if (this._table === 'vibescore_tracker_hourly') {
      return { data: HOURLY_ROWS.slice(0, 1), error: null };
    }
    return { data: [], error: null };
  }
}

function createClientStub() {
  return {
    auth: { async getCurrentUser() { return { data: { user: { id: 'user-id' } }, error: null }; } },
    database: new DatabaseStub()
  };
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';
  global.Deno = { env: { get: (k) => process.env[k] || null } };
  global.createClient = createClientStub;

  const usageDaily = require('../../insforge-src/functions/vibescore-usage-daily.js');
  const res = await usageDaily(new Request(
    'http://local/functions/vibescore-usage-daily?from=2025-12-01&to=2025-12-01&tz=UTC',
    { method: 'GET', headers: { Authorization: 'Bearer user-jwt' } }
  ));
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(body.summary, 'summary missing');
  assert.equal(body.summary.totals.total_tokens, '10');
  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
