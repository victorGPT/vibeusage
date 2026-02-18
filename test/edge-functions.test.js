const assert = require("node:assert/strict");
const { createHash, createHmac, webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { test, beforeEach, afterEach } = require("node:test");

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const SERVICE_ROLE_KEY = "srk_test_123";
const ANON_KEY = "anon_test_123";
const BASE_URL = "http://insforge:7130";
const JWT_SECRET = "jwt_secret_test";

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createJwt(payload) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function createHmacSha256(data, secret) {
  return createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmacSha256(data, secret);
  return `${data}.${signature}`;
}

function createUserJwt(userId, { expiresInSeconds = 3600 } = {}) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return signJwt({ sub: userId, exp }, JWT_SECRET);
}

function setDenoEnv(env) {
  const merged = { INSFORGE_JWT_SECRET: JWT_SECRET, ...env };
  globalThis.Deno = {
    env: {
      get(key) {
        return Object.prototype.hasOwnProperty.call(merged, key) ? merged[key] : undefined;
      },
    },
  };
}

test("vibeusage function sources are not wrapper shims", () => {
  const functionsDir = path.join(__dirname, "..", "insforge-src", "functions");
  const entries = fs
    .readdirSync(functionsDir)
    .filter((name) => name.startsWith("vibeusage-") && name.endsWith(".js"));
  assert.ok(entries.length > 0, "expected vibeusage function sources");
  const wrapperPattern = /module\.exports\s*=\s*require\(['"]\.\/vibescore-/;
  for (const entry of entries) {
    const content = fs.readFileSync(path.join(functionsDir, entry), "utf8");
    assert.equal(wrapperPattern.test(content), false, `${entry} still wraps vibescore`);
  }
});

test("env exposes INSFORGE_JWT_SECRET via getJwtSecret", () => {
  setDenoEnv({ INSFORGE_JWT_SECRET: JWT_SECRET });
  const { getJwtSecret } = require("../insforge-src/shared/env");
  assert.equal(getJwtSecret(), JWT_SECRET);
});

test("local jwt verification accepts valid HS256 token", async () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const jwt = signJwt({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  setDenoEnv({ INSFORGE_JWT_SECRET: JWT_SECRET, INSFORGE_ANON_KEY: ANON_KEY });
  const { verifyUserJwtHs256 } = require("../insforge-src/shared/auth");
  const res = await verifyUserJwtHs256({ token: jwt });
  assert.equal(res.ok, true);
  assert.equal(res.userId, userId);
});

test("local jwt verification rejects token without exp", async () => {
  const userId = "11111111-1111-1111-1111-111111111112";
  const jwt = signJwt({ sub: userId }, JWT_SECRET);
  setDenoEnv({ INSFORGE_JWT_SECRET: JWT_SECRET, INSFORGE_ANON_KEY: ANON_KEY });
  const { verifyUserJwtHs256 } = require("../insforge-src/shared/auth");
  const res = await verifyUserJwtHs256({ token: jwt });
  assert.equal(res.ok, false);
  assert.equal(res.error, "Missing exp");
});

test("local jwt verification rejects expired token", async () => {
  const userId = "22222222-2222-2222-2222-222222222222";
  const jwt = signJwt({ sub: userId, exp: Math.floor(Date.now() / 1000) - 10 }, JWT_SECRET);
  setDenoEnv({ INSFORGE_JWT_SECRET: JWT_SECRET, INSFORGE_ANON_KEY: ANON_KEY });
  const { verifyUserJwtHs256 } = require("../insforge-src/shared/auth");
  const res = await verifyUserJwtHs256({ token: jwt });
  assert.equal(res.ok, false);
});

test("local jwt verification rejects when secret missing", async () => {
  const userId = "22222222-2222-2222-2222-222222222223";
  const jwt = signJwt({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  setDenoEnv({ INSFORGE_JWT_SECRET: undefined, INSFORGE_ANON_KEY: ANON_KEY });
  const { verifyUserJwtHs256 } = require("../insforge-src/shared/auth");
  const res = await verifyUserJwtHs256({ token: jwt });
  assert.equal(res.ok, false);
  assert.equal(res.code, "missing_jwt_secret");
});

test("getEdgeClientAndUserIdFast falls back to remote auth when jwt secret missing", async () => {
  const userId = "22222222-2222-2222-2222-222222222224";
  const userJwt = createUserJwt(userId);
  let authCalls = 0;

  globalThis.createClient = () => ({
    auth: {
      getCurrentUser: async () => {
        authCalls += 1;
        return { data: { user: { id: userId } }, error: null };
      },
    },
  });

  setDenoEnv({ INSFORGE_JWT_SECRET: undefined, INSFORGE_ANON_KEY: ANON_KEY });
  const { getEdgeClientAndUserIdFast } = require("../insforge-src/shared/auth");
  const res = await getEdgeClientAndUserIdFast({ baseUrl: BASE_URL, bearer: userJwt });
  assert.equal(res.ok, true);
  assert.equal(res.userId, userId);
  assert.equal(authCalls, 1);
});

test("getEdgeClientAndUserIdFast rejects when auth lookup fails", async () => {
  const userId = "33333333-3333-3333-3333-333333333333";
  const userJwt = createUserJwt(userId);
  let authCalls = 0;

  globalThis.createClient = () => ({
    auth: {
      getCurrentUser: async () => {
        authCalls += 1;
        return { data: { user: null }, error: { message: "User missing" } };
      },
    },
  });

  const { getEdgeClientAndUserIdFast } = require("../insforge-src/shared/auth");
  const res = await getEdgeClientAndUserIdFast({ baseUrl: BASE_URL, bearer: userJwt });
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.equal(authCalls, 1);
});

test("getEdgeClientAndUserIdFast returns 503 when auth lookup fails transiently", async () => {
  const userId = "33333333-3333-3333-3333-333333333334";
  const userJwt = createUserJwt(userId);
  let authCalls = 0;

  globalThis.createClient = () => ({
    auth: {
      getCurrentUser: async () => {
        authCalls += 1;
        throw new Error("socket hang up");
      },
    },
  });

  const { getEdgeClientAndUserIdFast } = require("../insforge-src/shared/auth");
  const res = await getEdgeClientAndUserIdFast({ baseUrl: BASE_URL, bearer: userJwt });
  assert.equal(res.ok, false);
  assert.equal(res.status, 503);
  assert.equal(res.error, "Service unavailable");
  assert.equal(authCalls, 1);
});

test("vibeusage-usage-summary returns 503 when auth lookup fails transiently", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-summary");

  const userId = "33333333-3333-3333-3333-333333333335";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => {
            throw new Error("socket hang up");
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-summary?from=2026-02-09&to=2026-02-09",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, "Service unavailable");
});

test("vibeusage-debug-auth accepts locally verified jwt", async () => {
  const fn = require("../insforge-functions/vibeusage-debug-auth");
  const userId = "33333333-3333-3333-3333-333333333333";
  const userJwt = createUserJwt(userId);
  globalThis.createClient = () => {
    throw new Error("createClient should not be called");
  };

  const req = new Request("http://localhost/functions/vibeusage-debug-auth", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.hasAnonKey, true);
  assert.equal(body.hasBearer, true);
  assert.equal(body.authOk, true);
  assert.equal(body.userId, userId);
});

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
        },
      }),
      select: (columns) => {
        const q = { table, columns, filters: [] };
        selects.push(q);
        return {
          eq: (col, value) => {
            q.filters.push({ op: "eq", col, value });
            return {
              in: async (inCol, values) => {
                q.filters.push({ op: "in", col: inCol, value: values });
                return { data: [], error: null };
              },
              maybeSingle: async () => ({ data: null, error: null }),
            };
          },
        };
      },
    };
  }

  return {
    db: { from },
    inserts,
    updates,
    selects,
  };
}

function createQueryMock({ rows = [], onFilter } = {}) {
  const record = (entry) => {
    if (typeof onFilter === "function") onFilter(entry);
  };

  const query = {
    select: () => query,
    eq: (col, value) => {
      record({ op: "eq", col, value });
      return query;
    },
    neq: (col, value) => {
      record({ op: "neq", col, value });
      return query;
    },
    gte: (col, value) => {
      record({ op: "gte", col, value });
      return query;
    },
    lt: (col, value) => {
      record({ op: "lt", col, value });
      return query;
    },
    lte: (col, value) => {
      record({ op: "lte", col, value });
      return query;
    },
    in: (col, values) => {
      record({ op: "in", col, values });
      return query;
    },
    or: (value) => {
      record({ op: "or", value });
      return query;
    },
    order: (col, opts) => {
      record({ op: "order", col, opts });
      return query;
    },
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    range: async () => ({ data: rows, error: null }),
    limit: async () => ({ data: rows.slice(0, 1), error: null }),
    data: rows,
    error: null,
    then: (onFulfilled, onRejected) =>
      Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected),
  };

  return query;
}

function withRollupEnabled(fn) {
  const prevNew = process.env.VIBEUSAGE_ROLLUP_ENABLED;

  process.env.VIBEUSAGE_ROLLUP_ENABLED = "1";

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prevNew === undefined) delete process.env.VIBEUSAGE_ROLLUP_ENABLED;
      else process.env.VIBEUSAGE_ROLLUP_ENABLED = prevNew;
    });
}

function withRollupDisabled(fn) {
  const prevNew = process.env.VIBEUSAGE_ROLLUP_ENABLED;

  delete process.env.VIBEUSAGE_ROLLUP_ENABLED;

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prevNew === undefined) delete process.env.VIBEUSAGE_ROLLUP_ENABLED;
      else process.env.VIBEUSAGE_ROLLUP_ENABLED = prevNew;
    });
}

function createEntitlementsDbMock(options = {}) {
  const inserts = [];
  const rows = new Map();
  const seedRows = Array.isArray(options.seedRows) ? options.seedRows : [];
  const failOnDuplicate = options.failOnDuplicate !== false;
  const normalizeUserId = options.normalizeUserId === true;
  const conflictRow =
    options.conflictRow && typeof options.conflictRow.id === "string" ? options.conflictRow : null;
  const duplicateError = options.duplicateError || {
    message: 'duplicate key value violates unique constraint "vibeusage_user_entitlements_pkey"',
    code: "23505",
  };
  let conflictArmed = Boolean(conflictRow);

  const normalizeRow = (row) => {
    if (!normalizeUserId || !row || typeof row.user_id !== "string") return row;
    return { ...row, user_id: row.user_id.toLowerCase() };
  };

  for (const row of seedRows) {
    if (row && typeof row.id === "string") rows.set(row.id, normalizeRow(row));
  }

  function from(table) {
    if (table === "vibeusage_user_entitlements") {
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
              if (row && typeof row.id === "string" && rows.has(row.id)) {
                return { error: duplicateError };
              }
            }
          }
          for (const row of newRows) {
            if (row && typeof row.id === "string") rows.set(row.id, normalizeRow(row));
          }
          return { error: null };
        },
        select: () => ({
          eq: (col, value) => ({
            maybeSingle: async () => {
              if (col !== "id") return { data: null, error: null };
              return { data: rows.get(value) || null, error: null };
            },
          }),
        }),
      };
    }

    return {
      insert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  }

  return {
    db: { from },
    inserts,
    rows,
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
      if (filter.op === "eq") return target[filter.col] === filter.value;
      if (filter.op === "is") {
        if (filter.value === null) return target[filter.col] == null;
        return target[filter.col] === filter.value;
      }
      return false;
    });
  }

  function from(table) {
    if (table === "vibeusage_link_codes") {
      return {
        select: (columns) => {
          const q = { table, columns, filters: [] };
          return {
            eq: (col, value) => {
              q.filters.push({ op: "eq", col, value });
              return {
                maybeSingle: async () => ({
                  data: matchesFilters(row, q.filters) ? row : null,
                  error: null,
                }),
              };
            },
          };
        },
        update: (values) => {
          const q = { table, values, filters: [] };
          const builder = {
            eq: (col, value) => {
              q.filters.push({ op: "eq", col, value });
              return builder;
            },
            is: (col, value) => {
              q.filters.push({ op: "is", col, value });
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
            },
          };
          return builder;
        },
      };
    }

    if (table === "vibeusage_tracker_devices" || table === "vibeusage_tracker_device_tokens") {
      return {
        insert: async (rows) => {
          inserts.push({ table, rows });
          return { error: null };
        },
        delete: () => ({
          eq: async (col, value) => {
            deletes.push({ table, col, value });
            return { error: null };
          },
        }),
      };
    }

    return {
      insert: async () => ({ error: null }),
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
    };
  }

  return {
    db: { from },
    inserts,
    updates,
    deletes,
    getRow: () => row,
  };
}

