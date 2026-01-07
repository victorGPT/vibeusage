const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { logSlowQuery } = require('../insforge-src/shared/logging');
const { getUsageMaxDays } = require('../insforge-src/shared/date');
const { normalizeUsageModel, applyUsageModelFilter } = require('../insforge-src/shared/model');
const { resolveIdentityAtDate } = require('../insforge-src/shared/model-alias-timeline');
const pricing = require('../insforge-src/shared/pricing');

function createPricingEdgeClient({ aliasRows = [], profileRows = [] } = {}) {
  return {
    database: {
      from: (table) => {
        const rows = table === 'vibescore_pricing_model_aliases'
          ? aliasRows
          : table === 'vibescore_pricing_profiles'
            ? profileRows
            : [];
        const state = {
          filters: {},
          select() {
            return this;
          },
          eq(field, value) {
            this.filters[field] = value;
            return this;
          },
          lte(field, value) {
            this.filters.lte = { field, value };
            return this;
          },
          or(value) {
            this.filters.or = value;
            return this;
          },
          order() {
            return this;
          },
          limit() {
            let data = rows;
            if (this.filters.active !== undefined) {
              data = data.filter((row) => row.active === this.filters.active);
            }
            if (this.filters.source) {
              data = data.filter((row) => row.source === this.filters.source);
            }
            if (this.filters.pricing_source) {
              data = data.filter((row) => row.pricing_source === this.filters.pricing_source);
            }
            if (this.filters.usage_model) {
              data = data.filter((row) => row.usage_model === this.filters.usage_model);
            }
            if (this.filters.model) {
              data = data.filter((row) => row.model === this.filters.model);
            }
            if (this.filters.lte) {
              const { field, value } = this.filters.lte;
              data = data.filter((row) => String(row[field] || '') <= String(value));
            }
            return { data, error: null };
          }
        };
        return state;
      }
    }
  };
}

test('insforge shared logging module exists', () => {
  const loggingPath = path.join(
    __dirname,
    '..',
    'insforge-src',
    'shared',
    'logging.js'
  );
  assert.ok(fs.existsSync(loggingPath), 'expected insforge-src/shared/logging.js');
});

test('logSlowQuery emits only above threshold (VIBEUSAGE env)', { concurrency: 1 }, () => {
  const prevThreshold = process.env.VIBEUSAGE_SLOW_QUERY_MS;
  const logs = [];
  const logger = {
    log: (payload) => logs.push(payload)
  };

  try {
    process.env.VIBEUSAGE_SLOW_QUERY_MS = '50';

    logSlowQuery(logger, { query_label: 'test', duration_ms: 40, row_count: 1 });
    assert.equal(logs.length, 0);

    logSlowQuery(logger, { query_label: 'test', duration_ms: 60, row_count: 1 });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].stage, 'slow_query');
    assert.equal(logs[0].query_label, 'test');
    assert.equal(logs[0].row_count, 1);
    assert.ok(typeof logs[0].duration_ms === 'number');
  } finally {
    if (prevThreshold === undefined) delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    else process.env.VIBEUSAGE_SLOW_QUERY_MS = prevThreshold;
  }
});

test('logSlowQuery falls back to VIBESCORE env when VIBEUSAGE missing', { concurrency: 1 }, () => {
  const prevNewThreshold = process.env.VIBEUSAGE_SLOW_QUERY_MS;
  const prevLegacyThreshold = process.env.VIBESCORE_SLOW_QUERY_MS;
  const logs = [];
  const logger = {
    log: (payload) => logs.push(payload)
  };

  try {
    delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    process.env.VIBESCORE_SLOW_QUERY_MS = '40';

    logSlowQuery(logger, { query_label: 'test', duration_ms: 30, row_count: 1 });
    assert.equal(logs.length, 0);

    logSlowQuery(logger, { query_label: 'test', duration_ms: 50, row_count: 1 });
    assert.equal(logs.length, 1);
  } finally {
    if (prevNewThreshold === undefined) delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    else process.env.VIBEUSAGE_SLOW_QUERY_MS = prevNewThreshold;
    if (prevLegacyThreshold === undefined) delete process.env.VIBESCORE_SLOW_QUERY_MS;
    else process.env.VIBESCORE_SLOW_QUERY_MS = prevLegacyThreshold;
  }
});

