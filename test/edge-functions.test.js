const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const SERVICE_ROLE_KEY = 'srk_test_123';
const ANON_KEY = 'anon_test_123';
const BASE_URL = 'http://insforge:7130';

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

test('vibescore-device-token-issue works without serviceRoleKey (user mode)', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibescore-device-token-issue');

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

  const req = new Request('http://localhost/functions/vibescore-device-token-issue', {
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

test('vibescore-device-token-issue admin mode skips user lookup', async () => {
  const fn = require('../insforge-functions/vibescore-device-token-issue');

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

  const req = new Request('http://localhost/functions/vibescore-device-token-issue', {
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

test('vibescore-ingest uses serviceRoleKey as edgeFunctionToken and ingests hourly aggregates', async () => {
  const fn = require('../insforge-functions/vibescore-ingest');

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

  const req = new Request('http://localhost/functions/vibescore-ingest', {
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
  assert.equal(postUrl.searchParams.get('on_conflict'), 'user_id,device_id,source,hour_start');
  assert.equal(postUrl.searchParams.get('select'), 'hour_start');

  const postBody = JSON.parse(postCall.init?.body || '[]');
  assert.equal(postBody.length, 1);
  assert.equal(postBody[0]?.hour_start, bucket.hour_start);
  assert.equal(postBody[0]?.source, 'codex');

  const serviceClientCall = calls.find((c) => c && c.edgeFunctionToken === SERVICE_ROLE_KEY);
  assert.ok(serviceClientCall, 'service client not created');
  assert.equal(serviceClientCall.baseUrl, BASE_URL);
  assert.equal(serviceClientCall.anonKey, ANON_KEY);
});

test('vibescore-ingest accepts wrapped payload with data.hourly', async () => {
  const fn = require('../insforge-functions/vibescore-ingest');

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

  const req = new Request('http://localhost/functions/vibescore-ingest', {
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

test('vibescore-ingest works without serviceRoleKey via anonKey records API', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibescore-ingest');

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

  const req = new Request('http://localhost/functions/vibescore-ingest', {
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
  assert.equal(typeof getCall.init?.headers?.['x-vibescore-device-token-hash'], 'string');
  assert.equal(getCall.init?.headers?.['x-vibescore-device-token-hash'].length, 64);

  assert.ok(postCall, 'hourly upsert call not found');
  assert.ok(String(postCall.url).includes('/api/database/records/vibescore_tracker_hourly'));
  assert.equal(postCall.init?.method, 'POST');
  assert.equal(postCall.init?.headers?.Prefer, 'return=representation,resolution=merge-duplicates');
  const postUrl = new URL(postCall.url);
  assert.equal(postUrl.searchParams.get('on_conflict'), 'user_id,device_id,source,hour_start');
  assert.equal(postUrl.searchParams.get('select'), 'hour_start');

  assert.ok(touchCall, 'touch RPC call not found');
  assert.ok(String(touchCall.url).includes('/api/database/rpc/vibescore_touch_device_token_sync'));
  assert.equal(touchCall.init?.method, 'POST');
  assert.equal(touchCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(touchCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
  assert.equal(typeof touchCall.init?.headers?.['x-vibescore-device-token-hash'], 'string');

  assert.ok(metricsCall, 'ingest batch metrics call not found');
  assert.ok(String(metricsCall.url).includes('/api/database/records/vibescore_tracker_ingest_batches'));
  assert.equal(metricsCall.init?.method, 'POST');
  assert.equal(metricsCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(metricsCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
});

test('vibescore-ingest anonKey path errors when hourly upsert unsupported', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibescore-ingest');

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

  const req = new Request('http://localhost/functions/vibescore-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket] })
  });

  const res = await fn(req);
  assert.equal(res.status, 500);

  const data = await res.json();
  assert.deepEqual(data, { error: 'unknown on_conflict' });
});

test('vibescore-usage-heatmap returns a week-aligned grid with derived fields', async () => {
  const fn = require('../insforge-functions/vibescore-usage-heatmap');

  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';

  const rows = [
    { hour_start: '2025-12-10T00:00:00.000Z', total_tokens: '10' },
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
            return {
              select: () => ({
                eq: (col, value) => {
                  assert.equal(col, 'user_id');
                  assert.equal(value, userId);
                  return {
                    gte: (gteCol, from) => {
                      assert.equal(gteCol, 'hour_start');
                      assert.equal(from, '2025-12-07T00:00:00.000Z');
                      return {
                        lt: (ltCol, to) => {
                          assert.equal(ltCol, 'hour_start');
                          assert.equal(to, '2025-12-19T00:00:00.000Z');
                          return {
                            order: async (orderCol, opts) => {
                              assert.equal(orderCol, 'hour_start');
                              assert.equal(opts?.ascending, true);
                              return { data: rows, error: null };
                            }
                          };
                        }
                      };
                    }
                  };
                }
              })
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibescore-usage-heatmap?weeks=2&to=2025-12-18&week_starts_on=sun',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

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
  assert.deepEqual(cell1210, { day: '2025-12-10', value: '10', level: 1 });

  const cell1212 = body.weeks[0][5];
  assert.deepEqual(cell1212, { day: '2025-12-12', value: '100', level: 2 });

  const cell1218 = body.weeks[1][4];
  assert.deepEqual(cell1218, { day: '2025-12-18', value: '1000', level: 4 });
});

test('vibescore-usage-heatmap rejects invalid parameters', async () => {
  const fn = require('../insforge-functions/vibescore-usage-heatmap');

  const req = new Request(
    'http://localhost/functions/vibescore-usage-heatmap?weeks=105&to=2025-13-40&week_starts_on=wat',
    {
      method: 'GET',
      headers: { Authorization: 'Bearer user_jwt_test' }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test('vibescore-usage-daily applies optional source filter', async () => {
  const fn = require('../insforge-functions/vibescore-usage-daily');

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
            const query = {
              eq: (col, value) => {
                filters.push({ op: 'eq', col, value });
                return query;
              },
              gte: (col, value) => {
                filters.push({ op: 'gte', col, value });
                return query;
              },
              lt: (col, value) => {
                filters.push({ op: 'lt', col, value });
                return query;
              },
              order: async (col, opts) => {
                filters.push({ op: 'order', col, opts });
                return { data: [], error: null };
              }
            };
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibescore-usage-daily?from=2025-12-20&to=2025-12-21&source=every-code',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'source' && f.value === 'every-code'));
});

test('vibescore-usage-daily treats empty source as missing', async () => {
  const fn = require('../insforge-functions/vibescore-usage-daily');

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
            const query = {
              eq: (col, value) => {
                filters.push({ op: 'eq', col, value });
                return query;
              },
              gte: (col, value) => {
                filters.push({ op: 'gte', col, value });
                return query;
              },
              lt: (col, value) => {
                filters.push({ op: 'lt', col, value });
                return query;
              },
              order: async (col, opts) => {
                filters.push({ op: 'order', col, opts });
                return { data: [], error: null };
              }
            };
            return { select: () => query };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibescore-usage-daily?from=2025-12-20&to=2025-12-21&source=',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(filters.some((f) => f.op === 'eq' && f.col === 'user_id' && f.value === userId));
  assert.ok(!filters.some((f) => f.op === 'eq' && f.col === 'source'));
});

test('vibescore-usage-hourly aggregates half-hour buckets into half-hour totals', async () => {
  const fn = require('../insforge-functions/vibescore-usage-hourly');

  const userId = '77777777-7777-7777-7777-777777777777';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      hour_start: '2025-12-21T01:00:00.000Z',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2'
    },
    {
      hour_start: '2025-12-21T01:00:00.000Z',
      total_tokens: '2',
      input_tokens: '1',
      cached_input_tokens: '0',
      output_tokens: '1',
      reasoning_output_tokens: '0'
    },
    {
      hour_start: '2025-12-21T13:00:00.000Z',
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
                return {
                  eq: (col, value) => {
                    assert.equal(col, 'user_id');
                    assert.equal(value, userId);
                    return {
                      gte: (gteCol, from) => {
                        assert.equal(gteCol, 'hour_start');
                        assert.equal(from, '2025-12-21T00:00:00.000Z');
                        return {
                          lt: (ltCol, to) => {
                            assert.equal(ltCol, 'hour_start');
                            assert.equal(to, '2025-12-22T00:00:00.000Z');
                            return {
                              order: async (orderCol, opts) => {
                                assert.equal(opts?.ascending, true);
                                if (isAggregate) {
                                  assert.equal(orderCol, 'hour');
                                  return { data: null, error: { message: 'not supported' } };
                                }
                                assert.equal(orderCol, 'hour_start');
                                return { data: rows, error: null };
                              }
                            };
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request('http://localhost/functions/vibescore-usage-hourly?day=2025-12-21', {
    method: 'GET',
    headers: { Authorization: `Bearer ${userJwt}` }
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.day, '2025-12-21');
  assert.equal(body.data.length, 48);
  assert.equal(body.data[2].total_tokens, '12');
  assert.equal(body.data[2].input_tokens, '5');
  assert.equal(body.data[2].output_tokens, '4');
  assert.equal(body.data[26].total_tokens, '5');
});

test('vibescore-usage-monthly aggregates hourly rows into months', async () => {
  const fn = require('../insforge-functions/vibescore-usage-monthly');

  const userId = '88888888-8888-8888-8888-888888888888';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      hour_start: '2025-11-05T00:00:00.000Z',
      total_tokens: '10',
      input_tokens: '4',
      cached_input_tokens: '1',
      output_tokens: '3',
      reasoning_output_tokens: '2'
    },
    {
      hour_start: '2025-11-20T00:00:00.000Z',
      total_tokens: '5',
      input_tokens: '2',
      cached_input_tokens: '1',
      output_tokens: '1',
      reasoning_output_tokens: '1'
    },
    {
      hour_start: '2025-12-01T00:00:00.000Z',
      total_tokens: '7',
      input_tokens: '3',
      cached_input_tokens: '1',
      output_tokens: '2',
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
              select: () => ({
                eq: (col, value) => {
                  assert.equal(col, 'user_id');
                  assert.equal(value, userId);
                  return {
                    gte: (gteCol, from) => {
                      assert.equal(gteCol, 'hour_start');
                      assert.equal(from, '2025-11-01T00:00:00.000Z');
                      return {
                        lt: (ltCol, to) => {
                          assert.equal(ltCol, 'hour_start');
                          assert.equal(to, '2025-12-22T00:00:00.000Z');
                          return {
                            order: async (orderCol, opts) => {
                              assert.equal(orderCol, 'hour_start');
                              assert.equal(opts?.ascending, true);
                              return { data: rows, error: null };
                            }
                          };
                        }
                      };
                    }
                  };
                }
              })
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibescore-usage-monthly?months=2&to=2025-12-21',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.from, '2025-11-01');
  assert.equal(body.to, '2025-12-21');
  assert.equal(body.months, 2);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].month, '2025-11');
  assert.equal(body.data[0].total_tokens, '15');
  assert.equal(body.data[1].month, '2025-12');
  assert.equal(body.data[1].total_tokens, '7');
});

test('vibescore-usage-summary returns total_cost_usd and pricing metadata', async () => {
  const fn = require('../insforge-functions/vibescore-usage-summary');

  const userId = '99999999-9999-9999-9999-999999999999';
  const userJwt = 'user_jwt_test';

  const rows = [
    {
      hour_start: '2025-12-21T01:00:00.000Z',
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
            return {
              select: () => ({
                eq: (col, value) => {
                  assert.equal(col, 'user_id');
                  assert.equal(value, userId);
                  return {
                    gte: (gteCol, from) => {
                      assert.equal(gteCol, 'hour_start');
                      assert.equal(from, '2025-12-21T00:00:00.000Z');
                      return {
                        lt: (ltCol, to) => {
                          assert.equal(ltCol, 'hour_start');
                          assert.equal(to, '2025-12-22T00:00:00.000Z');
                          return {
                            order: async (orderCol, opts) => {
                              assert.equal(orderCol, 'hour_start');
                              assert.equal(opts?.ascending, true);
                              return { data: rows, error: null };
                            }
                          };
                        }
                      };
                    }
                  };
                }
              })
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibescore-usage-summary?from=2025-12-21&to=2025-12-21',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.from, '2025-12-21');
  assert.equal(body.to, '2025-12-21');
  assert.equal(body.totals.total_tokens, '1500000');
  assert.equal(body.totals.total_cost_usd, '8.435000');
  assert.equal(body.pricing.model, 'gpt-5.2-codex');
  assert.equal(body.pricing.pricing_mode, 'overlap');
  assert.equal(body.pricing.rates_per_million_usd.cached_input, '0.175000');
});

test('vibescore-usage-summary prefers jwt payload to avoid auth roundtrip', async () => {
  const fn = require('../insforge-functions/vibescore-usage-summary');

  const userId = '77777777-7777-7777-7777-777777777777';
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: 1893456000 })).toString('base64url');
  const userJwt = `header.${payload}.sig`;

  const rows = [
    {
      hour_start: '2025-12-21T01:00:00.000Z',
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
            return { data: { user: { id: 'should-not-be-used' } }, error: null };
          }
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_hourly');
            return {
              select: () => ({
                eq: (col, value) => {
                  assert.equal(col, 'user_id');
                  assert.equal(value, userId);
                  return {
                    gte: () => ({
                      lt: () => ({
                        order: async () => ({ data: rows, error: null })
                      })
                    })
                  };
                }
              })
            };
          }
        }
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    'http://localhost/functions/vibescore-usage-summary?from=2025-12-21&to=2025-12-21',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  assert.equal(authCalls, 0, 'expected jwt payload to skip auth.getCurrentUser');
});

test('vibescore-leaderboard returns a week window and slices entries to limit', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibescore-leaderboard');

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

  const req = new Request('http://localhost/functions/vibescore-leaderboard?period=week&limit=1', {
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

test('vibescore-leaderboard uses system earliest day for total window', async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY
  });

  const fn = require('../insforge-functions/vibescore-leaderboard');

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

  const req = new Request('http://localhost/functions/vibescore-leaderboard?period=total', {
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

test('vibescore-leaderboard rejects invalid period', async () => {
  const fn = require('../insforge-functions/vibescore-leaderboard');

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

  const req = new Request('http://localhost/functions/vibescore-leaderboard?period=year', {
    method: 'GET',
    headers: { Authorization: 'Bearer user_jwt_test' }
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test('vibescore-leaderboard-settings inserts user setting row', async () => {
  const fn = require('../insforge-functions/vibescore-leaderboard-settings');

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

  const req = new Request('http://localhost/functions/vibescore-leaderboard-settings', {
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

test('vibescore-leaderboard-settings updates existing row', async () => {
  const fn = require('../insforge-functions/vibescore-leaderboard-settings');

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

  const req = new Request('http://localhost/functions/vibescore-leaderboard-settings', {
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

test('vibescore-leaderboard-settings rejects invalid body', async () => {
  const fn = require('../insforge-functions/vibescore-leaderboard-settings');

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

  const req = new Request('http://localhost/functions/vibescore-leaderboard-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: 'yes' })
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});
