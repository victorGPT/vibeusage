#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor() {
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

  lte() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    if (this._table === 'vibescore_pricing_model_aliases') {
      return {
        data: [
          {
            usage_model: 'claude-opus-4-5-20251101',
            pricing_model: 'anthropic/claude-opus-4.5',
            pricing_source: 'openrouter',
            effective_from: '2025-12-20'
          }
        ],
        error: null
      };
    }
    if (this._table === 'vibescore_pricing_profiles') {
      return {
        data: [
          {
            model: 'anthropic/claude-opus-4.5',
            source: 'openrouter',
            effective_from: '2025-12-20',
            input_rate_micro_per_million: 1000000,
            cached_input_rate_micro_per_million: 100000,
            output_rate_micro_per_million: 2000000,
            reasoning_output_rate_micro_per_million: 2000000
          }
        ],
        error: null
      };
    }
    return { data: [], error: null };
  }
}

function createClientStub() {
  return {
    database: new DatabaseStub()
  };
}

async function main() {
  process.env.VIBESCORE_PRICING_SOURCE = 'openrouter';
  process.env.VIBESCORE_PRICING_MODEL = 'gpt-5.2-codex';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  const { resolvePricingProfile } = require('../../insforge-src/shared/pricing');

  const profile = await resolvePricingProfile({
    edgeClient: createClientStub(),
    model: 'claude-opus-4-5-20251101',
    effectiveDate: '2025-12-25'
  });

  assert.equal(profile.model, 'anthropic/claude-opus-4.5');
  assert.equal(profile.source, 'openrouter');
  assert.equal(profile.effective_from, '2025-12-20');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        model: profile.model,
        source: profile.source
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
