#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const {
  computeUsageCost,
  formatUsdFromMicros,
  getDefaultPricingProfile
} = require('../../insforge-src/shared/pricing');

class DatabaseStub {
  constructor(rows) {
    this._rows = rows;
    this._source = null;
  }

  from(table) {
    this._table = table;
    return this;
  }

  select() {
    return this;
  }

  eq(column, value) {
    if (column === 'source') this._source = value;
    return this;
  }

  or() {
    return this;
  }

  lte() {
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

  limit() {
    if (this._table === 'vibescore_pricing_model_aliases') {
      return { data: [], error: null };
    }
    if (this._rows && this._table === 'vibescore_pricing_profiles') {
      return { data: [buildPricingRow()], error: null };
    }
    return { data: [], error: null };
  }

  range(from) {
    if (from > 0) return { data: [], error: null };
    const filtered = this._source
      ? this._rows.filter((row) => String(row.source || '').toLowerCase() === this._source)
      : this._rows;
    return { data: filtered, error: null };
  }
}

function buildPricingRow() {
  return {
    model: 'gpt-5.2-codex',
    source: 'openrouter',
    effective_from: '2025-12-23',
    input_rate_micro_per_million: 1750000,
    cached_input_rate_micro_per_million: 175000,
    output_rate_micro_per_million: 14000000,
    reasoning_output_rate_micro_per_million: 14000000
  };
}

function createClientStub(rows) {
  return {
    auth: {
      async getCurrentUser() {
        return { data: { user: { id: 'user-id' } }, error: null };
      }
    },
    database: new DatabaseStub(rows)
  };
}

function buildExpectedCost(totals) {
  const profile = getDefaultPricingProfile();
  const cost = computeUsageCost(totals, profile);
  return formatUsdFromMicros(cost.cost_micros);
}

async function callEndpoint({ rows, query }) {
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

  global.createClient = () => createClientStub(rows);

  const breakdown = require('../../insforge-src/functions/vibescore-usage-model-breakdown.js');

  const res = await breakdown(
    new Request(`http://local/functions/vibescore-usage-model-breakdown?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  return { res, body: await res.json() };
}

async function main() {
  const rows = [
    {
      hour_start: '2025-12-01T18:00:00.000Z',
      source: 'codex',
      model: 'gpt-5.2-codex',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '5',
      reasoning_output_tokens: '0'
    },
    {
      hour_start: '2025-12-01T18:30:00.000Z',
      source: 'codex',
      model: 'claude-3.5',
      total_tokens: '20',
      input_tokens: '8',
      cached_input_tokens: '2',
      output_tokens: '10',
      reasoning_output_tokens: '0'
    },
    {
      hour_start: '2025-12-01T19:00:00.000Z',
      source: 'every-code',
      model: null,
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '0',
      output_tokens: '3',
      reasoning_output_tokens: '0'
    }
  ];

  const query = 'from=2025-12-01&to=2025-12-01';
  const { res, body } = await callEndpoint({ rows, query });

  assert.equal(res.status, 200);
  assert.equal(body.days, 1);
  assert.equal(body.sources.length, 2);

  const codex = body.sources.find((entry) => entry.source === 'codex');
  const every = body.sources.find((entry) => entry.source === 'every-code');

  assert.ok(codex);
  assert.ok(every);

  assert.equal(codex.totals.total_tokens, '30');
  assert.equal(codex.totals.input_tokens, '12');
  assert.equal(codex.totals.cached_input_tokens, '3');
  assert.equal(codex.totals.output_tokens, '15');

  const unknownModel = every.models.find((entry) => entry.model === 'unknown');
  assert.ok(unknownModel);
  assert.equal(unknownModel.totals.total_tokens, '5');

  const expectedCost = buildExpectedCost({
    total_tokens: '30',
    input_tokens: '12',
    cached_input_tokens: '3',
    output_tokens: '15',
    reasoning_output_tokens: '0'
  });
  assert.equal(codex.totals.total_cost_usd, expectedCost);

  const filtered = await callEndpoint({ rows, query: `${query}&source=codex` });
  assert.equal(filtered.res.status, 200);
  assert.equal(filtered.body.sources.length, 1);
  assert.equal(filtered.body.sources[0].source, 'codex');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        sources: body.sources.map((entry) => entry.source),
        codex_total: codex.totals.total_tokens
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
