#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const HOURLY_ROWS = [
  {
    hour_start: '2025-12-02T08:00:00.000Z',
    source: 'codex',
    model: 'gpt-5.2-codex',
    total_tokens: '20',
    input_tokens: '7',
    cached_input_tokens: '1',
    output_tokens: '13',
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

  const usageSummary = require('../../insforge-src/functions/vibescore-usage-summary.js');
  const res = await usageSummary(new Request(
    'http://local/functions/vibescore-usage-summary?from=2025-12-01&to=2025-12-03&tz=UTC',
    { method: 'GET', headers: { Authorization: 'Bearer user-jwt' } }
  ));
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.totals.total_tokens, '20');
  assert.equal(body.totals.input_tokens, '7');
  assert.equal(body.totals.cached_input_tokens, '1');
  assert.equal(body.totals.output_tokens, '13');
  assert.equal(body.totals.reasoning_output_tokens, '0');
  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
