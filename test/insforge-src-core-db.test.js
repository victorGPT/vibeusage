const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const usageSummaryCore = require("../insforge-src/shared/core/usage-summary");
const usageMonthlyCore = require("../insforge-src/shared/core/usage-monthly");
const usageDailyCore = require("../insforge-src/shared/core/usage-daily");
const usageAggregateCollector = require("../insforge-src/shared/core/usage-aggregate-collector");
require("../insforge-src/shared/usage-pricing-core");
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
const usageFilter = require("../insforge-src/shared/core/usage-filter");
const usageHourlyDb = require("../insforge-src/shared/db/usage-hourly");

let ingestCore;
let records;
let ingestDb;

test.before(async () => {
  ingestCore = await importModule("../insforge-src/shared/core/ingest.mjs");
  records = await importModule("../insforge-src/shared/db/records.mjs");
  ingestDb = await importModule("../insforge-src/shared/db/ingest.mjs");
});

function importModule(relativePath) {
  return import(pathToFileURL(path.join(__dirname, relativePath)).href);
}

test("normalizeHourlyPayload accepts supported shapes", () => {
  assert.deepEqual(ingestCore.normalizeHourlyPayload([{}]), [{}]);
  assert.deepEqual(ingestCore.normalizeHourlyPayload({ hourly: [{}] }), [{}]);
  assert.deepEqual(ingestCore.normalizeHourlyPayload({ data: [{}, {}] }), [{}, {}]);
  assert.deepEqual(ingestCore.normalizeHourlyPayload({ data: { hourly: [{ ok: true }] } }), [
    { ok: true },
  ]);
  assert.equal(ingestCore.normalizeHourlyPayload({}), null);
});

test("normalizeDeviceSubscriptionsPayload accepts supported shapes", () => {
  assert.deepEqual(
    ingestCore.normalizeDeviceSubscriptionsPayload({ device_subscriptions: [{ tool: "codex" }] }),
    [{ tool: "codex" }],
  );
  assert.deepEqual(
    ingestCore.normalizeDeviceSubscriptionsPayload({
      data: { device_subscriptions: [{ tool: "claude" }] },
    }),
    [{ tool: "claude" }],
  );
  assert.equal(ingestCore.normalizeDeviceSubscriptionsPayload({}), null);
});

