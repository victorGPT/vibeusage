const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getAnonKey, getHttpTimeoutMs } = require('../src/lib/insforge-client');

test('getAnonKey prefers VIBEUSAGE_INSFORGE_ANON_KEY with legacy fallback', () => {
  assert.equal(getAnonKey({ env: { VIBEUSAGE_INSFORGE_ANON_KEY: 'new', VIBESCORE_INSFORGE_ANON_KEY: 'old' } }), 'new');
  assert.equal(getAnonKey({ env: { VIBESCORE_INSFORGE_ANON_KEY: 'old' } }), 'old');
  assert.equal(getAnonKey({ env: { INSFORGE_ANON_KEY: 'anon' } }), 'anon');
});

test('getHttpTimeoutMs reads VIBEUSAGE_HTTP_TIMEOUT_MS with legacy fallback', () => {
  assert.equal(getHttpTimeoutMs({ env: { VIBEUSAGE_HTTP_TIMEOUT_MS: '1000' } }), 1000);
  assert.equal(getHttpTimeoutMs({ env: { VIBESCORE_HTTP_TIMEOUT_MS: '2000' } }), 2000);
  assert.equal(
    getHttpTimeoutMs({ env: { VIBEUSAGE_HTTP_TIMEOUT_MS: '', VIBESCORE_HTTP_TIMEOUT_MS: '3000' } }),
    3000
  );
});
