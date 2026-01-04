const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function loadVibescoreApi() {
  const modulePath = path.resolve(
    __dirname,
    '../dashboard/src/lib/vibescore-api.js'
  );
  return import(pathToFileURL(modulePath).href);
}

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  if (ORIGINAL_FETCH === undefined) delete globalThis.fetch;
  else globalThis.fetch = ORIGINAL_FETCH;
});

test('usage summary prefers /functions and falls back on 404', async () => {
  const { getUsageSummary } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);

    if (target.includes('/api/functions/vibeusage-usage-summary')) {
      return jsonResponse(
        {
          from: '2025-01-01',
          to: '2025-01-01',
          days: 1,
          totals: { total_tokens: '0' }
        },
        200
      );
    }
    if (target.includes('/functions/vibeusage-usage-summary')) {
      return jsonResponse({ error: 'Not Found', message: 'Not Found' }, 404);
    }

    return jsonResponse({ error: 'Unexpected', message: 'Unexpected' }, 500);
  };

  const res = await getUsageSummary({
    baseUrl: 'https://example.test',
    accessToken: 'token',
    from: '2025-01-01',
    to: '2025-01-01'
  });

  assert.equal(res?.totals?.total_tokens, '0');
  assert.ok(calls[0]?.includes('/functions/'));
  assert.ok(calls[1]?.includes('/api/functions/'));
});

test('usage summary does not fall back on 401', async () => {
  const { getUsageSummary } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);

    if (target.includes('/api/functions/vibeusage-usage-summary')) {
      return jsonResponse({ totals: { total_tokens: '0' } }, 200);
    }
    if (target.includes('/functions/vibeusage-usage-summary')) {
      return jsonResponse({ error: 'Unauthorized', message: 'Unauthorized' }, 401);
    }

    return jsonResponse({ error: 'Unexpected', message: 'Unexpected' }, 500);
  };

  await assert.rejects(
    () =>
      getUsageSummary({
        baseUrl: 'https://example.test',
        accessToken: 'token',
        from: '2025-01-01',
        to: '2025-01-01'
      }),
    (err) =>
      Number(err?.status) === 401 || Number(err?.statusCode) === 401
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.includes('/functions/'));
});

test('link code init posts to /functions', async () => {
  const { requestInstallLinkCode } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (input, init = {}) => {
    const target = typeof input === 'string' ? input : input?.url || '';
    const method = init?.method || input?.method;
    calls.push({ target, method });

    if (target.includes('/functions/vibeusage-link-code-init')) {
      return jsonResponse(
        {
          link_code: 'link_code_example',
          expires_at: '2025-01-01T00:00:00.000Z'
        },
        200
      );
    }

    return jsonResponse({ error: 'Unexpected', message: 'Unexpected' }, 500);
  };

  const res = await requestInstallLinkCode({
    baseUrl: 'https://example.test',
    accessToken: 'token'
  });

  assert.equal(res?.link_code, 'link_code_example');
  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.target?.includes('/functions/vibeusage-link-code-init'));
  assert.equal(calls[0]?.method, 'POST');
});
