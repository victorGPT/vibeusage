const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTotals } = require('../insforge-src/shared/usage-rollup');
const {
  resolveBillableTotals,
  applyTotalsAndBillable
} = require('../insforge-src/shared/usage-aggregate');

test('resolveBillableTotals uses stored billable when present', () => {
  const row = {
    total_tokens: '10',
    billable_total_tokens: '7',
    input_tokens: '1',
    cached_input_tokens: '0',
    output_tokens: '2',
    reasoning_output_tokens: '4'
  };

  const { billable, hasStoredBillable } = resolveBillableTotals({
    row,
    source: 'codex'
  });

  assert.equal(hasStoredBillable, true);
  assert.equal(billable, 7n);

  const totals = createTotals();
  applyTotalsAndBillable({ totals, row, billable, hasStoredBillable });
  assert.equal(totals.billable_total_tokens, 7n);
});

test('resolveBillableTotals computes billable when missing', () => {
  const row = {
    total_tokens: '10',
    input_tokens: '2',
    cached_input_tokens: '0',
    output_tokens: '3',
    reasoning_output_tokens: '1'
  };

  const { billable, hasStoredBillable } = resolveBillableTotals({
    row,
    source: 'codex'
  });

  assert.equal(hasStoredBillable, false);
  assert.equal(billable, 6n);

  const totals = createTotals();
  applyTotalsAndBillable({ totals, row, billable, hasStoredBillable });
  assert.equal(totals.billable_total_tokens, 6n);
});

test('resolveBillableTotals supports custom billable field and totals override', () => {
  const row = {
    sum_total_tokens: '20',
    sum_input_tokens: '5',
    sum_cached_input_tokens: '0',
    sum_output_tokens: '10',
    sum_reasoning_output_tokens: '0',
    sum_billable_total_tokens: null
  };

  const { billable, hasStoredBillable } = resolveBillableTotals({
    row,
    source: 'codex',
    billableField: 'sum_billable_total_tokens',
    totals: {
      total_tokens: row.sum_total_tokens,
      input_tokens: row.sum_input_tokens,
      cached_input_tokens: row.sum_cached_input_tokens,
      output_tokens: row.sum_output_tokens,
      reasoning_output_tokens: row.sum_reasoning_output_tokens
    }
  });

  assert.equal(hasStoredBillable, false);
  assert.equal(billable, 15n);
});
