const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { test, beforeEach, afterEach } = require('node:test');

const SERVICE_ROLE_KEY = 'srk_test_123';
const ANON_KEY = 'anon_test_123';
const BASE_URL = 'http://insforge:7130';

function toBase64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwt(payload) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function setDenoEnv(env) {
  globalThis.Deno = {
    env: {
      get(key) {
        return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
      }
    }
  };
}

function createServiceDbMock() {
  const inserts = [];
  const updates = [];
  const selects = [];

  function from(table) {
    return {
      insert: async (rows) => {
        inserts.push({ table, rows });
        return { error: null };
      },
      update: (values) => ({
        eq: async (col, value) => {
          updates.push({ table, values, where: { col, value } });
          return { error: null };
        }
      }),
      select: (columns) => {
        const q = { table, columns, filters: [] };
        selects.push(q);
        return {
          eq: (col, value) => {
            q.filters.push({ op: 'eq', col, value });
            return {
              in: async (inCol, values) => {
                q.filters.push({ op: 'in', col: inCol, value: values });
                return { data: [], error: null };
              },
              maybeSingle: async () => ({ data: null, error: null })
            };
          }
        };
      }
    };
  }

  return {
    db: { from },
    inserts,
    updates,
    selects
  };
}

function createQueryMock({ rows = [], onFilter } = {}) {
  const record = (entry) => {
    if (typeof onFilter === 'function') onFilter(entry);
  };

  const query = {
    select: () => query,
    eq: (col, value) => {
      record({ op: 'eq', col, value });
      return query;
    },
    neq: (col, value) => {
      record({ op: 'neq', col, value });
      return query;
    },
    gte: (col, value) => {
      record({ op: 'gte', col, value });
      return query;
    },
    lt: (col, value) => {
      record({ op: 'lt', col, value });
      return query;
    },
    lte: (col, value) => {
      record({ op: 'lte', col, value });
      return query;
    },
    order: (col, opts) => {
      record({ op: 'order', col, opts });
      return query;
    },
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    range: async () => ({ data: rows, error: null }),
    limit: async () => ({ data: rows.slice(0, 1), error: null })
  };

  return query;
}

function withRollupEnabled(fn) {
  const prevNew = process.env.VIBEUSAGE_ROLLUP_ENABLED;
  const prevLegacy = process.env.VIBESCORE_ROLLUP_ENABLED;

  delete process.env.VIBEUSAGE_ROLLUP_ENABLED;
  process.env.VIBESCORE_ROLLUP_ENABLED = '1';

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prevNew === undefined) delete process.env.VIBEUSAGE_ROLLUP_ENABLED;
      else process.env.VIBEUSAGE_ROLLUP_ENABLED = prevNew;
      if (prevLegacy === undefined) delete process.env.VIBESCORE_ROLLUP_ENABLED;
      else process.env.VIBESCORE_ROLLUP_ENABLED = prevLegacy;
    });
}

function withRollupDisabled(fn) {
  const prevNew = process.env.VIBEUSAGE_ROLLUP_ENABLED;
  const prevLegacy = process.env.VIBESCORE_ROLLUP_ENABLED;

  delete process.env.VIBEUSAGE_ROLLUP_ENABLED;
  delete process.env.VIBESCORE_ROLLUP_ENABLED;

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prevNew === undefined) delete process.env.VIBEUSAGE_ROLLUP_ENABLED;
      else process.env.VIBEUSAGE_ROLLUP_ENABLED = prevNew;
      if (prevLegacy === undefined) delete process.env.VIBESCORE_ROLLUP_ENABLED;
      else process.env.VIBESCORE_ROLLUP_ENABLED = prevLegacy;
    });
}

function createEntitlementsDbMock(options = {}) {
  const inserts = [];
  const rows = new Map();
  const seedRows = Array.isArray(options.seedRows) ? options.seedRows : [];
  const failOnDuplicate = options.failOnDuplicate !== false;
  const normalizeUserId = options.normalizeUserId === true;
  const conflictRow = options.conflictRow && typeof options.conflictRow.id === 'string'
    ? options.conflictRow
    : null;
  const duplicateError = options.duplicateError || {
    message: 'duplicate key value violates unique constraint "vibescore_user_entitlements_pkey"',
    code: '23505'
  };
  let conflictArmed = Boolean(conflictRow);

  const normalizeRow = (row) => {
    if (!normalizeUserId || !row || typeof row.user_id !== 'string') return row;
    return { ...row, user_id: row.user_id.toLowerCase() };
  };

  for (const row of seedRows) {
    if (row && typeof row.id === 'string') rows.set(row.id, normalizeRow(row));
  }

  function from(table) {
    if (table === 'vibescore_user_entitlements') {
      return {
        insert: async (newRows) => {
          inserts.push({ table, rows: newRows });
          if (conflictArmed) {
            const hasConflict = newRows.some((row) => row && row.id === conflictRow.id);
            if (hasConflict) {
              conflictArmed = false;
              rows.set(conflictRow.id, normalizeRow(conflictRow));
              return { error: duplicateError };
            }
          }
          if (failOnDuplicate) {
            for (const row of newRows) {
              if (row && typeof row.id === 'string' && rows.has(row.id)) {
                return { error: duplicateError };
              }
            }
          }
          for (const row of newRows) {
            if (row && typeof row.id === 'string') rows.set(row.id, normalizeRow(row));
          }
          return { error: null };
        },
        select: () => ({
          eq: (col, value) => ({
            maybeSingle: async () => {
              if (col !== 'id') return { data: null, error: null };
              return { data: rows.get(value) || null, error: null };
            }
          })
        })
      };
    }

    return {
      insert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    };
  }

  return {
    db: { from },
    inserts,
    rows
  };
}

function createLinkCodeExchangeDbMock(linkCodeRow) {
  const inserts = [];
  const updates = [];
  const deletes = [];
  let row = linkCodeRow ? { ...linkCodeRow } : null;

  function matchesFilters(target, filters) {
    if (!target) return false;
    return filters.every((filter) => {
      if (filter.op === 'eq') return target[filter.col] === filter.value;
      if (filter.op === 'is') {
        if (filter.value === null) return target[filter.col] == null;
        return target[filter.col] === filter.value;
      }
      return false;
    });
  }

  function from(table) {
    if (table === 'vibescore_link_codes') {
      return {
        select: (columns) => {
          const q = { table, columns, filters: [] };
          return {
            eq: (col, value) => {
              q.filters.push({ op: 'eq', col, value });
              return {
                maybeSingle: async () => ({
                  data: matchesFilters(row, q.filters) ? row : null,
                  error: null
                })
              };
            }
          };
        },
        update: (values) => {
          const q = { table, values, filters: [] };
          const builder = {
            eq: (col, value) => {
              q.filters.push({ op: 'eq', col, value });
              return builder;
            },
            is: (col, value) => {
              q.filters.push({ op: 'is', col, value });
              return builder;
            },
            select: (columns) => {
              q.columns = columns;
              return builder;
            },
            maybeSingle: async () => {
              updates.push(q);
              if (!matchesFilters(row, q.filters)) {
                return { data: null, error: null };
              }
              row = { ...row, ...values };
              return { data: row, error: null };
            }
          };
          return builder;
        }
      };
    }

    if (table === 'vibescore_tracker_devices' || table === 'vibescore_tracker_device_tokens') {
      return {
        insert: async (rows) => {
          inserts.push({ table, rows });
          return { error: null };
        },
        delete: () => ({
          eq: async (col, value) => {
            deletes.push({ table, col, value });
            return { error: null };
          }
        })
      };
    }

    return {
      insert: async () => ({ error: null }),
      delete: () => ({
        eq: async () => ({ error: null })
      })
    };
  }

  return {
    db: { from },
    inserts,
    updates,
    deletes,
    getRow: () => row
  };
}