const ORIGINAL_DENO = globalThis.Deno;
const ORIGINAL_CREATE_CLIENT = globalThis.createClient;
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  setDenoEnv({
    SERVICE_ROLE_KEY,
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
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

test("vibeusage-device-token-issue works without serviceRoleKey (user mode)", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-device-token-issue");

  const calls = [];
  const db = createServiceDbMock();
  const userId = "11111111-1111-1111-1111-111111111111";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    calls.push(args);

    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: db.db,
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-device-token-issue", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ device_name: "test-mac", platform: "macos" }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(typeof data.device_id, "string");
  assert.equal(typeof data.token, "string");

  assert.equal(calls.length, 1, "expected only one createClient call");

  const deviceInsert = db.inserts.find((i) => i.table === "vibeusage_tracker_devices");
  assert.ok(deviceInsert, "device insert not performed");
  assert.equal(deviceInsert.rows?.[0]?.user_id, userId);

  const tokenInsert = db.inserts.find((i) => i.table === "vibeusage_tracker_device_tokens");
  assert.ok(tokenInsert, "token insert not performed");
});

test("vibeusage-device-token-issue admin mode skips user lookup", async () => {
  const fn = require("../insforge-functions/vibeusage-device-token-issue");

  const calls = [];
  const service = createServiceDbMock();
  const adminUserId = "22222222-2222-2222-2222-222222222222";

  globalThis.createClient = (args) => {
    calls.push(args);
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: service.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-device-token-issue", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ user_id: adminUserId, device_name: "admin-mac", platform: "macos" }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  assert.equal(calls.length, 1, "expected only service client createClient call in admin mode");

  const deviceInsert = service.inserts.find((i) => i.table === "vibeusage_tracker_devices");
  assert.ok(deviceInsert, "device insert not performed");
  assert.equal(deviceInsert.rows?.[0]?.user_id, adminUserId);
});

test("vibeusage-ingest uses serviceRoleKey as edgeFunctionToken and ingests hourly aggregates", async () => {
  const fn = require("../insforge-functions/vibeusage-ingest");

  const calls = [];
  const fetchCalls = [];

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  function from(table) {
    if (table === "vibeusage_tracker_device_tokens") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }

    if (table === "vibeusage_tracker_devices") {
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
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

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const deviceToken = "device_token_test";
  const bucket = {
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 1,
    cached_input_tokens: 1,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 4,
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket, bucket] }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, {
    success: true,
    inserted: 1,
    skipped: 0,
    project_inserted: 0,
    project_skipped: 0,
  });
  assert.equal(fetchCalls.length, 1);
  const postCall = fetchCalls[0];
  const postUrl = new URL(postCall.url);
  assert.ok(String(postCall.url).includes("/api/database/records/vibeusage_tracker_hourly"));
  assert.equal(postCall.init?.method, "POST");
  assert.equal(postCall.init?.headers?.apikey, SERVICE_ROLE_KEY);
  assert.equal(postCall.init?.headers?.Authorization, `Bearer ${SERVICE_ROLE_KEY}`);
  assert.equal(postCall.init?.headers?.Prefer, "return=representation,resolution=merge-duplicates");
  assert.equal(
    postUrl.searchParams.get("on_conflict"),
    "user_id,device_id,source,model,hour_start",
  );
  assert.equal(postUrl.searchParams.get("select"), "hour_start");

  const postBody = JSON.parse(postCall.init?.body || "[]");
  assert.equal(postBody.length, 1);
  assert.equal(postBody[0]?.hour_start, bucket.hour_start);
  assert.equal(postBody[0]?.source, "codex");
  assert.equal(postBody[0]?.model, "unknown");
  assert.equal(postBody[0]?.billable_total_tokens, "3");
  assert.equal(postBody[0]?.billable_rule_version, 1);

  const serviceClientCall = calls.find((c) => c && c.edgeFunctionToken === SERVICE_ROLE_KEY);
  assert.ok(serviceClientCall, "service client not created");
  assert.equal(serviceClientCall.baseUrl, BASE_URL);
  assert.equal(serviceClientCall.anonKey, ANON_KEY);
});

test("vibeusage-ingest ingests project_hourly buckets and upserts project registry", async () => {
  const fn = require("../insforge-functions/vibeusage-ingest");

  const calls = [];
  const fetchCalls = [];

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  function from(table) {
    if (table === "vibeusage_tracker_device_tokens") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }

    if (table === "vibeusage_tracker_devices") {
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
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

    if (u.pathname.endsWith("/api/database/records/vibeusage_project_usage_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_projects")) {
      return new Response(JSON.stringify([{ project_key: "https://github.com/acme/alpha" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const deviceToken = "device_token_test";
  const projectBucket = {
    project_ref: "https://github.com/acme/alpha",
    project_key: "https://github.com/acme/alpha",
    source: "claude",
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 3,
    cached_input_tokens: 2,
    output_tokens: 1,
    reasoning_output_tokens: 0,
    total_tokens: 6,
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [], project_hourly: [projectBucket] }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, {
    success: true,
    inserted: 0,
    skipped: 0,
    project_inserted: 1,
    project_skipped: 0,
  });

  const projectUsageCall = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_project_usage_hourly"),
  );
  assert.ok(projectUsageCall, "project usage upsert missing");
  const usageUrl = new URL(projectUsageCall.url);
  assert.equal(usageUrl.searchParams.get("on_conflict"), "user_id,project_key,hour_start,source");

  const usageRows = JSON.parse(projectUsageCall.init?.body || "[]");
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0]?.project_ref, projectBucket.project_ref);
  assert.equal(usageRows[0]?.project_key, projectBucket.project_key);
  assert.equal(usageRows[0]?.total_tokens, 6);
  assert.equal(usageRows[0]?.billable_total_tokens, "6");
  assert.equal(usageRows[0]?.billable_rule_version, 1);

  const projectRegistryCall = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_projects"),
  );
  assert.ok(projectRegistryCall, "project registry upsert missing");
  const registryUrl = new URL(projectRegistryCall.url);
  assert.equal(registryUrl.searchParams.get("on_conflict"), "user_id,project_key");

  const registryRows = JSON.parse(projectRegistryCall.init?.body || "[]");
  assert.equal(registryRows.length, 1);
  assert.equal(registryRows[0]?.user_id, tokenRow.user_id);
  assert.equal(registryRows[0]?.device_id, tokenRow.device_id);
  assert.equal(registryRows[0]?.device_token_id, tokenRow.id);
  assert.equal(registryRows[0]?.project_key, projectBucket.project_key);
  assert.equal(registryRows[0]?.project_ref, projectBucket.project_ref);
  assert.equal(registryRows[0]?.source, projectBucket.source);
  assert.ok(registryRows[0]?.updated_at, "updated_at missing");
  assert.ok(registryRows[0]?.last_seen_at, "last_seen_at missing");
});

test("vibeusage-ingest accepts wrapped payload with data.hourly", async () => {
  const fn = require("../insforge-functions/vibeusage-ingest");

  const calls = [];
  const fetchCalls = [];

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  function from(table) {
    if (table === "vibeusage_tracker_device_tokens") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }

    if (table === "vibeusage_tracker_devices") {
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
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

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const deviceToken = "device_token_test";
  const bucket = {
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ data: { hourly: [bucket] } }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, {
    success: true,
    inserted: 1,
    skipped: 0,
    project_inserted: 0,
    project_skipped: 0,
  });
  assert.equal(fetchCalls.length, 1);
  const postCall = fetchCalls[0];
  assert.ok(String(postCall.url).includes("/api/database/records/vibeusage_tracker_hourly"));
  const postBody = JSON.parse(postCall.init?.body || "[]");
  assert.equal(postBody.length, 1);
  assert.equal(postBody[0]?.source, "codex");

  const serviceClientCall = calls.find((c) => c && c.edgeFunctionToken === SERVICE_ROLE_KEY);
  assert.ok(serviceClientCall, "service client not created");
});

test("vibeusage-ingest accepts project_hourly alongside hourly payloads", async () => {
  const fn = require("../insforge-functions/vibeusage-ingest");

  const calls = [];
  const fetchCalls = [];

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  function from(table) {
    if (table === "vibeusage_tracker_device_tokens") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }

    if (table === "vibeusage_tracker_devices") {
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
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

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_project_usage_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:30:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_projects")) {
      return new Response(JSON.stringify([{ project_key: "proj_1" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const deviceToken = "device_token_test";
  const bucket = {
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  };

  const projectBucket = {
    hour_start: new Date("2025-12-17T00:30:00.000Z").toISOString(),
    source: "codex",
    project_key: "proj_1",
    project_ref: "https://github.com/victorGPT/vibeusage",
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket], project_hourly: [projectBucket] }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, {
    success: true,
    inserted: 1,
    skipped: 0,
    project_inserted: 1,
    project_skipped: 0,
  });

  const projectUpsert = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_project_usage_hourly"),
  );
  assert.ok(projectUpsert, "project hourly upsert call not found");
  const projectUrl = new URL(projectUpsert.url);
  assert.equal(projectUrl.searchParams.get("on_conflict"), "user_id,project_key,hour_start,source");
  const projectBody = JSON.parse(projectUpsert.init?.body || "[]");
  assert.equal(projectBody.length, 1);
  assert.equal(projectBody[0]?.project_key, "proj_1");
  assert.equal(projectBody[0]?.project_ref, "https://github.com/victorGPT/vibeusage");
});

test("vibeusage-ingest upserts device subscriptions when provided", async () => {
  const fn = require("../insforge-functions/vibeusage-ingest");

  const fetchCalls = [];
  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  function from(table) {
    if (table === "vibeusage_tracker_device_tokens") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tokenRow, error: null }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }

    if (table === "vibeusage_tracker_devices") {
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: { from } };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    const u = new URL(url);

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_subscriptions")) {
      return new Response(
        JSON.stringify([{ tool: "codex", provider: "openai", product: "chatgpt" }]),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response("not found", { status: 404 });
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer device_token_test" },
    body: JSON.stringify({
      hourly: [
        {
          hour_start: "2025-12-17T00:00:00.000Z",
          source: "codex",
          model: "unknown",
          input_tokens: 1,
          cached_input_tokens: 0,
          output_tokens: 1,
          reasoning_output_tokens: 0,
          total_tokens: 2,
        },
      ],
      device_subscriptions: [
        { tool: "codex", provider: "openai", product: "chatgpt", planType: "pro" },
        {
          tool: "claude",
          provider: "anthropic",
          product: "subscription",
          planType: "max",
          rateLimitTier: "default_claude_max_5x",
        },
      ],
    }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const subUpsert = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_tracker_subscriptions"),
  );
  assert.ok(subUpsert, "subscription upsert call not found");
  const subUrl = new URL(subUpsert.url);
  assert.equal(subUrl.searchParams.get("on_conflict"), "user_id,tool,provider,product");
  const subBody = JSON.parse(subUpsert.init?.body || "[]");
  assert.equal(subBody.length, 2);
  assert.equal(subBody[0]?.plan_type, "pro");
  assert.equal(subBody[1]?.plan_type, "max");
});

test("vibeusage-ingest works without serviceRoleKey via anonKey records API", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-ingest");

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  const fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    const u = new URL(url);

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_device_tokens")) {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify([{ ok: true }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify([tokenRow]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_devices")) {
      return new Response(JSON.stringify([{ ok: true }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_ingest_batches")) {
      return new Response(JSON.stringify([{ ok: true }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const deviceToken = "device_token_test";
  const bucket = {
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket] }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, {
    success: true,
    inserted: 1,
    skipped: 0,
    project_inserted: 0,
    project_skipped: 0,
  });

  assert.equal(fetchCalls.length, 5);
  const getCall = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_tracker_device_tokens"),
  );
  const postCall = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_tracker_hourly"),
  );
  const touchTokenCall = fetchCalls.find(
    (call) =>
      String(call.url).includes("/api/database/records/vibeusage_tracker_device_tokens") &&
      call.init?.method === "PATCH",
  );
  const touchDeviceCall = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_tracker_devices"),
  );
  const metricsCall = fetchCalls.find((call) =>
    String(call.url).includes("/api/database/records/vibeusage_tracker_ingest_batches"),
  );

  assert.ok(getCall, "device token fetch not found");
  assert.ok(String(getCall.url).includes("/api/database/records/vibeusage_tracker_device_tokens"));
  assert.equal(getCall.init?.method, "GET");
  assert.equal(getCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(getCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
  assert.equal(typeof getCall.init?.headers?.["x-vibeusage-device-token-hash"], "string");
  assert.equal(getCall.init?.headers?.["x-vibeusage-device-token-hash"].length, 64);

  assert.ok(postCall, "hourly upsert call not found");
  assert.ok(String(postCall.url).includes("/api/database/records/vibeusage_tracker_hourly"));
  assert.equal(postCall.init?.method, "POST");
  assert.equal(postCall.init?.headers?.Prefer, "return=representation,resolution=merge-duplicates");
  const postUrl = new URL(postCall.url);
  assert.equal(
    postUrl.searchParams.get("on_conflict"),
    "user_id,device_id,source,model,hour_start",
  );
  assert.equal(postUrl.searchParams.get("select"), "hour_start");

  assert.ok(touchTokenCall, "token touch call not found");
  assert.ok(
    String(touchTokenCall.url).includes("/api/database/records/vibeusage_tracker_device_tokens"),
  );
  assert.equal(touchTokenCall.init?.method, "PATCH");
  assert.equal(touchTokenCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(touchTokenCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
  assert.equal(typeof touchTokenCall.init?.headers?.["x-vibeusage-device-token-hash"], "string");

  assert.ok(touchDeviceCall, "device touch call not found");
  assert.ok(
    String(touchDeviceCall.url).includes("/api/database/records/vibeusage_tracker_devices"),
  );
  assert.equal(touchDeviceCall.init?.method, "PATCH");
  assert.equal(touchDeviceCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(touchDeviceCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);

  assert.ok(metricsCall, "ingest batch metrics call not found");
  assert.ok(
    String(metricsCall.url).includes("/api/database/records/vibeusage_tracker_ingest_batches"),
  );
  assert.equal(metricsCall.init?.method, "POST");
  assert.equal(metricsCall.init?.headers?.apikey, ANON_KEY);
  assert.equal(metricsCall.init?.headers?.Authorization, `Bearer ${ANON_KEY}`);
});

test("vibeusage-ingest returns 429 when concurrency limit exceeded", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    VIBEUSAGE_INGEST_MAX_INFLIGHT: "1",
    VIBEUSAGE_INGEST_RETRY_AFTER_MS: "1000",
  });

  delete require.cache[require.resolve("../insforge-functions/vibeusage-ingest")];
  const fn = require("../insforge-functions/vibeusage-ingest");

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  let releaseHold;
  const hold = new Promise((resolve) => {
    releaseHold = resolve;
  });

  globalThis.fetch = async (url) => {
    const u = new URL(url);

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_device_tokens")) {
      await hold;
      return new Response(JSON.stringify([tokenRow]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify([{ hour_start: "2025-12-17T00:00:00.000Z" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_ingest_batches")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/rpc/vibeusage_touch_device_token_sync")) {
      return new Response(JSON.stringify({ updated: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const bucket = {
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  };

  const req = () =>
    new Request("http://localhost/functions/vibeusage-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer device_token_test" },
      body: JSON.stringify({ hourly: [bucket] }),
    });

  const first = fn(req());
  await new Promise((resolve) => setTimeout(resolve, 10));
  const res2 = await fn(req());

  assert.equal(res2.status, 429);
  assert.equal(res2.headers.get("Retry-After"), "1");

  releaseHold();
  const res1 = await first;
  assert.equal(res1.status, 200);
});

test("vibeusage-ingest anonKey path errors when hourly upsert unsupported", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-ingest");

  const tokenRow = {
    id: "token-id",
    user_id: "33333333-3333-3333-3333-333333333333",
    device_id: "44444444-4444-4444-4444-444444444444",
    revoked_at: null,
  };

  globalThis.fetch = async (url, init) => {
    const u = new URL(url);

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_device_tokens")) {
      return new Response(JSON.stringify([tokenRow]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.pathname.endsWith("/api/database/records/vibeusage_tracker_hourly")) {
      return new Response(JSON.stringify({ message: "unknown on_conflict" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const deviceToken = "device_token_test";
  const bucket = {
    hour_start: new Date("2025-12-17T00:00:00.000Z").toISOString(),
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  };

  const req = new Request("http://localhost/functions/vibeusage-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ hourly: [bucket] }),
  });

  const res = await fn(req);
  assert.equal(res.status, 500);

  const data = await res.json();
  assert.deepEqual(data, { error: "unknown on_conflict" });
});

test("vibeusage-usage-heatmap returns a week-aligned grid with derived fields", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-heatmap");

  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: "2025-12-10T00:00:00.000Z",
      source: "codex",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "1",
      output_tokens: "3",
      reasoning_output_tokens: "1",
      billable_total_tokens: "9",
    },
    { hour_start: "2025-12-11T00:00:00.000Z", total_tokens: "10" },
    { hour_start: "2025-12-12T00:00:00.000Z", total_tokens: "60" },
    { hour_start: "2025-12-12T01:00:00.000Z", total_tokens: "40" },
    { hour_start: "2025-12-18T00:00:00.000Z", total_tokens: "1000" },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({
                rows,
                onFilter: (entry) => {
                  if (entry.op === "order") orders.push(entry);
                  else filters.push(entry);
                },
              });
              return {
                select: () => query,
              };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              const query = createQueryMock({ rows: [] });
              query.or = () => query;
              return query;
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-heatmap?weeks=2&to=2025-12-18&week_starts_on=sun",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
  assert.ok(
    filters.some(
      (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-07T00:00:00.000Z",
    ),
  );
  assert.ok(
    filters.some(
      (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-19T00:00:00.000Z",
    ),
  );
  assert.ok(orders.some((o) => o.col === "hour_start" && o.opts?.ascending === true));

  assert.equal(body.from, "2025-12-07");
  assert.equal(body.to, "2025-12-18");
  assert.equal(body.week_starts_on, "sun");
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
  assert.deepEqual(cell1210, { day: "2025-12-10", value: "9", level: 1 });

  const cell1212 = body.weeks[0][5];
  assert.deepEqual(cell1212, { day: "2025-12-12", value: "100", level: 2 });

  const cell1218 = body.weeks[1][4];
  assert.deepEqual(cell1218, { day: "2025-12-18", value: "1000", level: 4 });
});

test("vibeusage-usage-heatmap canonical model filter includes alias rows", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-heatmap");

  const userId = "33333333-3333-3333-3333-333333333333";
  const userJwt = createUserJwt(userId);
  const filters = [];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({
                rows: [],
                onFilter: (entry) => filters.push(entry),
              });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-heatmap?weeks=1&to=2025-01-07&week_starts_on=sun&model=gpt-4o",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const filterCalls = filters.filter((entry) => entry.op === "or");
  assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.gpt-4o-mini")));
});

test("vibeusage-usage-heatmap normalizes model for non-UTC alias filtering", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-heatmap");

  const userId = "33333333-3333-3333-3333-333333333333";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      hour_start: "2025-01-07T10:00:00.000Z",
      model: "OpenAI/GPT-4o-mini",
      billable_total_tokens: "10",
      total_tokens: "10",
    },
  ];

  const aliasRows = [
    {
      usage_model: "openai/gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-heatmap?weeks=1&to=2025-01-07&week_starts_on=sun&model=gpt-4o&tz=America/Los_Angeles",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const flat = body.weeks.flat().filter(Boolean);
  const dayCell = flat.find((cell) => cell.day === "2025-01-07");
  assert.ok(dayCell);
  assert.equal(dayCell.value, "10");
});

test("vibeusage-usage-heatmap honors alias effective_from across range", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-heatmap");

  const userId = "33333333-3333-3333-3333-333333333333";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      hour_start: "2025-02-15T10:00:00.000Z",
      model: "gpt-foo",
      total_tokens: "10",
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01",
      active: true,
    },
    {
      usage_model: "gpt-foo",
      canonical_model: "beta",
      display_name: "Beta",
      effective_from: "2025-02-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-heatmap?weeks=1&to=2025-02-15&week_starts_on=sun&model=alpha",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const flat = body.weeks.flat().filter(Boolean);
  const dayCell = flat.find((cell) => cell.day === "2025-02-15");
  assert.ok(dayCell);
  assert.equal(dayCell.value, "0");
});

test("vibeusage-usage-heatmap rejects invalid parameters", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-heatmap");
  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-heatmap?weeks=105&to=2025-13-40&week_starts_on=wat",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test("vibeusage-usage-daily uses hourly when rollup disabled", () =>
  withRollupDisabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-daily");

    const userId = "66666666-6666-6666-6666-666666666666";
    const userJwt = createUserJwt(userId);
    const filters = [];

    const pricingFilters = [];
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              assert.equal(table, "vibeusage_tracker_hourly");
              const query = createQueryMock({
                rows: [],
                onFilter: (entry) => filters.push(entry),
              });
              return { select: () => query };
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-20T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
  }));

test("vibeusage-usage-daily ignores rollup flag", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-daily");

    const userId = "66666666-6666-6666-6666-666666666666";
    const userJwt = createUserJwt(userId);

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              assert.equal(table, "vibeusage_tracker_hourly");
              const query = createQueryMock({ rows: [] });
              return { select: () => query };
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
  }));

test("vibeusage-usage-daily applies optional source filter", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-daily");

    const userId = "66666666-6666-6666-6666-666666666666";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];
    const rows = [];
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows,
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21&source=every-code",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "source" && f.value === "every-code"));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-20T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
    assert.ok(orders.some((o) => o.col === "hour_start"));
  }));

test("vibeusage-usage-daily applies optional model filter", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-daily");

    const userId = "66666666-6666-6666-6666-666666666666";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];
    const rows = [];
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows,
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21&model=claude-3-5-sonnet",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    const modelFilter = filters.find(
      (f) => f.op === "or" && f.value?.includes?.("model.ilike.claude-3-5-sonnet"),
    );
    assert.ok(modelFilter);
    assert.ok(!modelFilter.value?.includes?.("model.ilike.%/claude-3-5-sonnet"));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-20T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
    assert.ok(orders.some((o) => o.col === "hour_start"));
  }));

test("vibeusage-usage-daily treats empty source as missing", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-daily");

    const userId = "66666666-6666-6666-6666-666666666666";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];
    const rows = [];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows,
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21&source=",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    assert.ok(!filters.some((f) => f.op === "eq" && f.col === "source"));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-20T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
    assert.ok(orders.some((o) => o.col === "hour_start"));
  }));

test("vibeusage-usage-daily excludes canary buckets by default", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-daily");

    const userId = "66666666-6666-6666-6666-666666666666";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];
    const rows = [];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows,
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === "neq" && f.col === "source" && f.value === "canary"));
    assert.ok(filters.some((f) => f.op === "neq" && f.col === "model" && f.value === "canary"));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-20T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
    assert.ok(orders.some((o) => o.col === "hour_start"));
  }));

test("vibeusage-usage-daily includes billable_total_tokens in summary", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-daily");

  const userId = "66666666-6666-6666-6666-666666666666";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      hour_start: "2025-12-20T01:00:00.000Z",
      source: "codex",
      model: "gpt-4o",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "2",
      output_tokens: "3",
      reasoning_output_tokens: "1",
    },
    {
      hour_start: "2025-12-20T12:00:00.000Z",
      source: "claude",
      model: "claude-3-5-sonnet",
      total_tokens: "5",
      input_tokens: "2",
      cached_input_tokens: "1",
      output_tokens: "1",
      reasoning_output_tokens: "1",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-20",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.totals.billable_total_tokens, "13");
});

test("vibeusage-usage-daily prefers stored billable_total_tokens", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-daily");

  const userId = "66666666-6666-6666-6666-666666666666";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      hour_start: "2025-12-20T01:00:00.000Z",
      source: "codex",
      model: "gpt-4o",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "1",
      output_tokens: "3",
      reasoning_output_tokens: "2",
      billable_total_tokens: "7",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-20",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.totals.billable_total_tokens, "7");
});