test("parseHourlyBucket validates half-hour boundaries and tokens", () => {
  const valid = ingestCore.parseHourlyBucket({
    hour_start: "2026-01-25T10:30:00.000Z",
    source: "codex",
    model: "gpt-4o",
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.hour_start, "2026-01-25T10:30:00.000Z");
  assert.equal(valid.value.total_tokens, "3");

  const invalid = ingestCore.parseHourlyBucket({ hour_start: "2026-01-25T10:31:00.000Z" });
  assert.equal(invalid.ok, false);
});

test("parseHourlyBucket accepts bigint-scale token strings without overflow", () => {
  const valid = ingestCore.parseHourlyBucket({
    hour_start: "2026-01-25T10:30:00.000Z",
    source: "hermes",
    model: "gpt-5",
    input_tokens: "2609396608",
    cached_input_tokens: "0",
    output_tokens: "12",
    reasoning_output_tokens: "0",
    total_tokens: "2609396620",
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.input_tokens, "2609396608");
  assert.equal(valid.value.total_tokens, "2609396620");
});

test("parseProjectHourlyBucket validates half-hour boundaries and project fields", () => {
  const valid = ingestCore.parseProjectHourlyBucket({
    hour_start: "2026-01-25T10:30:00.000Z",
    source: "codex",
    project_key: "proj_1",
    project_ref: "https://github.com/victorGPT/vibeusage",
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3,
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.project_key, "proj_1");

  const invalid = ingestCore.parseProjectHourlyBucket({ hour_start: "2026-01-25T10:31:00.000Z" });
  assert.equal(invalid.ok, false);
});

test("buildRows dedupes hourly buckets by hour/source/model", () => {
  const nowIso = "2026-01-25T12:00:00.000Z";
  const tokenRow = { user_id: "u1", device_id: "d1", id: "t1" };
  const hourly = [
    {
      hour_start: "2026-01-25T10:00:00.000Z",
      source: "codex",
      model: "gpt-4o",
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2,
    },
    {
      hour_start: "2026-01-25T10:00:00.000Z",
      source: "codex",
      model: "gpt-4o",
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2,
    },
  ];
  const rows = ingestCore.buildRows({ hourly, tokenRow, nowIso });
  assert.equal(rows.error, null);
  assert.equal(rows.data.length, 1);
  assert.equal(rows.data[0].user_id, "u1");
});

test("buildSubscriptionRows dedupes by tool/provider/product and normalizes values", () => {
  const nowIso = "2026-02-11T12:00:00.000Z";
  const tokenRow = { user_id: "u1", device_id: "d1", id: "t1" };
  const subscriptions = [
    { tool: "codex", provider: "openai", product: "chatgpt", planType: "pro" },
    { tool: "codex", provider: "openai", product: "chatgpt", planType: "plus" },
    {
      tool: "claude",
      provider: "anthropic",
      product: "subscription",
      planType: "max",
      rateLimitTier: "default_claude_max_5x",
    },
  ];

  const rows = ingestCore.buildSubscriptionRows({ subscriptions, tokenRow, nowIso });
  assert.equal(rows.error, null);
  assert.equal(rows.data.length, 2);
  const codex = rows.data.find((row) => row.tool === "codex");
  const claude = rows.data.find((row) => row.tool === "claude");
  assert.equal(codex.plan_type, "plus");
  assert.equal(claude.rate_limit_tier, "default_claude_max_5x");
  assert.equal(claude.user_id, "u1");
  assert.equal(claude.device_token_id, "t1");
});

test("pricing bucket key helpers round-trip JSON encoding", () => {
  const key = usageSummaryCore.buildPricingBucketKey("codex", "gpt-4o", "2026-01-25");
  const parsed = usageSummaryCore.parsePricingBucketKey(key, "fallback");
  assert.equal(parsed.usageKey, "gpt-4o");
  assert.equal(parsed.dateKey, "2026-01-25");
});

test("pricing bucket key helpers handle legacy delimited keys", () => {
  const parsed = usageSummaryCore.parsePricingBucketKey("codex::gpt-4o::2026-01-25", "fallback");
  assert.equal(parsed.usageKey, "gpt-4o");
  assert.equal(parsed.dateKey, "2026-01-25");
});

test("recordsUpsert builds expected headers and query params", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ hour_start: "2026-01-25T10:00:00.000Z" }]),
    };
  };

  const res = await records.recordsUpsert({
    url: new URL("https://example.com/api/database/records/vibeusage_tracker_hourly"),
    anonKey: "anon",
    tokenHash: "hash",
    rows: [{ id: 1 }],
    onConflict: "user_id,device_id",
    prefer: "return=representation",
    resolution: "merge-duplicates",
    select: "hour_start",
    fetcher: fakeFetch,
  });

  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.ok(url.includes("on_conflict=user_id%2Cdevice_id"));
  assert.ok(url.includes("select=hour_start"));
  assert.equal(init.headers.Authorization, "Bearer anon");
  assert.equal(init.headers["x-vibeusage-device-token-hash"], "hash");
  assert.ok(String(init.headers.Prefer || "").includes("return=representation"));
});

test("isUpsertUnsupported flags conflict-related errors", () => {
  assert.equal(records.isUpsertUnsupported({ status: 422, error: "invalid on_conflict" }), true);
  assert.equal(records.isUpsertUnsupported({ status: 500, error: "oops" }), false);
});

test("initMonthlyBuckets creates month keys and zeroed buckets", () => {
  const start = { year: 2026, month: 1, day: 1 };
  const { monthKeys, buckets } = usageMonthlyCore.initMonthlyBuckets({
    startMonthParts: start,
    months: 2,
  });
  assert.deepEqual(monthKeys, ["2026-01", "2026-02"]);
  assert.equal(buckets.get("2026-01").total, 0n);
  assert.equal(buckets.get("2026-02").billable, 0n);
});

