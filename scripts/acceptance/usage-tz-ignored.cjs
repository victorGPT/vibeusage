#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor({ baseUrl, anonKey, edgeFunctionToken } = {}) {
    this.baseUrl = baseUrl;
    this.anonKey = anonKey;
    this.edgeFunctionToken = edgeFunctionToken;
    this._table = null;
    this._select = null;
    this._filters = [];
    this._order = null;
  }

  from(table) {
    this._table = table;
    return this;
  }

  select(columns) {
    this._select = columns;
    return this;
  }

  eq(column, value) {
    this._filters.push({ op: 'eq', column, value });
    return this;
  }

  or() {
    return this;
  }

  gte(column, value) {
    this._filters.push({ op: 'gte', column, value });
    return this;
  }

  lte(column, value) {
    this._filters.push({ op: 'lte', column, value });
    return this;
  }

  lt(column, value) {
    this._filters.push({ op: 'lt', column, value });
    return this;
  }

  order(column, options) {
    this._order = { column, options };
    return this;
  }

  then(resolve, reject) {
    const table = this._table;
    const params = new URLSearchParams();

    if (this._select) params.set('select', this._select);
    for (const f of this._filters) {
      const key = `${f.column}`;
      params.append(key, `${f.op}.${f.value}`);
    }
    if (this._order?.column) {
      const asc = this._order.options?.ascending ? 'asc' : 'desc';
      params.set('order', `${this._order.column}.${asc}`);
    }

    const url = new URL(`/api/database/records/${table}`, 'http://local');
    for (const [k, v] of params.entries()) url.searchParams.append(k, v);

    const headers = {};
    const authToken = this.edgeFunctionToken || this.anonKey;
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    return fetch(url.toString(), { method: 'GET', headers })
      .then(async (res) => {
        const data = await res.json();
        return { data, error: null };
      })
      .then(resolve, reject);
  }
}

function createClientStub({ baseUrl, anonKey, edgeFunctionToken } = {}) {
  return {
    auth: {
      async getCurrentUser() {
        if (!edgeFunctionToken) return { data: null, error: null };
        return { data: { user: { id: 'user-id' } }, error: null };
      }
    },
    database: new DatabaseStub({ baseUrl, anonKey, edgeFunctionToken })
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

  const { handler, calls } = buildFetchStub();
  global.fetch = handler;

  const usageDaily = require('../../insforge-src/functions/vibescore-usage-daily.js');
  const usageSummary = require('../../insforge-src/functions/vibescore-usage-summary.js');

  const query = 'from=2025-12-01&to=2025-12-02&tz=America/Los_Angeles&tz_offset_minutes=-480';
  const headers = { Authorization: 'Bearer user-jwt' };

  const dailyRes = await usageDaily(
    new Request(`http://local/functions/vibescore-usage-daily?${query}`, {
      method: 'GET',
      headers
    })
  );
  const dailyBody = await dailyRes.json();

  const summaryRes = await usageSummary(
    new Request(`http://local/functions/vibescore-usage-summary?${query}`, {
      method: 'GET',
      headers
    })
  );
  const summaryBody = await summaryRes.json();

  assert.equal(dailyRes.status, 200);
  assert.equal(summaryRes.status, 200);
  assert.ok(calls.hourly >= 1, 'expected hourly table query');
  assert.equal(calls.daily, 0, 'expected no daily table query');
  assert.equal(summaryBody.totals.total_tokens, '30');
  assert.equal(summaryBody.totals.input_tokens, '12');
  assert.equal(summaryBody.totals.cached_input_tokens, '3');
  assert.equal(summaryBody.totals.output_tokens, '15');
  assert.equal(summaryBody.totals.reasoning_output_tokens, '0');
  assert.equal(Array.isArray(dailyBody.data), true);
  assert.equal(dailyBody.data.length, 2);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        daily_queries: calls.daily,
        hourly_queries: calls.hourly
      },
      null,
      2
    ) + '\n'
  );
}

function buildFetchStub() {
  const calls = { daily: 0, hourly: 0 };

  async function handler(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();

    if (url.pathname === '/api/auth/sessions/current' && method === 'GET') {
      return jsonResponse(200, { user: { id: 'user-id' } });
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_daily' && method === 'GET') {
      calls.daily += 1;
      return jsonResponse(200, []);
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_hourly') {
      calls.hourly += 1;
      return jsonResponse(200, [
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
      ]);
    }

    if (url.pathname === '/api/database/records/vibescore_pricing_profiles') {
      return jsonResponse(200, [
        {
          model: 'gpt-5.2-codex',
          source: 'openrouter',
          effective_from: '2025-12-23',
          input_rate_micro_per_million: 1750000,
          cached_input_rate_micro_per_million: 175000,
          output_rate_micro_per_million: 14000000,
          reasoning_output_rate_micro_per_million: 14000000
        }
      ]);
    }

    if (url.pathname === '/api/database/records/vibescore_pricing_model_aliases') {
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