test("vibeusage-usage-hourly aggregates half-hour buckets into half-hour totals", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: "2025-12-21T01:00:00.000Z",
      source: "codex",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "1",
      output_tokens: "3",
      reasoning_output_tokens: "2",
    },
    {
      hour_start: "2025-12-21T01:00:00.000Z",
      source: "codex",
      total_tokens: "2",
      input_tokens: "1",
      cached_input_tokens: "0",
      output_tokens: "1",
      reasoning_output_tokens: "0",
    },
    {
      hour_start: "2025-12-21T13:00:00.000Z",
      source: "codex",
      total_tokens: "5",
      input_tokens: "2",
      cached_input_tokens: "1",
      output_tokens: "1",
      reasoning_output_tokens: "1",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_tracker_hourly");
            return {
              select: (columns) => {
                const isAggregate = typeof columns === "string" && columns.includes("sum(");
                const result = isAggregate
                  ? { data: null, error: { message: "not supported" } }
                  : { data: rows, error: null };
                const query = createQueryMock({
                  rows: Array.isArray(result.data) ? result.data : [],
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                if (isAggregate) {
                  query.order = (col, opts) => {
                    orders.push({ op: "order", col, opts });
                    return result;
                  };
                }
                query.range = async () => result;
                return query;
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
  assert.ok(
    filters.some(
      (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-21T00:00:00.000Z",
    ),
  );
  assert.ok(
    filters.some(
      (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
    ),
  );
  assert.ok(orders.some((o) => o.opts?.ascending === true));
  assert.equal(body.day, "2025-12-21");
  assert.equal(body.data.length, 48);
  assert.equal(body.data[2].total_tokens, "12");
  assert.equal(body.data[2].billable_total_tokens, "11");
  assert.equal(body.data[2].input_tokens, "5");
  assert.equal(body.data[2].output_tokens, "4");
  assert.equal(body.data[26].total_tokens, "5");
  assert.equal(body.data[26].billable_total_tokens, "4");
});

test("vibeusage-usage-hourly local timezone prefers stored billable_total_tokens", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);
  let selectColumns = "";

  const rows = [
    {
      hour_start: "2025-12-20T16:00:00.000Z",
      source: "codex",
      total_tokens: "10",
      input_tokens: "1",
      cached_input_tokens: "0",
      output_tokens: "1",
      reasoning_output_tokens: "1",
      billable_total_tokens: "9",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_tracker_hourly");
            return {
              select: (columns) => {
                selectColumns = String(columns || "");
                const query = createQueryMock({ rows });
                return query;
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21&tz_offset_minutes=480",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(selectColumns.includes("billable_total_tokens"));
  assert.equal(body.data[0].billable_total_tokens, "9");
});

test("vibeusage-usage-hourly computes billable totals from aggregated rows", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);

  const aggregateRows = [
    {
      hour: "2025-12-21T01:00:00.000Z",
      source: "codex",
      sum_total_tokens: "10",
      sum_input_tokens: "4",
      sum_cached_input_tokens: "1",
      sum_output_tokens: "3",
      sum_reasoning_output_tokens: "2",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_tracker_hourly");
            return {
              select: (columns) => {
                const isAggregate = typeof columns === "string" && columns.includes("sum(");
                if (isAggregate) {
                  assert.ok(columns.includes("source"));
                  const query = createQueryMock({ rows: aggregateRows });
                  query.range = async () => ({ data: aggregateRows, error: null });
                  return query;
                }
                throw new Error("raw hourly query should not be called in aggregate path");
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[2].total_tokens, "10");
  assert.equal(body.data[2].billable_total_tokens, "9");
});

test("vibeusage-usage-hourly prefers stored billable totals in aggregate path", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);
  let selectColumns = "";

  const aggregateRows = [
    {
      hour: "2025-12-21T01:00:00.000Z",
      source: "codex",
      sum_total_tokens: "10",
      sum_input_tokens: "4",
      sum_cached_input_tokens: "1",
      sum_output_tokens: "3",
      sum_reasoning_output_tokens: "2",
      sum_billable_total_tokens: "8",
      count_rows: "1",
      count_billable_total_tokens: "1",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_tracker_hourly");
            return {
              select: (columns) => {
                selectColumns = String(columns || "");
                const isAggregate = typeof columns === "string" && columns.includes("sum(");
                if (isAggregate) {
                  assert.ok(selectColumns.includes("sum(billable_total_tokens)"));
                  const query = createQueryMock({ rows: aggregateRows });
                  query.range = async () => ({ data: aggregateRows, error: null });
                  return query;
                }
                throw new Error("raw hourly query should not be called in aggregate path");
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[2].total_tokens, "10");
  assert.equal(body.data[2].billable_total_tokens, "8");
});

test("vibeusage-usage-hourly aggregate path falls back when billable sums incomplete", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);
  let selectColumns = "";

  const aggregateRows = [
    {
      hour: "2025-12-21T01:00:00.000Z",
      source: "codex",
      sum_total_tokens: "10",
      sum_input_tokens: "4",
      sum_cached_input_tokens: "1",
      sum_output_tokens: "3",
      sum_reasoning_output_tokens: "2",
      sum_billable_total_tokens: "8",
      count_rows: "2",
      count_billable_total_tokens: "1",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_tracker_hourly");
            return {
              select: (columns) => {
                selectColumns = String(columns || "");
                const isAggregate = typeof columns === "string" && columns.includes("sum(");
                if (isAggregate) {
                  assert.ok(selectColumns.includes("count(billable_total_tokens)"));
                  assert.ok(selectColumns.includes("count()"));
                  const query = createQueryMock({ rows: aggregateRows });
                  query.range = async () => ({ data: aggregateRows, error: null });
                  return query;
                }
                throw new Error("raw hourly query should not be called in aggregate path");
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-usage-hourly?day=2025-12-21", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[2].total_tokens, "10");
  assert.equal(body.data[2].billable_total_tokens, "9");
});

test("vibeusage-usage-hourly canonical model filter includes alias rows", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "11111111-1111-1111-1111-111111111111";
  const userJwt = createUserJwt(userId);
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: "2025-01-01T00:00:00.000Z",
      model: "gpt-4o-mini",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "0",
      output_tokens: "6",
      reasoning_output_tokens: "0",
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return {
                select: (columns) => {
                  const isAggregate = typeof columns === "string" && columns.includes("sum(");
                  const result = isAggregate
                    ? { data: null, error: { message: "not supported" } }
                    : { data: rows, error: null };
                  const query = createQueryMock({
                    rows: Array.isArray(result.data) ? result.data : [],
                    onFilter: (entry) => {
                      if (entry.op === "order") orders.push(entry);
                      else filters.push(entry);
                    },
                  });
                  if (isAggregate) {
                    query.order = (col, opts) => {
                      orders.push({ op: "order", col, opts });
                      return result;
                    };
                  }
                  query.range = async () => result;
                  return query;
                },
              };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-hourly?day=2025-01-01&model=gpt-4o",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const filterCalls = filters.filter((entry) => entry.op === "or");
  assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.gpt-4o-mini")));
});

test("vibeusage-usage-hourly selects model column for canonical filtering (UTC)", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "44444444-4444-4444-4444-444444444444";
  const userJwt = createUserJwt(userId);
  let selectColumns = null;

  const rows = [
    {
      hour_start: "2025-01-01T00:00:00.000Z",
      model: "gpt-4o-mini",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "0",
      output_tokens: "6",
      reasoning_output_tokens: "0",
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return {
                select: (columns) => {
                  selectColumns = columns;
                  const query = createQueryMock({ rows });
                  query.range = async () => ({ data: rows, error: null });
                  return query;
                },
              };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-hourly?day=2025-01-01&model=gpt-4o",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(selectColumns);
  const selected = selectColumns.split(",").map((col) => col.trim());
  assert.ok(selected.includes("model"));
});

test("vibeusage-usage-hourly selects model column for canonical filtering (local time)", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);
  let selectColumns = null;

  const rows = [
    {
      hour_start: "2025-01-01T00:00:00.000Z",
      model: "gpt-4o-mini",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "0",
      output_tokens: "6",
      reasoning_output_tokens: "0",
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return {
                select: (columns) => {
                  selectColumns = columns;
                  const query = createQueryMock({ rows });
                  query.range = async () => ({ data: rows, error: null });
                  return query;
                },
              };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-hourly?day=2025-01-01&model=gpt-4o&tz_offset_minutes=480",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(selectColumns);
  const selected = selectColumns.split(",").map((col) => col.trim());
  assert.ok(selected.includes("model"));
});

test("vibeusage-usage-hourly honors alias effective_from across day", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-hourly");

  const userId = "11111111-1111-1111-1111-111111111111";
  const userJwt = createUserJwt(userId);
  const filters = [];

  const rows = [
    {
      hour_start: "2025-02-15T00:00:00.000Z",
      model: "gpt-foo",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "0",
      output_tokens: "6",
      reasoning_output_tokens: "0",
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01",
      active: true,
    },
    {
      usage_model: "gpt-foo",
      canonical_model: "beta",
      display_name: "Beta",
      effective_from: "2025-02-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return createQueryMock({
                rows,
                onFilter: (entry) => filters.push(entry),
              });
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-hourly?day=2025-02-15&model=alpha",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.day, "2025-02-15");
  assert.equal(body.data[0].total_tokens, "0");
  const filterCalls = filters.filter((entry) => entry.op === "or");
  assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.gpt-foo")));
});

test("vibeusage-usage-monthly aggregates hourly rows into months", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-monthly");

  const userId = "88888888-8888-8888-8888-888888888888";
  const userJwt = createUserJwt(userId);
  const filters = [];
  const orders = [];

  const rows = [
    {
      hour_start: "2025-11-05T00:00:00.000Z",
      source: "codex",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "1",
      output_tokens: "3",
      reasoning_output_tokens: "2",
      billable_total_tokens: "9",
    },
    {
      hour_start: "2025-11-20T00:00:00.000Z",
      source: "codex",
      total_tokens: "5",
      input_tokens: "2",
      cached_input_tokens: "1",
      output_tokens: "1",
      reasoning_output_tokens: "1",
      billable_total_tokens: "4",
    },
    {
      hour_start: "2025-12-01T00:00:00.000Z",
      source: "codex",
      total_tokens: "7",
      input_tokens: "3",
      cached_input_tokens: "1",
      output_tokens: "2",
      reasoning_output_tokens: "1",
      billable_total_tokens: "6",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({
                rows,
                onFilter: (entry) => {
                  if (entry.op === "order") orders.push(entry);
                  else filters.push(entry);
                },
              });
              return {
                select: () => query,
              };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              const query = createQueryMock({ rows: [] });
              query.or = () => query;
              return query;
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-monthly?months=2&to=2025-12-21",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
  assert.ok(
    filters.some(
      (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-11-01T00:00:00.000Z",
    ),
  );
  assert.ok(
    filters.some(
      (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
    ),
  );
  assert.ok(orders.some((o) => o.col === "hour_start" && o.opts?.ascending === true));
  assert.equal(body.from, "2025-11-01");
  assert.equal(body.to, "2025-12-21");
  assert.equal(body.months, 2);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].month, "2025-11");
  assert.equal(body.data[0].total_tokens, "15");
  assert.equal(body.data[0].billable_total_tokens, "13");
  assert.equal(body.data[1].month, "2025-12");
  assert.equal(body.data[1].total_tokens, "7");
  assert.equal(body.data[1].billable_total_tokens, "6");
});

test("vibeusage-usage-monthly canonical model filter includes alias rows", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-monthly");

  const userId = "22222222-2222-2222-2222-222222222222";
  const userJwt = createUserJwt(userId);
  const filters = [];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({
                rows: [],
                onFilter: (entry) => filters.push(entry),
              });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-monthly?months=1&to=2025-01-31&model=gpt-4o",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const filterCalls = filters.filter((entry) => entry.op === "or");
  assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.gpt-4o-mini")));
});

test("vibeusage-usage-monthly honors alias effective_from across range", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-monthly");

  const userId = "22222222-2222-2222-2222-222222222222";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      hour_start: "2025-02-15T10:00:00.000Z",
      model: "gpt-foo",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "0",
      output_tokens: "6",
      reasoning_output_tokens: "0",
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01",
      active: true,
    },
    {
      usage_model: "gpt-foo",
      canonical_model: "beta",
      display_name: "Beta",
      effective_from: "2025-02-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-monthly?months=1&to=2025-02-28&model=alpha",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data[0].month, "2025-02");
  assert.equal(body.data[0].total_tokens, "0");
});

test("vibeusage-usage-summary uses hourly when rollup disabled", () =>
  withRollupDisabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);
    const filters = [];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              assert.equal(table, "vibeusage_tracker_hourly");
              const query = createQueryMock({
                rows: [],
                onFilter: (entry) => filters.push(entry),
              });
              return {
                select: () => query,
              };
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-20&to=2025-12-22",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-20T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-23T00:00:00.000Z",
      ),
    );
  }));

test("vibeusage-project-usage-summary aggregates project usage", async () => {
  const fn = require("../insforge-functions/vibeusage-project-usage-summary");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);
  const filters = [];
  const orders = [];

  const rows = [
    {
      project_key: "acme/alpha",
      project_ref: "https://github.com/acme/alpha",
      sum_total_tokens: "100",
      sum_billable_total_tokens: "0",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_project_usage_hourly");
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                if (entry.op === "order") orders.push(entry);
                else filters.push(entry);
              },
            });
            return { select: () => query };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-project-usage-summary?from=2025-12-20&to=2025-12-21&limit=3",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].project_key, "acme/alpha");
  assert.equal(body.entries[0].total_tokens, "100");
  assert.equal(body.entries[0].billable_total_tokens, "0");
  assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
  assert.ok(filters.some((f) => f.op === "neq" && f.col === "source" && f.value === "canary"));
  assert.ok(!filters.some((f) => f.col === "model"));
  assert.ok(!filters.some((f) => f.col === "hour_start"));
  const billableOrderIndex = orders.findIndex((o) => o.col === "sum_billable_total_tokens");
  const totalOrderIndex = orders.findIndex((o) => o.col === "sum_total_tokens");
  assert.ok(billableOrderIndex >= 0);
  assert.ok(totalOrderIndex >= 0);
  assert.ok(billableOrderIndex < totalOrderIndex);
});

test("vibeusage-project-usage-summary ignores date range for all-time totals", async () => {
  const fn = require("../insforge-functions/vibeusage-project-usage-summary");

  const userId = "11111111-1111-1111-1111-111111111111";
  const userJwt = createUserJwt(userId);
  const filters = [];

  const rows = [
    {
      project_key: "acme/omega",
      project_ref: "https://github.com/acme/omega",
      sum_total_tokens: "250",
      sum_billable_total_tokens: "0",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_project_usage_hourly");
            const query = createQueryMock({
              rows,
              onFilter: (entry) => {
                filters.push(entry);
              },
            });
            return { select: () => query };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-project-usage-summary?from=2020-01-01&to=2030-01-01&limit=3",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].project_key, "acme/omega");
  assert.equal(body.entries[0].total_tokens, "250");
  assert.ok(!filters.some((f) => f.col === "hour_start"));
});

test("vibeusage-project-usage-summary uses PostgREST sum() syntax", async () => {
  const fn = require("../insforge-functions/vibeusage-project-usage-summary");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);
  let selectColumns = null;

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      const query = {
        eq: () => query,
        neq: () => query,
        gte: () => query,
        lt: () => query,
        order: () => query,
        limit: async () => ({ data: [], error: null }),
      };
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_project_usage_hourly");
            return {
              select: (columns) => {
                selectColumns = columns;
                return query;
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-project-usage-summary?from=2025-12-20&to=2025-12-21&limit=3",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  assert.ok(selectColumns && selectColumns.includes("sum(total_tokens)"));
  assert.ok(selectColumns && selectColumns.includes("sum(billable_total_tokens)"));
});

test("vibeusage-project-usage-summary falls back on schema cache aggregate error", async () => {
  const fn = require("../insforge-functions/vibeusage-project-usage-summary");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);
  const selects = [];
  const rows = [
    {
      project_key: "acme/alpha",
      project_ref: "https://github.com/acme/alpha",
      total_tokens: "10",
      billable_total_tokens: "5",
    },
    {
      project_key: "acme/alpha",
      project_ref: "https://github.com/acme/alpha",
      total_tokens: "7",
      billable_total_tokens: "7",
    },
    {
      project_key: "acme/bravo",
      project_ref: "https://github.com/acme/bravo",
      total_tokens: "3",
      billable_total_tokens: "2",
    },
  ];

  const createErrorQuery = () => {
    const query = {
      select: () => query,
      eq: () => query,
      neq: () => query,
      gte: () => query,
      lt: () => query,
      order: () => query,
      limit: async () => ({
        data: null,
        error: {
          message:
            "Could not find a relationship between 'vibeusage_project_usage_hourly' and 'sum' in the schema cache",
        },
      }),
      then: (resolve, reject) =>
        Promise.resolve({
          data: null,
          error: {
            message:
              "Could not find a relationship between 'vibeusage_project_usage_hourly' and 'sum' in the schema cache",
          },
        }).then(resolve, reject),
    };
    return query;
  };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_project_usage_hourly");
            const query = createQueryMock({ rows });
            return {
              select: (columns) => {
                selects.push(columns);
                if (String(columns).includes("sum_total_tokens")) {
                  return createErrorQuery();
                }
                return query;
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-project-usage-summary?from=2025-12-20&to=2025-12-21&limit=3",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.entries.length, 2);
  assert.equal(body.entries[0].project_key, "acme/alpha");
  assert.equal(body.entries[0].total_tokens, "17");
  assert.equal(body.entries[0].billable_total_tokens, "12");
  assert.equal(body.entries[1].project_key, "acme/bravo");
  assert.ok(selects.some((value) => String(value).includes("sum_total_tokens")));
  assert.ok(
    selects.some((value) =>
      String(value).includes("project_key,project_ref,total_tokens,billable_total_tokens"),
    ),
  );
});

test("vibeusage-project-usage-summary falls back when aggregates are blocked", async () => {
  const fn = require("../insforge-functions/vibeusage-project-usage-summary");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);
  const selects = [];
  const rows = [
    {
      project_key: "acme/alpha",
      project_ref: "https://github.com/acme/alpha",
      total_tokens: "10",
      billable_total_tokens: "5",
    },
    {
      project_key: "acme/alpha",
      project_ref: "https://github.com/acme/alpha",
      total_tokens: "7",
      billable_total_tokens: "7",
    },
    {
      project_key: "acme/bravo",
      project_ref: "https://github.com/acme/bravo",
      total_tokens: "3",
      billable_total_tokens: "2",
    },
  ];

  const createErrorQuery = () => {
    const query = {
      select: () => query,
      eq: () => query,
      neq: () => query,
      gte: () => query,
      lt: () => query,
      order: () => query,
      limit: async () => ({
        data: null,
        error: { message: "Use of aggregate functions is not allowed" },
      }),
      then: (resolve, reject) =>
        Promise.resolve({
          data: null,
          error: { message: "Use of aggregate functions is not allowed" },
        }).then(resolve, reject),
    };
    return query;
  };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_project_usage_hourly");
            const query = createQueryMock({ rows });
            return {
              select: (columns) => {
                selects.push(columns);
                if (String(columns).includes("sum_total_tokens")) {
                  return createErrorQuery();
                }
                return query;
              },
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-project-usage-summary?from=2025-12-20&to=2025-12-21&limit=3",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.entries.length, 2);
  assert.equal(body.entries[0].project_key, "acme/alpha");
  assert.equal(body.entries[0].total_tokens, "17");
  assert.equal(body.entries[0].billable_total_tokens, "12");
  assert.equal(body.entries[1].project_key, "acme/bravo");
  assert.ok(selects.some((value) => String(value).includes("sum_total_tokens")));
  assert.ok(
    selects.some((value) =>
      String(value).includes("project_key,project_ref,total_tokens,billable_total_tokens"),
    ),
  );
});
test("vibeusage-usage-summary returns rolling metrics when requested", () =>
  withRollupDisabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const rows = [
      {
        hour_start: "2025-12-19T12:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "100",
        total_tokens: "120",
        input_tokens: "40",
        cached_input_tokens: "10",
        output_tokens: "50",
        reasoning_output_tokens: "20",
      },
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: null,
        total_tokens: "55",
        input_tokens: "15",
        cached_input_tokens: "5",
        output_tokens: "25",
        reasoning_output_tokens: "10",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&rolling=1",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.rolling);
    assert.ok(body.rolling.last_7d);
    assert.ok(body.rolling.last_30d);
    assert.equal(body.rolling.last_7d.from, "2025-12-15");
    assert.equal(body.rolling.last_7d.to, "2025-12-21");
    assert.equal(body.rolling.last_7d.totals.billable_total_tokens, "150");
    assert.equal(body.rolling.last_7d.active_days, 2);
    assert.equal(body.rolling.last_7d.avg_per_active_day, "75");
    assert.equal(body.rolling.last_7d.avg_per_day, "21");
    assert.equal(body.rolling.last_7d.window_days, 7);

    assert.equal(body.rolling.last_30d.from, "2025-11-22");
    assert.equal(body.rolling.last_30d.to, "2025-12-21");
    assert.equal(body.rolling.last_30d.totals.billable_total_tokens, "150");
    assert.equal(body.rolling.last_30d.active_days, 2);
    assert.equal(body.rolling.last_30d.avg_per_active_day, "75");
    assert.equal(body.rolling.last_30d.avg_per_day, "5");
    assert.equal(body.rolling.last_30d.window_days, 30);
  }));

test("vibeusage-usage-summary counts rolling active days in local timezone", () =>
  withRollupDisabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const rows = [
      {
        hour_start: "2025-12-21T09:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
      {
        hour_start: "2025-12-22T07:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&rolling=1&tz_offset_minutes=-480",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.rolling);
    assert.equal(body.rolling.last_7d.totals.billable_total_tokens, "20");
    assert.equal(body.rolling.last_7d.active_days, 1);
    assert.equal(body.rolling.last_7d.avg_per_active_day, "20");
  }));

test("vibeusage-usage-summary rolling fallback does not double count hourly rows", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const rows = [
      {
        hour_start: "2025-12-15T09:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
      {
        hour_start: "2025-12-22T01:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows });
                return { select: () => query };
              }
              if (table === "vibeusage_tracker_daily_rollup") {
                const query = createQueryMock({ rows: [] });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&rolling=1&tz_offset_minutes=-480",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.rolling);
    assert.equal(body.rolling.last_7d.totals.billable_total_tokens, "20");
  }));

test("vibeusage-usage-summary derives active days from hourly when rollup spans local days", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const hourlyRows = [
      {
        hour_start: "2025-12-21T01:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
      {
        hour_start: "2025-12-21T15:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
    ];

    const rollupRows = [
      {
        day: "2025-12-21",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "20",
        total_tokens: "24",
        input_tokens: "8",
        cached_input_tokens: "2",
        output_tokens: "10",
        reasoning_output_tokens: "6",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows: hourlyRows });
                return { select: () => query };
              }
              if (table === "vibeusage_tracker_daily_rollup") {
                const query = createQueryMock({ rows: rollupRows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&rolling=1&tz_offset_minutes=-480",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.rolling);
    assert.equal(body.rolling.last_7d.totals.billable_total_tokens, "20");
    assert.equal(body.rolling.last_7d.active_days, 2);
    assert.equal(body.rolling.last_7d.avg_per_active_day, "10");
  }));

test("vibeusage-usage-summary derives active days from hourly for IANA tz", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const hourlyRows = [
      {
        hour_start: "2025-12-21T01:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
      {
        hour_start: "2025-12-21T15:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "10",
        total_tokens: "12",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "5",
        reasoning_output_tokens: "3",
      },
    ];

    const rollupRows = [
      {
        day: "2025-12-21",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "20",
        total_tokens: "24",
        input_tokens: "8",
        cached_input_tokens: "2",
        output_tokens: "10",
        reasoning_output_tokens: "6",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows: hourlyRows });
                return { select: () => query };
              }
              if (table === "vibeusage_tracker_daily_rollup") {
                const query = createQueryMock({ rows: rollupRows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&rolling=1&tz=America/Los_Angeles",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.rolling);
    assert.equal(body.rolling.last_7d.totals.billable_total_tokens, "20");
    assert.equal(body.rolling.last_7d.active_days, 2);
    assert.equal(body.rolling.last_7d.avg_per_active_day, "10");
  }));

test("vibeusage-usage-summary clamps rolling windows to local yesterday", () =>
  withRollupDisabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const rows = [
      {
        hour_start: "2025-12-19T12:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "100",
        total_tokens: "120",
        input_tokens: "40",
        cached_input_tokens: "10",
        output_tokens: "50",
        reasoning_output_tokens: "20",
      },
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        billable_total_tokens: "50",
        total_tokens: "60",
        input_tokens: "20",
        cached_input_tokens: "5",
        output_tokens: "25",
        reasoning_output_tokens: "10",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const RealDate = globalThis.Date;
    const fixedNow = new RealDate("2025-12-22T02:00:00.000Z");
    globalThis.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) return new RealDate(fixedNow);
        return new RealDate(...args);
      }
      static now() {
        return fixedNow.getTime();
      }
      static UTC(...args) {
        return RealDate.UTC(...args);
      }
      static parse(str) {
        return RealDate.parse(str);
      }
    };

    try {
      const req = new Request(
        "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-25&rolling=1&tz_offset_minutes=-480",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${userJwt}` },
        },
      );

      const res = await fn(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.rolling);
      assert.equal(body.rolling.last_7d.to, "2025-12-20");
      assert.equal(body.rolling.last_30d.to, "2025-12-20");
      assert.equal(body.rolling.last_7d.from, "2025-12-14");
      assert.equal(body.rolling.last_30d.from, "2025-11-21");
    } finally {
      globalThis.Date = RealDate;
    }
  }));

test("vibeusage-usage-summary returns total_cost_usd and pricing metadata", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];

    const rows = [
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        total_tokens: "1500000",
        input_tokens: "1000000",
        cached_input_tokens: "200000",
        output_tokens: "500000",
        reasoning_output_tokens: "100000",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        assert.equal(args.anonKey, ANON_KEY);
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows,
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                return {
                  select: () => query,
                };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                const query = createQueryMock({ rows: [] });
                query.or = () => query;
                return query;
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-21T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
    assert.ok(orders.some((o) => o.col === "hour_start"));
    assert.equal(body.from, "2025-12-21");
    assert.equal(body.to, "2025-12-21");
    assert.equal(body.totals.total_tokens, "1500000");
    assert.equal(body.totals.billable_total_tokens, "1600000");
    assert.equal(body.totals.total_cost_usd, "8.435000");
    assert.equal(body.pricing.model, "gpt-5.2-codex");
    assert.equal(body.pricing.pricing_mode, "overlap");
    assert.equal(body.pricing.rates_per_million_usd.cached_input, "0.175000");
  }));

test("vibeusage-usage-summary prefers stored billable_total_tokens", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);

    const rows = [
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        total_tokens: "10",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "3",
        reasoning_output_tokens: "2",
        billable_total_tokens: "7",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totals.billable_total_tokens, "7");
  }));

test("vibeusage-usage-summary canonical model filter includes alias rows", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);
    const filters = [];

    const hourlyRows = [
      {
        hour_start: "2025-01-01T00:00:00.000Z",
        source: "codex",
        model: "gpt-4o-mini",
        total_tokens: 50,
        input_tokens: 30,
        cached_input_tokens: 0,
        output_tokens: 20,
        reasoning_output_tokens: 0,
      },
    ];

    const aliasRows = [
      {
        usage_model: "gpt-4o-mini",
        canonical_model: "gpt-4o",
        display_name: "GPT-4o",
        effective_from: "2025-01-01",
        active: true,
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows: hourlyRows,
                  onFilter: (entry) => filters.push(entry),
                });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: aliasRows });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-01-01&to=2025-01-01&model=gpt-4o",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    const filterCalls = filters.filter((entry) => entry.op === "or");
    assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.gpt-4o-mini")));
    assert.equal(body.model_id, "gpt-4o");
    assert.equal(body.model, "GPT-4o");
  }));

test("vibeusage-usage-summary honors alias effective_from across range", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "11111111-1111-1111-1111-111111111111";
    const userJwt = createUserJwt(userId);

    const hourlyRows = [
      {
        hour_start: "2025-01-15T00:00:00.000Z",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 100,
        input_tokens: 60,
        cached_input_tokens: 0,
        output_tokens: 40,
        reasoning_output_tokens: 0,
      },
      {
        hour_start: "2025-02-15T00:00:00.000Z",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 200,
        input_tokens: 120,
        cached_input_tokens: 0,
        output_tokens: 80,
        reasoning_output_tokens: 0,
      },
    ];

    const aliasRows = [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-01-01",
        active: true,
      },
      {
        usage_model: "gpt-foo",
        canonical_model: "beta",
        display_name: "Beta",
        effective_from: "2025-02-01",
        active: true,
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows: hourlyRows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: aliasRows });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-01-01&to=2025-02-15&model=alpha",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totals.total_tokens, "100");
  }));

test("vibeusage-usage-summary prices per-alias effective_from when unfiltered", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "12121212-1212-1212-1212-121212121212";
    const userJwt = createUserJwt(userId);

    const hourlyRows = [
      {
        hour_start: "2025-01-15T00:00:00.000Z",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 1000000,
        input_tokens: 1000000,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
      },
      {
        hour_start: "2025-02-15T00:00:00.000Z",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 1000000,
        input_tokens: 1000000,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
      },
    ];

    const aliasRows = [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-01-01",
        active: true,
      },
      {
        usage_model: "gpt-foo",
        canonical_model: "beta",
        display_name: "Beta",
        effective_from: "2025-02-01",
        active: true,
      },
    ];

    const pricingProfiles = {
      alpha: {
        model: "alpha",
        source: "openrouter",
        effective_from: "2025-01-01",
        input_rate_micro_per_million: 1000000,
        cached_input_rate_micro_per_million: 0,
        output_rate_micro_per_million: 0,
        reasoning_output_rate_micro_per_million: 0,
      },
      beta: {
        model: "beta",
        source: "openrouter",
        effective_from: "2025-02-01",
        input_rate_micro_per_million: 2000000,
        cached_input_rate_micro_per_million: 0,
        output_rate_micro_per_million: 0,
        reasoning_output_rate_micro_per_million: 0,
      },
    };
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows: hourlyRows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: aliasRows });
              }
              if (table === "vibeusage_pricing_profiles") {
                const state = { model: null };
                const query = {
                  select: () => query,
                  eq: (col, value) => {
                    if (col === "model") state.model = value;
                    return query;
                  },
                  lte: () => query,
                  order: () => query,
                  or: (expr) => {
                    const match = String(expr).match(/model\.eq\.([^,]+)/);
                    if (match) state.model = match[1];
                    return query;
                  },
                  limit: async () => {
                    const row = pricingProfiles[state.model];
                    return { data: row ? [row] : [], error: null };
                  },
                };
                return query;
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-01-01&to=2025-02-15",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.model_id, null);
    assert.equal(body.model, null);
    assert.equal(body.totals.total_cost_usd, "3.000000");
  }));

test("vibeusage-usage-summary emits debug payload when requested", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");
    const prevThreshold = process.env.VIBEUSAGE_SLOW_QUERY_MS;

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];

    const rows = [
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        total_tokens: "10",
        input_tokens: "6",
        cached_input_tokens: "2",
        output_tokens: "4",
        reasoning_output_tokens: "1",
      },
    ];

    try {
      process.env.VIBEUSAGE_SLOW_QUERY_MS = "2000";

      globalThis.createClient = (args) => {
        if (args && args.edgeFunctionToken === userJwt) {
          return {
            auth: {
              getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
            },
            database: {
              from: (table) => {
                if (table === "vibeusage_tracker_hourly") {
                  const query = createQueryMock({
                    rows,
                    onFilter: (entry) => {
                      if (entry.op === "order") orders.push(entry);
                      else filters.push(entry);
                    },
                  });
                  return {
                    select: () => query,
                  };
                }
                if (table === "vibeusage_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                if (table === "vibeusage_pricing_profiles") {
                  const query = createQueryMock({ rows: [] });
                  query.or = () => query;
                  return query;
                }
                if (table === "vibeusage_pricing_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                throw new Error(`Unexpected table: ${table}`);
              },
            },
          };
        }
        throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
      };

      const req = new Request(
        "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21&debug=1",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${userJwt}` },
        },
      );

      const res = await fn(req);
      assert.equal(res.status, 200);

      const payload = await res.json();
      assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
      assert.ok(
        filters.some(
          (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-21T00:00:00.000Z",
        ),
      );
      assert.ok(
        filters.some(
          (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
        ),
      );
      assert.ok(orders.some((o) => o.col === "hour_start"));
      assert.ok(payload.debug);
      assert.ok(payload.debug.request_id && payload.debug.request_id.length > 0);
      assert.equal(payload.debug.status, 200);
      assert.ok(Number.isFinite(payload.debug.query_ms));
      assert.ok(Number.isFinite(payload.debug.slow_threshold_ms));
      assert.equal(typeof payload.debug.slow_query, "boolean");

      const noDebugReq = new Request(
        "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${userJwt}` },
        },
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

test("vibeusage-usage-summary logs vibeusage function name", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "99999999-9999-9999-9999-999999999999";
    const userJwt = createUserJwt(userId);
    const rows = [
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        total_tokens: "10",
        input_tokens: "6",
        cached_input_tokens: "2",
        output_tokens: "4",
        reasoning_output_tokens: "1",
      },
    ];
    const logs = [];
    const prevLog = console.log;

    console.log = (message) => logs.push(message);

    try {
      globalThis.createClient = (args) => {
        if (args && args.edgeFunctionToken === userJwt) {
          return {
            auth: {
              getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
            },
            database: {
              from: (table) => {
                if (table === "vibeusage_tracker_hourly") {
                  const query = createQueryMock({ rows });
                  return { select: () => query };
                }
                if (table === "vibeusage_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                if (table === "vibeusage_pricing_profiles") {
                  const query = createQueryMock({ rows: [] });
                  query.or = () => query;
                  return query;
                }
                if (table === "vibeusage_pricing_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                throw new Error(`Unexpected table ${table}`);
              },
            },
          };
        }
        throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
      };

      const req = new Request(
        "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${userJwt}` },
        },
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
      const responseLog = parsed.find((payload) => payload?.stage === "response");
      assert.ok(responseLog, "expected response log payload");
      assert.equal(responseLog.function, "vibeusage-usage-summary");
    } finally {
      console.log = prevLog;
    }
  }));

test("vibeusage-usage-summary validates user via auth lookup", () =>
  withRollupEnabled(async () => {
    const fn = require("../insforge-functions/vibeusage-usage-summary");

    const userId = "77777777-7777-7777-7777-777777777777";
    const userJwt = createUserJwt(userId);
    const filters = [];
    const orders = [];

    const rows = [
      {
        hour_start: "2025-12-21T00:00:00.000Z",
        total_tokens: "10",
        input_tokens: "6",
        cached_input_tokens: "2",
        output_tokens: "4",
        reasoning_output_tokens: "1",
      },
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
            },
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({
                  rows,
                  onFilter: (entry) => {
                    if (entry.op === "order") orders.push(entry);
                    else filters.push(entry);
                  },
                });
                return {
                  select: () => query,
                };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                const query = createQueryMock({ rows: [] });
                query.or = () => query;
                return query;
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-21&to=2025-12-21",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 200);

    assert.ok(filters.some((f) => f.op === "eq" && f.col === "user_id" && f.value === userId));
    assert.ok(
      filters.some(
        (f) => f.op === "gte" && f.col === "hour_start" && f.value === "2025-12-21T00:00:00.000Z",
      ),
    );
    assert.ok(
      filters.some(
        (f) => f.op === "lt" && f.col === "hour_start" && f.value === "2025-12-22T00:00:00.000Z",
      ),
    );
    assert.ok(orders.some((o) => o.col === "hour_start"));
    assert.equal(authCalls, 1, "expected auth.getCurrentUser to be used");
  }));

test("vibeusage-usage-summary rejects oversized ranges", { concurrency: 1 }, async () => {
  const fn = require("../insforge-functions/vibeusage-usage-summary");
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);
  let dbTouched = false;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = "30";
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: () => {
              dbTouched = true;
              throw new Error("database should not be queried for oversized ranges");
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-01-01&to=2025-02-15",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(String(body.error || ""), /max/i);
    assert.equal(dbTouched, false);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test("getUsageMaxDays defaults to 800 days", { concurrency: 1 }, () => {
  const { getUsageMaxDays } = require("../insforge-src/shared/date");
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  try {
    delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    assert.equal(getUsageMaxDays(), 800);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test("resolveIdentityAtDate uses date portion of effective_from timestamps", () => {
  const {
    buildAliasTimeline,
    resolveIdentityAtDate,
  } = require("../insforge-src/shared/model-alias-timeline");

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01T00:00:00+00:00",
      active: true,
    },
  ];

  const timeline = buildAliasTimeline({ usageModels: ["gpt-foo"], aliasRows });
  const identity = resolveIdentityAtDate({
    rawModel: "gpt-foo",
    dateKey: "2025-01-01",
    timeline,
  });

  assert.equal(identity.model_id, "alpha");
});

test("fetchAliasRows includes same-day alias timestamps", { concurrency: 1 }, async () => {
  const { fetchAliasRows } = require("../insforge-src/shared/model-alias-timeline");
  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01T12:00:00Z",
      active: true,
    },
  ];
  const edgeClient = {
    database: {
      from: () => {
        const state = {
          filters: {},
          select() {
            return this;
          },
          eq(col, value) {
            this.filters.eq = this.filters.eq || {};
            this.filters.eq[col] = value;
            return this;
          },
          in(col, values) {
            this.filters.in = this.filters.in || {};
            this.filters.in[col] = Array.isArray(values) ? values : [values];
            return this;
          },
          lte(col, value) {
            this.filters.lte = { col, value };
            return this;
          },
          lt(col, value) {
            this.filters.lt = { col, value };
            return this;
          },
          order() {
            const data = aliasRows.filter((row) => {
              if (this.filters.eq) {
                for (const [col, value] of Object.entries(this.filters.eq)) {
                  if (row[col] !== value) return false;
                }
              }
              if (this.filters.in) {
                for (const [col, values] of Object.entries(this.filters.in)) {
                  if (!values.includes(row[col])) return false;
                }
              }
              if (this.filters.lt) {
                return String(row[this.filters.lt.col]) < this.filters.lt.value;
              }
              if (this.filters.lte) {
                return String(row[this.filters.lte.col]) <= this.filters.lte.value;
              }
              return true;
            });
            return { data, error: null };
          },
        };
        return state;
      },
    },
  };

  const rows = await fetchAliasRows({
    edgeClient,
    usageModels: ["gpt-foo"],
    effectiveDate: "2025-01-01",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].usage_model, "gpt-foo");
});

test("vibeusage-usage-daily rejects oversized ranges", { concurrency: 1 }, async () => {
  const fn = require("../insforge-functions/vibeusage-usage-daily");
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);
  let dbTouched = false;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = "30";
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: () => {
              dbTouched = true;
              throw new Error("database should not be queried for oversized ranges");
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-02-15",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(String(body.error || ""), /max/i);
    assert.equal(dbTouched, false);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test("vibeusage-usage-model-breakdown includes billable_total_tokens per source", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");

  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      source: "codex",
      model: "gpt-4o",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "1",
      output_tokens: "3",
      reasoning_output_tokens: "2",
    },
    {
      source: "claude",
      model: "claude-3-5-sonnet",
      total_tokens: "5",
      input_tokens: "2",
      cached_input_tokens: "1",
      output_tokens: "1",
      reasoning_output_tokens: "1",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const bySource = new Map(body.sources.map((entry) => [entry.source, entry]));
  assert.equal(bySource.get("codex")?.totals?.billable_total_tokens, "9");
  assert.equal(bySource.get("claude")?.totals?.billable_total_tokens, "5");
  const codexModel = bySource.get("codex")?.models?.find((entry) => entry.model === "gpt-4o");
  const claudeModel = bySource
    .get("claude")
    ?.models?.find((entry) => entry.model === "claude-3-5-sonnet");
  assert.equal(codexModel?.totals?.billable_total_tokens, "9");
  assert.equal(claudeModel?.totals?.billable_total_tokens, "5");
});

test("vibeusage-usage-model-breakdown prefers stored billable_total_tokens", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");

  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      source: "codex",
      model: "gpt-4o",
      total_tokens: "10",
      input_tokens: "4",
      cached_input_tokens: "1",
      output_tokens: "3",
      reasoning_output_tokens: "2",
      billable_total_tokens: "7",
    },
    {
      source: "claude",
      model: "claude-3-5-sonnet",
      total_tokens: "5",
      input_tokens: "2",
      cached_input_tokens: "1",
      output_tokens: "1",
      reasoning_output_tokens: "1",
      billable_total_tokens: "6",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const bySource = new Map(body.sources.map((entry) => [entry.source, entry]));
  assert.equal(bySource.get("codex")?.totals?.billable_total_tokens, "7");
  assert.equal(bySource.get("claude")?.totals?.billable_total_tokens, "6");
  const codexModel = bySource.get("codex")?.models?.find((entry) => entry.model === "gpt-4o");
  const claudeModel = bySource
    .get("claude")
    ?.models?.find((entry) => entry.model === "claude-3-5-sonnet");
  assert.equal(codexModel?.totals?.billable_total_tokens, "7");
  assert.equal(claudeModel?.totals?.billable_total_tokens, "6");
});

test("vibeusage-usage-model-breakdown sorts models by billable_total_tokens", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);

  const rows = [
    {
      source: "codex",
      model: "gpt-4o",
      total_tokens: "100",
      input_tokens: "40",
      cached_input_tokens: "10",
      output_tokens: "30",
      reasoning_output_tokens: "20",
      billable_total_tokens: "30",
    },
    {
      source: "codex",
      model: "gpt-4.1",
      total_tokens: "60",
      input_tokens: "20",
      cached_input_tokens: "10",
      output_tokens: "20",
      reasoning_output_tokens: "10",
      billable_total_tokens: "50",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_profiles") {
              return createQueryMock({ rows: [] });
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const sourceEntry = body.sources.find((entry) => entry.source === "codex");
  assert.ok(Array.isArray(sourceEntry?.models));
  assert.equal(sourceEntry.models[0]?.model, "gpt-4.1");
});

test(
  "vibeusage usage aggregates stay consistent across summary daily breakdown",
  { concurrency: 1 },
  async () => {
    const summaryFn = require("../insforge-functions/vibeusage-usage-summary");
    const dailyFn = require("../insforge-functions/vibeusage-usage-daily");
    const breakdownFn = require("../insforge-functions/vibeusage-usage-model-breakdown");

    const userId = "88888888-8888-8888-8888-888888888888";
    const userJwt = createUserJwt(userId);

    const rows = [
      {
        hour_start: "2025-12-20T01:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        total_tokens: "10",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "3",
        reasoning_output_tokens: "2",
      },
      {
        hour_start: "2025-12-20T12:00:00.000Z",
        source: "claude",
        model: "claude-3-5-sonnet",
        total_tokens: "5",
        input_tokens: "2",
        cached_input_tokens: "1",
        output_tokens: "1",
        reasoning_output_tokens: "1",
      },
      {
        hour_start: "2025-12-21T03:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        total_tokens: "7",
        input_tokens: "3",
        cached_input_tokens: "0",
        output_tokens: "3",
        reasoning_output_tokens: "1",
        billable_total_tokens: "6",
      },
      {
        hour_start: "2025-12-21T18:00:00.000Z",
        source: "every-code",
        model: "gpt-4o",
        total_tokens: "9",
        input_tokens: "4",
        cached_input_tokens: "1",
        output_tokens: "3",
        reasoning_output_tokens: "1",
      },
    ];

    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: (table) => {
              if (table === "vibeusage_tracker_hourly") {
                const query = createQueryMock({ rows });
                return { select: () => query };
              }
              if (table === "vibeusage_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_profiles") {
                return createQueryMock({ rows: [] });
              }
              if (table === "vibeusage_pricing_model_aliases") {
                return createQueryMock({ rows: [] });
              }
              throw new Error(`Unexpected table ${table}`);
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const headers = { Authorization: `Bearer ${userJwt}` };
    const summaryReq = new Request(
      "http://localhost/functions/vibeusage-usage-summary?from=2025-12-20&to=2025-12-21",
      { method: "GET", headers },
    );
    const dailyReq = new Request(
      "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-21",
      { method: "GET", headers },
    );
    const breakdownReq = new Request(
      "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-21",
      { method: "GET", headers },
    );

    const summaryRes = await summaryFn(summaryReq);
    const dailyRes = await dailyFn(dailyReq);
    const breakdownRes = await breakdownFn(breakdownReq);

    assert.equal(summaryRes.status, 200);
    assert.equal(dailyRes.status, 200);
    assert.equal(breakdownRes.status, 200);

    const summaryBody = await summaryRes.json();
    const dailyBody = await dailyRes.json();
    const breakdownBody = await breakdownRes.json();

    const summaryTotals = normalizeTokenTotals(summaryBody.totals);
    const dailyTotals = sumTokenTotals(dailyBody.data);
    const breakdownTotals = sumTokenTotals(breakdownBody.sources.map((entry) => entry.totals));

    assertTokenTotalsEqual(summaryTotals, dailyTotals, "daily");
    assertTokenTotalsEqual(summaryTotals, breakdownTotals, "model breakdown");
  },
);

test(
  "vibeusage usage costs stay consistent across daily summary and model breakdown when models overlap sources",
  { concurrency: 1 },
  () =>
    withRollupDisabled(async () => {
      const summaryFn = require("../insforge-functions/vibeusage-usage-summary");
      const dailyFn = require("../insforge-functions/vibeusage-usage-daily");
      const breakdownFn = require("../insforge-functions/vibeusage-usage-model-breakdown");

      const userId = "77777777-7777-7777-7777-777777777777";
      const userJwt = createUserJwt(userId);

      const hourlyRows = [
        {
          hour_start: "2025-12-20T01:00:00.000Z",
          source: "codex",
          model: "gpt-5.2-codex",
          total_tokens: 3000000,
          input_tokens: 1000000,
          cached_input_tokens: 0,
          output_tokens: 2000000,
          reasoning_output_tokens: 0,
        },
        {
          hour_start: "2025-12-20T02:00:00.000Z",
          source: "opencode",
          model: "gpt-5.2-codex",
          total_tokens: 1100000,
          input_tokens: 1000000,
          cached_input_tokens: 0,
          output_tokens: 100000,
          reasoning_output_tokens: 500000,
        },
      ];

      const pricingProfile = {
        model: "gpt-5.2-codex",
        source: "openrouter",
        effective_from: "2025-12-01",
        input_rate_micro_per_million: 1000000,
        cached_input_rate_micro_per_million: 0,
        output_rate_micro_per_million: 1000000,
        reasoning_output_rate_micro_per_million: 1000000,
      };

      const pricingFilters = [];
      globalThis.createClient = (args) => {
        if (args && args.edgeFunctionToken === userJwt) {
          return {
            auth: {
              getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
            },
            database: {
              from: (table) => {
                if (table === "vibeusage_tracker_hourly") {
                  const query = createQueryMock({ rows: hourlyRows });
                  return { select: () => query };
                }
                if (table === "vibeusage_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                if (table === "vibeusage_pricing_profiles") {
                  return createQueryMock({
                    rows: [pricingProfile],
                    onFilter: (entry) => pricingFilters.push(entry),
                  });
                }
                if (table === "vibeusage_pricing_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                throw new Error(`Unexpected table ${table}`);
              },
            },
          };
        }
        throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
      };

      const headers = { Authorization: `Bearer ${userJwt}` };
      const summaryReq = new Request(
        "http://localhost/functions/vibeusage-usage-summary?from=2025-12-20&to=2025-12-20",
        { method: "GET", headers },
      );
      const dailyReq = new Request(
        "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-20",
        { method: "GET", headers },
      );
      const breakdownReq = new Request(
        "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20",
        { method: "GET", headers },
      );

      const summaryRes = await summaryFn(summaryReq);
      const dailyRes = await dailyFn(dailyReq);
      const breakdownRes = await breakdownFn(breakdownReq);

      assert.equal(summaryRes.status, 200);
      assert.equal(dailyRes.status, 200);
      assert.equal(breakdownRes.status, 200);

      const summaryBody = await summaryRes.json();
      const dailyBody = await dailyRes.json();
      const breakdownBody = await breakdownRes.json();

      const expected = "4.600000";
      assert.ok(
        pricingFilters.some(
          (entry) =>
            entry.op === "or" && String(entry.value || "").includes("model.eq.gpt-5.2-codex"),
        ),
        "expected pricing profile lookup for gpt-5.2-codex",
      );
      const breakdownCost = breakdownBody.sources
        .map((entry) => Number(entry?.totals?.total_cost_usd || 0))
        .reduce((sum, value) => sum + value, 0)
        .toFixed(6);

      assert.equal(dailyBody.summary?.totals?.total_cost_usd, expected);
      assert.equal(summaryBody.totals?.total_cost_usd, expected);
      assert.equal(breakdownCost, expected);
    }),
);

test(
  "vibeusage usage costs stay consistent when source contains bucket delimiter",
  { concurrency: 1 },
  () =>
    withRollupDisabled(async () => {
      const summaryFn = require("../insforge-functions/vibeusage-usage-summary");
      const dailyFn = require("../insforge-functions/vibeusage-usage-daily");
      const breakdownFn = require("../insforge-functions/vibeusage-usage-model-breakdown");

      const userId = "77777777-7777-7777-7777-777777777777";
      const userJwt = createUserJwt(userId);

      const hourlyRows = [
        {
          hour_start: "2025-12-20T01:00:00.000Z",
          source: "alpha::beta",
          model: "gpt-5.2-codex",
          total_tokens: 1000000,
          input_tokens: 1000000,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
        },
        {
          hour_start: "2025-12-20T02:00:00.000Z",
          source: "opencode",
          model: "gpt-5.2-codex",
          total_tokens: 1000000,
          input_tokens: 1000000,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
        },
      ];

      const pricingProfiles = {
        "gpt-5.2-codex": {
          model: "gpt-5.2-codex",
          source: "openrouter",
          effective_from: "2025-12-01",
          input_rate_micro_per_million: 1000000,
          cached_input_rate_micro_per_million: 0,
          output_rate_micro_per_million: 0,
          reasoning_output_rate_micro_per_million: 0,
        },
        beta: {
          model: "beta",
          source: "openrouter",
          effective_from: "2025-12-01",
          input_rate_micro_per_million: 10000000,
          cached_input_rate_micro_per_million: 0,
          output_rate_micro_per_million: 0,
          reasoning_output_rate_micro_per_million: 0,
        },
      };

      globalThis.createClient = (args) => {
        if (args && args.edgeFunctionToken === userJwt) {
          return {
            auth: {
              getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
            },
            database: {
              from: (table) => {
                if (table === "vibeusage_tracker_hourly") {
                  const query = createQueryMock({ rows: hourlyRows });
                  return { select: () => query };
                }
                if (table === "vibeusage_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                if (table === "vibeusage_pricing_profiles") {
                  const state = { model: null };
                  const query = {
                    select: () => query,
                    eq: (col, value) => {
                      if (col === "model") state.model = value;
                      return query;
                    },
                    lte: () => query,
                    order: () => query,
                    or: (expr) => {
                      const match = String(expr).match(/model\.eq\.([^,]+)/);
                      if (match) state.model = match[1];
                      return query;
                    },
                    limit: async () => {
                      const row = pricingProfiles[state.model];
                      return { data: row ? [row] : [], error: null };
                    },
                  };
                  return query;
                }
                if (table === "vibeusage_pricing_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                throw new Error(`Unexpected table ${table}`);
              },
            },
          };
        }
        throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
      };

      const headers = { Authorization: `Bearer ${userJwt}` };
      const summaryReq = new Request(
        "http://localhost/functions/vibeusage-usage-summary?from=2025-12-20&to=2025-12-20",
        { method: "GET", headers },
      );
      const dailyReq = new Request(
        "http://localhost/functions/vibeusage-usage-daily?from=2025-12-20&to=2025-12-20",
        { method: "GET", headers },
      );
      const breakdownReq = new Request(
        "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-12-20&to=2025-12-20",
        { method: "GET", headers },
      );

      const summaryRes = await summaryFn(summaryReq);
      const dailyRes = await dailyFn(dailyReq);
      const breakdownRes = await breakdownFn(breakdownReq);

      assert.equal(summaryRes.status, 200);
      assert.equal(dailyRes.status, 200);
      assert.equal(breakdownRes.status, 200);

      const summaryBody = await summaryRes.json();
      const dailyBody = await dailyRes.json();
      const breakdownBody = await breakdownRes.json();

      const expected = "2.000000";
      const breakdownCost = breakdownBody.sources
        .map((entry) => Number(entry?.totals?.total_cost_usd || 0))
        .reduce((sum, value) => sum + value, 0)
        .toFixed(6);

      assert.equal(dailyBody.summary?.totals?.total_cost_usd, expected);
      assert.equal(summaryBody.totals?.total_cost_usd, expected);
      assert.equal(breakdownCost, expected);
    }),
);

const TOKEN_TOTAL_FIELDS = [
  "total_tokens",
  "billable_total_tokens",
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
];

function toBigIntValue(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return BigInt(Math.floor(value));
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!/^[0-9]+$/.test(s)) return 0n;
    try {
      return BigInt(s);
    } catch (_e) {
      return 0n;
    }
  }
  return 0n;
}

function initTokenTotals() {
  return TOKEN_TOTAL_FIELDS.reduce((acc, field) => {
    acc[field] = 0n;
    return acc;
  }, {});
}

function normalizeTokenTotals(totals) {
  const normalized = initTokenTotals();
  for (const field of TOKEN_TOTAL_FIELDS) {
    normalized[field] = toBigIntValue(totals?.[field]);
  }
  return normalized;
}

function sumTokenTotals(rows) {
  const totals = initTokenTotals();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const field of TOKEN_TOTAL_FIELDS) {
      totals[field] += toBigIntValue(row?.[field]);
    }
  }
  return totals;
}

function assertTokenTotalsEqual(expected, actual, label) {
  for (const field of TOKEN_TOTAL_FIELDS) {
    assert.equal(actual[field], expected[field], `${label} ${field} mismatch`);
  }
}

test("vibeusage-usage-model-breakdown rejects oversized ranges", { concurrency: 1 }, async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");
  const prevMaxDays = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const userId = "55555555-5555-5555-5555-555555555555";
  const userJwt = createUserJwt(userId);
  let dbTouched = false;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = "30";
    globalThis.createClient = (args) => {
      if (args && args.edgeFunctionToken === userJwt) {
        return {
          auth: {
            getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
          },
          database: {
            from: () => {
              dbTouched = true;
              throw new Error("database should not be queried for oversized ranges");
            },
          },
        };
      }
      throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
    };

    const req = new Request(
      "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-01-01&to=2025-02-15",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${userJwt}` },
      },
    );

    const res = await fn(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(String(body.error || ""), /max/i);
    assert.equal(dbTouched, false);
  } finally {
    if (prevMaxDays === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevMaxDays;
  }
});

test("vibeusage-usage-model-breakdown emits model_id and merges aliases", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");

  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);

  const hourlyRows = [
    {
      source: "codex",
      model: "gpt-4o",
      total_tokens: 100,
      input_tokens: 60,
      cached_input_tokens: 0,
      output_tokens: 40,
      reasoning_output_tokens: 0,
    },
    {
      source: "claude",
      model: "gpt-4o-mini",
      total_tokens: 50,
      input_tokens: 30,
      cached_input_tokens: 0,
      output_tokens: 20,
      reasoning_output_tokens: 0,
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return createQueryMock({ rows: hourlyRows });
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            if (table === "vibeusage_pricing_profiles") {
              const query = createQueryMock({ rows: [] });
              query.or = () => query;
              query.limit = async () => ({ data: [], error: null });
              return query;
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-01-01&to=2025-01-01",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.sources));
  const models = body.sources.flatMap((source) => source?.models || []);
  assert.ok(models.some((entry) => entry.model_id === "gpt-4o"));
  assert.ok(models.every((entry) => entry.model_id !== "gpt-4o-mini"));
  assert.ok(models.some((entry) => entry.model === "GPT-4o"));
});

test("vibeusage-usage-model-breakdown honors alias effective_from across range", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);

  const hourlyRows = [
    {
      hour_start: "2025-01-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 100,
      input_tokens: 60,
      cached_input_tokens: 0,
      output_tokens: 40,
      reasoning_output_tokens: 0,
    },
    {
      hour_start: "2025-02-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 200,
      input_tokens: 120,
      cached_input_tokens: 0,
      output_tokens: 80,
      reasoning_output_tokens: 0,
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01",
      active: true,
    },
    {
      usage_model: "gpt-foo",
      canonical_model: "beta",
      display_name: "Beta",
      effective_from: "2025-02-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return createQueryMock({ rows: hourlyRows });
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            if (table === "vibeusage_pricing_profiles") {
              const query = createQueryMock({ rows: [] });
              query.or = () => query;
              query.limit = async () => ({ data: [], error: null });
              return query;
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-01-01&to=2025-02-15",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const models = body.sources.flatMap((source) => source?.models || []);
  const alpha = models.find((entry) => entry.model_id === "alpha");
  const beta = models.find((entry) => entry.model_id === "beta");
  assert.equal(alpha?.totals?.total_tokens, "100");
  assert.equal(beta?.totals?.total_tokens, "200");
});

test("vibeusage-usage-model-breakdown prices per-alias effective_from when unfiltered", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-model-breakdown");

  const userId = "23232323-2323-2323-2323-232323232323";
  const userJwt = createUserJwt(userId);

  const hourlyRows = [
    {
      hour_start: "2025-01-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 1000000,
      input_tokens: 1000000,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
    },
    {
      hour_start: "2025-02-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 1000000,
      input_tokens: 1000000,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01",
      active: true,
    },
    {
      usage_model: "gpt-foo",
      canonical_model: "beta",
      display_name: "Beta",
      effective_from: "2025-02-01",
      active: true,
    },
  ];

  const pricingProfiles = {
    alpha: {
      model: "alpha",
      source: "openrouter",
      effective_from: "2025-01-01",
      input_rate_micro_per_million: 1000000,
      cached_input_rate_micro_per_million: 0,
      output_rate_micro_per_million: 0,
      reasoning_output_rate_micro_per_million: 0,
    },
    beta: {
      model: "beta",
      source: "openrouter",
      effective_from: "2025-02-01",
      input_rate_micro_per_million: 2000000,
      cached_input_rate_micro_per_million: 0,
      output_rate_micro_per_million: 0,
      reasoning_output_rate_micro_per_million: 0,
    },
  };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              const query = createQueryMock({ rows: hourlyRows });
              return { select: () => query };
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            if (table === "vibeusage_pricing_profiles") {
              const state = { model: null };
              const query = {
                select: () => query,
                eq: (col, value) => {
                  if (col === "model") state.model = value;
                  return query;
                },
                lte: () => query,
                order: () => query,
                or: (expr) => {
                  const match = String(expr).match(/model\.eq\.([^,]+)/);
                  if (match) state.model = match[1];
                  return query;
                },
                limit: async () => {
                  const row = pricingProfiles[state.model];
                  return { data: row ? [row] : [], error: null };
                },
              };
              return query;
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-model-breakdown?from=2025-01-01&to=2025-02-15",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const source = body.sources.find((entry) => entry.source === "codex");
  const alpha = source?.models?.find((entry) => entry.model_id === "alpha");
  const beta = source?.models?.find((entry) => entry.model_id === "beta");
  assert.equal(alpha?.totals?.total_cost_usd, "1.000000");
  assert.equal(beta?.totals?.total_cost_usd, "2.000000");
  assert.equal(source?.totals?.total_cost_usd, "3.000000");
});

test("vibeusage-usage-daily canonical model filter includes alias rows", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-daily");

  const userId = "88888888-8888-8888-8888-888888888888";
  const userJwt = createUserJwt(userId);

  const hourlyRows = [
    {
      hour_start: "2025-01-01T00:00:00.000Z",
      source: "codex",
      model: "gpt-4o-mini",
      total_tokens: 50,
      input_tokens: 30,
      cached_input_tokens: 0,
      output_tokens: 20,
      reasoning_output_tokens: 0,
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-4o-mini",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  const filters = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return createQueryMock({
                rows: hourlyRows,
                onFilter: (entry) => filters.push(entry),
              });
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-01-01&model=gpt-4o",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const filterCalls = filters.filter((entry) => entry.op === "or");
  assert.ok(filterCalls.length > 0);
  assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.gpt-4o-mini")));
  assert.equal(body.model_id, "gpt-4o");
  assert.equal(body.model, "GPT-4o");
});

test("vibeusage-usage-daily prefixed model filter includes alias rows", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-daily");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);

  const hourlyRows = [
    {
      hour_start: "2025-01-01T00:00:00.000Z",
      source: "codex",
      model: "aws/gpt-4o",
      total_tokens: 50,
      input_tokens: 30,
      cached_input_tokens: 0,
      output_tokens: 20,
      reasoning_output_tokens: 0,
    },
  ];

  const aliasRows = [
    {
      usage_model: "aws/gpt-4o",
      canonical_model: "gpt-4o",
      display_name: "GPT-4o",
      effective_from: "2025-01-01",
      active: true,
    },
  ];

  const filters = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return createQueryMock({
                rows: hourlyRows,
                onFilter: (entry) => filters.push(entry),
              });
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-01-01&model=aws/gpt-4o",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  const filterCalls = filters.filter((entry) => entry.op === "or");
  assert.ok(filterCalls.length > 0);
  assert.ok(filterCalls.some((entry) => entry.value?.includes?.("model.ilike.aws/gpt-4o")));
  assert.equal(body.summary.totals.total_tokens, "50");
});

test("vibeusage-usage-daily honors alias effective_from across range", async () => {
  const fn = require("../insforge-functions/vibeusage-usage-daily");

  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userJwt = createUserJwt(userId);

  const hourlyRows = [
    {
      hour_start: "2025-01-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 100,
      input_tokens: 60,
      cached_input_tokens: 0,
      output_tokens: 40,
      reasoning_output_tokens: 0,
    },
    {
      hour_start: "2025-02-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 200,
      input_tokens: 120,
      cached_input_tokens: 0,
      output_tokens: 80,
      reasoning_output_tokens: 0,
    },
  ];

  const aliasRows = [
    {
      usage_model: "gpt-foo",
      canonical_model: "alpha",
      display_name: "Alpha",
      effective_from: "2025-01-01",
      active: true,
    },
    {
      usage_model: "gpt-foo",
      canonical_model: "beta",
      display_name: "Beta",
      effective_from: "2025-02-01",
      active: true,
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_tracker_hourly") {
              return createQueryMock({ rows: hourlyRows });
            }
            if (table === "vibeusage_model_aliases") {
              return createQueryMock({ rows: aliasRows });
            }
            if (table === "vibeusage_pricing_profiles") {
              const query = createQueryMock({ rows: [] });
              query.or = () => query;
              query.limit = async () => ({ data: [], error: null });
              return query;
            }
            if (table === "vibeusage_pricing_model_aliases") {
              return createQueryMock({ rows: [] });
            }
            throw new Error(`Unexpected table ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-02-15&model=alpha",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary?.totals?.total_tokens, "100");
});

test(
  "vibeusage-usage-daily prices per-alias effective_from when unfiltered",
  { concurrency: 1 },
  () =>
    withRollupDisabled(async () => {
      const fn = require("../insforge-functions/vibeusage-usage-daily");

      const userId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
      const userJwt = createUserJwt(userId);

      const hourlyRows = [
        {
          hour_start: "2025-01-15T00:00:00.000Z",
          source: "codex",
          model: "gpt-foo",
          total_tokens: 1000000,
          input_tokens: 1000000,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
        },
        {
          hour_start: "2025-02-15T00:00:00.000Z",
          source: "codex",
          model: "gpt-foo",
          total_tokens: 1000000,
          input_tokens: 1000000,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
        },
      ];

      const aliasRows = [
        {
          usage_model: "gpt-foo",
          canonical_model: "alpha",
          display_name: "Alpha",
          effective_from: "2025-01-01",
          active: true,
        },
        {
          usage_model: "gpt-foo",
          canonical_model: "beta",
          display_name: "Beta",
          effective_from: "2025-02-01",
          active: true,
        },
      ];

      const pricingProfiles = {
        alpha: {
          model: "alpha",
          source: "openrouter",
          effective_from: "2025-01-01",
          input_rate_micro_per_million: 1000000,
          cached_input_rate_micro_per_million: 0,
          output_rate_micro_per_million: 0,
          reasoning_output_rate_micro_per_million: 0,
        },
        beta: {
          model: "beta",
          source: "openrouter",
          effective_from: "2025-02-01",
          input_rate_micro_per_million: 2000000,
          cached_input_rate_micro_per_million: 0,
          output_rate_micro_per_million: 0,
          reasoning_output_rate_micro_per_million: 0,
        },
      };
      const dailyPricingRequests = [];
      globalThis.createClient = (args) => {
        if (args && args.edgeFunctionToken === userJwt) {
          return {
            auth: {
              getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
            },
            database: {
              from: (table) => {
                if (table === "vibeusage_tracker_hourly") {
                  const query = createQueryMock({ rows: hourlyRows });
                  return { select: () => query };
                }
                if (table === "vibeusage_model_aliases") {
                  return createQueryMock({ rows: aliasRows });
                }
                if (table === "vibeusage_pricing_profiles") {
                  const state = { model: null };
                  const query = {
                    select: () => query,
                    eq: (col, value) => {
                      if (col === "model") state.model = value;
                      return query;
                    },
                    lte: () => query,
                    order: () => query,
                    or: (expr) => {
                      const match = String(expr).match(/model\.eq\.([^,]+)/);
                      if (match) state.model = match[1];
                      return query;
                    },
                    limit: async () => {
                      const row = pricingProfiles[state.model];
                      return { data: row ? [row] : [], error: null };
                    },
                  };
                  return query;
                }
                if (table === "vibeusage_pricing_model_aliases") {
                  return createQueryMock({ rows: [] });
                }
                throw new Error(`Unexpected table ${table}`);
              },
            },
          };
        }
        throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
      };

      const req = new Request(
        "http://localhost/functions/vibeusage-usage-daily?from=2025-01-01&to=2025-02-15",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${userJwt}` },
        },
      );

      const res = await fn(req);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.model_id, null);
      assert.equal(body.model, null);
      assert.equal(body.summary?.totals?.total_cost_usd, "3.000000");
    }),
);

test("vibeusage-leaderboard returns a week window and slices entries to limit", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");

  const userId = "66666666-6666-6666-6666-666666666666";
  const userJwt = createUserJwt(userId);

  const entriesRows = [
    {
      rank: 1,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "60",
      claude_tokens: "40",
      total_tokens: "100",
    },
    {
      rank: 2,
      is_me: true,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "30",
      claude_tokens: "20",
      total_tokens: "50",
    },
  ];

  const meRow = { rank: 2, gpt_tokens: "30", claude_tokens: "20", total_tokens: "50" };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_week_current") {
              return {
                select: () => ({
                  order: (col, opts) => {
                    assert.equal(col, "rank");
                    assert.equal(opts?.ascending, true);
                    return {
                      range: async (from, to) => {
                        assert.equal(from, 0);
                        assert.equal(to, 0);
                        return { data: entriesRows, error: null };
                      },
                    };
                  },
                }),
              };
            }

            if (table === "vibeusage_leaderboard_me_week_current") {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard?period=week&limit=1", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "week");
  assert.equal(body.metric, "all");
  assert.ok(typeof body.generated_at === "string" && body.generated_at.includes("T"));

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
  assert.equal(body.entries[0].gpt_tokens, "60");
  assert.equal(body.entries[0].claude_tokens, "40");
  assert.equal(body.entries[0].other_tokens, "0");
  assert.equal(body.entries[0].total_tokens, "100");
  assert.equal(Object.prototype.hasOwnProperty.call(body.entries[0], "is_public"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(body.entries[0], "user_id"), true);
  assert.equal(body.entries[0].is_public, false);
  assert.equal(body.entries[0].user_id, null);

  assert.deepEqual(body.me, {
    rank: 2,
    gpt_tokens: "30",
    claude_tokens: "20",
    other_tokens: "0",
    total_tokens: "50",
  });
});

test("vibeusage-leaderboard supports month period", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");
  const userId = "77777777-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);

  const entriesRows = [
    {
      rank: 1,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "6",
      claude_tokens: "4",
      total_tokens: "10",
    },
  ];

  const meRow = { rank: 7, gpt_tokens: "3", claude_tokens: "2", total_tokens: "5" };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_month_current") {
              return {
                select: () => ({
                  order: () => ({
                    range: async () => ({ data: entriesRows, error: null }),
                  }),
                }),
              };
            }

            if (table === "vibeusage_leaderboard_me_month_current") {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard?period=month&limit=1", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "month");
  assert.equal(body.metric, "all");
  assert.equal(body.entries?.length, 1);
  assert.deepEqual(body.me, {
    rank: 7,
    gpt_tokens: "3",
    claude_tokens: "2",
    other_tokens: "0",
    total_tokens: "5",
  });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

  assert.equal(body.from, from.toISOString().slice(0, 10));
  assert.equal(body.to, to.toISOString().slice(0, 10));
});

test("vibeusage-leaderboard supports total period", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");
  const userId = "77777777-7777-7777-7777-777777777778";
  const userJwt = createUserJwt(userId);

  const entriesRows = [
    {
      rank: 1,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "600",
      claude_tokens: "400",
      total_tokens: "1000",
    },
  ];

  const meRow = { rank: 399, gpt_tokens: "30", claude_tokens: "20", total_tokens: "50" };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_total_current") {
              return {
                select: () => ({
                  order: () => ({
                    range: async () => ({ data: entriesRows, error: null }),
                  }),
                }),
              };
            }

            if (table === "vibeusage_leaderboard_me_total_current") {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard?period=total&limit=1", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "total");
  assert.equal(body.metric, "all");
  assert.equal(body.from, "1970-01-01");
  assert.equal(body.to, "9999-12-31");
});

test("vibeusage-leaderboard supports offset pagination", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");

  const userId = "99999999-6666-6666-6666-666666666666";
  const userJwt = createUserJwt(userId);

  const entriesRows = [
    {
      rank: 2,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "2",
      claude_tokens: "3",
      total_tokens: "5",
    },
    {
      rank: 3,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "4",
      claude_tokens: "1",
      total_tokens: "5",
    },
  ];

  const meRow = { rank: 99, gpt_tokens: "0", claude_tokens: "0", total_tokens: "0" };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_week_current") {
              return {
                select: () => ({
                  order: () => ({
                    range: async (from, to) => {
                      assert.equal(from, 1);
                      assert.equal(to, 2);
                      return { data: entriesRows, error: null };
                    },
                  }),
                }),
              };
            }

            if (table === "vibeusage_leaderboard_me_week_current") {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-leaderboard?period=week&limit=2&offset=1",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "week");
  assert.equal(body.metric, "all");
  assert.ok(Array.isArray(body.entries));
  assert.equal(body.entries.length, 2);
  assert.equal(body.entries[0].rank, 2);
  assert.equal(body.entries[1].rank, 3);
  assert.deepEqual(body.me, {
    rank: 99,
    gpt_tokens: "0",
    claude_tokens: "0",
    other_tokens: "0",
    total_tokens: "0",
  });
});

test("vibeusage-leaderboard supports metric=Gpt", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");

  const userId = "99999999-7777-7777-7777-777777777777";
  const userJwt = createUserJwt(userId);

  const entriesRows = [
    {
      rank: 1,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "60",
      claude_tokens: "0",
      total_tokens: "60",
    },
  ];

  const meRow = { rank: 4, gpt_tokens: "5", claude_tokens: "7", total_tokens: "12" };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_gpt_week_current") {
              return {
                select: () => ({
                  order: (col) => {
                    assert.equal(col, "rank");
                    return {
                      range: async (from, to) => {
                        assert.equal(from, 0);
                        assert.equal(to, 0);
                        return { data: entriesRows, error: null };
                      },
                    };
                  },
                }),
              };
            }

            if (table === "vibeusage_leaderboard_me_gpt_week_current") {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-leaderboard?period=week&metric=gpt&limit=1",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "week");
  assert.equal(body.metric, "gpt");
  assert.ok(Array.isArray(body.entries));
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].rank, 1);
  assert.deepEqual(body.me, {
    rank: 4,
    gpt_tokens: "5",
    claude_tokens: "7",
    other_tokens: "0",
    total_tokens: "12",
  });
});

test("vibeusage-leaderboard supports metric=other", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");

  const userId = "99999999-7878-7878-7878-787878787878";
  const userJwt = createUserJwt(userId);

  const entriesRows = [
    {
      rank: 1,
      is_me: false,
      display_name: "Anonymous",
      avatar_url: null,
      gpt_tokens: "20",
      claude_tokens: "10",
      other_tokens: "70",
      total_tokens: "100",
    },
  ];

  const meRow = {
    rank: 5,
    gpt_tokens: "5",
    claude_tokens: "6",
    other_tokens: "9",
    total_tokens: "20",
  };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_other_week_current") {
              return {
                select: () => ({
                  order: (col) => {
                    assert.equal(col, "rank");
                    return {
                      range: async (from, to) => {
                        assert.equal(from, 0);
                        assert.equal(to, 0);
                        return { data: entriesRows, error: null };
                      },
                    };
                  },
                }),
              };
            }

            if (table === "vibeusage_leaderboard_me_other_week_current") {
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: meRow, error: null }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-leaderboard?period=week&metric=other&limit=1",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "week");
  assert.equal(body.metric, "other");
  assert.ok(Array.isArray(body.entries));
  assert.equal(body.entries.length, 1);
  assert.equal(body.entries[0].rank, 1);
  assert.equal(body.entries[0].other_tokens, "70");
  assert.deepEqual(body.me, {
    rank: 5,
    gpt_tokens: "5",
    claude_tokens: "6",
    other_tokens: "9",
    total_tokens: "20",
  });
});

test("vibeusage-leaderboard rejects invalid metric", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard");
  const userId = "99999999-8888-8888-8888-888888888888";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: () => {
            throw new Error("Unexpected database access");
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    "http://localhost/functions/vibeusage-leaderboard?period=week&metric=banana",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test("vibeusage-leaderboard rejects invalid period", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard");
  const userId = "88888888-8888-8888-8888-888888888888";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: () => {
            throw new Error("Unexpected database access");
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard?period=year", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test("vibeusage-leaderboard snapshot entries gate user_id by is_public and include is_public", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard");

  const userId = "11111111-2222-3333-4444-555555555555";
  const userJwt = createUserJwt(userId);

  const publicUserId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  const snapshotRows = [
    {
      user_id: publicUserId,
      rank: 1,
      rank_gpt: 1,
      rank_claude: 1,
      display_name: "Nick",
      avatar_url: "https://example.com/avatar.png",
      is_public: true,
      gpt_tokens: "10",
      claude_tokens: "5",
      total_tokens: "15",
      generated_at: "2026-02-09T00:00:00.000Z",
    },
    {
      user_id: userId,
      rank: 2,
      rank_gpt: 2,
      rank_claude: 2,
      display_name: "Private Nick",
      avatar_url: "https://example.com/private.png",
      is_public: false,
      gpt_tokens: "7",
      claude_tokens: "3",
      total_tokens: "10",
      generated_at: "2026-02-09T00:00:00.000Z",
    },
  ];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: () => {
            throw new Error("Unexpected user database access");
          },
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            if (table !== "vibeusage_leaderboard_snapshots") {
              throw new Error(`Unexpected service table: ${String(table)}`);
            }

            return {
              select: () => {
                const q = {
                  eq: () => q,
                  order: () => q,
                  range: async () => ({ data: snapshotRows, error: null }),
                  maybeSingle: async () => ({
                    data: snapshotRows.find((row) => row.user_id === userId) || null,
                    error: null,
                  }),
                  limit: async () => ({
                    data: snapshotRows.slice(0, 1),
                    error: null,
                    count: snapshotRows.length,
                  }),
                };
                return q;
              },
            };
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard?period=week&limit=2", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(Object.prototype.hasOwnProperty.call(body.entries?.[0] || {}, "is_public"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(body.entries?.[1] || {}, "is_public"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(body.entries?.[0] || {}, "user_id"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(body.entries?.[1] || {}, "user_id"), true);

  assert.equal(body.entries?.[0]?.display_name, "Nick");
  assert.equal(body.entries?.[0]?.is_public, true);
  assert.equal(body.entries?.[0]?.user_id, publicUserId);

  assert.equal(body.entries?.[1]?.display_name, "Private Nick");
  assert.equal(body.entries?.[1]?.is_public, false);
  assert.equal(body.entries?.[1]?.user_id, null);
});

test("vibeusage-leaderboard-refresh rejects non-week period", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-refresh");

  globalThis.createClient = () => {
    throw new Error("Unexpected createClient call");
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-refresh?period=year", {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test("vibeusage-leaderboard-refresh defaults to week+month periods", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-refresh");

  const deletedPeriods = [];
  const sourceViews = [];

  function makeDeleteQuery() {
    const query = {
      filters: [],
      eq(col, value) {
        query.filters.push({ col, value });
        if (col === "period") deletedPeriods.push(String(value));
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return query;
  }

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                delete: () => makeDeleteQuery(),
                insert: async () => ({ error: null }),
              };
            }

            if (
              table === "vibeusage_leaderboard_source_week" ||
              table === "vibeusage_leaderboard_source_month"
            ) {
              sourceViews.push(table);
              return {
                select: () => ({
                  order: () => ({
                    range: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-refresh", {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.results));
  assert.equal(body.results.length, 2);
  assert.equal(body.results[0].period, "week");
  assert.equal(body.results[1].period, "month");

  assert.equal(sourceViews.includes("vibeusage_leaderboard_source_week"), true);
  assert.equal(sourceViews.includes("vibeusage_leaderboard_source_month"), true);
  assert.equal(deletedPeriods.includes("week"), true);
  assert.equal(deletedPeriods.includes("month"), true);
});

test("vibeusage-leaderboard-refresh snapshots weekly leaderboard with token fields", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-refresh");

  const deletes = [];
  const inserts = [];

  const sourceRows = [
    {
      user_id: "11111111-1111-1111-1111-111111111111",
      rank: 1,
      rank_gpt: 1,
      rank_claude: 2,
      rank_other: 1,
      gpt_tokens: "10",
      claude_tokens: "5",
      other_tokens: "30",
      total_tokens: "45",
      display_name: "Anonymous",
      avatar_url: null,
    },
    {
      user_id: "22222222-2222-2222-2222-222222222222",
      rank: 2,
      rank_gpt: 2,
      rank_claude: 1,
      rank_other: 2,
      gpt_tokens: "3",
      claude_tokens: "7",
      other_tokens: "5",
      total_tokens: "15",
      display_name: "Anonymous",
      avatar_url: null,
    },
  ];

  function makeDeleteQuery() {
    const query = {
      filters: [],
      eq(col, value) {
        query.filters.push({ col, value });
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return query;
  }

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      assert.equal(args.anonKey, ANON_KEY);
      return {
        database: {
          from: (table) => {
            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                delete: () => {
                  const query = makeDeleteQuery();
                  deletes.push(query);
                  return query;
                },
                insert: async (rows) => {
                  inserts.push({ table, rows });
                  return { error: null };
                },
              };
            }

            if (table === "vibeusage_leaderboard_source_week") {
              return {
                select: () => ({
                  order: () => ({
                    range: async (from, to) => {
                      assert.equal(from, 0);
                      assert.ok(to >= 0);
                      return { data: sourceRows, error: null };
                    },
                  }),
                }),
              };
            }

            if (table === "vibeusage_user_settings") {
              return {
                select: () => ({
                  in: async (_col, ids) => ({
                    data: ids.map((id) => ({
                      user_id: id,
                      leaderboard_public: true,
                    })),
                    error: null,
                  }),
                }),
              };
            }

            if (table === "users") {
              return {
                select: () => ({
                  in: async (_col, ids) => ({
                    data: ids.map((id, idx) => ({
                      id,
                      nickname: idx === 0 ? "" : null,
                      avatar_url: null,
                      profile: idx === 0 ? { full_name: "Alpha" } : { full_name: "Beta" },
                      metadata: null,
                    })),
                    error: null,
                  }),
                }),
              };
            }

            if (table === "vibeusage_public_views") {
              return {
                select: () => ({
                  in: (_col, ids) => ({
                    is: async () => ({
                      data: ids.map((user_id) => ({ user_id })),
                      error: null,
                    }),
                  }),
                }),
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-refresh?period=week", {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.ok(typeof body.generated_at === "string" && body.generated_at.includes("T"));
  assert.ok(Array.isArray(body.results));
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].period, "week");
  assert.equal(body.results[0].inserted, 2);

  assert.equal(deletes.length, 1);
  assert.equal(inserts.length, 1);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - today.getUTCDay()); // Sunday start
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 6);

  const inserted = inserts[0]?.rows || [];
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].period, "week");
  assert.equal(inserted[0].from_day, from.toISOString().slice(0, 10));
  assert.equal(inserted[0].to_day, to.toISOString().slice(0, 10));
  assert.equal(inserted[0].generated_at, body.generated_at);
  assert.equal(inserted[0].rank_gpt, 1);
  assert.equal(inserted[0].rank_claude, 2);
  assert.equal(inserted[0].rank_other, 1);
  assert.equal(inserted[0].gpt_tokens, "10");
  assert.equal(inserted[0].claude_tokens, "5");
  assert.equal(inserted[0].other_tokens, "30");
  assert.equal(inserted[0].total_tokens, "45");
  assert.equal(inserted[0].display_name, "Alpha");
  assert.equal(inserted[1].display_name, "Beta");
});

test("vibeusage-leaderboard-settings inserts user setting row", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard-settings");

  const userId = "99999999-9999-9999-9999-999999999999";
  const userJwt = createUserJwt(userId);

  const inserts = [];

  function makeThenableResult(result) {
    return {
      eq: () => makeThenableResult(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
  }

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_user_settings");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: async (rows) => {
                inserts.push({ table, rows });
                return { error: null };
              },
            };
          },
        },
      };
    }
    if (args && args.edgeFunctionToken && args.edgeFunctionToken !== userJwt) {
      return {
        database: {
          from: (table) => {
            if (table === "users") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { nickname: "Nick", avatar_url: "https://example.com/avatar.png" },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                update: () => makeThenableResult({ error: null }),
              };
            }
            throw new Error(`Unexpected service table: ${String(table)}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: true }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, true);
  assert.equal(typeof body.updated_at, "string");
  assert.ok(body.updated_at.includes("T"));

  assert.equal(inserts.length, 1);
  const row = inserts[0].rows?.[0];
  assert.equal(row.user_id, userId);
  assert.equal(row.leaderboard_public, true);
  assert.equal(typeof row.updated_at, "string");
});

test("vibeusage-leaderboard-settings updates existing row", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard-settings");

  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userJwt = createUserJwt(userId);

  const updates = [];
  const snapshotUpdates = [];

  function makeThenableResult(result) {
    return {
      eq: () => makeThenableResult(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
  }

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_settings") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { user_id: userId }, error: null }),
                  }),
                }),
                update: (values) => ({
                  eq: async (col, value) => {
                    updates.push({ table, values, where: { col, value } });
                    return { error: null };
                  },
                }),
              };
            }
            if (table === "vibeusage_public_views") {
              return {
                update: () => ({
                  eq: async () => ({ error: null }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${String(table)}`);
          },
        },
      };
    }
    if (args && args.edgeFunctionToken && args.edgeFunctionToken !== userJwt) {
      return {
        database: {
          from: (table) => {
            if (table === "users") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { nickname: "Nick", avatar_url: "https://example.com/avatar.png" },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                update: (values) => {
                  snapshotUpdates.push(values);
                  return makeThenableResult({ error: null });
                },
              };
            }
            throw new Error(`Unexpected service table: ${String(table)}`);
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: false }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, false);
  assert.equal(typeof body.updated_at, "string");

  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.col, "user_id");
  assert.equal(updates[0].where.value, userId);
  assert.equal(updates[0].values.leaderboard_public, false);
  assert.equal(typeof updates[0].values.updated_at, "string");

  assert.equal(snapshotUpdates.length, 3);
  assert.equal(snapshotUpdates.every((values) => values?.is_public === false), true);
  assert.equal(snapshotUpdates.every((values) => values?.display_name === "Anonymous"), true);
  assert.equal(snapshotUpdates.every((values) => values?.avatar_url === null), true);
});

test("vibeusage-leaderboard-settings syncs snapshot display name from profile fallback", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard-settings");

  const userId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userJwt = createUserJwt(userId);

  const snapshotUpdates = [];

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_settings") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { user_id: userId }, error: null }),
                  }),
                }),
                update: (values) => ({
                  eq: async () => ({ error: null, values }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${String(table)}`);
          },
        },
      };
    }

    if (args && args.edgeFunctionToken && args.edgeFunctionToken !== userJwt) {
      return {
        database: {
          from: (table) => {
            if (table === "users") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        nickname: null,
                        avatar_url: "https://example.com/victor.png",
                        profile: { full_name: "Victor Wu" },
                        metadata: null,
                      },
                      error: null,
                    }),
                  }),
                }),
              };
            }

            if (table === "vibeusage_public_views") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({ data: { user_id: userId }, error: null }),
                    }),
                  }),
                }),
              };
            }

            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                update: (values) => {
                  const entry = { values, filters: [] };
                  snapshotUpdates.push(entry);
                  const query = {
                    eq: (col, value) => {
                      entry.filters.push({ col, value });
                      return query;
                    },
                    then: (resolve, reject) =>
                      Promise.resolve({ error: null }).then(resolve, reject),
                  };
                  return query;
                },
              };
            }

            throw new Error(`Unexpected service table: ${String(table)}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: true }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, true);
  assert.equal(snapshotUpdates.length, 3);
  assert.equal(snapshotUpdates[0].values.display_name, "Victor Wu");
  assert.equal(snapshotUpdates[0].values.avatar_url, "https://example.com/victor.png");
  assert.equal(snapshotUpdates.every((entry) => entry.values?.is_public === true), true);
});

test("vibeusage-leaderboard-settings returns user setting state", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard-settings");

  const userId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_user_settings");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { leaderboard_public: true, updated_at: "2026-02-09T00:00:00.000Z" },
                    error: null,
                  }),
                }),
              }),
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, true);
  assert.equal(body.updated_at, "2026-02-09T00:00:00.000Z");
});

test("vibeusage-leaderboard-settings defaults to false when missing row", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard-settings");

  const userId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            assert.equal(table, "vibeusage_user_settings");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            };
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.leaderboard_public, false);
  assert.equal(body.updated_at, null);
});

test("vibeusage-leaderboard-settings rejects invalid body", async () => {
  const fn = require("../insforge-functions/vibeusage-leaderboard-settings");

  const userId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: () => {
            throw new Error("Unexpected database access");
          },
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: "yes" }),
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test("vibeusage-leaderboard-profile rejects missing user_id", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-profile");

  const userId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
      };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-leaderboard-profile", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 400);
});

test("vibeusage-leaderboard-profile hides non-public users", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-profile");

  const userId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  const userJwt = createUserJwt(userId);
  const targetUserId = "aaaaaaaa-0000-0000-0000-000000000000";

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            if (table !== "vibeusage_user_settings") {
              throw new Error(`Unexpected service table: ${String(table)}`);
            }
            return {
              select: () => {
                const q = {
                  eq: () => q,
                  maybeSingle: async () => ({ data: { leaderboard_public: false }, error: null }),
                };
                return q;
              },
            };
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    `http://localhost/functions/vibeusage-leaderboard-profile?user_id=${encodeURIComponent(targetUserId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 404);
});

