'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  buildUpdates,
  BILLABLE_RULE_VERSION,
  buildCursorFilter,
  runBackfill
} = require('../scripts/ops/billable-total-tokens-backfill.cjs');

const rows = [
  {
    user_id: 'u1',
    device_id: 'd1',
    source: 'codex',
    model: 'm1',
    hour_start: '2025-12-17T00:00:00.000Z',
    input_tokens: 1,
    cached_input_tokens: 2,
    output_tokens: 3,
    reasoning_output_tokens: 0,
    total_tokens: 6
  }
];

const updates = buildUpdates(rows);
assert.equal(updates.length, 1);
assert.equal(updates[0].billable_total_tokens, '4');
assert.equal(updates[0].billable_rule_version, BILLABLE_RULE_VERSION);

const skipped = buildUpdates([{ ...rows[0], billable_total_tokens: '4' }]);
assert.equal(skipped.length, 0);

test('buildCursorFilter builds composite keyset cursor', () => {
  const cursor = {
    hour_start: '2025-12-17T00:00:00.000Z',
    user_id: 'u1',
    device_id: 'd1',
    source: 'codex',
    model: 'm1'
  };
  const filter = buildCursorFilter(cursor);
  assert.ok(filter.includes('hour_start.gt.2025-12-17T00:00:00.000Z'));
  assert.ok(filter.includes('and(hour_start.eq.2025-12-17T00:00:00.000Z,user_id.gt.u1)'));
  assert.ok(filter.includes('and(hour_start.eq.2025-12-17T00:00:00.000Z,user_id.eq.u1,device_id.gt.d1)'));
  assert.ok(filter.includes('and(hour_start.eq.2025-12-17T00:00:00.000Z,user_id.eq.u1,device_id.eq.d1,source.gt.codex)'));
  assert.ok(filter.includes('and(hour_start.eq.2025-12-17T00:00:00.000Z,user_id.eq.u1,device_id.eq.d1,source.eq.codex,model.gt.m1)'));
});

test('buildCursorFilter keeps raw values for URL encoding', () => {
  const cursor = {
    hour_start: '2025-12-17T00:00:00.000Z',
    user_id: 'user,1',
    device_id: 'd1',
    source: 'co)dex',
    model: 'm1'
  };
  const filter = buildCursorFilter(cursor);
  assert.ok(filter.includes('user_id.eq.user,1'));
  assert.ok(filter.includes('source.eq.co)dex'));
  assert.ok(filter.includes('source.gt.co)dex'));
});

test('URLSearchParams encodes cursor filter safely', () => {
  const cursor = {
    hour_start: '2025-12-17T00:00:00.000Z',
    user_id: 'user,1',
    device_id: 'd1',
    source: 'co)dex',
    model: 'm1'
  };
  const filter = buildCursorFilter(cursor);
  const url = new URL('http://localhost');
  url.searchParams.set('or', filter);
  const query = url.toString();
  assert.ok(query.includes('user_id.eq.user%2C1'));
  assert.ok(query.includes('source.eq.co%29dex'));
  assert.ok(query.includes('source.gt.co%29dex'));
});

test('runBackfill paginates with cursor without skipping rows', async () => {
  const orderedRows = [
    {
      hour_start: '2025-12-17T00:00:00.000Z',
      user_id: 'u1',
      device_id: 'd1',
      source: 'codex',
      model: 'm1',
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2
    },
    {
      hour_start: '2025-12-17T00:00:00.000Z',
      user_id: 'u2',
      device_id: 'd1',
      source: 'codex',
      model: 'm1',
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 3
    },
    {
      hour_start: '2025-12-17T01:00:00.000Z',
      user_id: 'u1',
      device_id: 'd2',
      source: 'codex',
      model: 'm2',
      input_tokens: 1,
      cached_input_tokens: 1,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 3
    }
  ];

  const compareRows = (left, right) => {
    const fields = ['hour_start', 'user_id', 'device_id', 'source', 'model'];
    for (const field of fields) {
      if (left[field] === right[field]) continue;
      return left[field] > right[field] ? 1 : -1;
    }
    return 0;
  };

  const calls = [];
  const updates = [];

  const fetchBatch = async (args) => {
    assert.ok(Object.prototype.hasOwnProperty.call(args, 'cursor'));
    const { cursor, limit } = args;
    calls.push(cursor ? { ...cursor } : null);
    let startIndex = 0;
    if (cursor) {
      startIndex = orderedRows.findIndex((row) => compareRows(row, cursor) > 0);
      if (startIndex === -1) return [];
    }
    return orderedRows.slice(startIndex, startIndex + limit);
  };

  const upsertBatch = async ({ updates: batch }) => {
    updates.push(...batch);
    return { updated: batch.length };
  };

  const result = await runBackfill({
    from: null,
    to: null,
    batchSize: 2,
    sleepMs: 0,
    dryRun: false,
    fetchBatch,
    upsertBatch
  });

  assert.equal(result.totalUpdated, orderedRows.length);
  assert.equal(updates.length, orderedRows.length);
  assert.equal(result.totalSkippedCursor, 0);
  const uniqueKeys = new Set(
    updates.map(
      (row) => `${row.hour_start}|${row.user_id}|${row.device_id}|${row.source}|${row.model}`
    )
  );
  assert.equal(uniqueKeys.size, orderedRows.length);
  assert.equal(calls[0], null);
  assert.deepEqual(calls[1], {
    hour_start: '2025-12-17T00:00:00.000Z',
    user_id: 'u2',
    device_id: 'd1',
    source: 'codex',
    model: 'm1'
  });
});