test("ingestMonthlyRow accumulates token totals into buckets", () => {
  const start = { year: 2026, month: 1, day: 1 };
  const { buckets } = usageMonthlyCore.initMonthlyBuckets({ startMonthParts: start, months: 1 });
  const tzContext = { timeZone: "UTC", offsetMinutes: 0 };
  const row = {
    hour_start: "2026-01-15T00:00:00.000Z",
    source: "codex",
    total_tokens: 5,
    input_tokens: 2,
    cached_input_tokens: 1,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    billable_total_tokens: 5,
  };
  const ok = usageMonthlyCore.ingestMonthlyRow({
    buckets,
    row,
    usageRow: {
      date: new Date("2026-01-15T00:00:00.000Z"),
      billable: 5n,
    },
    tzContext,
  });
  assert.equal(ok, true);
  const bucket = buckets.get("2026-01");
  assert.equal(bucket.total, 5n);
  assert.equal(bucket.billable, 5n);
  assert.equal(bucket.input, 2n);
  assert.equal(bucket.cached, 1n);
});

test("ingestMonthlyRow skips rows outside initialized month buckets", () => {
  const start = { year: 2026, month: 1, day: 1 };
  const { buckets } = usageMonthlyCore.initMonthlyBuckets({ startMonthParts: start, months: 1 });
  const tzContext = { timeZone: "UTC", offsetMinutes: 0 };
  const row = {
    hour_start: "2026-02-15T00:00:00.000Z",
    source: "codex",
    total_tokens: 5,
  };
  const ok = usageMonthlyCore.ingestMonthlyRow({
    buckets,
    row,
    usageRow: {
      date: new Date("2026-02-15T00:00:00.000Z"),
      billable: 5n,
    },
    tzContext,
  });
  assert.equal(ok, false);
  assert.equal(buckets.get("2026-01").total, 0n);
});

test("buildHourlyUsageQuery applies filters and ordering", () => {
  const calls = [];
  const query = {
    eq: (field, value) => (calls.push(["eq", field, value]), query),
    gte: (field, value) => (calls.push(["gte", field, value]), query),
    lt: (field, value) => (calls.push(["lt", field, value]), query),
    order: (field, opts) => (calls.push(["order", field, opts]), query),
    neq: (field, value) => (calls.push(["neq", field, value]), query),
    or: (value) => (calls.push(["or", value]), query),
  };
  const edgeClient = {
    database: {
      from: (table) => (
        calls.push(["from", table]),
        {
          select: (cols) => (calls.push(["select", cols]), query),
        }
      ),
    },
  };

  usageHourlyDb.buildHourlyUsageQuery({
    edgeClient,
    userId: "u1",
    source: "codex",
    usageModels: ["gpt-4o"],
    canonicalModel: "gpt-4o",
    startIso: "2026-01-01T00:00:00.000Z",
    endIso: "2026-01-02T00:00:00.000Z",
    select: "hour_start,source,total_tokens",
  });

  assert.deepEqual(calls[0], ["from", "vibeusage_tracker_hourly"]);
  assert.deepEqual(calls[1], ["select", "hour_start,source,total_tokens"]);
  assert.ok(calls.find((call) => call[0] === "eq" && call[1] === "user_id" && call[2] === "u1"));
  assert.ok(calls.find((call) => call[0] === "eq" && call[1] === "source" && call[2] === "codex"));
  assert.ok(calls.find((call) => call[0] === "gte" && call[1] === "hour_start"));
  assert.ok(calls.find((call) => call[0] === "lt" && call[1] === "hour_start"));
  assert.ok(calls.find((call) => call[0] === "order" && call[1] === "hour_start"));
});

test("buildHourlyUsageQuery throws when edgeClient missing", () => {
  assert.throws(() => usageHourlyDb.buildHourlyUsageQuery({}), /edgeClient/i);
});

test("hourly usage db exports shared select contracts", () => {
  assert.equal(usageHourlyDb.DEFAULT_HOURLY_USAGE_SELECT, "hour_start,source,model,total_tokens");
  assert.equal(
    usageHourlyDb.DETAILED_HOURLY_USAGE_SELECT,
    "hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens",
  );
  assert.equal(
    usageHourlyDb.AGGREGATE_HOURLY_USAGE_SELECT,
    "source,hour:hour_start,sum_total_tokens:sum(total_tokens),sum_input_tokens:sum(input_tokens),sum_cached_input_tokens:sum(cached_input_tokens),sum_output_tokens:sum(output_tokens),sum_reasoning_output_tokens:sum(reasoning_output_tokens),sum_billable_total_tokens:sum(billable_total_tokens),count_rows:count(),count_billable_total_tokens:count(billable_total_tokens)",
  );
});