test("vibeusage-leaderboard-profile requires active public link for non-self user", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-profile");

  const userId = "ffff0000-0000-0000-0000-000000000000";
  const userJwt = createUserJwt(userId);
  const targetUserId = "ffff0000-0000-0000-0000-000000000001";
  let snapshotRead = false;

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            if (table === "vibeusage_user_settings") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    maybeSingle: async () => ({ data: { leaderboard_public: true }, error: null }),
                  };
                  return q;
                },
              };
            }

            if (table === "vibeusage_public_views") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    is: () => q,
                    limit: () => q,
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                  return q;
                },
              };
            }

            if (table === "vibeusage_leaderboard_snapshots") {
              snapshotRead = true;
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                  return q;
                },
              };
            }

            throw new Error(`Unexpected service table: ${String(table)}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    `http://localhost/functions/vibeusage-leaderboard-profile?user_id=${encodeURIComponent(targetUserId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 404);
  assert.equal(snapshotRead, false);
});

test("vibeusage-leaderboard-profile hides snapshot rows marked private", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-profile");

  const userId = "999a0000-0000-0000-0000-000000000000";
  const userJwt = createUserJwt(userId);
  const targetUserId = "999a0000-0000-0000-0000-000000000001";

  const snapshotRow = {
    user_id: targetUserId,
    display_name: "Nick",
    avatar_url: "https://example.com/avatar.png",
    rank: 12,
    gpt_tokens: "10",
    claude_tokens: "5",
    other_tokens: "2",
    total_tokens: "17",
    is_public: false,
    generated_at: "2026-02-09T00:00:00.000Z",
  };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            if (table === "vibeusage_user_settings") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    maybeSingle: async () => ({ data: { leaderboard_public: true }, error: null }),
                  };
                  return q;
                },
              };
            }

            if (table === "vibeusage_public_views") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    is: () => q,
                    limit: () => q,
                    maybeSingle: async () => ({ data: { user_id: targetUserId }, error: null }),
                  };
                  return q;
                },
              };
            }

            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    maybeSingle: async () => ({ data: snapshotRow, error: null }),
                  };
                  return q;
                },
              };
            }

            throw new Error(`Unexpected service table: ${String(table)}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    `http://localhost/functions/vibeusage-leaderboard-profile?user_id=${encodeURIComponent(targetUserId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 404);
});

