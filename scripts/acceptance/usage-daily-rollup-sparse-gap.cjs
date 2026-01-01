#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const ROLLUP_ROWS = [
  {
    day: '2025-12-02',
    source: 'codex',
    model: 'gpt-5.2-codex',
    total_tokens: '5',
    input_tokens: '2',
    cached_input_tokens: '0',
    output_tokens: '3',
    reasoning_output_tokens: '0'
  }
];

const HOURLY_ROWS = [
  {
    hour_start: '2025-12-02T08:00:00.000Z',
    source: 'codex',
    model: 'gpt-5.2-codex',
    total_tokens: '50',
    input_tokens: '20',
    cached_input_tokens: '0',
    output_tokens: '30',
    reasoning_output_tokens: '0'
  }
];

function filterHourlyRows(gteIso, ltIso) {
  const gte = gteIso ? new Date(gteIso).getTime() : null;
  const lt = ltIso ? new Date(ltIso).getTime() : null;
  return HOURLY_ROWS.filter((row) => {
    const t = new Date(row.hour_start).getTime();
    if (Number.isFinite(gte) && t < gte) return false;
    if (Number.isFinite(lt) && t >= lt) return false;
    return true;
  });
}

class DatabaseStub {
  from(table) {
    this._table = table;
    return this;
  }
  select() { return this; }
  eq() { return this; }
  gte(_field, value) { this._gte = value; return this; }
  lte() { return this; }
  lt(_field, value) { this._lt = value; return this; }
  order() { return this; }
  range() {
    if (this._table === 'vibescore_tracker_daily_rollup') {
      return { data: ROLLUP_ROWS, error: null };
    }
    if (this._table === 'vibescore_tracker_hourly') {
      return { data: filterHourlyRows(this._gte, this._lt), error: null };
    }
    return { data: [], error: null };
  }
  limit() {
    if (this._table === 'vibescore_tracker_hourly') {
      const rows = filterHourlyRows(this._gte, this._lt);
      return { data: rows.slice(0, 1), error: null };
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
    'http://local/functions/vibescore-usage-daily?from=2025-12-01&to=2025-12-02&tz=UTC',
    { method: 'GET', headers: { Authorization: 'Bearer user-jwt' } }
  ));
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(body.summary, 'summary missing');
  assert.equal(body.summary.totals.total_tokens, '5');
  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
