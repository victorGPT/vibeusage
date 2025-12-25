#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor() {
    this._table = null;
    this._select = null;
    this._filters = [];
    this.upserts = [];
    this.aliasUpserts = [];
    this.upsertCalls = 0;
    this.aliasUpsertCalls = 0;
    this.retention = null;
    this.aliasRetention = null;
    this.usageRows = [];
  }

  from(table) {
    this._table = table;
    this._select = null;
    this._filters = [];
    return this;
  }

  select(columns) {
    this._select = columns;
    return this;
  }

  gte(column, value) {
    this._filters.push({ op: 'gte', column, value });
    return this;
  }

  upsert(rows) {
    if (this._table === 'vibescore_pricing_profiles') {
      this.upserts.push(...rows);
      this.upsertCalls += 1;
    } else if (this._table === 'vibescore_pricing_model_aliases') {
      this.aliasUpserts.push(...rows);
      this.aliasUpsertCalls += 1;
    }
    return { error: null };
  }

  update(values) {
    this._updateValues = values;
    return this;
  }

  eq(column, value) {
    this._eq = { column, value };
    return this;
  }

  lt(column, value) {
    const target = {
      update: this._updateValues,
      eq: this._eq,
      lt: { column, value }
    };
    if (this._table === 'vibescore_pricing_model_aliases') {
      this.aliasRetention = target;
    } else {
      this.retention = target;
    }
    return { error: null };
  }

  range() {
    if (this._table === 'vibescore_tracker_hourly') {
      return { data: this.usageRows, error: null };
    }
    return { data: [], error: null };
  }
}

function createClientStub(db) {
  return {
    database: db
  };
}

function buildOpenRouterPayload() {
  return {
    data: [
      {
        id: 'anthropic/claude-opus-4.5',
        created: 10,
        pricing: {
          prompt: '0.000001',
          completion: '0.000002',
          input_cache_read: '0.0000001',
          internal_reasoning: '0.000002'
        }
      },
      {
        id: 'anthropic/claude-opus-4.1',
        created: 5,
        pricing: {
          prompt: 0.0000015,
          completion: 0.000003
        }
      },
      {
        id: 'openai/gpt-4o-mini',
        created: 8,
        pricing: {
          prompt: 0.0000015,
          completion: 0.000003
        }
      },
      {
        id: 'openai/no-pricing'
      }
    ]
  };
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';
  process.env.INSFORGE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.OPENROUTER_API_KEY = 'openrouter-key';
  process.env.VIBESCORE_PRICING_SOURCE = 'openrouter';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  const db = new DatabaseStub();
  db.usageRows = [
    { model: 'claude-opus-4-5-20251101' },
    { model: 'openai/gpt-4o-mini' },
    { model: 'unknown' }
  ];
  global.createClient = () => createClientStub(db);

  const payload = buildOpenRouterPayload();
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/models');
    assert.equal(options?.headers?.Authorization, 'Bearer openrouter-key');
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const sync = require('../../insforge-src/functions/vibescore-pricing-sync.js');

  const req = new Request('http://local/functions/vibescore-pricing-sync', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer service-role-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ retention_days: 90 })
  });

  const res = await sync(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.models_total, 4);
  assert.equal(body.models_processed, 3);
  assert.equal(body.rows_upserted, 3);
  assert.equal(body.usage_models_total, 2);
  assert.equal(body.aliases_generated, 1);
  assert.equal(body.aliases_upserted, 1);
  assert.equal(db.upsertCalls, 1);
  assert.equal(db.upserts.length, 3);

  const first = db.upserts.find((row) => row.model === 'anthropic/claude-opus-4.5');
  const second = db.upserts.find((row) => row.model === 'openai/gpt-4o-mini');

  assert.equal(first.input_rate_micro_per_million, 1000000);
  assert.equal(first.cached_input_rate_micro_per_million, 100000);
  assert.equal(first.output_rate_micro_per_million, 2000000);
  assert.equal(first.reasoning_output_rate_micro_per_million, 2000000);

  assert.equal(second.input_rate_micro_per_million, 1500000);
  assert.equal(second.cached_input_rate_micro_per_million, 1500000);
  assert.equal(second.output_rate_micro_per_million, 3000000);
  assert.equal(second.reasoning_output_rate_micro_per_million, 3000000);

  assert.equal(db.retention.eq.column, 'source');
  assert.equal(db.retention.eq.value, 'openrouter');
  assert.equal(db.retention.update.active, false);
  assert.equal(db.aliasUpsertCalls, 1);
  assert.equal(db.aliasUpserts.length, 1);
  assert.equal(db.aliasUpserts[0].usage_model, 'claude-opus-4-5-20251101');
  assert.equal(db.aliasUpserts[0].pricing_model, 'anthropic/claude-opus-4.5');
  assert.equal(db.aliasUpserts[0].pricing_source, 'openrouter');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        upserts: db.upserts.length,
        alias_upserts: db.aliasUpserts.length,
        retention: db.retention
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