test("vibeusage-leaderboard-profile returns weekly snapshot entry for public user", async () => {
  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
    INSFORGE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  });

  const fn = require("../insforge-functions/vibeusage-leaderboard-profile");

  const userId = "99990000-0000-0000-0000-000000000000";
  const userJwt = createUserJwt(userId);
  const targetUserId = "99990000-0000-0000-0000-000000000001";

  const snapshotRow = {
    user_id: targetUserId,
    display_name: "Nick",
    avatar_url: "https://example.com/avatar.png",
    rank: 12,
    gpt_tokens: "10",
    claude_tokens: "5",
    other_tokens: "2",
    total_tokens: "17",
    is_public: true,
    generated_at: "2026-02-09T00:00:00.000Z",
  };

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            if (table === "vibeusage_user_settings") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    maybeSingle: async () => ({ data: { leaderboard_public: true }, error: null }),
                  };
                  return q;
                },
              };
            }

            if (table === "vibeusage_public_views") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    is: () => q,
                    limit: () => q,
                    maybeSingle: async () => ({ data: { user_id: targetUserId }, error: null }),
                  };
                  return q;
                },
              };
            }

            if (table === "vibeusage_leaderboard_snapshots") {
              return {
                select: () => {
                  const q = {
                    eq: () => q,
                    maybeSingle: async () => ({ data: snapshotRow, error: null }),
                  };
                  return q;
                },
              };
            }

            throw new Error(`Unexpected service table: ${String(table)}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request(
    `http://localhost/functions/vibeusage-leaderboard-profile?user_id=${encodeURIComponent(targetUserId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  );

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.period, "week");
  assert.equal(body.entry?.user_id, targetUserId);
  assert.equal(body.entry?.display_name, "Nick");
  assert.equal(body.entry?.rank, 12);
  assert.equal(body.entry?.other_tokens, "2");
  assert.equal(body.entry?.total_tokens, "17");
});

