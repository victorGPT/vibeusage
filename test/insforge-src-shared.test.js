const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
