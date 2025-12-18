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

test('vibescore-ingest uses serviceRoleKey as edgeFunctionToken and ingests events', async () => {
  const fn = require('../insforge-functions/vibescore-ingest');

  const calls = [];
  const insertedEvents = [];

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

    if (table === 'vibescore_tracker_events') {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [], error: null })
          })
        }),
        insert: async (rows) => {
          insertedEvents.push(...rows);
          return { error: null };
        }
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

  const deviceToken = 'device_token_test';
  const ev = {
    event_id: 'e1',
    token_timestamp: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    model: 'gpt-test',
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = new Request('http://localhost/functions/vibescore-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ events: [ev, ev] })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { success: true, inserted: 1, skipped: 0 });
  assert.equal(insertedEvents.length, 1);

  const serviceClientCall = calls.find((c) => c && c.edgeFunctionToken === SERVICE_ROLE_KEY);
  assert.ok(serviceClientCall, 'service client not created');
  assert.equal(serviceClientCall.baseUrl, BASE_URL);
  assert.equal(serviceClientCall.anonKey, ANON_KEY);
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

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_events')) {
      return new Response(JSON.stringify([{ event_id: 'e1' }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('not found', { status: 404 });
  };

  const deviceToken = 'device_token_test';
  const ev = {
    event_id: 'e1',
    token_timestamp: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    model: 'gpt-test',
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = new Request('http://localhost/functions/vibescore-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ events: [ev] })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { success: true, inserted: 1, skipped: 0 });

  assert.equal(fetchCalls.length, 2);
  const getCall = fetchCalls[0];
  const postCall = fetchCalls[1];

  assert.ok(String(getCall.url).includes('/api/database/records/vibescore_tracker_device_tokens'));
  assert.equal(getCall.init?.method, 'GET');
  assert.equal(getCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(getCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
  assert.equal(typeof getCall.init?.headers?.['x-vibescore-device-token-hash'], 'string');
  assert.equal(getCall.init?.headers?.['x-vibescore-device-token-hash'].length, 64);

  assert.ok(String(postCall.url).includes('/api/database/records/vibescore_tracker_events'));
  assert.equal(postCall.init?.method, 'POST');
  assert.equal(postCall.init?.headers?.Prefer, 'return=minimal');
});

test('vibescore-ingest anonKey path falls back to per-row inserts on 23505', async () => {
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

  let postCount = 0;
  globalThis.fetch = async (url, init) => {
    const u = new URL(url);

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_device_tokens')) {
      return new Response(JSON.stringify([tokenRow]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (u.pathname.endsWith('/api/database/records/vibescore_tracker_events')) {
      postCount += 1;
      if (postCount === 1) {
        return new Response(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (postCount === 2) {
        return new Response('[]', { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (postCount === 3) {
        return new Response(JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('unexpected', { status: 500 });
    }

    return new Response('not found', { status: 404 });
  };

  const deviceToken = 'device_token_test';
  const baseEvent = {
    token_timestamp: new Date('2025-12-17T00:00:00.000Z').toISOString(),
    model: 'gpt-test',
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  const req = new Request('http://localhost/functions/vibescore-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({
      events: [
        { ...baseEvent, event_id: 'e1' },
        { ...baseEvent, event_id: 'e2' }
      ]
    })
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { success: true, inserted: 1, skipped: 1 });
  assert.equal(postCount, 3);
});

test('vibescore-usage-heatmap returns a week-aligned grid with derived fields', async () => {
  const fn = require('../insforge-functions/vibescore-usage-heatmap');

  const userId = '55555555-5555-5555-5555-555555555555';
  const userJwt = 'user_jwt_test';

  const rows = [
    { day: '2025-12-10', total_tokens: '10' },
    { day: '2025-12-11', total_tokens: '10' },
    { day: '2025-12-12', total_tokens: '100' },
    { day: '2025-12-18', total_tokens: '1000' }
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            assert.equal(table, 'vibescore_tracker_daily');
            return {
              select: () => ({
                eq: (col, value) => {
                  assert.equal(col, 'user_id');
                  assert.equal(value, userId);
                  return {
                    gte: (gteCol, from) => {
                      assert.equal(gteCol, 'day');
                      assert.equal(from, '2025-12-07');
                      return {
                        lte: (lteCol, to) => {
                          assert.equal(lteCol, 'day');
                          assert.equal(to, '2025-12-18');
                          return {
                            order: async (orderCol, opts) => {
                              assert.equal(orderCol, 'day');
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
