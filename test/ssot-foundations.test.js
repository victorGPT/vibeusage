const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

function stripModulePrelude(content) {
  return content
    .split("\n")
    .filter((line) => !line.startsWith('require("./') && !line.startsWith('import "./'))
    .join("\n");
}

test("copy registry runtime and tooling reuse the shared parser", () => {
  assert.match(read("dashboard/src/lib/copy.ts"), /src\/shared\/copy-registry\.cjs/);
  assert.match(read("scripts/validate-copy-registry.cjs"), /src\/shared\/copy-registry\.cjs/);
  assert.match(read("dashboard/vite.config.js"), /src\/shared\/copy-registry\.cjs/);
});

test("runtime defaults are imported from a shared module", () => {
  assert.match(read("src/lib/runtime-config.js"), /shared\/runtime-defaults\.cjs/);
  assert.match(read("dashboard/src/lib/config.ts"), /shared\/runtime-defaults\.cjs/);
  assert.match(read("scripts\/acceptance\/usage-cost-consistency.cjs"), /shared\/runtime-defaults\.cjs/);
});

test("dashboard and cli API clients reuse the shared function contract", () => {
  assert.match(read("dashboard/src/lib/vibeusage-api.ts"), /shared\/vibeusage-function-contract\.cjs/);
  assert.match(read("src/lib/vibeusage-api.js"), /shared\/vibeusage-function-contract\.cjs/);
});

test("backend model semantics flow through a single shared core", () => {
  assert.equal(
    read("insforge-src/shared/usage-model-core.js"),
    read("insforge-src/shared/usage-model-core.mjs"),
  );
  assert.match(read("insforge-src/shared/model.js"), /usage-model-core/);
  assert.match(read("insforge-src/shared/model-identity.js"), /usage-model-core/);
  assert.match(read("insforge-src/shared/model-alias-timeline.js"), /usage-model-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /shared\/usage-model-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /matchesCanonicalModelAtDate = usageModelCore\.matchesCanonicalModelAtDate/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /resolveUsageFilterContext = usageModelCore\.resolveUsageFilterContext/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /resolveUsageTimelineContext = usageModelCore\.resolveUsageTimelineContext/,
  );
  assert.match(read("insforge-src/shared/model-identity.js"), /resolveUsageFilterContext/);
  assert.match(read("insforge-src/shared/model-identity.js"), /resolveUsageTimelineContext/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /shared\/core\/usage-filter-request\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /shared\/core\/usage-filtered-rows\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /shared\/core\/usage-filter-request\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /shared\/core\/usage-filter-request\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /shared\/core\/usage-filtered-rows\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /shared\/core\/usage-filtered-rows\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveUsageFilterContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveUsageFilterContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /resolveUsageFilterContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /resolveUsageFilterContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /resolveUsageFilterContext/,
  );
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /resolveUsageTimelineContext/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /resolveUsageTimelineContext/,
  );
  assert.doesNotMatch(read("insforge-src/shared/usage-pricing-core.js"), /fetchAliasRows/);
  assert.doesNotMatch(read("insforge-src/shared/usage-pricing-core.js"), /buildAliasTimeline/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /fetchAliasRows/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /buildAliasTimeline/,
  );
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /shared\/core\/usage-hourly\.js/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /shared\/core\/usage-filtered-rows\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /matchesCanonicalModelAtDate/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /matchesCanonicalModelAtDate/,
  );
});

test("backend pricing and usage metrics semantics flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/runtime-primitives-core.js"),
    read("insforge-src/shared/runtime-primitives-core.mjs"),
  );
  assert.equal(read("insforge-src/shared/env-core.js"), read("insforge-src/shared/env-core.mjs"));
  assert.equal(
    read("insforge-src/shared/pricing-core.js"),
    read("insforge-src/shared/pricing-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-metrics-core.js"),
    read("insforge-src/shared/usage-metrics-core.mjs"),
  );
  assert.match(read("insforge-src/shared/numbers.js"), /runtime-primitives-core/);
  assert.match(read("insforge-src/shared/source.js"), /runtime-primitives-core/);
  assert.match(read("insforge-src/functions-esm/shared/numbers.js"), /runtime-primitives-core\.mjs/);
  assert.match(read("insforge-src/functions-esm/shared/source.js"), /runtime-primitives-core\.mjs/);
  assert.match(read("insforge-src/shared/env.js"), /env-core/);
  assert.match(read("insforge-src/functions-esm/shared/env.js"), /env-core\.mjs/);
  assert.match(read("insforge-src/shared/pricing.js"), /pricing-core/);
  assert.match(read("insforge-src/shared/usage-billable.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/shared/usage-aggregate.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/shared/usage-rollup.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/shared/core/usage-summary.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/functions-esm/shared/pricing.js"), /shared\/pricing-core\.mjs/);
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /shared\/usage-metrics-core\.mjs/,
  );
});