test('getUsageMaxDays reads VIBEUSAGE env with VIBESCORE fallback', () => {
  const prevNewMax = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const prevLegacyMax = process.env.VIBESCORE_USAGE_MAX_DAYS;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = '1200';
    process.env.VIBESCORE_USAGE_MAX_DAYS = '900';
    assert.equal(getUsageMaxDays(), 1200);

    delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    assert.equal(getUsageMaxDays(), 900);
  } finally {
    if (prevNewMax === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevNewMax;
    if (prevLegacyMax === undefined) delete process.env.VIBESCORE_USAGE_MAX_DAYS;
    else process.env.VIBESCORE_USAGE_MAX_DAYS = prevLegacyMax;
  }
});

test('pricing defaults read VIBEUSAGE env with VIBESCORE fallback', () => {
  const prevNewModel = process.env.VIBEUSAGE_PRICING_MODEL;
  const prevNewSource = process.env.VIBEUSAGE_PRICING_SOURCE;
  const prevLegacyModel = process.env.VIBESCORE_PRICING_MODEL;
  const prevLegacySource = process.env.VIBESCORE_PRICING_SOURCE;

  try {
    process.env.VIBEUSAGE_PRICING_MODEL = 'gpt-5-mini';
    process.env.VIBEUSAGE_PRICING_SOURCE = 'openai';
    process.env.VIBESCORE_PRICING_MODEL = 'gpt-5.2-codex';
    process.env.VIBESCORE_PRICING_SOURCE = 'openrouter';
    assert.deepEqual(pricing._getPricingDefaults(), {
      model: 'gpt-5-mini',
      source: 'openai'
    });

    delete process.env.VIBEUSAGE_PRICING_MODEL;
    delete process.env.VIBEUSAGE_PRICING_SOURCE;
    assert.deepEqual(pricing._getPricingDefaults(), {
      model: 'gpt-5.2-codex',
      source: 'openrouter'
    });
  } finally {
    if (prevNewModel === undefined) delete process.env.VIBEUSAGE_PRICING_MODEL;
    else process.env.VIBEUSAGE_PRICING_MODEL = prevNewModel;
    if (prevNewSource === undefined) delete process.env.VIBEUSAGE_PRICING_SOURCE;
    else process.env.VIBEUSAGE_PRICING_SOURCE = prevNewSource;
    if (prevLegacyModel === undefined) delete process.env.VIBESCORE_PRICING_MODEL;
    else process.env.VIBESCORE_PRICING_MODEL = prevLegacyModel;
    if (prevLegacySource === undefined) delete process.env.VIBESCORE_PRICING_SOURCE;
    else process.env.VIBESCORE_PRICING_SOURCE = prevLegacySource;
  }
});

test('resolvePricingProfile falls back for prefixed models without aliases', async () => {
  const edgeClient = createPricingEdgeClient({
    aliasRows: [],
    profileRows: [
      {
        model: 'openai/gpt-4o',
        source: 'openai',
        effective_from: '2025-01-01',
        active: true,
        input_rate_micro_per_million: 100,
        cached_input_rate_micro_per_million: 10,
        output_rate_micro_per_million: 200,
        reasoning_output_rate_micro_per_million: 200
      }
    ]
  });

  const profile = await pricing.resolvePricingProfile({
    edgeClient,
    effectiveDate: '2025-01-02',
    model: 'aws/gpt-4o',
    source: 'openai'
  });

  assert.deepEqual(profile, pricing.getDefaultPricingProfile());
});

test('normalizeUsageModel preserves vendor prefixes', () => {
  assert.equal(normalizeUsageModel(' GPT-4o '), 'gpt-4o');
  assert.equal(normalizeUsageModel('openai/GPT-4o'), 'openai/gpt-4o');
  assert.equal(normalizeUsageModel('Anthropic/Claude-3.5'), 'anthropic/claude-3.5');
  assert.equal(normalizeUsageModel('unknown'), 'unknown');
  assert.equal(normalizeUsageModel(''), null);
});

test('applyUsageModelFilter builds strict filters', () => {
  const filters = [];
  const query = {
    or: (value) => {
      filters.push(value);
      return query;
    }
  };

  applyUsageModelFilter(query, ['gpt-4o']);

  assert.equal(filters.length, 1);
  assert.ok(filters[0].includes('model.ilike.gpt-4o'));
  assert.ok(!filters[0].includes('model.ilike.%/gpt-4o'));
});


test('resolveIdentityAtDate does not infer suffix aliases for prefixed models', () => {
  const timeline = new Map();
  timeline.set('gpt-4o', [
    { model_id: 'gpt-4o', model: 'GPT-4o', effective_from: '2026-01-01' }
  ]);

  const identity = resolveIdentityAtDate({
    rawModel: 'aws/gpt-4o',
    dateKey: '2026-01-02',
    timeline
  });

  assert.equal(identity.model_id, 'aws/gpt-4o');
  assert.equal(identity.model, 'aws/gpt-4o');
});