const ORIGINAL_DENO = globalThis.Deno;
const ORIGINAL_CREATE_CLIENT = globalThis.createClient;
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  setDenoEnv({
    SERVICE_ROLE_KEY,
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });
});

afterEach(() => {
  if (ORIGINAL_DENO === undefined) delete globalThis.Deno;
  else globalThis.Deno = ORIGINAL_DENO;

  if (ORIGINAL_CREATE_CLIENT === undefined) delete globalThis.createClient;
  else globalThis.createClient = ORIGINAL_CREATE_CLIENT;

  if (ORIGINAL_FETCH === undefined) delete globalThis.fetch;
  else globalThis.fetch = ORIGINAL_FETCH;
});

test('vibeusage-device-token-issue works without serviceRoleKey (user mode)', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibeusage-device-token-issue');

  const calls = [];
  const db = createServiceDbMock();
  const userId = '11111111-1111-1111-1111-111111111111';
  const userJwt = 'user_jwt_test';

  globalThis.createClient = (args) => {
    calls.push(args);

    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: db.db
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-device-token-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ device_name: 'test-mac', platform: 'macos' })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(typeof data.device_id, 'string');
  assert.equal(typeof data.token, 'string');

  assert.equal(calls.length, 1, 'expected only one createClient call');

  const deviceInsert = db.inserts.find((i) => i.table === 'vibescore_tracker_devices');
  assert.ok(deviceInsert, 'device insert not performed');
  assert.equal(deviceInsert.rows?.[0]?.user_id, userId);

  const tokenInsert = db.inserts.find((i) => i.table === 'vibescore_tracker_device_tokens');
  assert.ok(tokenInsert, 'token insert not performed');
});

test('vibeusage-device-token-issue admin mode skips user lookup', async () => {
  const fn = require('../insforge-functions/vibeusage-device-token-issue');

  const calls = [];
  const service = createServiceDbMock();
  const adminUserId = '22222222-2222-2222-2222-222222222222';

  globalThis.createClient = (args) => {
    calls.push(args);
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: service.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-device-token-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ user_id: adminUserId, device_name: 'admin-mac', platform: 'macos' })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  assert.equal(calls.length, 1, 'expected only service client createClient call in admin mode');

  const deviceInsert = service.inserts.find((i) => i.table === 'vibescore_tracker_devices');
  assert.ok(deviceInsert, 'device insert not performed');
  assert.equal(deviceInsert.rows?.[0]?.user_id, adminUserId);
});

