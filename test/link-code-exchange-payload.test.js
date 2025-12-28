const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('link code exchange payload uses rpc parameter names', () => {
  const filePath = path.join(
    __dirname,
    '..',
    'insforge-src',
    'functions',
    'vibescore-link-code-exchange.js'
  );
  const src = fs.readFileSync(filePath, 'utf8');
  const requiredKeys = [
    'p_code_hash',
    'p_request_id',
    'p_device_name',
    'p_platform',
    'p_token_hash'
  ];
  for (const key of requiredKeys) {
    assert.ok(
      src.includes(key),
      `expected payload to include ${key}`
    );
  }
});