test("forEachHourlyUsagePage paginates through hourly query rows", async () => {
  const calls = [];
  const pages = [
    [{ hour_start: "2026-01-01T00:00:00.000Z" }, { hour_start: "2026-01-01T00:30:00.000Z" }],
    [{ hour_start: "2026-01-01T01:00:00.000Z" }],
  ];
  const edgeClient = {
    database: {
      from: (table) => {
        calls.push(["from", table]);
        const query = {
          eq: (field, value) => (calls.push(["eq", field, value]), query),
          gte: (field, value) => (calls.push(["gte", field, value]), query),
          lt: (field, value) => (calls.push(["lt", field, value]), query),
          order: (field, opts) => (calls.push(["order", field, opts]), query),
          neq: (field, value) => (calls.push(["neq", field, value]), query),
          or: (value) => (calls.push(["or", value]), query),
          range: async (from, to) => {
            calls.push(["range", from, to]);
            if (from === 0) return { data: pages[0], error: null };
            if (from === 2) return { data: pages[1], error: null };
            return { data: [], error: null };
          },
        };
        return {
          select: (cols) => (calls.push(["select", cols]), query),
        };
      },
    },
  };

  const seen = [];
  const result = await usageHourlyDb.forEachHourlyUsagePage({
    edgeClient,
    userId: "u1",
    startIso: "2026-01-01T00:00:00.000Z",
    endIso: "2026-01-02T00:00:00.000Z",
    select: "hour_start",
    pageSize: 2,
    onPage: (rows) => seen.push(rows.map((row) => row.hour_start)),
  });

  assert.equal(result.error, null);
  assert.equal(result.rowCount, 3);
  assert.deepEqual(seen, [
    ["2026-01-01T00:00:00.000Z", "2026-01-01T00:30:00.000Z"],
    ["2026-01-01T01:00:00.000Z"],
  ]);
  assert.deepEqual(
    calls.filter((call) => call[0] === "range"),
    [
      ["range", 0, 1],
      ["range", 2, 3],
    ],
  );
});

test("collectAggregateUsageRange reuses hourly paging, filtering, and aggregate ingestion", async () => {
  const pages = [
    [
      {
        hour_start: "2026-01-01T00:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        total_tokens: 6,
        billable_total_tokens: 4,
        input_tokens: 2,
        cached_input_tokens: 0,
        output_tokens: 4,
        reasoning_output_tokens: 0,
      },
      {
        hour_start: "2026-01-01T00:30:00.000Z",
        source: "codex",
        model: "other-model",
        total_tokens: 9,
        billable_total_tokens: 9,
        input_tokens: 4,
        cached_input_tokens: 0,
        output_tokens: 5,
        reasoning_output_tokens: 0,
      },
    ],
    [
      {
        hour_start: "2026-01-01T01:00:00.000Z",
        source: "codex",
        model: "gpt-4o",
        total_tokens: 5,
        input_tokens: 3,
        cached_input_tokens: 0,
        output_tokens: 2,
        reasoning_output_tokens: 0,
      },
    ],
  ];

  const edgeClient = {
    database: {
      from: () => {
        const query = {
          eq: () => query,
          gte: () => query,
          lt: () => query,
          order: () => query,
          neq: () => query,
          or: () => query,
          range: async (from) => {
            if (from === 0) return { data: pages[0], error: null };
            if (from === 2) return { data: pages[1], error: null };
            return { data: [], error: null };
          },
        };
        return {
          select: () => query,
        };
      },
    },
  };

  const state = usagePricingCore.createAggregateUsageState({
    hasModelParam: false,
    defaultModel: "unknown",
  });
  const seen = [];

  const result = await usageAggregateCollector.collectAggregateUsageRange({
    edgeClient,
    userId: "u1",
    canonicalModel: "gpt-4o",
    hasModelFilter: true,
    aliasTimeline: null,
    effectiveDate: "2026-01-01",
    startIso: "2026-01-01T00:00:00.000Z",
    endIso: "2026-01-02T00:00:00.000Z",
    state,
    pageSize: 2,
    onAccumulatedRow: ({ row, accumulation }) => {
      seen.push([row.hour_start, accumulation.billable.toString()]);
    },
  });

  assert.equal(result.error, null);
  assert.equal(result.rowCount, 3);
  assert.equal(result.state, state);
  assert.deepEqual(seen, [
    ["2026-01-01T00:00:00.000Z", "4"],
    ["2026-01-01T01:00:00.000Z", "5"],
  ]);
  assert.equal(state.totals.total_tokens, 11n);
  assert.equal(state.totals.billable_total_tokens, 9n);
  assert.equal(state.pricingBuckets.size, 1);
  assert.deepEqual(Array.from(state.distinctModels), ["gpt-4o"]);
  assert.deepEqual(Array.from(state.distinctUsageModels), ["gpt-4o"]);
});