test('vibeusage-ingest uses serviceRoleKey as edgeFunctionToken and ingests hourly aggregates', async () => {
  const fn = require('../insforge-functions/vibeusage-ingest');

  const calls = [];
  const fetchCalls = [];

  const tokenRow = {
    id: 'token-id',
    user_id: '33333333-3333-3333-3333-333333333333',
    device_id: '44444444-4444-4444-4444-444444444444',
    revoked_at: null
  };

  function from(table) {
    if (table === 'vibescore_tracker_device_tokens') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null })
          })
        }),
        update: () => ({ eq: async () => ({ error: null }) })
      };
    }

    if (table === 'vibescore_tracker_devices') {
      return {
        update: () => ({ eq: async () => ({ error: null }) })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }

  globalThis.createClient = (args) => {
    calls.push(args);
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: { from } };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    const u = new URL(url);

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_hourly')) {
      return new Response(JSON.stringify([{ hour_start: '2025-12-17T00:00:00.000Z' }]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('not found', { status: 404 });
  };

  const deviceToken = 'device_token_test';
  const bucket = {
    hour_start: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    input_tokens: 1,
    cached_input_tokens: 1,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 4
  };

  const req = new Request('http://localhost/functions/vibeusage-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket, bucket] })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { success: true, inserted: 1, skipped: 0 });
  assert.equal(fetchCalls.length, 1);
  const postCall = fetchCalls[0];
  const postUrl = new URL(postCall.url);
  assert.ok(String(postCall.url).includes('/api/database/records/vibescore_tracker_hourly'));
  assert.equal(postCall.init?.method, 'POST');
  assert.equal(postCall.init?.headers?.apikey, SERVICE_ROLE_KEY);
  assert.equal(postCall.init?.headers?.Authorization, `Bearer ${SERVICE_ROLE_KEY}`);
  assert.equal(postCall.init?.headers?.Prefer, 'return=representation,resolution=merge-duplicates');
  assert.equal(postUrl.searchParams.get('on_conflict'), 'user_id,device_id,source,model,hour_start');
  assert.equal(postUrl.searchParams.get('select'), 'hour_start');

  const postBody = JSON.parse(postCall.init?.body || '[]');
  assert.equal(postBody.length, 1);
  assert.equal(postBody[0]?.hour_start, bucket.hour_start);
  assert.equal(postBody[0]?.source, 'codex');
  assert.equal(postBody[0]?.model, 'unknown');
  assert.equal(postBody[0]?.billable_total_tokens, '3');
  assert.equal(postBody[0]?.billable_rule_version, 1);

  const serviceClientCall = calls.find((c) => c && c.edgeFunctionToken === SERVICE_ROLE_KEY);
  assert.ok(serviceClientCall, 'service client not created');
  assert.equal(serviceClientCall.baseUrl, BASE_URL);
  assert.equal(serviceClientCall.anonKey, ANON_KEY);
});

test('vibeusage-ingest accepts wrapped payload with data.hourly', async () => {
  const fn = require('../insforge-functions/vibeusage-ingest');

  const calls = [];
  const fetchCalls = [];

  const tokenRow = {
    id: 'token-id',
    user_id: '33333333-3333-3333-3333-333333333333',
    device_id: '44444444-4444-4444-4444-444444444444',
    revoked_at: null
  };

  function from(table) {
    if (table === 'vibescore_tracker_device_tokens') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null })
          })
        }),
        update: () => ({ eq: async () => ({ error: null }) })
      };
    }

    if (table === 'vibescore_tracker_devices') {
      return {
        update: () => ({ eq: async () => ({ error: null }) })
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }

  globalThis.createClient = (args) => {
    calls.push(args);
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: { from } };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    const u = new URL(url);

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_hourly')) {
      return new Response(JSON.stringify([{ hour_start: '2025-12-17T00:00:00.000Z' }]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('not found', { status: 404 });
  };

  const deviceToken = 'device_token_test';
  const bucket = {
    hour_start: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = new Request('http://localhost/functions/vibeusage-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ data: { hourly: [bucket] } })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { success: true, inserted: 1, skipped: 0 });
  assert.equal(fetchCalls.length, 1);
  const postCall = fetchCalls[0];
  assert.ok(String(postCall.url).includes('/api/database/records/vibescore_tracker_hourly'));
  const postBody = JSON.parse(postCall.init?.body || '[]');
  assert.equal(postBody.length, 1);
  assert.equal(postBody[0]?.source, 'codex');

  const serviceClientCall = calls.find((c) => c && c.edgeFunctionToken === SERVICE_ROLE_KEY);
  assert.ok(serviceClientCall, 'service client not created');
});

test('vibeusage-ingest works without serviceRoleKey via anonKey records API', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibeusage-ingest');

  const tokenRow = {
    id: 'token-id',
    user_id: '33333333-3333-3333-3333-333333333333',
    device_id: '44444444-4444-4444-4444-444444444444',
    revoked_at: null
  };

  const fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    const u = new URL(url);

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_device_tokens')) {
      return new Response(JSON.stringify([tokenRow]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_hourly')) {
      return new Response(JSON.stringify([{ hour_start: '2025-12-17T00:00:00.000Z' }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('not found', { status: 404 });
  };

  const deviceToken = 'device_token_test';
  const bucket = {
    hour_start: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = new Request('http://localhost/functions/vibeusage-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket] })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { success: true, inserted: 1, skipped: 0 });

  assert.equal(fetchCalls.length, 4);
  const getCall = fetchCalls.find((call) =>
    String(call.url).includes('/api/database/records/vibescore_tracker_device_tokens')
  );
  const postCall = fetchCalls.find((call) =>
    String(call.url).includes('/api/database/records/vibescore_tracker_hourly')
  );
  const touchCall = fetchCalls.find((call) =>
    String(call.url).includes('/api/database/rpc/vibescore_touch_device_token_sync')
  );
  const metricsCall = fetchCalls.find((call) =>
    String(call.url).includes('/api/database/records/vibescore_tracker_ingest_batches')
  );

  assert.ok(getCall, 'device token fetch not found');
  assert.ok(String(getCall.url).includes('/api/database/records/vibescore_tracker_device_tokens'));
  assert.equal(getCall.init?.method, 'GET');
  assert.equal(getCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(getCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
  assert.equal(typeof getCall.init?.headers?.['x-vibeusage-device-token-hash'], 'string');
  assert.equal(getCall.init?.headers?.['x-vibeusage-device-token-hash'].length, 64);

  assert.ok(postCall, 'hourly upsert call not found');
  assert.ok(String(postCall.url).includes('/api/database/records/vibescore_tracker_hourly'));
  assert.equal(postCall.init?.method, 'POST');
  assert.equal(postCall.init?.headers?.Prefer, 'return=representation,resolution=merge-duplicates');
  const postUrl = new URL(postCall.url);
  assert.equal(postUrl.searchParams.get('on_conflict'), 'user_id,device_id,source,model,hour_start');
  assert.equal(postUrl.searchParams.get('select'), 'hour_start');

  assert.ok(touchCall, 'touch RPC call not found');
  assert.ok(String(touchCall.url).includes('/api/database/rpc/vibescore_touch_device_token_sync'));
  assert.equal(touchCall.init?.method, 'POST');
  assert.equal(touchCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(touchCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
  assert.equal(typeof touchCall.init?.headers?.['x-vibeusage-device-token-hash'], 'string');

  assert.ok(metricsCall, 'ingest batch metrics call not found');
  assert.ok(String(metricsCall.url).includes('/api/database/records/vibescore_tracker_ingest_batches'));
  assert.equal(metricsCall.init?.method, 'POST');
  assert.equal(metricsCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(metricsCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
});

test('vibeusage-ingest returns 429 when concurrency limit exceeded', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    VIBEUSAGE_INGEST_MAX_INFLIGHT: '1',
    VIBEUSAGE_INGEST_RETRY_AFTER_MS: '1000'
  });

  delete require.cache[require.resolve('../insforge-functions/vibeusage-ingest')];
  const fn = require('../insforge-functions/vibeusage-ingest');

  const tokenRow = {
    id: 'token-id',
    user_id: '33333333-3333-3333-3333-333333333333',
    device_id: '44444444-4444-4444-4444-444444444444',
    revoked_at: null
  };

  let releaseHold;
  const hold = new Promise((resolve) => {
    releaseHold = resolve;
  });

  globalThis.fetch = async (url) => {
    const u = new URL(url);

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_device_tokens')) {
      await hold;
      return new Response(JSON.stringify([tokenRow]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_hourly')) {
      return new Response(JSON.stringify([{ hour_start: '2025-12-17T00:00:00.000Z' }]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_ingest_batches')) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (u.pathname.endsWith('/api/database/rpc/vibescore_touch_device_token_sync')) {
      return new Response(JSON.stringify({ updated: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('not found', { status: 404 });
  };

  const bucket = {
    hour_start: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = () =>
    new Request('http://localhost/functions/vibeusage-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer device_token_test' },
      body: JSON.stringify({ hourly: [bucket] })
    });

  const first = fn(req());
  await new Promise((resolve) => setTimeout(resolve, 10));
  const res2 = await fn(req());

  assert.equal(res2.status, 429);
  assert.equal(res2.headers.get('Retry-After'), '1');

  releaseHold();
  const res1 = await first;
  assert.equal(res1.status, 200);
});

test('vibeusage-ingest anonKey path errors when hourly upsert unsupported', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibeusage-ingest');

  const tokenRow = {
    id: 'token-id',
    user_id: '33333333-3333-3333-3333-333333333333',
    device_id: '44444444-4444-4444-4444-444444444444',
    revoked_at: null
  };

  globalThis.fetch = async (url, init) => {
    const u = new URL(url);

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_device_tokens')) {
      return new Response(JSON.stringify([tokenRow]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_hourly')) {
      return new Response(JSON.stringify({ message: 'unknown on_conflict' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('not found', { status: 404 });
  };

  const deviceToken = 'device_token_test';
  const bucket = {
    hour_start: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = new Request('http://localhost/functions/vibeusage-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket] })
  });

  const res = await fn(req);
  assert.equal(res.status, 500);

  const data = await res.json();
  assert.deepEqual(data, { error: 'unknown on_conflict' });
});

test('vibeusage-usage-heatmap returns a week-aligned grid with derived fields', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-heatmap');

  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: '2025-12-10T00:00:00.000Z',
      source: 'codex',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '1',
      billable_total_tokens: '9'
    },
    { hour_start: '2025-12-11T00:00:00.000Z', total_tokens: '10' },
    { hour_start: '2025-12-12T00:00:00.000Z', total_tokens: '60' },
    { hour_start: '2025-12-12T01:00:00.000Z', total_tokens: '40' },
    { hour_start: '2025-12-18T00:00:00.000Z', total_tokens: '1000' }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return {
              select: () => query
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-heatmap?weeks=2&to=2025-12-18&week_starts_on=sun',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-07T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-19T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start' && o.opts?.ascending === true));

  assert.equal(body.from, '2025-12-07');
  assert.equal(body.to, '2025-12-18');
  assert.equal(body.week_starts_on, 'sun');
  assert.equal(body.active_days, 4);
  assert.equal(body.streak_days, 1);

  assert.ok(Array.isArray(body.weeks));
  assert.equal(body.weeks.length, 2);
  assert.equal(body.weeks[0].length, 7);
  assert.equal(body.weeks[1].length, 7);

  // Days after "to" in the last week are null.
  assert.equal(body.weeks[1][5], null);
  assert.equal(body.weeks[1][6], null);

  const cell1210 = body.weeks[0][3];
  assert.deepEqual(cell1210, { day: '2025-12-10', value: '9', level: 1 });

  const cell1212 = body.weeks[0][5];
  assert.deepEqual(cell1212, { day: '2025-12-12', value: '100', level: 2 });

  const cell1218 = body.weeks[1][4];
  assert.deepEqual(cell1218, { day: '2025-12-18', value: '1000', level: 4 });
});

test('vibeusage-usage-heatmap rejects invalid parameters', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-heatmap');

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-heatmap?weeks=105&to=2025-13-40&week_starts_on=wat',
    {
      method: 'GET',
      headers: { Authorization: 'Bearer user_jwt_test' }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test('vibeusage-usage-daily uses hourly when rollup disabled', () =>
  withRollupDisabled(async () => {
    const fn = require('../insforge-functions/vibeusage-usage-daily');

    const userId = '66666666-6666-6666-6666-666666666666';
    const userJwt = 'user_jwt_test';
    const filters = [];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              assert.equal(table, 'vibescore_tracker_hourly');
              const query = createQueryMock({
                rows: [],
                onFilter: (entry) => filters.push(entry)
              });
              return { select: () => query };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
    assert.ok(
      filters.some(
        (f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-20T00:00:00.000Z'
      )
    );
    assert.ok(
      filters.some(
        (f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'
      )
    );
  }));

test('vibeusage-usage-daily ignores rollup flag', () =>
  withRollupEnabled(async () => {
    const fn = require('../insforge-functions/vibeusage-usage-daily');

    const userId = '66666666-6666-6666-6666-666666666666';
    const userJwt = 'user_jwt_test';

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              assert.equal(table, 'vibescore_tracker_hourly');
              const query = createQueryMock({ rows: [] });
              return { select: () => query };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
  }));

test('vibeusage-usage-daily applies optional source filter', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];
  const rows = [];
  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21&source=every-code',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'source' && f.value === 'every-code'));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-20T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start'));
  }));

test('vibeusage-usage-daily applies optional model filter', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];
  const rows = [];
  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21&model=claude-3-5-sonnet',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'model' && f.value === 'claude-3-5-sonnet'));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-20T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start'));
  }));

test('vibeusage-usage-daily treats empty source as missing', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];
  const rows = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21&source=',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(!filters.some((f) => f.op === 'eq' && f.col === 'source'));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-20T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start'));
  }));

test('vibeusage-usage-daily excludes canary buckets by default', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];
  const rows = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(filters.some((f) => f.op === 'neq' && f.col === 'source' && f.value === 'canary'));
  assert.ok(filters.some((f) => f.op === 'neq' && f.col === 'model' && f.value === 'canary'));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-20T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start'));
  }));

test('vibeusage-usage-daily includes billable_total_tokens in summary', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      hour_start: '2025-12-20T01:00:00.000Z',
      source: 'codex',
      model: 'gpt-4o',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '2',
      output_tokens: '3',
      reasoning_output_tokens: '1'
    },
    {
      hour_start: '2025-12-20T12:00:00.000Z',
      source: 'claude',
      model: 'claude-3-5-sonnet',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '1',
      reasoning_output_tokens: '1'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({ rows });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-20',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.totals.billable_total_tokens, '13');
});

test('vibeusage-usage-daily prefers stored billable_total_tokens', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      hour_start: '2025-12-20T01:00:00.000Z',
      source: 'codex',
      model: 'gpt-4o',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2',
      billable_total_tokens: '7'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({ rows });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-20',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.totals.billable_total_tokens, '7');
});

test('vibeusage-usage-hourly aggregates half-hour buckets into half-hour totals', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-hourly');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: '2025-12-21T01:00:00.000Z',
      source: 'codex',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2'
    },
    {
      hour_start: '2025-12-21T01:00:00.000Z',
      source: 'codex',
      total_tokens: '2',
      input_tokens: '1',
      cached_input_tokens: '0',
      output_tokens: '1',
      reasoning_output_tokens: '0'
    },
    {
      hour_start: '2025-12-21T13:00:00.000Z',
      source: 'codex',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '1',
      reasoning_output_tokens: '1'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            return {
              select: (columns) => {
                const isAggregate =
                  typeof columns === 'string' && columns.includes('sum(');
                const result = isAggregate
                  ? { data: null, error: { message: 'not supported' } }
                  : { data: rows, error: null };
                const query = createQueryMock({
                  rows: Array.isArray(result.data) ? result.data : [],
                  onFilter: (entry) => {
                    if (entry.op === 'order') orders.push(entry);
                    else filters.push(entry);
                  }
                });
                if (isAggregate) {
                  query.order = (col, opts) => {
                    orders.push({ op: 'order', col, opts });
                    return result;
                  };
                }
                query.range = async () => result;
                return query;
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-21T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.opts?.ascending === true));
  assert.equal(body.day, '2025-12-21');
  assert.equal(body.data.length, 48);
  assert.equal(body.data[2].total_tokens, '12');
  assert.equal(body.data[2].billable_total_tokens, '11');
  assert.equal(body.data[2].input_tokens, '5');
  assert.equal(body.data[2].output_tokens, '4');
  assert.equal(body.data[26].total_tokens, '5');
  assert.equal(body.data[26].billable_total_tokens, '4');
});

