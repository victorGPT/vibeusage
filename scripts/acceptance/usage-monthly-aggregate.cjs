#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor({ aggregateError = false, aggregateRows = [], dailyRows = [] } = {}) {
    this.aggregateError = aggregateError;
    this.aggregateRows = aggregateRows;
    this.dailyRows = dailyRows;
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

  lte() {
    return this;
  }

  order() {
    if (this._table !== 'vibescore_tracker_daily') {
      return { data: [], error: null };
    }

    const select = String(this._select || '');
    const isAggregate = select.includes('date_trunc') || select.includes('sum_total_tokens');

    if (isAggregate) {
      if (this.aggregateError) {
        return { data: null, error: new Error('aggregate not supported') };
      }
      return { data: this.aggregateRows, error: null };
    }

    return { data: this.dailyRows, error: null };
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

function expectMonthlyTotals(body, expectedTotals) {
  const lookup = new Map(body.data.map((row) => [row.month, row]));

  for (const [month, expected] of Object.entries(expectedTotals)) {
    const row = lookup.get(month);
    assert.ok(row, `missing month ${month}`);
    assert.equal(row.total_tokens, expected.total_tokens);
    assert.equal(row.input_tokens, expected.input_tokens);
    assert.equal(row.cached_input_tokens, expected.cached_input_tokens);
    assert.equal(row.output_tokens, expected.output_tokens);
    assert.equal(row.reasoning_output_tokens, expected.reasoning_output_tokens);
  }
}

async function runScenario({
  name,
  aggregateError,
  aggregateRows,
  dailyRows,
  expectedTotals
}) {
  global.createClient = () =>
    createClientStub(new DatabaseStub({ aggregateError, aggregateRows, dailyRows }));

  const usageMonthly = require('../../insforge-src/functions/vibescore-usage-monthly.js');
  const query = 'months=2&to=2025-12-15';

  const res = await usageMonthly(
    new Request(`http://local/functions/vibescore-usage-monthly?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();

  assert.equal(res.status, 200, `${name}: status`);
  assert.equal(body.months, 2, `${name}: months`);
  assert.equal(body.data.length, 2, `${name}: data length`);
  expectMonthlyTotals(body, expectedTotals);

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
      month: '2025-11-01T00:00:00',
      sum_total_tokens: '120',
      sum_input_tokens: '70',
      sum_cached_input_tokens: '10',
      sum_output_tokens: '40',
      sum_reasoning_output_tokens: '0'
    }
  ];

  const aggregateExpected = {
    '2025-11': {
      total_tokens: '120',
      input_tokens: '70',
      cached_input_tokens: '10',
      output_tokens: '40',
      reasoning_output_tokens: '0'
    },
    '2025-12': {
      total_tokens: '0',
      input_tokens: '0',
      cached_input_tokens: '0',
      output_tokens: '0',
      reasoning_output_tokens: '0'
    }
  };

  const aggregateBody = await runScenario({
    name: 'aggregate',
    aggregateError: false,
    aggregateRows,
    dailyRows: [],
    expectedTotals: aggregateExpected
  });

  const dailyRows = [
    {
      day: '2025-11-02',
      total_tokens: '10',
      input_tokens: '6',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '0'
    },
    {
      day: '2025-11-10',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '2',
      reasoning_output_tokens: '0'
    },
    {
      day: '2025-12-01',
      total_tokens: '7',
      input_tokens: '3',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '0'
    }
  ];

  const fallbackExpected = {
    '2025-11': {
      total_tokens: '15',
      input_tokens: '8',
      cached_input_tokens: '2',
      output_tokens: '5',
      reasoning_output_tokens: '0'
    },
    '2025-12': {
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
    dailyRows,
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
