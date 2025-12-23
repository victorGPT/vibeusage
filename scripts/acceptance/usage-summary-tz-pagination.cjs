#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor({ calls }) {
    this.calls = calls;
    this._table = null;
    this._select = null;
  }

  from(table) {
    this._table = table;
    this._select = null;
    return this;
  }

  select(columns) {
    this._select = columns;
    return this;
  }

  eq() {
    return this;
  }

  gte() {
    return this;
  }

  lt() {
    return this;
  }

  order() {
    return this;
  }

  range(from, to) {
    this.calls.ranges.push([from, to]);
    if (this._table !== 'vibescore_tracker_hourly') {
      return { data: [], error: null };
    }

    if (from === 0 && to === 999) {
      return { data: buildRows(1000, '2025-12-01T18:00:00.000Z', '1', '1'), error: null };
    }
    if (from === 1000 && to === 1999) {
      return { data: buildRows(1, '2025-12-02T18:00:00.000Z', '7', '1'), error: null };
    }
    return { data: [], error: null };
  }
}

function createClientStub(database) {
  return {
    auth: {
      async getCurrentUser() {
        return { data: { user: { id: 'user-id' } }, error: null };
      }
    },
    database
  };
}

function buildRows(count, tokenTimestamp, totalTokens, inputTokens) {
  return Array.from({ length: count }, () => ({
    hour_start: tokenTimestamp,
    total_tokens: totalTokens,
    input_tokens: inputTokens,
    cached_input_tokens: '0',
    output_tokens: '0',
    reasoning_output_tokens: '0'
  }));
}

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

  const calls = { ranges: [] };
  global.createClient = () => createClientStub(new DatabaseStub({ calls }));

  const usageSummary = require('../../insforge-src/functions/vibescore-usage-summary.js');
  const query = 'from=2025-12-01&to=2025-12-02&tz_offset_minutes=-480';

  const res = await usageSummary(
    new Request(`http://local/functions/vibescore-usage-summary?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(calls.ranges.length, 2, 'expected 2 pagination calls');
  assert.deepEqual(calls.ranges[0], [0, 999]);
  assert.deepEqual(calls.ranges[1], [1000, 1999]);
  assert.equal(body.days, 2);
  assert.equal(body.totals.total_tokens, '1007');
  assert.equal(body.totals.input_tokens, '1001');
  assert.equal(body.totals.cached_input_tokens, '0');
  assert.equal(body.totals.output_tokens, '0');
  assert.equal(body.totals.reasoning_output_tokens, '0');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        ranges: calls.ranges,
        totals: body.totals,
        days: body.days
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