test('vibeusage-usage-hourly local timezone prefers stored billable_total_tokens', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-hourly');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';
  let selectColumns = '';

  const rows = [
    {
      hour_start: '2025-12-20T16:00:00.000Z',
      source: 'codex',
      total_tokens: '10',
      input_tokens: '1',
      cached_input_tokens: '0',
      output_tokens: '1',
      reasoning_output_tokens: '1',
      billable_total_tokens: '9'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            return {
              select: (columns) => {
                selectColumns = String(columns || '');
                const query = createQueryMock({ rows });
                return query;
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21&tz_offset_minutes=480',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(selectColumns.includes('billable_total_tokens'));
  assert.equal(body.data[0].billable_total_tokens, '9');
});

test('vibeusage-usage-hourly computes billable totals from aggregated rows', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-hourly');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';

  const aggregateRows = [
    {
      hour: '2025-12-21T01:00:00.000Z',
      source: 'codex',
      sum_total_tokens: '10',
      sum_input_tokens: '4',
      sum_cached_input_tokens: '1',
      sum_output_tokens: '3',
      sum_reasoning_output_tokens: '2'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            return {
              select: (columns) => {
                const isAggregate =
                  typeof columns === 'string' && columns.includes('sum(');
                if (isAggregate) {
                  assert.ok(columns.includes('source'));
                  const query = createQueryMock({ rows: aggregateRows });
                  query.range = async () => ({ data: aggregateRows, error: null });
                  return query;
                }
                throw new Error('raw hourly query should not be called in aggregate path');
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[2].total_tokens, '10');
  assert.equal(body.data[2].billable_total_tokens, '9');
});

test('vibeusage-usage-hourly prefers stored billable totals in aggregate path', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-hourly');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';
  let selectColumns = '';

  const aggregateRows = [
    {
      hour: '2025-12-21T01:00:00.000Z',
      source: 'codex',
      sum_total_tokens: '10',
      sum_input_tokens: '4',
      sum_cached_input_tokens: '1',
      sum_output_tokens: '3',
      sum_reasoning_output_tokens: '2',
      sum_billable_total_tokens: '8',
      count_rows: '1',
      count_billable_total_tokens: '1'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            return {
              select: (columns) => {
                selectColumns = String(columns || '');
                const isAggregate =
                  typeof columns === 'string' && columns.includes('sum(');
                if (isAggregate) {
                  assert.ok(selectColumns.includes('sum(billable_total_tokens)'));
                  const query = createQueryMock({ rows: aggregateRows });
                  query.range = async () => ({ data: aggregateRows, error: null });
                  return query;
                }
                throw new Error('raw hourly query should not be called in aggregate path');
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[2].total_tokens, '10');
  assert.equal(body.data[2].billable_total_tokens, '8');
});

test('vibeusage-usage-hourly aggregate path falls back when billable sums incomplete', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-hourly');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';
  let selectColumns = '';

  const aggregateRows = [
    {
      hour: '2025-12-21T01:00:00.000Z',
      source: 'codex',
      sum_total_tokens: '10',
      sum_input_tokens: '4',
      sum_cached_input_tokens: '1',
      sum_output_tokens: '3',
      sum_reasoning_output_tokens: '2',
      sum_billable_total_tokens: '8',
      count_rows: '2',
      count_billable_total_tokens: '1'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            return {
              select: (columns) => {
                selectColumns = String(columns || '');
                const isAggregate =
                  typeof columns === 'string' && columns.includes('sum(');
                if (isAggregate) {
                  assert.ok(selectColumns.includes('count(billable_total_tokens)'));
                  assert.ok(selectColumns.includes('count()'));
                  const query = createQueryMock({ rows: aggregateRows });
                  query.range = async () => ({ data: aggregateRows, error: null });
                  return query;
                }
                throw new Error('raw hourly query should not be called in aggregate path');
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[2].total_tokens, '10');
  assert.equal(body.data[2].billable_total_tokens, '9');
});

test('vibeusage-usage-monthly aggregates hourly rows into months', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-monthly');

  const userId = '88888888-8888-8888-8888-888888888888';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: '2025-11-05T00:00:00.000Z',
      source: 'codex',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2',
      billable_total_tokens: '9'
    },
    {
      hour_start: '2025-11-20T00:00:00.000Z',
      source: 'codex',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '1',
      reasoning_output_tokens: '1',
      billable_total_tokens: '4'
    },
    {
      hour_start: '2025-12-01T00:00:00.000Z',
      source: 'codex',
      total_tokens: '7',
      input_tokens: '3',
      cached_input_tokens: '1',
      output_tokens: '2',
      reasoning_output_tokens: '1',
      billable_total_tokens: '6'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return {
              select: () => query
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-monthly?months=2&to=2025-12-21',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-11-01T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start' && o.opts?.ascending === true));
  assert.equal(body.from, '2025-11-01');
  assert.equal(body.to, '2025-12-21');
  assert.equal(body.months, 2);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].month, '2025-11');
  assert.equal(body.data[0].total_tokens, '15');
  assert.equal(body.data[0].billable_total_tokens, '13');
  assert.equal(body.data[1].month, '2025-12');
  assert.equal(body.data[1].total_tokens, '7');
  assert.equal(body.data[1].billable_total_tokens, '6');
});

test('vibeusage-usage-summary uses hourly when rollup disabled', () =>
  withRollupDisabled(async () => {
    const fn = require('../insforge-functions/vibeusage-usage-summary');

    const userId = '99999999-9999-9999-9999-999999999999';
    const userJwt = 'user_jwt_test';
    const filters = [];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              assert.equal(table, 'vibescore_tracker_hourly');
              const query = createQueryMock({
                rows: [],
                onFilter: (entry) => filters.push(entry)
              });
              return {
                select: () => query
              };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-12-20&to=2025-12-22',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
    assert.ok(
      filters.some(
        (f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-20T00:00:00.000Z'
      )
    );
    assert.ok(
      filters.some(
        (f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-23T00:00:00.000Z'
      )
    );
  }));

test('vibeusage-usage-summary returns total_cost_usd and pricing metadata', () =>
  withRollupEnabled(async () => {
    const fn = require('../insforge-functions/vibeusage-usage-summary');

    const userId = '99999999-9999-9999-9999-999999999999';
    const userJwt = 'user_jwt_test';
    const filters = [];
    const orders = [];

    const rows = [
      {
        hour_start: '2025-12-21T00:00:00.000Z',
        total_tokens: '1500000',
        input_tokens: '1000000',
        cached_input_tokens: '200000',
        output_tokens: '500000',
        reasoning_output_tokens: '100000'
      }
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        assert.equal(args.anonKey, ANON_KEY);
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              assert.equal(table, 'vibescore_tracker_hourly');
              const query = createQueryMock({
                rows,
                onFilter: (entry) => {
                  if (entry.op === 'order') orders.push(entry);
                  else filters.push(entry);
                }
              });
              return {
                select: () => query
              };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
    assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-21T00:00:00.000Z'));
    assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
    assert.ok(orders.some((o) => o.col === 'hour_start'));
    assert.equal(body.from, '2025-12-21');
    assert.equal(body.to, '2025-12-21');
    assert.equal(body.totals.total_tokens, '1500000');
    assert.equal(body.totals.billable_total_tokens, '1600000');
    assert.equal(body.totals.total_cost_usd, '8.435000');
    assert.equal(body.pricing.model, 'gpt-5.2-codex');
    assert.equal(body.pricing.pricing_mode, 'overlap');
    assert.equal(body.pricing.rates_per_million_usd.cached_input, '0.175000');
  }));

test('vibeusage-usage-summary prefers stored billable_total_tokens', () =>
  withRollupEnabled(async () => {
    const fn = require('../insforge-functions/vibeusage-usage-summary');

    const userId = '99999999-9999-9999-9999-999999999999';
    const userJwt = 'user_jwt_test';

    const rows = [
      {
        hour_start: '2025-12-21T00:00:00.000Z',
        source: 'codex',
        model: 'gpt-4o',
        total_tokens: '10',
        input_tokens: '4',
        cached_input_tokens: '1',
        output_tokens: '3',
        reasoning_output_tokens: '2',
        billable_total_tokens: '7'
      }
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              assert.equal(table, 'vibescore_tracker_hourly');
              const query = createQueryMock({ rows });
              return {
                select: () => query
              };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totals.billable_total_tokens, '7');
  }));

test('vibeusage-usage-summary emits debug payload when requested', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-summary');
  const prevThreshold = process.env.VIBEUSAGE_SLOW_QUERY_MS;

  const userId = '99999999-9999-9999-9999-999999999999';
  const userJwt = 'user_jwt_test';
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: '2025-12-21T00:00:00.000Z',
      total_tokens: '10',
      input_tokens: '6',
      cached_input_tokens: '2',
      output_tokens: '4',
      reasoning_output_tokens: '1'
    }
  ];

  try {
    process.env.VIBEUSAGE_SLOW_QUERY_MS = '2000';

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              if (table !== 'vibescore_tracker_hourly') {
                throw new Error(`Unexpected table: ${table}`);
              }
              const query = createQueryMock({
                rows,
                onFilter: (entry) => {
                  if (entry.op === 'order') orders.push(entry);
                  else filters.push(entry);
                }
              });
              return {
                select: () => query
              };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&debug=1',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);

    const payload = await res.json();
    assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
    assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-21T00:00:00.000Z'));
    assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
    assert.ok(orders.some((o) => o.col === 'hour_start'));
    assert.ok(payload.debug);
    assert.ok(payload.debug.request_id && payload.debug.request_id.length > 0);
    assert.equal(payload.debug.status, 200);
    assert.ok(Number.isFinite(payload.debug.query_ms));
    assert.ok(Number.isFinite(payload.debug.slow_threshold_ms));
    assert.equal(typeof payload.debug.slow_query, 'boolean');

    const noDebugReq = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );
    const noDebugRes = await fn(noDebugReq);
    assert.equal(noDebugRes.status, 200);
    const noDebugPayload = await noDebugRes.json();
    assert.equal(noDebugPayload.debug, undefined);
  } finally {
    if (prevThreshold === undefined) delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    else process.env.VIBEUSAGE_SLOW_QUERY_MS = prevThreshold;
  }
  }));

test('vibeusage-usage-summary logs vibeusage function name', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-summary');

  const userId = '99999999-9999-9999-9999-999999999999';
  const userJwt = 'user_jwt_test';
  const rows = [
    {
      hour_start: '2025-12-21T00:00:00.000Z',
      total_tokens: '10',
      input_tokens: '6',
      cached_input_tokens: '2',
      output_tokens: '4',
      reasoning_output_tokens: '1'
    }
  ];
  const logs = [];
  const prevLog = console.log;

  console.log = (message) => logs.push(message);

  try {
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: (table) => {
              assert.equal(table, 'vibescore_tracker_hourly');
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 200);

    const parsed = logs
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch (_e) {
          return null;
        }
      })
      .filter(Boolean);
    const responseLog = parsed.find((payload) => payload?.stage === 'response');
    assert.ok(responseLog, 'expected response log payload');
    assert.equal(responseLog.function, 'vibeusage-usage-summary');
  } finally {
    console.log = prevLog;
  }
  }));

