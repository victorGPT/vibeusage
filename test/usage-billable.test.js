const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeBillableTotalTokens } = require('../insforge-src/shared/usage-billable');

test('computeBillableTotalTokens applies source rules', () => {
  const totals = {
    input_tokens: 10,
    cached_input_tokens: 4,
    output_tokens: 3,
    reasoning_output_tokens: 2,
    total_tokens: 25
  };

  assert.equal(computeBillableTotalTokens({ source: 'codex', totals }), 15n);
  assert.equal(computeBillableTotalTokens({ source: 'every-code', totals }), 15n);
  assert.equal(computeBillableTotalTokens({ source: 'claude', totals }), 19n);
  assert.equal(computeBillableTotalTokens({ source: 'opencode', totals }), 19n);
  assert.equal(computeBillableTotalTokens({ source: 'gemini', totals }), 25n);
});

test('computeBillableTotalTokens uses total for unknown source', () => {
  const totals = {
    input_tokens: 1,
    cached_input_tokens: 1,
    output_tokens: 1,
    reasoning_output_tokens: 1,
    total_tokens: 9
  };

  assert.equal(computeBillableTotalTokens({ source: 'unknown', totals }), 9n);
});

test('computeBillableTotalTokens falls back when total missing', () => {
  const totals = {
    input_tokens: 5,
    cached_input_tokens: 2,
    output_tokens: 4,
    reasoning_output_tokens: 3
  };

  assert.equal(computeBillableTotalTokens({ source: 'mystery', totals }), 12n);
});
