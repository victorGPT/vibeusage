const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizeUsageModelKey,
  buildIdentityMap,
  applyModelIdentity
} = require('../insforge-src/shared/model-identity');

test('normalizeUsageModelKey lowercases and trims', () => {
  assert.equal(normalizeUsageModelKey(' GPT-4o '), 'gpt-4o');
  assert.equal(normalizeUsageModelKey(''), null);
});

test('buildIdentityMap selects latest effective mapping', () => {
  const map = buildIdentityMap({
    usageModels: ['gpt-4o-mini'],
    aliasRows: [
      {
        usage_model: 'gpt-4o-mini',
        canonical_model: 'gpt-4o',
        display_name: 'GPT-4o',
        effective_from: '2025-12-01'
      },
      {
        usage_model: 'gpt-4o-mini',
        canonical_model: 'gpt-4o',
        display_name: 'GPT-4o',
        effective_from: '2026-01-01'
      }
    ]
  });
  assert.deepEqual(map.get('gpt-4o-mini'), { model_id: 'gpt-4o', model: 'GPT-4o' });
});

test('applyModelIdentity falls back to raw model', () => {
  const identityMap = new Map();
  const res = applyModelIdentity({ rawModel: 'custom-model', identityMap });
  assert.equal(res.model_id, 'custom-model');
  assert.equal(res.model, 'custom-model');
});
