#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor({ calls }) {
    this.calls = calls;
    this._table = null;
  }

  from(table) {
    this._table = table;
    return this;
  }

  select() {
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
    if (from > 0) return { data: [], error: null };
    return {
      data: [
        {
          hour_start: '2025-11-10T08:00:00.000Z',
          total_tokens: '10',
          input_tokens: '6',
          cached_input_tokens: '1',
          output_tokens: '3',
          reasoning_output_tokens: '0'
        },
        {
          hour_start: '2025-11-20T12:30:00.000Z',
          total_tokens: '5',
          input_tokens: '2',
          cached_input_tokens: '1',
          output_tokens: '2',
          reasoning_output_tokens: '0'
        },
        {
          hour_start: '2025-12-02T18:00:00.000Z',
          total_tokens: '7',
          input_tokens: '3',
          cached_input_tokens: '1',
          output_tokens: '3',
          reasoning_output_tokens: '0'
        }
      ],
      error: null
    };
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

  const usageMonthly = require('../../insforge-src/functions/vibescore-usage-monthly.js');
  const query = 'months=2&to=2025-12-15';

  const res = await usageMonthly(
    new Request(`http://local/functions/vibescore-usage-monthly?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();

  assert.equal(res.status, 200, 'status');
  assert.equal(body.months, 2, 'months');
  assert.equal(body.data.length, 2, 'data length');

  const nov = body.data.find((row) => row.month === '2025-11');
  const dec = body.data.find((row) => row.month === '2025-12');

  assert.ok(nov && dec, 'missing month rows');
  assert.equal(nov.total_tokens, '15');
  assert.equal(nov.input_tokens, '8');
  assert.equal(nov.cached_input_tokens, '2');
  assert.equal(nov.output_tokens, '5');
  assert.equal(nov.reasoning_output_tokens, '0');

  assert.equal(dec.total_tokens, '7');
  assert.equal(dec.input_tokens, '3');
  assert.equal(dec.cached_input_tokens, '1');
  assert.equal(dec.output_tokens, '3');
  assert.equal(dec.reasoning_output_tokens, '0');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        ranges: calls.ranges,
        data: body.data
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
