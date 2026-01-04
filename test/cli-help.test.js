const assert = require('node:assert/strict');
const { test } = require('node:test');

const { run } = require('../src/cli');

test('help output uses VibeUsage identifiers', async () => {
  const prevWrite = process.stdout.write;
  let out = '';

  try {
    process.stdout.write = (chunk) => {
      out += String(chunk || '');
      return true;
    };

    await run([]);
  } finally {
    process.stdout.write = prevWrite;
  }

  assert.match(out, /vibeusage/);
  assert.ok(!out.includes('@vibescore/tracker'));
  assert.match(out, /VIBEUSAGE_DASHBOARD_URL/);
});
