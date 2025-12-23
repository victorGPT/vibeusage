#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor() {
    this._table = null;
    this._select = null;
  }

  from(table) {
    this._table = table;
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
    if (this._table !== 'vibescore_tracker_hourly') {
      return { data: [], error: null };
    }
    if (from > 0) return { data: [], error: null };
    return {
      data: [
        {
          hour_start: '2025-12-01T18:00:00.000Z',
          total_tokens: '10',
          input_tokens: '4',
          cached_input_tokens: '1',
          output_tokens: '5',
          reasoning_output_tokens: '0'
        },
        {
          hour_start: '2025-12-02T18:00:00.000Z',
          total_tokens: '20',
          input_tokens: '8',
          cached_input_tokens: '2',
          output_tokens: '10',
          reasoning_output_tokens: '0'
        }
      ],
      error: null
    };
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
  process.env.INSFORGE_SERVICE_ROLE_KEY = '';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  global.createClient = createClientStub;

  const usageSummary = require('../../insforge-src/functions/vibescore-usage-summary.js');

  const query = 'from=2025-12-01&to=2025-12-02';
  const res = await usageSummary(
    new Request(`http://local/functions/vibescore-usage-summary?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.days, 2);
  assert.equal(body.totals.total_tokens, '30');
  assert.equal(body.totals.input_tokens, '12');
  assert.equal(body.totals.cached_input_tokens, '3');
  assert.equal(body.totals.output_tokens, '15');
  assert.equal(body.totals.reasoning_output_tokens, '0');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
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
