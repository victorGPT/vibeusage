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

  const usageHourly = require('../../insforge-src/functions/vibescore-usage-hourly.js');

  const query = [
    'day=2025-12-02',
    'tz=America/Los_Angeles',
    'tz_offset_minutes=-480'
  ].join('&');

  const res = await usageHourly(
    new Request(`http://local/functions/vibescore-usage-hourly?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(calls.hourly, 1, 'expected hourly table query');
  assert.equal(calls.daily, 0, 'expected no daily table query');
  assert.equal(calls.rangeStart, '2025-12-02T08:00:00.000Z');
  assert.equal(calls.rangeEnd, '2025-12-03T08:00:00.000Z');
  assert.equal(body.day, '2025-12-02');
  assert.equal(Array.isArray(body.data), true);
  assert.equal(body.data.length, 48);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        hourly_queries: calls.hourly,
        range_start: calls.rangeStart,
        range_end: calls.rangeEnd
      },
      null,
      2
    ) + '\n'
  );
}

function buildFetchStub() {
  const calls = { daily: 0, hourly: 0, rangeStart: null, rangeEnd: null };

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

    if (url.pathname === '/api/database/records/vibescore_tracker_hourly' && method === 'GET') {
      calls.hourly += 1;
      const filters = url.searchParams.getAll('hour_start');
      const startFilter = filters.find((f) => f.startsWith('gte.')) || '';
      const endFilter = filters.find((f) => f.startsWith('lt.')) || '';
      calls.rangeStart = startFilter.slice(4) || null;
      calls.rangeEnd = endFilter.slice(3) || null;
      return jsonResponse(200, [
        {
          hour_start: '2025-12-02T18:00:00.000Z',
          total_tokens: '3',
          input_tokens: '1',
          cached_input_tokens: '0',
          output_tokens: '2',
          reasoning_output_tokens: '0'
        },
        {
          hour_start: '2025-12-03T01:30:00.000Z',
          total_tokens: '6',
          input_tokens: '2',
          cached_input_tokens: '1',
          output_tokens: '3',
          reasoning_output_tokens: '0'
        }
      ]);
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
