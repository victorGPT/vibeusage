#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor({ aggregateError = false, aggregateRows = [], bucketRows = [] } = {}) {
    this.aggregateError = aggregateError;
    this.aggregateRows = aggregateRows;
    this.bucketRows = bucketRows;
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
    if (this._table !== 'vibescore_tracker_hourly') {
      return { data: [], error: null };
    }

    const select = String(this._select || '');
    const isAggregate = select.includes('sum_total_tokens');

    if (isAggregate) {
      if (this.aggregateError) {
        return { data: null, error: new Error('aggregate not supported') };
      }
      return { data: this.aggregateRows, error: null };
    }

    return { data: this.bucketRows, error: null };
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

function expectHourlyTotals(body, expected) {
  const lookup = new Map(body.data.map((row) => [row.hour, row]));
  for (const [hour, totals] of Object.entries(expected)) {
    const row = lookup.get(hour);
    assert.ok(row, `missing hour ${hour}`);
    assert.equal(row.total_tokens, totals.total_tokens);
    assert.equal(row.input_tokens, totals.input_tokens);
    assert.equal(row.cached_input_tokens, totals.cached_input_tokens);
    assert.equal(row.output_tokens, totals.output_tokens);
    assert.equal(row.reasoning_output_tokens, totals.reasoning_output_tokens);
  }
}

async function runScenario({
  name,
  aggregateError,
  aggregateRows,
  bucketRows,
  expectedTotals
}) {
  global.createClient = () => createClientStub(new DatabaseStub({ aggregateError, aggregateRows, bucketRows }));
  delete require.cache[require.resolve('../../insforge-src/functions/vibescore-usage-hourly.js')];
  const usageHourly = require('../../insforge-src/functions/vibescore-usage-hourly.js');

  const res = await usageHourly(
    new Request('http://local/functions/vibescore-usage-hourly?day=2025-12-01', {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();
  assert.equal(res.status, 200, `${name}: status`);
  assert.equal(body.day, '2025-12-01', `${name}: day`);
  assert.equal(body.data.length, 48, `${name}: data length`);
  expectHourlyTotals(body, expectedTotals);

  return body;
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

  const aggregateRows = [
    {
      hour: '2025-12-01T00:30:00',
      sum_total_tokens: '12',
      sum_input_tokens: '7',
      sum_cached_input_tokens: '1',
      sum_output_tokens: '4',
      sum_reasoning_output_tokens: '0'
    },
    {
      hour: '2025-12-01T13:00:00',
      sum_total_tokens: '20',
      sum_input_tokens: '10',
      sum_cached_input_tokens: '2',
      sum_output_tokens: '8',
      sum_reasoning_output_tokens: '0'
    }
  ];

  const aggregateExpected = {
    '2025-12-01T00:30:00': {
      total_tokens: '12',
      input_tokens: '7',
      cached_input_tokens: '1',
      output_tokens: '4',
      reasoning_output_tokens: '0'
    },
    '2025-12-01T13:00:00': {
      total_tokens: '20',
      input_tokens: '10',
      cached_input_tokens: '2',
      output_tokens: '8',
      reasoning_output_tokens: '0'
    }
  };

  const aggregateBody = await runScenario({
    name: 'aggregate',
    aggregateError: false,
    aggregateRows,
    bucketRows: [],
    expectedTotals: aggregateExpected
  });

  const bucketRows = [
    {
      hour_start: '2025-12-01T00:00:00Z',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '2',
      reasoning_output_tokens: '0'
    },
    {
      hour_start: '2025-12-01T13:30:00Z',
      total_tokens: '7',
      input_tokens: '3',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '0'
    }
  ];

  const fallbackExpected = {
    '2025-12-01T00:00:00': {
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '2',
      reasoning_output_tokens: '0'
    },
    '2025-12-01T13:30:00': {
      total_tokens: '7',
      input_tokens: '3',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '0'
    }
  };

  const fallbackBody = await runScenario({
    name: 'fallback',
    aggregateError: true,
    aggregateRows: [],
    bucketRows,
    expectedTotals: fallbackExpected
  });

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        aggregate: aggregateBody.data,
        fallback: fallbackBody.data
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
