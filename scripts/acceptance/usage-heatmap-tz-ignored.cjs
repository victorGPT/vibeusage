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

  const usageHeatmap = require('../../insforge-src/functions/vibescore-usage-heatmap.js');

  const query = [
    'weeks=2',
    'to=2025-12-07',
    'week_starts_on=sun',
    'tz=America/Los_Angeles',
    'tz_offset_minutes=-480'
  ].join('&');

  const res = await usageHeatmap(
    new Request(`http://local/functions/vibescore-usage-heatmap?${query}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(calls.events, 0, 'expected no events table query');
  assert.ok(calls.daily >= 1, 'expected daily table query');
  assert.equal(body.from, '2025-11-30');
  assert.equal(body.to, '2025-12-07');
  assert.equal(body.week_starts_on, 'sun');
  assert.equal(Array.isArray(body.weeks), true);
  assert.equal(body.weeks.length, 2);
  assert.equal(body.active_days, 2);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        daily_queries: calls.daily,
        events_queries: calls.events
      },
      null,
      2
    ) + '\n'
  );
}

function buildFetchStub() {
  const rows = [
    { day: '2025-12-01', total_tokens: '10' },
    { day: '2025-12-05', total_tokens: '20' }
  ];

  const calls = { daily: 0, events: 0 };

  async function handler(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();

    if (url.pathname === '/api/auth/sessions/current' && method === 'GET') {
      return jsonResponse(200, { user: { id: 'user-id' } });
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_daily' && method === 'GET') {
      calls.daily += 1;
      return jsonResponse(200, rows);
    }

    if (url.pathname === '/api/database/records/vibescore_tracker_events') {
      calls.events += 1;
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