test('vibeusage-usage-summary uses auth lookup even with jwt payload', () =>
  withRollupEnabled(async () => {
  const fn = require('../insforge-functions/vibeusage-usage-summary');

  const userId = '77777777-7777-7777-7777-777777777777';
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: 1893456000 })).toString('base64url');
  const userJwt = `header.${payload}.sig`;
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: '2025-12-21T00:00:00.000Z',
      total_tokens: '10',
      input_tokens: '6',
      cached_input_tokens: '2',
      output_tokens: '4',
      reasoning_output_tokens: '1'
    }
  ];

  let authCalls = 0;

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => {
            authCalls += 1;
            return { data: { user: { id: userId } }, error: null };
          }
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === 'order') orders.push(entry);
                else filters.push(entry);
              }
            });
            return {
              select: () => query
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'gte' && f.col === 'hour_start' && f.value === '2025-12-21T00:00:00.000Z'));
  assert.ok(filters.some((f) => f.op === 'lt' && f.col === 'hour_start' && f.value === '2025-12-22T00:00:00.000Z'));
  assert.ok(orders.some((o) => o.col === 'hour_start'));
  assert.equal(authCalls, 1, 'expected auth.getCurrentUser to validate jwt payload');
  }));

test('vibeusage-usage-summary rejects oversized ranges', { concurrency: 1 }, async () => {
  const fn = require('../insforge-functions/vibeusage-usage-summary');
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';
  let dbTouched = false;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = '30';
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: () => {
              dbTouched = true;
              throw new Error('database should not be queried for oversized ranges');
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-summary?from=2025-01-01&to=2025-02-15',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(String(body.error || ''), /max/i);
    assert.equal(dbTouched, false);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test('getUsageMaxDays defaults to 800 days', { concurrency: 1 }, () => {
  const { getUsageMaxDays } = require('../insforge-src/shared/date');
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  try {
    delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    assert.equal(getUsageMaxDays(), 800);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test('vibeusage-usage-daily rejects oversized ranges', { concurrency: 1 }, async () => {
  const fn = require('../insforge-functions/vibeusage-usage-daily');
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';
  let dbTouched = false;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = '30';
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: () => {
              dbTouched = true;
              throw new Error('database should not be queried for oversized ranges');
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-02-15',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(String(body.error || ''), /max/i);
    assert.equal(dbTouched, false);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test('vibeusage-usage-model-breakdown includes billable_total_tokens per source', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-model-breakdown');

  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      source: 'codex',
      model: 'gpt-4o',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2'
    },
    {
      source: 'claude',
      model: 'claude-3-5-sonnet',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '1',
      reasoning_output_tokens: '1'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({ rows });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const bySource = new Map(body.sources.map((entry) => [entry.source, entry]));
  assert.equal(bySource.get('codex')?.totals?.billable_total_tokens, '9');
  assert.equal(bySource.get('claude')?.totals?.billable_total_tokens, '5');
  const codexModel = bySource.get('codex')?.models?.find((entry) => entry.model === 'gpt-4o');
  const claudeModel = bySource.get('claude')?.models?.find((entry) => entry.model === 'claude-3-5-sonnet');
  assert.equal(codexModel?.totals?.billable_total_tokens, '9');
  assert.equal(claudeModel?.totals?.billable_total_tokens, '5');
});

test('vibeusage-usage-model-breakdown prefers stored billable_total_tokens', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-model-breakdown');

  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      source: 'codex',
      model: 'gpt-4o',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2',
      billable_total_tokens: '7'
    },
    {
      source: 'claude',
      model: 'claude-3-5-sonnet',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '1',
      reasoning_output_tokens: '1',
      billable_total_tokens: '6'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({ rows });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const bySource = new Map(body.sources.map((entry) => [entry.source, entry]));
  assert.equal(bySource.get('codex')?.totals?.billable_total_tokens, '7');
  assert.equal(bySource.get('claude')?.totals?.billable_total_tokens, '6');
  const codexModel = bySource.get('codex')?.models?.find((entry) => entry.model === 'gpt-4o');
  const claudeModel = bySource.get('claude')?.models?.find((entry) => entry.model === 'claude-3-5-sonnet');
  assert.equal(codexModel?.totals?.billable_total_tokens, '7');
  assert.equal(claudeModel?.totals?.billable_total_tokens, '6');
});

test('vibeusage-usage-model-breakdown sorts models by billable_total_tokens', async () => {
  const fn = require('../insforge-functions/vibeusage-usage-model-breakdown');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      source: 'codex',
      model: 'gpt-4o',
      total_tokens: '100',
      input_tokens: '40',
      cached_input_tokens: '10',
      output_tokens: '30',
      reasoning_output_tokens: '20',
      billable_total_tokens: '30'
    },
    {
      source: 'codex',
      model: 'gpt-4.1',
      total_tokens: '60',
      input_tokens: '20',
      cached_input_tokens: '10',
      output_tokens: '20',
      reasoning_output_tokens: '10',
      billable_total_tokens: '50'
    }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            const query = createQueryMock({ rows });
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const sourceEntry = body.sources.find((entry) => entry.source === 'codex');
  assert.ok(Array.isArray(sourceEntry?.models));
  assert.equal(sourceEntry.models[0]?.model, 'gpt-4.1');
});

test('vibeusage-usage-model-breakdown rejects oversized ranges', { concurrency: 1 }, async () => {
  const fn = require('../insforge-functions/vibeusage-usage-model-breakdown');
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';
  let dbTouched = false;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = '30';
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
          },
          database: {
            from: () => {
              dbTouched = true;
              throw new Error('database should not be queried for oversized ranges');
            }
          }
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      'http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-01-01&to=2025-02-15',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` }
      }
    );

    const res = await fn(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(String(body.error || ''), /max/i);
    assert.equal(dbTouched, false);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test('vibeusage-leaderboard returns a week window and slices entries to limit', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibeusage-leaderboard');

  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';

  const entriesRows = [
    { rank: 1, is_me: false, display_name: 'Anonymous', avatar_url: null, total_tokens: '100' },
    { rank: 2, is_me: true, display_name: 'Anonymous', avatar_url: null, total_tokens: '50' }
  ];

  const meRow = { rank: 2, total_tokens: '50' };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            if (table === 'vibescore_leaderboard_week_current') {
              return {
                select: () => ({
                  order: (col, opts) => {
                    assert.equal(col, 'rank');
                    assert.equal(opts?.ascending, true);
                    return {
                      limit: async () => ({ data: entriesRows, error: null })
                    };
                  }
                })
              };
            }

            if (table === 'vibescore_leaderboard_me_week_current') {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null })
                })
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          }
        }
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-leaderboard?period=week&limit=1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, 'week');
  assert.ok(typeof body.generated_at === 'string' && body.generated_at.includes('T'));

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - today.getUTCDay()); // Sunday start
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 6);

  assert.equal(body.from, from.toISOString().slice(0, 10));
  assert.equal(body.to, to.toISOString().slice(0, 10));

  assert.ok(Array.isArray(body.entries));
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].rank, 1);
  assert.equal(body.entries[0].total_tokens, '100');

  assert.deepEqual(body.me, { rank: 2, total_tokens: '50' });
});

test('vibeusage-leaderboard uses system earliest day for total window', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibeusage-leaderboard');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';

  const metaRow = { from_day: '2025-12-01', to_day: '2025-12-19' };
  const entriesRows = [{ rank: 1, is_me: true, display_name: 'Anonymous', avatar_url: null, total_tokens: '42' }];
  const meRow = { rank: 1, total_tokens: '42' };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            if (table === 'vibescore_leaderboard_meta_total_current') {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: metaRow, error: null })
                })
              };
            }

            if (table === 'vibescore_leaderboard_total_current') {
              return {
                select: () => ({
                  order: () => ({
                    limit: async () => ({ data: entriesRows, error: null })
                  })
                })
              };
            }

            if (table === 'vibescore_leaderboard_me_total_current') {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null })
                })
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          }
        }
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-leaderboard?period=total', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, 'total');
  assert.equal(body.from, metaRow.from_day);
  assert.equal(body.to, metaRow.to_day);
  assert.ok(Array.isArray(body.entries));
  assert.equal(body.entries.length, 1);
  assert.deepEqual(body.me, { rank: 1, total_tokens: '42' });
});

test('vibeusage-leaderboard rejects invalid period', async () => {
  const fn = require('../insforge-functions/vibeusage-leaderboard');

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === 'user_jwt_test') {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: '88888888-8888-8888-8888-888888888888' } }, error: null })
        },
        database: {
          from: () => {
            throw new Error('Unexpected database access');
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-leaderboard?period=year', {
    method: 'GET',
    headers: { Authorization: 'Bearer user_jwt_test' }
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test('vibeusage-leaderboard-settings inserts user setting row', async () => {
  const fn = require('../insforge-functions/vibeusage-leaderboard-settings');

  const userId = '99999999-9999-9999-9999-999999999999';
  const userJwt = 'user_jwt_test';

  const inserts = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_user_settings');
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null })
                })
              }),
              insert: async (rows) => {
                inserts.push({ table, rows });
                return { error: null };
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-leaderboard-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: true })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, true);
  assert.equal(typeof body.updated_at, 'string');
  assert.ok(body.updated_at.includes('T'));

  assert.equal(inserts.length, 1);
  const row = inserts[0].rows?.[0];
  assert.equal(row.user_id, userId);
  assert.equal(row.leaderboard_public, true);
  assert.equal(typeof row.updated_at, 'string');
});

test('vibeusage-leaderboard-settings updates existing row', async () => {
  const fn = require('../insforge-functions/vibeusage-leaderboard-settings');

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userJwt = 'user_jwt_test';

  const updates = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_user_settings');
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { user_id: userId }, error: null })
                })
              }),
              update: (values) => ({
                eq: async (col, value) => {
                  updates.push({ table, values, where: { col, value } });
                  return { error: null };
                }
              })
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-leaderboard-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: false })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, false);
  assert.equal(typeof body.updated_at, 'string');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.col, 'user_id');
  assert.equal(updates[0].where.value, userId);
  assert.equal(updates[0].values.leaderboard_public, false);
  assert.equal(typeof updates[0].values.updated_at, 'string');
});

test('vibeusage-leaderboard-settings rejects invalid body', async () => {
  const fn = require('../insforge-functions/vibeusage-leaderboard-settings');

  const userJwt = 'user_jwt_test';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' } }, error: null })
        },
        database: {
          from: () => {
            throw new Error('Unexpected database access');
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-leaderboard-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: 'yes' })
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test('vibeusage-user-status returns pro.active for cutoff user', async () => {
  const fn = require('../insforge-functions/vibeusage-user-status');

  const userId = '11111111-1111-1111-1111-111111111111';
  const userJwt = 'user_jwt_test';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({
            data: { user: { id: userId, created_at: '2025-01-01T00:00:00Z' } },
            error: null
          })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_user_entitlements');
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null })
                })
              })
            };
          }
        }
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-user-status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.pro.active, true);
  assert.equal(body.pro.sources.includes('registration_cutoff'), true);
});

test('vibeusage-user-status falls back to users table when created_at missing', async () => {
  const fn = require('../insforge-functions/vibeusage-user-status');

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userJwt = 'user_jwt_test';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_user_entitlements');
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null })
                })
              })
            };
          }
        }
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            assert.equal(table, 'users');
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { created_at: '2025-01-01T00:00:00Z' }, error: null })
                })
              })
            };
          }
        }
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-user-status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.pro.active, true);
  assert.equal(body.pro.sources.includes('registration_cutoff'), true);
});

test('vibeusage-user-status degrades when created_at missing and no service role', async () => {
  const fn = require('../insforge-functions/vibeusage-user-status');

  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const userId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const userJwt = 'user_jwt_test';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_user_entitlements');
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({
                    data: [
                      {
                        effective_from: '2025-01-01T00:00:00Z',
                        effective_to: '2027-01-01T00:00:00Z',
                        revoked_at: null
                      }
                    ],
                    error: null
                  })
                })
              })
            };
          }
        }
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-user-status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.created_at, null);
  assert.equal(body.pro.partial, true);
  assert.equal(body.pro.active, true);
  assert.equal(body.pro.sources.includes('entitlement'), true);
});

test('vibeusage-entitlements rejects non-admin caller', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const userJwt = 'user_jwt_test';

  globalThis.createClient = () => {
    throw new Error('Unexpected createClient');
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({})
  });

  const res = await fn(req);
  assert.equal(res.status, 401);
});

test('vibeusage-entitlements inserts entitlement (admin)', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createServiceDbMock();
  const userId = '22222222-2222-2222-2222-222222222222';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      user_id: userId,
      source: 'manual',
      effective_from: '2025-01-01T00:00:00Z',
      effective_to: '2124-01-01T00:00:00Z',
      note: 'test'
    })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.user_id, userId);
  assert.equal(body.source, 'manual');
  assert.equal(body.note, 'test');
  assert.equal(db.inserts.length, 1);
  assert.equal(db.inserts[0].table, 'vibescore_user_entitlements');
  assert.equal(db.inserts[0].rows[0].user_id, userId);
});

test('vibeusage-entitlements replays idempotency_key without duplicate insert', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createEntitlementsDbMock();
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const body = {
    user_id: userId,
    source: 'manual',
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2124-01-01T00:00:00Z',
    note: 'test',
    idempotency_key: 'entitlement-1'
  };

  const req1 = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body)
  });
  const res1 = await fn(req1);
  assert.equal(res1.status, 200);
  const row1 = await res1.json();

  const req2 = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body)
  });
  const res2 = await fn(req2);
  assert.equal(res2.status, 200);
  const row2 = await res2.json();

  assert.equal(row1.id, row2.id);
  assert.equal(db.rows.size, 1);
});

test('vibeusage-entitlements accepts long idempotency_key without collisions', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createEntitlementsDbMock();
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const longPrefix = 'k'.repeat(128);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const base = {
    user_id: userId,
    source: 'manual',
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2124-01-01T00:00:00Z',
    note: 'test'
  };

  const res1 = await fn(
    new Request('http://localhost/functions/vibeusage-entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        ...base,
        idempotency_key: `${longPrefix}A`
      })
    })
  );
  assert.equal(res1.status, 200);
  const row1 = await res1.json();

  const res2 = await fn(
    new Request('http://localhost/functions/vibeusage-entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        ...base,
        idempotency_key: `${longPrefix}B`
      })
    })
  );
  assert.equal(res2.status, 200);
  const row2 = await res2.json();

  assert.notEqual(row1.id, row2.id);
  assert.equal(db.rows.size, 2);
});

test('vibeusage-entitlements normalizes user_id for idempotency replays', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createEntitlementsDbMock({ normalizeUserId: true });
  const userId = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const body = {
    user_id: userId,
    source: 'manual',
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2124-01-01T00:00:00Z',
    note: 'test',
    idempotency_key: 'entitlement-uppercase'
  };

  const res1 = await fn(
    new Request('http://localhost/functions/vibeusage-entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify(body)
    })
  );
  assert.equal(res1.status, 200);
  const row1 = await res1.json();

  const res2 = await fn(
    new Request('http://localhost/functions/vibeusage-entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify(body)
    })
  );
  assert.equal(res2.status, 200);
  const row2 = await res2.json();

  assert.equal(row1.id, row2.id);
  assert.equal(db.rows.size, 1);
});

test('vibeusage-entitlements rejects idempotency_key payload mismatch', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createEntitlementsDbMock();
  const userId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const base = {
    user_id: userId,
    source: 'manual',
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2124-01-01T00:00:00Z',
    note: 'alpha',
    idempotency_key: 'entitlement-mismatch'
  };

  const res1 = await fn(
    new Request('http://localhost/functions/vibeusage-entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify(base)
    })
  );
  assert.equal(res1.status, 200);

  const res2 = await fn(
    new Request('http://localhost/functions/vibeusage-entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ ...base, note: 'beta' })
    })
  );

  assert.equal(res2.status, 409);
  const body = await res2.json();
  assert.equal(body.error, 'Entitlement already exists with different payload');
  assert.equal(db.rows.size, 1);
});

test('vibeusage-entitlements returns existing row after insert conflict', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const userId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const conflictRow = {
    id: '99999999-9999-9999-9999-999999999999',
    user_id: userId,
    source: 'manual',
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2124-01-01T00:00:00Z',
    revoked_at: null,
    note: 'test',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    created_by: null
  };
  const db = createEntitlementsDbMock({ conflictRow });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      id: conflictRow.id,
      user_id: userId,
      source: 'manual',
      effective_from: conflictRow.effective_from,
      effective_to: conflictRow.effective_to,
      note: conflictRow.note
    })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, conflictRow.id);
});

test('vibeusage-entitlements rejects id reuse across users', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const existingId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const existingRow = {
    id: existingId,
    user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    source: 'manual',
    effective_from: '2025-01-01T00:00:00Z',
    effective_to: '2124-01-01T00:00:00Z',
    revoked_at: null,
    note: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    created_by: null
  };
  const db = createEntitlementsDbMock({ seedRows: [existingRow] });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      id: existingId,
      user_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      source: 'manual',
      effective_from: '2025-01-01T00:00:00Z',
      effective_to: '2124-01-01T00:00:00Z',
      note: 'test'
    })
  });

  const res = await fn(req);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, 'Entitlement already exists with different payload');
});

test('vibeusage-entitlements accepts project_admin token', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createServiceDbMock();
  const userId = '44444444-4444-4444-4444-444444444444';
  const projectAdminJwt = createJwt({ role: 'project_admin' });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === projectAdminJwt) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${projectAdminJwt}` },
    body: JSON.stringify({
      user_id: userId,
      source: 'manual',
      effective_from: '2025-01-01T00:00:00Z',
      effective_to: '2124-01-01T00:00:00Z'
    })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
});

test('vibeusage-entitlements accepts project_admin token from roles array', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements');

  const db = createServiceDbMock();
  const userId = '55555555-5555-5555-5555-555555555555';
  const projectAdminJwt = createJwt({ app_metadata: { roles: ['user', 'project_admin'] } });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === projectAdminJwt) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${projectAdminJwt}` },
    body: JSON.stringify({
      user_id: userId,
      source: 'manual',
      effective_from: '2025-01-01T00:00:00Z',
      effective_to: '2124-01-01T00:00:00Z'
    })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
});

test('vibeusage-entitlements-revoke updates revoked_at (admin)', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements-revoke');

  const db = createServiceDbMock();
  const entitlementId = '33333333-3333-3333-3333-333333333333';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements-revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ id: entitlementId })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.id, entitlementId);
  assert.equal(typeof body.revoked_at, 'string');
  assert.equal(db.updates.length, 1);
  assert.equal(db.updates[0].table, 'vibescore_user_entitlements');
  assert.equal(db.updates[0].where.col, 'id');
  assert.equal(db.updates[0].where.value, entitlementId);
});

test('vibeusage-entitlements-revoke accepts project_admin token', async () => {
  const fn = require('../insforge-functions/vibeusage-entitlements-revoke');

  const db = createServiceDbMock();
  const entitlementId = '55555555-5555-5555-5555-555555555555';
  const projectAdminJwt = createJwt({ role: 'project_admin' });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === projectAdminJwt) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-entitlements-revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${projectAdminJwt}` },
    body: JSON.stringify({ id: entitlementId })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
});

test('vibeusage-link-code-init issues a short-lived link code', async () => {
  const fn = require('../insforge-functions/vibeusage-link-code-init');

  const db = createServiceDbMock();
  const userId = '66666666-6666-6666-6666-666666666666';
  const userJwt = 'user_jwt_test';

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: db.db
      };
    }
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-link-code-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({})
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(typeof body.link_code, 'string');
  assert.ok(body.link_code.length > 0);
  assert.equal(typeof body.expires_at, 'string');

  const insert = db.inserts.find((i) => i.table === 'vibescore_link_codes');
  assert.ok(insert, 'link code insert missing');
  const row = insert.rows?.[0] || {};

  assert.equal(typeof row.code_hash, 'string');
  assert.equal(row.code_hash.length, 64);
  assert.equal(typeof row.session_id, 'string');
  assert.equal(row.session_id.length, 64);
  assert.notEqual(row.session_id, userJwt);
  assert.equal(row.used_at, null);
});

