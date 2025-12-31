const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { logSlowQuery } = require('../insforge-src/shared/logging');

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

test('logSlowQuery emits only above threshold', { concurrency: 1 }, () => {
  const prevThreshold = process.env.VIBESCORE_SLOW_QUERY_MS;
  const logs = [];
  const logger = {
    log: (payload) => logs.push(payload)
  };

  try {
    process.env.VIBESCORE_SLOW_QUERY_MS = '50';

    logSlowQuery(logger, { query_label: 'test', duration_ms: 40, row_count: 1 });
    assert.equal(logs.length, 0);

    logSlowQuery(logger, { query_label: 'test', duration_ms: 60, row_count: 1 });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].stage, 'slow_query');
    assert.equal(logs[0].query_label, 'test');
    assert.equal(logs[0].row_count, 1);
    assert.ok(typeof logs[0].duration_ms === 'number');
  } finally {
    if (prevThreshold === undefined) delete process.env.VIBESCORE_SLOW_QUERY_MS;
    else process.env.VIBESCORE_SLOW_QUERY_MS = prevThreshold;
  }
});