test("fetchDeviceTokenRow uses records API and ignores revoked tokens", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          { id: "t1", user_id: "u1", device_id: "d1", revoked_at: null, last_sync_at: null },
        ]),
    };
  };

  const tokenRow = await ingestDb.fetchDeviceTokenRow({
    baseUrl: "https://example.com",
    anonKey: "anon",
    tokenHash: "hash",
    fetcher: fakeFetch,
  });

  assert.equal(tokenRow.id, "t1");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes("/api/database/records/vibeusage_tracker_device_tokens"));
  assert.ok(calls[0].url.includes("token_hash=eq.hash"));
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer anon");
});

test("upsertProjectUsage uses correct table and onConflict keys", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ hour_start: "2026-01-25T10:30:00.000Z" }]),
    };
  };

  await ingestDb.upsertProjectUsage({
    baseUrl: "https://example.com",
    anonKey: "anon",
    tokenHash: "hash",
    rows: [
      { user_id: "u1", project_key: "p1", hour_start: "2026-01-25T10:30:00.000Z", source: "codex" },
    ],
    nowIso: "2026-01-25T12:00:00.000Z",
    fetcher: fakeFetch,
  });

  assert.ok(calls[0].url.includes("/api/database/records/vibeusage_project_usage_hourly"));
  assert.ok(calls[0].url.includes("on_conflict=user_id%2Cproject_key%2Chour_start%2Csource"));
});

test("upsertDeviceSubscriptions uses correct table and onConflict keys", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ tool: "codex", provider: "openai", product: "chatgpt" }]),
    };
  };

  await ingestDb.upsertDeviceSubscriptions({
    baseUrl: "https://example.com",
    anonKey: "anon",
    tokenHash: "hash",
    rows: [
      {
        user_id: "u1",
        device_id: "d1",
        device_token_id: "t1",
        tool: "codex",
        provider: "openai",
        product: "chatgpt",
        plan_type: "pro",
        observed_at: "2026-02-11T12:00:00.000Z",
        updated_at: "2026-02-11T12:00:00.000Z",
      },
    ],
    fetcher: fakeFetch,
  });

  assert.ok(calls[0].url.includes("/api/database/records/vibeusage_tracker_subscriptions"));
  assert.ok(calls[0].url.includes("on_conflict=user_id%2Ctool%2Cprovider%2Cproduct"));
});

test("touchDeviceTokenAndDevice updates last_sync_at only when interval elapsed", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => "[]" };
  };

  await ingestDb.touchDeviceTokenAndDevice({
    baseUrl: "https://example.com",
    anonKey: "anon",
    tokenHash: "hash",
    tokenRow: { id: "t1", device_id: "d1", last_sync_at: "2026-01-25T00:00:00.000Z" },
    nowIso: "2026-01-25T01:00:00.000Z",
    fetcher: fakeFetch,
    minIntervalMinutes: 30,
  });

  assert.equal(calls.length, 2);
  const tokenUpdate = JSON.parse(calls[0].init.body);
  assert.equal(tokenUpdate.last_used_at, "2026-01-25T01:00:00.000Z");
  assert.equal(tokenUpdate.last_sync_at, "2026-01-25T01:00:00.000Z");
});