test("backend auth and public sharing semantics flow through shared cores", () => {
  assert.equal(read("insforge-src/shared/auth-core.js"), read("insforge-src/shared/auth-core.mjs"));
  assert.equal(
    read("insforge-src/shared/public-sharing-core.js"),
    read("insforge-src/shared/public-sharing-core.mjs"),
  );
  assert.match(read("insforge-src/shared/auth.js"), /auth-core/);
  assert.match(read("insforge-src/shared/public-view.js"), /public-sharing-core/);
  assert.match(read("insforge-src/shared/public-visibility.js"), /public-sharing-core/);
  assert.match(read("insforge-src/functions-esm/shared/auth.js"), /shared\/auth-core\.mjs/);
  assert.match(
    read("insforge-src/functions-esm/shared/public-view.js"),
    /shared\/public-sharing-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/public-visibility.js"),
    /shared\/public-sharing-core\.mjs/,
  );
});

test("backend pro status and http helpers flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/pro-status-core.js"),
    read("insforge-src/shared/pro-status-core.mjs"),
  );
  assert.equal(read("insforge-src/shared/http-core.js"), read("insforge-src/shared/http-core.mjs"));
  assert.match(read("insforge-src/shared/pro-status.js"), /pro-status-core/);
  assert.match(read("insforge-src/functions-esm/shared/pro-status.js"), /shared\/pro-status-core\.mjs/);
  assert.match(read("insforge-src/shared/http.js"), /http-core/);
  assert.match(read("insforge-src/functions-esm/shared/http.js"), /shared\/http-core\.mjs/);
});

test("backend canary debug and crypto helpers flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/canary-core.js"),
    read("insforge-src/shared/canary-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/debug-core.js"),
    read("insforge-src/shared/debug-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/crypto-core.js"),
    read("insforge-src/shared/crypto-core.mjs"),
  );
  assert.match(read("insforge-src/shared/canary.js"), /canary-core/);
  assert.match(read("insforge-src/functions-esm/shared/canary.js"), /shared\/canary-core\.mjs/);
  assert.match(read("insforge-src/shared/debug.js"), /debug-core/);
  assert.match(read("insforge-src/functions-esm/shared/debug.js"), /shared\/debug-core\.mjs/);
  assert.match(read("insforge-src/shared/crypto.js"), /crypto-core/);
  assert.match(read("insforge-src/functions-esm/shared/crypto.js"), /shared\/crypto-core\.mjs/);
});

test("backend usage response assembly flows through a shared core", () => {
  const stripUsageResponsePrelude = (content) =>
    stripModulePrelude(content).replace(/^"use strict";\n/, "").replace(/^\s+/, "");
  assert.equal(
    stripUsageResponsePrelude(read("insforge-src/shared/usage-response-core.js")),
    stripUsageResponsePrelude(read("insforge-src/shared/usage-response-core.mjs")),
  );
  assert.match(read("insforge-src/shared/usage-response-core.js"), /require\("\.\/debug-core"\)/);
  assert.match(read("insforge-src/shared/usage-response-core.js"), /require\("\.\/http-core"\)/);
  assert.match(read("insforge-src/shared/usage-response-core.mjs"), /import "\.\/debug-core\.mjs"/);
  assert.match(read("insforge-src/shared/usage-response-core.mjs"), /import "\.\/http-core\.mjs"/);
  assert.match(read("insforge-src/shared/core/usage-response.js"), /usage-response-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-response.js"),
    /shared\/usage-response-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-endpoint.js"),
    /from "\.\/usage-response\.js"/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /withSlowQueryDebugPayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /isDebugEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /withSlowQueryDebugPayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /isDebugEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /withSlowQueryDebugPayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /isDebugEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /withSlowQueryDebugPayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /isDebugEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /withSlowQueryDebugPayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /isDebugEnabled/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /withSlowQueryDebugPayload/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /isDebugEnabled/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /withSlowQueryDebugPayload/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /isDebugEnabled/,
  );
});

