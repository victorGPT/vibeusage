const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { logSlowQuery } = require('../insforge-src/shared/logging');
const { getUsageMaxDays } = require('../insforge-src/shared/date');
const { normalizeUsageModel, applyUsageModelFilter } = require('../insforge-src/shared/model');
const pricing = require('../insforge-src/shared/pricing');

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

test('normalizeUsageModel canonicalizes usage model ids', () => {
  assert.equal(normalizeUsageModel(' GPT-4o '), 'gpt-4o');
  assert.equal(normalizeUsageModel('openai/GPT-4o'), 'gpt-4o');
  assert.equal(normalizeUsageModel('Anthropic/Claude-3.5'), 'claude-3.5');
  assert.equal(normalizeUsageModel('unknown'), 'unknown');
  assert.equal(normalizeUsageModel(''), null);
});

test('applyUsageModelFilter builds prefix-aware filters', () => {
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
  assert.ok(filters[0].includes('model.ilike.%/gpt-4o'));
});