test("shouldIncludeUsageRow matches canonical model when filter enabled", () => {
  const ok = usageFilter.shouldIncludeUsageRow({
    row: { hour_start: "2026-01-25T00:00:00.000Z", model: "gpt-4o" },
    canonicalModel: "gpt-4o",
    hasModelFilter: true,
    aliasTimeline: new Map(),
    to: "2026-01-25",
  });
  assert.equal(ok, true);
});

test("shouldIncludeUsageRow rejects mismatched model when filter enabled", () => {
  const ok = usageFilter.shouldIncludeUsageRow({
    row: { hour_start: "2026-01-25T00:00:00.000Z", model: "other" },
    canonicalModel: "gpt-4o",
    hasModelFilter: true,
    aliasTimeline: new Map(),
    to: "2026-01-25",
  });
  assert.equal(ok, false);
});

test("shouldIncludeUsageRow returns true when model filter disabled", () => {
  const ok = usageFilter.shouldIncludeUsageRow({
    row: { hour_start: "2026-01-25T00:00:00.000Z", model: "gpt-4o" },
    canonicalModel: null,
    hasModelFilter: false,
    aliasTimeline: new Map(),
    to: "2026-01-25",
  });
  assert.equal(ok, true);
});

test("shouldIncludeUsageRow matches canonical alias rows via effective timeline", () => {
  const ok = usageFilter.shouldIncludeUsageRow({
    row: { hour_start: "2026-01-25T00:00:00.000Z", model: "gpt-4o-mini" },
    canonicalModel: "gpt-4o",
    hasModelFilter: true,
    aliasTimeline: new Map([
      [
        "gpt-4o-mini",
        [{ model_id: "gpt-4o", model: "GPT-4o", effective_from: "2026-01-01" }],
      ],
      ["gpt-4o", [{ model_id: "gpt-4o", model: "GPT-4o", effective_from: "2026-01-01" }]],
    ]),
    to: "2026-01-25",
  });
  assert.equal(ok, true);
});

test("initDailyBuckets creates zeroed daily buckets", () => {
  const { buckets } = usageDailyCore.initDailyBuckets(["2026-01-25"]);
  const bucket = buckets.get("2026-01-25");
  assert.equal(bucket.total, 0n);
  assert.equal(bucket.billable, 0n);
});

test("applyDailyBucket updates daily totals", () => {
  const { buckets } = usageDailyCore.initDailyBuckets(["2026-01-25"]);
  const ok = usageDailyCore.applyDailyBucket({
    buckets,
    row: {
      hour_start: "2026-01-25T00:00:00.000Z",
      total_tokens: 5,
      input_tokens: 2,
      cached_input_tokens: 1,
      output_tokens: 2,
      reasoning_output_tokens: 0,
    },
    tzContext: { timeZone: "UTC", offsetMinutes: 0 },
    billable: 5n,
  });
  assert.equal(ok, true);
  const bucket = buckets.get("2026-01-25");
  assert.equal(bucket.total, 5n);
  assert.equal(bucket.billable, 5n);
});

test("applyDailyBucket rejects invalid hour_start", () => {
  const { buckets } = usageDailyCore.initDailyBuckets(["2026-01-25"]);
  const ok = usageDailyCore.applyDailyBucket({
    buckets,
    row: { hour_start: "not-a-date", total_tokens: 1 },
    tzContext: { timeZone: "UTC", offsetMinutes: 0 },
    billable: 0n,
  });
  assert.equal(ok, false);
});

test("usage-monthly esm source imports getLocalParts from shared/date", () => {
  const filePath = path.join(
    __dirname,
    "..",
    "insforge-src",
    "functions-esm",
    "vibeusage-usage-monthly.js",
  );
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes("getLocalParts"));
});

test("vibeusage-ingest uses shared ingest db and avoids RPC", () => {
  const filePath = path.join(__dirname, "..", "insforge-src", "functions-esm", "vibeusage-ingest.js");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes("shared/db/ingest"));
  assert.equal(content.includes("/api/database/rpc/vibeusage_touch_device_token_sync"), false);
});