test("usage endpoint preflight flows through a shared ESM helper", () => {
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-endpoint.js"),
    /function prepareUsageEndpoint/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-endpoint.js"),
    /async function requireUsageAccess/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-endpoint.js"),
    /function respondUsageRequestError/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-endpoint.js"),
    /from "\.\.\/auth\.js"/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-endpoint.js"),
    /from "\.\/usage-response\.js"/,
  );
  for (const relPath of [
    "insforge-src/functions-esm/vibeusage-usage-summary.js",
    "insforge-src/functions-esm/vibeusage-usage-daily.js",
    "insforge-src/functions-esm/vibeusage-usage-hourly.js",
    "insforge-src/functions-esm/vibeusage-usage-heatmap.js",
    "insforge-src/functions-esm/vibeusage-usage-monthly.js",
    "insforge-src/functions-esm/vibeusage-usage-model-breakdown.js",
    "insforge-src/functions-esm/vibeusage-project-usage-summary.js",
  ]) {
    const content = read(relPath);
    assert.match(content, /shared\/core\/usage-endpoint\.js/);
    assert.doesNotMatch(content, /handleOptions\(/);
    assert.doesNotMatch(content, /getBearerToken\(/);
    assert.doesNotMatch(content, /getAccessContext\(/);
    assert.doesNotMatch(content, /createUsageJsonResponder\(/);
  }
});

test("backend date and logging helpers flow through shared cores", () => {
  assert.equal(read("insforge-src/shared/date-core.js"), read("insforge-src/shared/date-core.mjs"));
  assert.equal(
    read("insforge-src/shared/logging-core.js"),
    read("insforge-src/shared/logging-core.mjs"),
  );
  assert.match(read("insforge-src/shared/date.js"), /date-core/);
  assert.match(read("insforge-src/functions-esm/shared/date.js"), /shared\/date-core\.mjs/);
  assert.match(read("insforge-src/shared/date-core.js"), /function normalizeIso/);
  assert.match(read("insforge-src/shared/date-core.js"), /function isWithinInterval/);
  assert.match(read("insforge-src/shared/date-core.js"), /function resolveUsageDateRangeLocal/);
  assert.match(read("insforge-src/shared/logging.js"), /logging-core/);
  assert.match(read("insforge-src/functions-esm/shared/logging.js"), /shared\/logging-core\.mjs/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /normalizeIso/);
  assert.match(read("insforge-src/functions-esm/shared/date.js"), /resolveUsageDateRangeLocal/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveUsageDateRangeLocal/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveUsageDateRangeLocal/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /shared\/core\/usage-range-request\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /resolveUsageDateRangeLocal/,
  );
  assert.match(read("insforge-src/functions-esm\/vibeusage-sync-ping.js"), /from "\.\/shared\/date\.js"/);
  assert.match(read("insforge-src/shared\/db\/ingest.js"), /require\(\"..\/date\"\)/);
  assert.match(read("insforge-src/functions-esm\/vibeusage-user-status.js"), /from "\.\/shared\/date\.js"/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /function normalizeIso/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-user-status.js"), /function normalizeIso/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-sync-ping.js"), /function normalizeIso/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-sync-ping.js"), /function isWithinInterval/);
  assert.doesNotMatch(read("insforge-src/shared\/db\/ingest.js"), /function normalizeIso/);
  assert.doesNotMatch(read("insforge-src/shared\/db\/ingest.js"), /function isWithinInterval/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /normalizeDateRangeLocal/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /listDateStrings/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /getUsageMaxDays/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /normalizeDateRangeLocal/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /listDateStrings/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /getUsageMaxDays/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /normalizeDateRangeLocal/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /listDateStrings/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /getUsageMaxDays/,
  );
});

test("backend usage rollup and bucket helpers flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/pagination-core.js"),
    read("insforge-src/shared/pagination-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-rollup-core.js"),
    read("insforge-src/shared/usage-rollup-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-daily-core.js"),
    read("insforge-src/shared/usage-daily-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-filter-core.js"),
    read("insforge-src/shared/usage-filter-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-monthly-core.js"),
    read("insforge-src/shared/usage-monthly-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-hourly-query-core.js"),
    read("insforge-src/shared/usage-hourly-query-core.mjs"),
  );
  assert.equal(
    stripModulePrelude(read("insforge-src/shared/usage-heatmap-core.js")),
    stripModulePrelude(read("insforge-src/shared/usage-heatmap-core.mjs")),
  );
  assert.match(read("insforge-src/shared/pagination.js"), /pagination-core/);
  assert.match(read("insforge-src/shared/usage-rollup.js"), /usage-rollup-core/);
  assert.match(read("insforge-src/shared/core/usage-daily.js"), /usage-daily-core/);
  assert.match(read("insforge-src/shared/core/usage-filter.js"), /usage-filter-core/);
  assert.match(read("insforge-src/shared/core/usage-monthly.js"), /usage-monthly-core/);
  assert.match(read("insforge-src/shared/db/usage-hourly.js"), /usage-hourly-query-core/);
  assert.match(read("insforge-src/shared/db/usage-hourly.js"), /forEachHourlyUsagePage/);
  assert.match(read("insforge-src/shared/usage-hourly-query-core.js"), /DETAILED_HOURLY_USAGE_SELECT/);
  assert.match(read("insforge-src/shared/usage-hourly-query-core.js"), /AGGREGATE_HOURLY_USAGE_SELECT/);
  assert.match(read("insforge-src/shared/db/usage-hourly.js"), /DETAILED_HOURLY_USAGE_SELECT/);
  assert.match(read("insforge-src/shared/db/usage-hourly.js"), /AGGREGATE_HOURLY_USAGE_SELECT/);
  assert.match(read("insforge-src/shared/usage-heatmap-core.js"), /require\("\.\/date-core"\)/);
  assert.match(read("insforge-src/shared/usage-heatmap-core.mjs"), /import "\.\/date-core\.mjs"/);
  assert.match(read("insforge-src/shared/usage-heatmap-core.js"), /resolveUsageHeatmapRequestContext/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-heatmap.js"),
    /shared\/usage-heatmap-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-heatmap.js"),
    /accumulateHeatmapDayValue = usageHeatmapCore\.accumulateHeatmapDayValue/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-heatmap.js"),
    /normalizeHeatmapWeeks = usageHeatmapCore\.normalizeHeatmapWeeks/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/db/usage-hourly.js"),
    /forEachHourlyUsagePage/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/db/usage-hourly.js"),
    /DETAILED_HOURLY_USAGE_SELECT/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/db/usage-hourly.js"),
    /AGGREGATE_HOURLY_USAGE_SELECT/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-daily.js"),
    /shared\/usage-daily-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-filter.js"),
    /shared\/usage-filter-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-monthly.js"),
    /shared\/usage-monthly-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/db/usage-hourly.js"),
    /shared\/usage-hourly-query-core\.mjs/,
  );
  assert.match(read("insforge-src/shared/usage-filter-core.js"), /matchesCanonicalModelAtDate/);
  assert.match(read("insforge-src/shared/usage-monthly-core.js"), /usageRow\?\.date/);
  assert.match(read("insforge-src/shared/usage-monthly-core.js"), /usageRow\?\.billable/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /shouldIncludeUsageRow/);
  assert.match(read("insforge-src/shared/usage-hourly-query-core.js"), /forEachHourlyUsagePage/);
  assert.equal(
    stripModulePrelude(read("insforge-src/shared/usage-hourly-core.js")),
    stripModulePrelude(read("insforge-src/shared/usage-hourly-core.mjs")),
  );
  assert.match(read("insforge-src/shared/usage-hourly-core.js"), /require\(\"\.\/runtime-primitives-core\"\)/);
  assert.match(read("insforge-src/shared/usage-hourly-core.js"), /require\(\"\.\/usage-metrics-core\"\)/);
  assert.match(read("insforge-src/shared/usage-hourly-core.mjs"), /import \"\.\/runtime-primitives-core\.mjs\"/);
  assert.match(read("insforge-src/shared/usage-hourly-core.mjs"), /import \"\.\/usage-metrics-core\.mjs\"/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /forEachHourlyUsagePage/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /startAggregateUsageRequest/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /collectFilteredUsageRows/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /collectHourlyUsageBuckets/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /collectFilteredUsageRows/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /collectFilteredUsageRows/,
  );
  assert.match(read("insforge-src/functions-esm/shared/core/usage-hourly.js"), /shared\/usage-hourly-core\.mjs/);
  assert.match(read("insforge-src/functions-esm/shared/core/usage-hourly.js"), /import "\.\.\/date\.js"/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-heatmap.js"),
    /resolveUsageHeatmapRequestContext/,
  );
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /buildUsageHeatmapPayload/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /accumulateHeatmapDayValue/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /resolveUsageHeatmapRequestContext/,
  );
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /createHourlyBuckets/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /addHourlyBucketTotals/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /buildHourlyResponse/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /resolveUsageHourlyRequestContext/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /collectHourlyUsageBuckets/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-hourly.js"),
    /resolveUsageHourlyRequestContext/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-hourly.js"),
    /resolveUsageHourlyRowSlot/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-hourly.js"),
    /collectHourlyUsageBuckets/,
  );
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /buildUsageTotalsPayload/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /buildUsageBucketPayload/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /buildUsageBucketPayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /pagination-core/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /forEachPage/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /forEachHourlyUsagePage/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /normalizeHeatmapWeeks/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /normalizeHeatmapWeekStartsOn/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /normalizeHeatmapToDate/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /computeHeatmapWindowUtc/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /dateFromPartsUTC/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /localDatePartsToUtc/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /parseDateParts/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /getLocalParts/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /addDatePartsDays/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /addUtcDays/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /isUtcTimeZone/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /usage-rollup-core/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /fetchRollupRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /isRollupEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /fetchRollupRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /isRollupEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /fetchRollupRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /isRollupEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /quantileNearestRank/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /computeActiveStreakDays/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /function normalizeWeeks/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /function normalizeWeekStartsOn/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /function normalizeToDate/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /valuesByDay\.set\(day,/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /valuesByDay\.set\(key,/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /function initHourlyBuckets/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /function buildHourlyResponse/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /function formatHourKeyFromValue/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /function parseHalfHourSlotFromKey/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /parseUtcDateString/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /parseDateParts/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /localDatePartsToUtc/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /const dayRaw = url\.searchParams\.get\("day"\)/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /isUtcTimeZone/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /bucket\.total\.toString\(\)/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /bucket\.total\.toString\(\)/);
  assert.doesNotMatch(read("insforge-src/shared/usage-hourly-core.js"), /bucket\.total\.toString\(\)/);
});

test("backend leaderboard and user identity semantics flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/user-identity-core.js"),
    read("insforge-src/shared/user-identity-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/leaderboard-core.js"),
    read("insforge-src/shared/leaderboard-core.mjs"),
  );
  assert.match(read("insforge-src/shared/user-identity.js"), /user-identity-core/);
  assert.match(read("insforge-src/functions-esm/shared/user-identity.js"), /resolveUserIdentity/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-leaderboard-refresh.js"),
    /shared\/leaderboard-core\.mjs/,
  );
  assert.match(read("insforge-src/functions-esm/vibeusage-leaderboard-profile.js"), /leaderboard-core/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-leaderboard.js"),
    /shared\/leaderboard-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-viewer-identity.js"),
    /shared\/user-identity\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-public-view-profile.js"),
    /shared\/user-identity\.js/,
  );
});

test("backend usage pricing semantics flow through shared cores", () => {
  const usagePricingCoreJs = read("insforge-src/shared/usage-pricing-core.js");
  const usagePricingCoreMjs = read("insforge-src/shared/usage-pricing-core.mjs");
  assert.equal(stripModulePrelude(usagePricingCoreJs), stripModulePrelude(usagePricingCoreMjs));
  for (const dependency of [
    "runtime-primitives-core",
    "usage-model-core",
    "usage-row-core",
    "date-core",
    "env-core",
    "pricing-core",
    "usage-metrics-core",
  ]) {
    assert.match(usagePricingCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(
      usagePricingCoreMjs,
      new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`),
    );
  }
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/usage-pricing-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /shared\/usage-pricing-core\.mjs/,
  );
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /createAggregateUsageState/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /accumulateAggregateUsageRow/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /createRollingUsageState/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /accumulateRollingUsageRow/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /buildRollingUsagePayload/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /buildAggregateUsagePayload/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /resolveAggregateUsagePayload/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /createModelBreakdownState/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /accumulateModelBreakdownRow/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /attributeModelBreakdownBucketCost/);
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /buildModelBreakdownSources/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /accumulateRollingUsageRow/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /buildRollingUsagePayload/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /createModelBreakdownState/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /accumulateModelBreakdownRow/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /attributeModelBreakdownBucketCost/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /buildModelBreakdownSources/,
  );
  assert.doesNotMatch(read("insforge-src/shared/usage-pricing-core.js"), /collectAggregateUsageRange/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /applyTotalsAndBillable/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /const sumHourlyRange = async/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /accumulateAggregateUsageRow/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /getSourceEntry/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /buildPricingBucketKey/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /resolveBillableTotals/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /buildPricingMetadata/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /formatUsdFromMicros/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /resolveAggregateUsagePricing/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /buildAggregateUsagePayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /applyTotalsAndBillable/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /const sumHourlyRange = async/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /accumulateAggregateUsageRow/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /getSourceEntry/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /buildPricingBucketKey/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /buildPricingMetadata/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /formatUsdFromMicros/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /resolveAggregateUsagePricing/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /buildAggregateUsagePayload/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /function getSourceEntry/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /function getCanonicalEntry/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /function formatTotals/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /function compareTotals/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /function addCostMicros/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /function resolveCostMicros/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
});

test("backend aggregate usage endpoint orchestration flows through shared ESM helper", () => {
  const aggregateHelper = read("insforge-src/functions-esm/shared/core/usage-aggregate.js");
  assert.match(aggregateHelper, /startAggregateUsageRequest/);
  assert.match(aggregateHelper, /finishAggregateUsageRequest/);
  assert.match(aggregateHelper, /resolveAggregateUsageRequestContext/);
  assert.match(aggregateHelper, /collectAggregateUsageRange/);
  assert.match(aggregateHelper, /resolveAggregateUsagePayload/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /shared\/core\/usage-aggregate\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveAggregateUsageRequestContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveAggregateUsageRequestContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /collectAggregateUsageRange/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /collectAggregateUsageRange/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveAggregateUsagePayload/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveAggregateUsagePayload/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /createAggregateUsageState/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /createAggregateUsageState/,
  );
});

test("backend aggregate usage collection semantics flow through dedicated shared core", () => {
  const aggregateCollectorCoreJs = read("insforge-src/shared/usage-aggregate-collector-core.js");
  const aggregateCollectorCoreMjs = read("insforge-src/shared/usage-aggregate-collector-core.mjs");
  assert.equal(
    stripModulePrelude(aggregateCollectorCoreJs),
    stripModulePrelude(aggregateCollectorCoreMjs),
  );
  for (const dependency of [
    "usage-filter-core",
    "usage-pricing-core",
    "usage-hourly-query-core",
  ]) {
    assert.match(aggregateCollectorCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(
      aggregateCollectorCoreMjs,
      new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`),
    );
  }
  assert.match(
    read("insforge-src/shared/core/usage-aggregate-collector.js"),
    /usage-aggregate-collector-core/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-aggregate-collector.js"),
    /shared\/usage-aggregate-collector-core\.mjs/,
  );
  assert.match(aggregateCollectorCoreJs, /collectAggregateUsageRange/);
  assert.match(aggregateCollectorCoreJs, /shouldAccumulateRow/);
  assert.match(aggregateCollectorCoreJs, /onAccumulatedRow/);
  assert.match(aggregateCollectorCoreJs, /DETAILED_HOURLY_USAGE_SELECT/);
});

test("backend aggregate usage request semantics flow through dedicated shared core", () => {
  const aggregateRequestCoreJs = read("insforge-src/shared/usage-aggregate-request-core.js");
  const aggregateRequestCoreMjs = read("insforge-src/shared/usage-aggregate-request-core.mjs");
  const stripAggregateRequestPrelude = (content) =>
    stripModulePrelude(content).replace(/^"use strict";\n/, "").replace(/^\s+/, "");
  assert.equal(
    stripAggregateRequestPrelude(aggregateRequestCoreJs),
    stripAggregateRequestPrelude(aggregateRequestCoreMjs),
  );
  for (const dependency of ["usage-range-request-core", "usage-filter-request-core"]) {
    assert.match(aggregateRequestCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(aggregateRequestCoreMjs, new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`));
  }
  assert.match(
    read("insforge-src/shared/core/usage-aggregate-request.js"),
    /usage-aggregate-request-core/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-aggregate-request.js"),
    /shared\/usage-aggregate-request-core\.mjs/,
  );
  assert.match(aggregateRequestCoreJs, /resolveAggregateUsageRequestContext/);
  assert.match(aggregateRequestCoreJs, /resolveUsageRangeRequestContext/);
  assert.match(aggregateRequestCoreJs, /resolveUsageFilterRequestSnapshot/);
  assert.doesNotMatch(aggregateRequestCoreJs, /resolveUsageDateRangeLocal/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /getSourceParam/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /getModelParam/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/source\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveUsageDateRangeLocal/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveUsageFilterContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /getSourceParam/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /getModelParam/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveUsageDateRangeLocal/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveUsageFilterContext/,
  );
});

test("backend usage range request semantics flow through dedicated shared core", () => {
  const rangeRequestCoreJs = read("insforge-src/shared/usage-range-request-core.js");
  const rangeRequestCoreMjs = read("insforge-src/shared/usage-range-request-core.mjs");
  const stripRangeRequestPrelude = (content) =>
    stripModulePrelude(content).replace(/^"use strict";\n/, "").replace(/^\s+/, "");
  assert.equal(stripRangeRequestPrelude(rangeRequestCoreJs), stripRangeRequestPrelude(rangeRequestCoreMjs));
  for (const dependency of ["date-core", "runtime-primitives-core"]) {
    assert.match(rangeRequestCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(rangeRequestCoreMjs, new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`));
  }
  assert.match(read("insforge-src/shared/core/usage-range-request.js"), /usage-range-request-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-range-request.js"),
    /shared\/usage-range-request-core\.mjs/,
  );
  assert.match(rangeRequestCoreJs, /resolveUsageRangeRequestContext/);
  assert.match(rangeRequestCoreJs, /getSourceParam/);
  assert.match(rangeRequestCoreJs, /resolveUsageDateRangeLocal/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /shared\/core\/usage-range-request\.js/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /getSourceParam/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /resolveUsageDateRangeLocal/,
  );
});

test("backend usage filter request semantics flow through dedicated shared core", () => {
  const filterRequestCoreJs = read("insforge-src/shared/usage-filter-request-core.js");
  const filterRequestCoreMjs = read("insforge-src/shared/usage-filter-request-core.mjs");
  const stripFilterRequestPrelude = (content) =>
    stripModulePrelude(content).replace(/^"use strict";\n/, "").replace(/^\s+/, "");
  assert.equal(
    stripFilterRequestPrelude(filterRequestCoreJs),
    stripFilterRequestPrelude(filterRequestCoreMjs),
  );
  for (const dependency of ["runtime-primitives-core", "usage-model-core"]) {
    assert.match(filterRequestCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(filterRequestCoreMjs, new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`));
  }
  assert.match(read("insforge-src/shared/core/usage-filter-request.js"), /usage-filter-request-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-filter-request.js"),
    /shared\/usage-filter-request-core\.mjs/,
  );
  assert.match(filterRequestCoreJs, /resolveUsageFilterRequestParams/);
  assert.match(filterRequestCoreJs, /resolveUsageModelRequestParams/);
  assert.match(filterRequestCoreJs, /resolveUsageFilterRequestContext/);
  assert.match(filterRequestCoreJs, /resolveUsageFilterRequestSnapshot/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /shared\/core\/usage-filter-request\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /shared\/core\/usage-filter-request\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /shared\/core\/usage-filter-request\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /resolveUsageFilterRequestSnapshot/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /resolveUsageFilterRequestSnapshot/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /resolveUsageFilterRequestSnapshot/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /getSourceParam/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /getModelParam/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /resolveUsageFilterRequestContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /resolveUsageFilterRequestParams/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /getSourceParam/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /getModelParam/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /resolveUsageFilterRequestContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /resolveUsageFilterRequestParams/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /getSourceParam/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /getModelParam/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /resolveUsageFilterRequestContext/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /resolveUsageFilterRequestParams/,
  );
});

test("backend hourly usage row semantics flow through shared core", () => {
  const usageRowCoreJs = read("insforge-src/shared/usage-row-core.js");
  const usageRowCoreMjs = read("insforge-src/shared/usage-row-core.mjs");
  const usageRowCollectorCoreJs = read("insforge-src/shared/usage-row-collector-core.js");
  const usageRowCollectorCoreMjs = read("insforge-src/shared/usage-row-collector-core.mjs");
  assert.equal(stripModulePrelude(usageRowCoreJs), stripModulePrelude(usageRowCoreMjs));
  const stripUsageRowCollectorPrelude = (content) =>
    stripModulePrelude(content).replace(/^"use strict";\n/, "").replace(/^\s+/, "");
  assert.equal(
    stripUsageRowCollectorPrelude(usageRowCollectorCoreJs),
    stripUsageRowCollectorPrelude(usageRowCollectorCoreMjs),
  );
  for (const dependency of [
    "runtime-primitives-core",
    "usage-model-core",
    "usage-metrics-core",
  ]) {
    assert.match(usageRowCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(usageRowCoreMjs, new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`));
  }
  for (const dependency of [
    "canary-core",
    "pagination-core",
    "usage-model-core",
    "usage-filter-core",
    "usage-hourly-query-core",
    "usage-row-core",
  ]) {
    assert.match(usageRowCollectorCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(usageRowCollectorCoreMjs, new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`));
  }
  assert.match(read("insforge-src/shared/core/usage-row-collector.js"), /usage-row-collector-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-row-collector.js"),
    /shared\/usage-row-collector-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /shared\/usage-row-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /resolveHourlyUsageRowState = usageRowCore\.resolveHourlyUsageRowState/,
  );
  assert.match(read("insforge-src/shared/usage-pricing-core.js"), /resolveHourlyUsageRowState/);
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-filtered-rows.js"),
    /from "\.\/usage-row-collector\.js"/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-filtered-rows.js"),
    /from "\.\.\/logging\.js"/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-hourly.js"),
    /from "\.\/usage-filtered-rows\.js"/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /shared\/core\/usage-hourly\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /shared\/core\/usage-filtered-rows\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /shared\/core\/usage-filtered-rows\.js/,
  );
  assert.match(usageRowCollectorCoreJs, /DETAILED_HOURLY_USAGE_SELECT/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /DETAILED_HOURLY_USAGE_SELECT/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /collectFilteredUsageRows/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /AGGREGATE_HOURLY_USAGE_SELECT/,
  );
  assert.match(read("insforge-src/functions-esm/shared/core/usage-hourly.js"), /collectFilteredUsageRows/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /collectHourlyUsageBuckets/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /collectFilteredUsageRows/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /collectFilteredUsageRows/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-monthly.js"),
    /hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /resolveHourlyUsageRowState/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /shouldIncludeUsageRow/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /collectFilteredUsageRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /collectHourlyUsageRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /forEachHourlyUsagePage/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /collectHourlyUsageRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /resolveHourlyUsageRowState/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /shouldIncludeUsageRow/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /collectHourlyUsageRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /forEachHourlyUsagePage/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /resolveHourlyUsageRowState/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /collectHourlyUsageRows/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /forEachHourlyUsagePage/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /resolveBillableTotals/);
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /resolveBillableTotals/,
  );
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /normalizeUsageModel/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /normalizeUsageModel/);
});

test("backend project usage summary semantics flow through shared core", () => {
  const projectUsageCoreJs = read("insforge-src/shared/project-usage-core.js");
  const projectUsageCoreMjs = read("insforge-src/shared/project-usage-core.mjs");
  assert.equal(stripModulePrelude(projectUsageCoreJs), stripModulePrelude(projectUsageCoreMjs));
  assert.match(projectUsageCoreJs, /require\("\.\/runtime-primitives-core"\)/);
  assert.match(projectUsageCoreJs, /require\("\.\/canary-core"\)/);
  assert.match(projectUsageCoreMjs, /import "\.\/runtime-primitives-core\.mjs"/);
  assert.match(projectUsageCoreMjs, /import "\.\/canary-core\.mjs"/);
  assert.match(read("insforge-src/shared/project-usage.js"), /project-usage-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/project-usage.js"),
    /shared\/project-usage-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /shared\/project-usage\.js/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /normalizeProjectUsageLimit/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /normalizeProjectUsageRows/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /aggregateProjectUsageRows/,
  );
  assert.match(projectUsageCoreJs, /buildProjectUsageAggregateQuery/);
  assert.match(projectUsageCoreJs, /buildProjectUsageFallbackQuery/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /buildProjectUsageAggregateQuery/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /buildProjectUsageFallbackQuery/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /shouldFallbackProjectUsageAggregate/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /isCanaryTag/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /vibeusage_project_usage_hourly/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /function normalizeLimit/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /function normalizeAggregateValue/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /function resolveBillableTotal/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /function shouldFallbackAggregate/,
  );
  assert.doesNotMatch(
    read("insforge-src/functions-esm/vibeusage-project-usage-summary.js"),
    /function aggregateProjectRows/,
  );
});
