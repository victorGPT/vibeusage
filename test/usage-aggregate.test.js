const assert = require('node:assert/strict');
const { test } = require('node:test');

test('sumDailyRowsToTotals aggregates with BigInt', async () => {
  const mod = await import('../dashboard/src/lib/usage-aggregate.js');
  const sumDailyRowsToTotals = mod.sumDailyRowsToTotals;

  const rows = [
    {
      total_tokens: '9007199254740993',
      input_tokens: '1',
      cached_input_tokens: '0',
      output_tokens: 2,
      reasoning_output_tokens: '0'
    },
    {
      total_tokens: 7,
      input_tokens: '3',
      cached_input_tokens: '1',
      output_tokens: '4',
      reasoning_output_tokens: '2'
    },
    {
      total_tokens: null,
      input_tokens: null,
      cached_input_tokens: null,
      output_tokens: null,
      reasoning_output_tokens: null,
      missing: true
    }
  ];

  const totals = sumDailyRowsToTotals(rows);

  assert.equal(totals.total_tokens, '9007199254741000');
  assert.equal(totals.input_tokens, '4');
  assert.equal(totals.cached_input_tokens, '1');
  assert.equal(totals.output_tokens, '6');
  assert.equal(totals.reasoning_output_tokens, '2');
});