test("vibeusage-user-status returns pro.active for cutoff user", async () => {
  const fn = require("../insforge-functions/vibeusage-user-status");

  const userId = "11111111-1111-1111-1111-111111111111";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_entitlements") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_subscriptions") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_device_tokens") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_devices") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }
            if (table === 'vibeusage_tracker_device_tokens') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({ data: [{ id: 'tok_1' }], count: 2, error: null })
                        })
                      })
                    };
                  }

                  if (columns === 'last_used_at') {
                    return {
                      eq: () => ({
                        is: () => ({
                          order: () => ({
                            limit: async () => ({
                              data: [{ last_used_at: '2026-02-12T03:00:00.000Z' }],
                              error: null
                            })
                          })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected token select: ${String(columns)}`);
                }
              };
            }
            if (table === 'vibeusage_tracker_devices') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({ data: [{ id: 'dev_1' }], count: 2, error: null })
                        })
                      })
                    };
                  }

                  if (columns === 'last_seen_at') {
                    return {
                      eq: () => ({
                        is: () => ({
                          order: () => ({
                            limit: async () => ({
                              data: [{ last_seen_at: '2026-02-12T04:00:00.000Z' }],
                              error: null
                            })
                          })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected device select: ${String(columns)}`);
                }
              };
            }
            throw new Error(`Unexpected user table: ${String(table)}`);
          },
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            assert.equal(table, "users");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { created_at: "2025-01-01T00:00:00Z" },
                    error: null,
                  }),
                }),
              }),
            };
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-user-status", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.pro.active, true);
  assert.equal(body.pro.sources.includes('registration_cutoff'), true);
  assert.equal(body.install.partial, false);
  assert.equal(typeof body.install.as_of, 'string');
  assert.equal(body.install.has_active_device_token, true);
  assert.equal(body.install.has_active_device, true);
  assert.equal(body.install.active_device_tokens, 2);
  assert.equal(body.install.active_devices, 2);
  assert.equal(body.install.latest_token_activity_at, '2026-02-12T03:00:00.000Z');
  assert.equal(body.install.latest_device_seen_at, '2026-02-12T04:00:00.000Z');
});

