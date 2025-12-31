#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { getDefaultPricingProfile } = require('../../insforge-src/shared/pricing');

const ROWS = [
  {
    hour_start: '2025-12-30T00:00:00.000Z',
    source: 'codex',
    model: 'gpt-5.2-codex',
    total_tokens: '10',
    input_tokens: '6',
    cached_input_tokens: '2',
    output_tokens: '4',
    reasoning_output_tokens: '1'
  }
];

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
    if (this._table === 'vibescore_pricing_profiles') {
      const profile = getDefaultPricingProfile();
      return {
        data: [
          {
            model: profile.model,
            source: profile.source,
            effective_from: profile.effective_from,
            input_rate_micro_per_million: profile.rates_micro_per_million.input,
            cached_input_rate_micro_per_million: profile.rates_micro_per_million.cached_input,
            output_rate_micro_per_million: profile.rates_micro_per_million.output,
            reasoning_output_rate_micro_per_million: profile.rates_micro_per_million.reasoning_output
          }
        ],
        error: null
      };
    }
    return { data: [], error: null };
  }

  range(from) {
    if (this._table !== 'vibescore_tracker_hourly') {
      return { data: [], error: null };
    }
    if (from > 0) return { data: [], error: null };
    return { data: ROWS, error: null };
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

  const base = 'http://local/functions/vibescore-usage-summary?from=2025-12-30&to=2025-12-30';

  const debugRes = await usageSummary(
    new Request(`${base}&debug=1`, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );
  const debugBody = await debugRes.json();

  assert.equal(debugRes.status, 200);
  assert.ok(debugBody.debug);
  assert.ok(debugBody.debug.request_id);
  assert.equal(debugBody.debug.status, 200);
  assert.ok(Number.isFinite(debugBody.debug.query_ms));
  assert.ok(Number.isFinite(debugBody.debug.slow_threshold_ms));
  assert.equal(typeof debugBody.debug.slow_query, 'boolean');

  const noDebugRes = await usageSummary(
    new Request(base, {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );
  const noDebugBody = await noDebugRes.json();

  assert.equal(noDebugRes.status, 200);
  assert.equal(noDebugBody.debug, undefined);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        debug: {
          request_id: debugBody.debug.request_id,
          status: debugBody.debug.status
        },
        no_debug: 'absent'
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