test('vibeusage-link-code-exchange creates device token and marks link code used', async () => {
  const fn = require('../insforge-functions/vibeusage-link-code-exchange');

  const linkCode = 'link_code_test';
  const requestId = 'req_123';
  const userId = '77777777-7777-7777-7777-777777777777';
  const linkCodeRow = {
    id: 'link_code_id',
    user_id: userId,
    code_hash: createHash('sha256').update(linkCode).digest('hex'),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: null,
    request_id: null,
    device_id: null
  };
  const db = createLinkCodeExchangeDbMock(linkCodeRow);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-link-code-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link_code: linkCode, request_id: requestId })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  const codeHash = createHash('sha256').update(linkCode).digest('hex');
  const expectedToken = createHash('sha256')
    .update(`${SERVICE_ROLE_KEY}:${codeHash}:${requestId}`)
    .digest('hex');
  const expectedTokenHash = createHash('sha256').update(expectedToken).digest('hex');

  assert.equal(body.token, expectedToken);
  assert.equal(body.user_id, userId);

  const deviceInsert = db.inserts.find((entry) => entry.table === 'vibescore_tracker_devices');
  assert.ok(deviceInsert, 'device insert missing');
  const deviceRow = deviceInsert.rows[0];
  assert.equal(body.device_id, deviceRow.id);

  const tokenInsert = db.inserts.find((entry) => entry.table === 'vibescore_tracker_device_tokens');
  assert.ok(tokenInsert, 'token insert missing');
  assert.equal(tokenInsert.rows[0].token_hash, expectedTokenHash);
  assert.equal(tokenInsert.rows[0].device_id, deviceRow.id);

  const update = db.updates.find((entry) => entry.table === 'vibescore_link_codes');
  assert.ok(update, 'link code update missing');
  assert.equal(update.values.request_id, requestId);
  assert.equal(update.values.device_id, deviceRow.id);
  assert.equal(
    update.filters.some((filter) => filter.op === 'is' && filter.col === 'used_at' && filter.value === null),
    true
  );
});

test('vibeusage-link-code-exchange returns existing device for repeated request', async () => {
  const fn = require('../insforge-functions/vibeusage-link-code-exchange');

  const linkCode = 'link_code_used';
  const requestId = 'req_repeat';
  const userId = '88888888-8888-8888-8888-888888888888';
  const deviceId = 'device_existing';
  const linkCodeRow = {
    id: 'link_code_id_used',
    user_id: userId,
    code_hash: createHash('sha256').update(linkCode).digest('hex'),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: new Date().toISOString(),
    request_id: requestId,
    device_id: deviceId
  };
  const db = createLinkCodeExchangeDbMock(linkCodeRow);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibeusage-link-code-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link_code: linkCode, request_id: requestId })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.device_id, deviceId);
  assert.equal(body.user_id, userId);
  assert.equal(db.inserts.length, 0);
  assert.equal(db.updates.length, 0);
});