test("vibeusage-user-status returns tracked subscriptions for identity card", async () => {
  const fn = require("../insforge-functions/vibeusage-user-status");

  const userId = "11111111-1111-1111-1111-111111111119";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_entitlements") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }

            if (table === "vibeusage_tracker_subscriptions") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({
                      data: [
                        {
                          tool: "claude",
                          provider: "anthropic",
                          product: "subscription",
                          plan_type: "max",
                          rate_limit_tier: "default_claude_max_5x",
                          updated_at: "2026-02-11T12:00:00.000Z",
                        },
                        {
                          tool: "codex",
                          provider: "openai",
                          product: "chatgpt",
                          plan_type: "pro",
                          updated_at: "2026-02-11T11:00:00.000Z",
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_device_tokens") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({
                        data: [
                          {
                            id: "tok_1",
                            last_used_at: "2026-02-11T10:00:00.000Z",
                          },
                          {
                            id: "tok_2",
                            last_used_at: "2026-02-11T13:00:00.000Z",
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_devices") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({
                        data: [
                          {
                            id: "dev_1",
                            last_seen_at: "2026-02-11T09:00:00.000Z",
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }

            if (table === 'vibeusage_tracker_device_tokens') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({ data: [], count: 0, error: null })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected token select: ${String(columns)}`);
                }
              };
            }

            if (table === 'vibeusage_tracker_devices') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({ data: [], count: 0, error: null })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected device select: ${String(columns)}`);
                }
              };
            }

            throw new Error(`Unexpected user table: ${String(table)}`);
          },
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            assert.equal(table, "users");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { created_at: "2025-01-01T00:00:00Z" },
                    error: null,
                  }),
                }),
              }),
            };
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-user-status", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.subscriptions.partial, false);
  assert.equal(Array.isArray(body.subscriptions.items), true);
  assert.equal(body.subscriptions.items.length, 2);
  assert.equal(body.subscriptions.items[0].tool, "claude");
  assert.equal(body.subscriptions.items[0].plan_type, "max");
  assert.equal(body.subscriptions.items[1].tool, "codex");
  assert.equal(body.subscriptions.items[1].plan_type, "pro");
  assert.equal(body.install.partial, false);
  assert.equal(body.install.has_active_device_token, true);
  assert.equal(body.install.has_active_device, true);
  assert.equal(body.install.active_device_tokens, 2);
  assert.equal(body.install.active_devices, 1);
  assert.equal(body.install.latest_token_activity_at, "2026-02-11T13:00:00.000Z");
  assert.equal(body.install.latest_device_seen_at, "2026-02-11T09:00:00.000Z");
});

