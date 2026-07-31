const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const { loadDashboardModule } = require("./helpers/load-dashboard-module");

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function loadVibescoreApi() {
  return loadDashboardModule("dashboard/src/lib/vibeusage-api.ts");
}

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  if (ORIGINAL_FETCH === undefined) delete globalThis.fetch;
  else globalThis.fetch = ORIGINAL_FETCH;
});

// /api/functions/{slug} is the admin management API, not an invocation route.
// Falling back to it on 404 turned a backend outage into a bogus
// "Admin access required" permission error, so a 404 now surfaces as-is.
test("usage summary surfaces 404 instead of falling back to the admin API", async () => {
  const { getUsageSummary } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.includes("/functions/vibeusage-usage-summary")) {
      return jsonResponse({ error: "Not Found", message: "Not Found" }, 404);
    }
    return jsonResponse({ error: "Unexpected", message: "Unexpected" }, 500);
  };

  await assert.rejects(
    () =>
      getUsageSummary({
        baseUrl: "https://example.test",
        accessToken: "token",
        from: "2025-01-01",
        to: "2025-01-01",
      }),
    (err) => Number(err?.status) === 404 || Number(err?.statusCode) === 404,
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.includes("/functions/"));
  assert.ok(!calls.some((c) => c.includes("/api/functions/")));
});

test("usage summary does not fall back on 401", async () => {
  const { getUsageSummary } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);

    if (target.includes("/api/functions/vibeusage-usage-summary")) {
      return jsonResponse({ totals: { total_tokens: "0" } }, 200);
    }
    if (target.includes("/functions/vibeusage-usage-summary")) {
      return jsonResponse({ error: "Unauthorized", message: "Unauthorized" }, 401);
    }

    return jsonResponse({ error: "Unexpected", message: "Unexpected" }, 500);
  };

  await assert.rejects(
    () =>
      getUsageSummary({
        baseUrl: "https://example.test",
        accessToken: "token",
        from: "2025-01-01",
        to: "2025-01-01",
      }),
    (err) => Number(err?.status) === 401 || Number(err?.statusCode) === 401,
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.includes("/functions/"));
});

test("project usage summary reads from /functions only", async () => {
  const { getProjectUsageSummary } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.includes("/functions/vibeusage-project-usage-summary")) {
      return jsonResponse(
        {
          from: "2025-01-01",
          to: "2025-01-01",
          entries: [
            {
              project_key: "acme/alpha",
              project_ref: "https://github.com/acme/alpha",
              total_tokens: "10",
              billable_total_tokens: "10",
            },
          ],
        },
        200,
      );
    }
    return jsonResponse({ error: "Unexpected", message: "Unexpected" }, 500);
  };

  const res = await getProjectUsageSummary({
    baseUrl: "https://example.test",
    accessToken: "token",
    limit: 3,
  });

  assert.equal(res?.entries?.[0]?.project_key, "acme/alpha");
  assert.equal(calls.length, 1);
  assert.ok(!calls.some((c) => c.includes("/api/functions/")));
});

test("leaderboard reads from /functions only", async () => {
  const { getLeaderboard } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.includes("/functions/vibeusage-leaderboard")) {
      return jsonResponse(
        {
          period: "total",
          from: "2025-01-01",
          to: "2025-01-31",
          entries: [{ rank: 1, display_name: "NEO", total_tokens: "1000", is_me: false }],
          me: { rank: 9, total_tokens: "200" },
        },
        200,
      );
    }
    return jsonResponse({ error: "Unexpected", message: "Unexpected" }, 500);
  };

  const res = await getLeaderboard({
    baseUrl: "https://example.test",
    accessToken: "token",
    period: "total",
    limit: 20,
  });

  assert.equal(res?.entries?.[0]?.display_name, "NEO");
  assert.equal(calls.length, 1);
  assert.ok(!calls.some((c) => c.includes("/api/functions/")));
});

test("link code init posts to /functions", async () => {
  const { requestInstallLinkCode } = await loadVibescoreApi();
  const calls = [];

  globalThis.fetch = async (input, init = {}) => {
    const target = typeof input === "string" ? input : input?.url || "";
    const method = init?.method || input?.method;
    calls.push({ target, method });

    if (target.includes("/functions/vibeusage-link-code-init")) {
      return jsonResponse(
        {
          link_code: "link_code_example",
          expires_at: "2025-01-01T00:00:00.000Z",
        },
        200,
      );
    }

    return jsonResponse({ error: "Unexpected", message: "Unexpected" }, 500);
  };

  const res = await requestInstallLinkCode({
    baseUrl: "https://example.test",
    accessToken: "token",
  });

  assert.equal(res?.link_code, "link_code_example");
  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.target?.includes("/functions/vibeusage-link-code-init"));
  assert.equal(calls[0]?.method, "POST");
});