test("vibeusage-user-status marks install partial when device tables are missing", async () => {
  const fn = require("../insforge-functions/vibeusage-user-status");

  const userId = "11111111-1111-1111-1111-11111111111a";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_entitlements") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_subscriptions") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_device_tokens") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({
                        data: null,
                        error: {
                          code: "42P01",
                          message: 'relation "vibeusage_tracker_device_tokens" does not exist',
                        },
                      }),
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_devices") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({
                        data: null,
                        error: {
                          code: "42P01",
                          message: 'relation "vibeusage_tracker_devices" does not exist',
                        },
                      }),
                    }),
                  }),
                }),
              };
            }
            if (table === 'vibeusage_tracker_device_tokens') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({ data: [], count: 0, error: null })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected token select: ${String(columns)}`);
                }
              };
            }
            if (table === 'vibeusage_tracker_devices') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({ data: [], count: 0, error: null })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected device select: ${String(columns)}`);
                }
              };
            }
            throw new Error(`Unexpected user table: ${String(table)}`);
          },
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            assert.equal(table, "users");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { created_at: "2025-01-01T00:00:00Z" },
                    error: null,
                  }),
                }),
              }),
            };
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-user-status", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.install.partial, true);
  assert.equal(body.install.has_active_device_token, false);
  assert.equal(body.install.has_active_device, false);
  assert.equal(body.install.active_device_tokens, 0);
  assert.equal(body.install.active_devices, 0);
  assert.equal(body.install.latest_token_activity_at, null);
  assert.equal(body.install.latest_device_seen_at, null);
});

test("vibeusage-user-status falls back to users table when created_at missing", async () => {
  const fn = require("../insforge-functions/vibeusage-user-status");

  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_entitlements") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_subscriptions") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_device_tokens") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_devices") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected user table: ${String(table)}`);
          },
        },
      };
    }

    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return {
        database: {
          from: (table) => {
            assert.equal(table, "users");
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { created_at: "2025-01-01T00:00:00Z" },
                    error: null,
                  }),
                }),
              }),
            };
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-user-status", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.pro.active, true);
  assert.equal(body.pro.sources.includes("registration_cutoff"), true);
});

test("vibeusage-user-status degrades when created_at missing and no service role", async () => {
  const fn = require("../insforge-functions/vibeusage-user-status");

  setDenoEnv({
    INSFORGE_INTERNAL_URL: BASE_URL,
    ANON_KEY,
  });

  const userId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: {
          from: (table) => {
            if (table === "vibeusage_user_entitlements") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({
                      data: [
                        {
                          effective_from: "2025-01-01T00:00:00Z",
                          effective_to: "2027-01-01T00:00:00Z",
                          revoked_at: null,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_subscriptions") {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_device_tokens") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }
            if (table === "vibeusage_tracker_devices") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      order: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              };
            }
            if (table === 'vibeusage_tracker_device_tokens') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({
                            data: null,
                            error: { code: '42P01', message: 'relation "vibeusage_tracker_device_tokens" does not exist' }
                          })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected token select: ${String(columns)}`);
                }
              };
            }
            if (table === 'vibeusage_tracker_devices') {
              return {
                select: (columns, options) => {
                  if (columns === 'id' && options?.count === 'exact') {
                    return {
                      eq: () => ({
                        is: () => ({
                          limit: async () => ({
                            data: null,
                            error: { message: 'relation "vibeusage_tracker_devices" does not exist' }
                          })
                        })
                      })
                    };
                  }

                  throw new Error(`Unexpected device select: ${String(columns)}`);
                }
              };
            }
            throw new Error(`Unexpected user table: ${String(table)}`);
          },
        },
      };
    }

    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-user-status", {
    method: "GET",
    headers: { Authorization: `Bearer ${userJwt}` },
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.created_at, null);
  assert.equal(body.pro.partial, true);
  assert.equal(body.pro.active, true);
  assert.equal(body.pro.sources.includes('entitlement'), true);
  assert.equal(body.install.partial, true);
  assert.equal(body.install.has_active_device_token, false);
  assert.equal(body.install.has_active_device, false);
  assert.equal(body.install.active_device_tokens, 0);
  assert.equal(body.install.active_devices, 0);
  assert.equal(body.install.latest_token_activity_at, null);
  assert.equal(body.install.latest_device_seen_at, null);
});

test('vibeusage-user-status returns 500 for unrelated missing relation errors', async () => {
  const fn = require('../insforge-functions/vibeusage-user-status');

  const userId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
        },
        database: {
          from: (table) => {
            if (table === 'vibeusage_user_entitlements') {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null })
                  })
                })
              };
            }

            if (table === 'vibeusage_tracker_subscriptions') {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({
                      data: null,
                      error: { code: '42P01', message: 'relation "vibeusage_unrelated_table" does not exist' }
                    })
                  })
                })
              };
            }

            throw new Error(`Unexpected user table: ${String(table)}`);
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
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(String(body.error || ''), /vibeusage_unrelated_table/i);
});

test("vibeusage-entitlements rejects non-admin caller", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const userId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = () => {
    throw new Error("Unexpected createClient");
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({}),
  });

  const res = await fn(req);
  assert.equal(res.status, 401);
});

test("vibeusage-entitlements inserts entitlement (admin)", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createServiceDbMock();
  const userId = "22222222-2222-2222-2222-222222222222";

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      user_id: userId,
      source: "manual",
      effective_from: "2025-01-01T00:00:00Z",
      effective_to: "2124-01-01T00:00:00Z",
      note: "test",
    }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.user_id, userId);
  assert.equal(body.source, "manual");
  assert.equal(body.note, "test");
  assert.equal(db.inserts.length, 1);
  assert.equal(db.inserts[0].table, "vibeusage_user_entitlements");
  assert.equal(db.inserts[0].rows[0].user_id, userId);
});

test("vibeusage-entitlements replays idempotency_key without duplicate insert", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createEntitlementsDbMock();
  const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const body = {
    user_id: userId,
    source: "manual",
    effective_from: "2025-01-01T00:00:00Z",
    effective_to: "2124-01-01T00:00:00Z",
    note: "test",
    idempotency_key: "entitlement-1",
  };

  const req1 = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body),
  });
  const res1 = await fn(req1);
  assert.equal(res1.status, 200);
  const row1 = await res1.json();

  const req2 = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body),
  });
  const res2 = await fn(req2);
  assert.equal(res2.status, 200);
  const row2 = await res2.json();

  assert.equal(row1.id, row2.id);
  assert.equal(db.rows.size, 1);
});

test("vibeusage-entitlements accepts long idempotency_key without collisions", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createEntitlementsDbMock();
  const userId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const longPrefix = "k".repeat(128);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const base = {
    user_id: userId,
    source: "manual",
    effective_from: "2025-01-01T00:00:00Z",
    effective_to: "2124-01-01T00:00:00Z",
    note: "test",
  };

  const res1 = await fn(
    new Request("http://localhost/functions/vibeusage-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        ...base,
        idempotency_key: `${longPrefix}A`,
      }),
    }),
  );
  assert.equal(res1.status, 200);
  const row1 = await res1.json();

  const res2 = await fn(
    new Request("http://localhost/functions/vibeusage-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        ...base,
        idempotency_key: `${longPrefix}B`,
      }),
    }),
  );
  assert.equal(res2.status, 200);
  const row2 = await res2.json();

  assert.notEqual(row1.id, row2.id);
  assert.equal(db.rows.size, 2);
});

test("vibeusage-entitlements normalizes user_id for idempotency replays", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createEntitlementsDbMock({ normalizeUserId: true });
  const userId = "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA";

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const body = {
    user_id: userId,
    source: "manual",
    effective_from: "2025-01-01T00:00:00Z",
    effective_to: "2124-01-01T00:00:00Z",
    note: "test",
    idempotency_key: "entitlement-uppercase",
  };

  const res1 = await fn(
    new Request("http://localhost/functions/vibeusage-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify(body),
    }),
  );
  assert.equal(res1.status, 200);
  const row1 = await res1.json();

  const res2 = await fn(
    new Request("http://localhost/functions/vibeusage-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify(body),
    }),
  );
  assert.equal(res2.status, 200);
  const row2 = await res2.json();

  assert.equal(row1.id, row2.id);
  assert.equal(db.rows.size, 1);
});

test("vibeusage-entitlements rejects idempotency_key payload mismatch", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createEntitlementsDbMock();
  const userId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const base = {
    user_id: userId,
    source: "manual",
    effective_from: "2025-01-01T00:00:00Z",
    effective_to: "2124-01-01T00:00:00Z",
    note: "alpha",
    idempotency_key: "entitlement-mismatch",
  };

  const res1 = await fn(
    new Request("http://localhost/functions/vibeusage-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify(base),
    }),
  );
  assert.equal(res1.status, 200);

  const res2 = await fn(
    new Request("http://localhost/functions/vibeusage-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ ...base, note: "beta" }),
    }),
  );

  assert.equal(res2.status, 409);
  const body = await res2.json();
  assert.equal(body.error, "Entitlement already exists with different payload");
  assert.equal(db.rows.size, 1);
});

test("vibeusage-entitlements returns existing row after insert conflict", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const userId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  const conflictRow = {
    id: "99999999-9999-9999-9999-999999999999",
    user_id: userId,
    source: "manual",
    effective_from: "2025-01-01T00:00:00Z",
    effective_to: "2124-01-01T00:00:00Z",
    revoked_at: null,
    note: "test",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    created_by: null,
  };
  const db = createEntitlementsDbMock({ conflictRow });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      id: conflictRow.id,
      user_id: userId,
      source: "manual",
      effective_from: conflictRow.effective_from,
      effective_to: conflictRow.effective_to,
      note: conflictRow.note,
    }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, conflictRow.id);
});

test("vibeusage-entitlements rejects id reuse across users", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const existingId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const existingRow = {
    id: existingId,
    user_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    source: "manual",
    effective_from: "2025-01-01T00:00:00Z",
    effective_to: "2124-01-01T00:00:00Z",
    revoked_at: null,
    note: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    created_by: null,
  };
  const db = createEntitlementsDbMock({ seedRows: [existingRow] });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      id: existingId,
      user_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      source: "manual",
      effective_from: "2025-01-01T00:00:00Z",
      effective_to: "2124-01-01T00:00:00Z",
      note: "test",
    }),
  });

  const res = await fn(req);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "Entitlement already exists with different payload");
});

test("vibeusage-entitlements accepts project_admin token", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createServiceDbMock();
  const userId = "44444444-4444-4444-4444-444444444444";
  const projectAdminJwt = createJwt({ role: "project_admin" });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === projectAdminJwt) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${projectAdminJwt}` },
    body: JSON.stringify({
      user_id: userId,
      source: "manual",
      effective_from: "2025-01-01T00:00:00Z",
      effective_to: "2124-01-01T00:00:00Z",
    }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
});

test("vibeusage-entitlements accepts project_admin token from roles array", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements");

  const db = createServiceDbMock();
  const userId = "55555555-5555-5555-5555-555555555555";
  const projectAdminJwt = createJwt({ app_metadata: { roles: ["user", "project_admin"] } });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === projectAdminJwt) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${projectAdminJwt}` },
    body: JSON.stringify({
      user_id: userId,
      source: "manual",
      effective_from: "2025-01-01T00:00:00Z",
      effective_to: "2124-01-01T00:00:00Z",
    }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
});

test("vibeusage-entitlements-revoke updates revoked_at (admin)", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements-revoke");

  const db = createServiceDbMock();
  const entitlementId = "33333333-3333-3333-3333-333333333333";

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements-revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ id: entitlementId }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.id, entitlementId);
  assert.equal(typeof body.revoked_at, "string");
  assert.equal(db.updates.length, 1);
  assert.equal(db.updates[0].table, "vibeusage_user_entitlements");
  assert.equal(db.updates[0].where.col, "id");
  assert.equal(db.updates[0].where.value, entitlementId);
});

test("vibeusage-entitlements-revoke accepts project_admin token", async () => {
  const fn = require("../insforge-functions/vibeusage-entitlements-revoke");

  const db = createServiceDbMock();
  const entitlementId = "55555555-5555-5555-5555-555555555555";
  const projectAdminJwt = createJwt({ role: "project_admin" });

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === projectAdminJwt) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-entitlements-revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${projectAdminJwt}` },
    body: JSON.stringify({ id: entitlementId }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
});

test("vibeusage-link-code-init issues a short-lived link code", async () => {
  const fn = require("../insforge-functions/vibeusage-link-code-init");

  const db = createServiceDbMock();
  const userId = "66666666-6666-6666-6666-666666666666";
  const userJwt = createUserJwt(userId);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === userJwt) {
      return {
        auth: {
          getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
        database: db.db,
      };
    }
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-link-code-init", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({}),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(typeof body.link_code, "string");
  assert.ok(body.link_code.length > 0);
  assert.equal(typeof body.expires_at, "string");

  const insert = db.inserts.find((i) => i.table === "vibeusage_link_codes");
  assert.ok(insert, "link code insert missing");
  const row = insert.rows?.[0] || {};

  assert.equal(typeof row.code_hash, "string");
  assert.equal(row.code_hash.length, 64);
  assert.equal(typeof row.session_id, "string");
  assert.equal(row.session_id.length, 64);
  assert.notEqual(row.session_id, userJwt);
  assert.equal(row.used_at, null);
});

test("vibeusage-link-code-exchange creates device token and marks link code used", async () => {
  const fn = require("../insforge-functions/vibeusage-link-code-exchange");

  const linkCode = "link_code_test";
  const requestId = "req_123";
  const userId = "77777777-7777-7777-7777-777777777777";
  const linkCodeRow = {
    id: "link_code_id",
    user_id: userId,
    code_hash: createHash("sha256").update(linkCode).digest("hex"),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: null,
    request_id: null,
    device_id: null,
  };
  const db = createLinkCodeExchangeDbMock(linkCodeRow);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-link-code-exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_code: linkCode, request_id: requestId }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  const codeHash = createHash("sha256").update(linkCode).digest("hex");
  const expectedToken = createHash("sha256")
    .update(`${SERVICE_ROLE_KEY}:${codeHash}:${requestId}`)
    .digest("hex");
  const expectedTokenHash = createHash("sha256").update(expectedToken).digest("hex");

  assert.equal(body.token, expectedToken);
  assert.equal(body.user_id, userId);

  const deviceInsert = db.inserts.find((entry) => entry.table === "vibeusage_tracker_devices");
  assert.ok(deviceInsert, "device insert missing");
  const deviceRow = deviceInsert.rows[0];
  assert.equal(body.device_id, deviceRow.id);

  const tokenInsert = db.inserts.find((entry) => entry.table === "vibeusage_tracker_device_tokens");
  assert.ok(tokenInsert, "token insert missing");
  assert.equal(tokenInsert.rows[0].token_hash, expectedTokenHash);
  assert.equal(tokenInsert.rows[0].device_id, deviceRow.id);

  const update = db.updates.find((entry) => entry.table === "vibeusage_link_codes");
  assert.ok(update, "link code update missing");
  assert.equal(update.values.request_id, requestId);
  assert.equal(update.values.device_id, deviceRow.id);
  assert.equal(
    update.filters.some(
      (filter) => filter.op === "is" && filter.col === "used_at" && filter.value === null,
    ),
    true,
  );
});

test("vibeusage-link-code-exchange returns existing device for repeated request", async () => {
  const fn = require("../insforge-functions/vibeusage-link-code-exchange");

  const linkCode = "link_code_used";
  const requestId = "req_repeat";
  const userId = "88888888-8888-8888-8888-888888888888";
  const deviceId = "device_existing";
  const linkCodeRow = {
    id: "link_code_id_used",
    user_id: userId,
    code_hash: createHash("sha256").update(linkCode).digest("hex"),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: new Date().toISOString(),
    request_id: requestId,
    device_id: deviceId,
  };
  const db = createLinkCodeExchangeDbMock(linkCodeRow);

  globalThis.createClient = (args) => {
    if (args && args.edgeFunctionToken === SERVICE_ROLE_KEY) {
      return { database: db.db };
    }
    throw new Error(`Unexpected createClient args: ${JSON.stringify(args)}`);
  };

  const req = new Request("http://localhost/functions/vibeusage-link-code-exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_code: linkCode, request_id: requestId }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.device_id, deviceId);
  assert.equal(body.user_id, userId);
  assert.equal(db.inserts.length, 0);
  assert.equal(db.updates.length, 0);
});
