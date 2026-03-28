const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = process.cwd();
const FUNCTION_SLUGS = [
  "vibeusage-device-token-issue",
  "vibeusage-debug-auth",
  "vibeusage-entitlements",
  "vibeusage-entitlements-revoke",
  "vibeusage-events-retention",
  "vibeusage-ingest",
  "vibeusage-leaderboard-settings",
  "vibeusage-leaderboard-profile",
  "vibeusage-link-code-exchange",
  "vibeusage-public-view-issue",
  "vibeusage-public-view-revoke",
  "vibeusage-public-view-status",
  "vibeusage-pricing-sync",
  "vibeusage-sync-ping",
  "vibeusage-usage-daily",
  "vibeusage-link-code-init",
  "vibeusage-public-visibility",
  "vibeusage-user-status",
  "vibeusage-usage-model-breakdown",
  "vibeusage-usage-heatmap",
];

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("hard-cut loader uses esm sources for all edge functions without fallback", () => {
  const loaderSrc = readFile("scripts/lib/load-edge-function.cjs");
  assert.match(loaderSrc, /"functions-esm"/);
  assert.match(loaderSrc, /`?\$\{slug\}\.js`?/);
  assert.doesNotMatch(loaderSrc, /MIGRATED_FUNCTION_SOURCES/);
  assert.doesNotMatch(loaderSrc, /insforge-functions/);
});

test("hard-cut build script is esm-only", () => {
  const buildSrc = readFile("scripts/build-insforge-functions.cjs");
  assert.doesNotMatch(buildSrc, /legacySrcDir/);
  assert.doesNotMatch(buildSrc, /format:\s*"cjs"/);
  assert.doesNotMatch(buildSrc, /insforge-src\/functions\/\*\.js/);
});

test("hard-cut repo removes legacy edge author sources", () => {
  const legacyDir = path.join(ROOT, "insforge-src", "functions");
  const legacyFiles = fs.existsSync(legacyDir)
    ? fs.readdirSync(legacyDir).filter((name) => name.startsWith("vibeusage-") && name.endsWith(".js"))
    : [];
  assert.deepEqual(legacyFiles, []);
});

test("hard-cut edge function artifacts do not include CommonJS wrappers", () => {
  for (const slug of FUNCTION_SLUGS) {
    const artifact = readFile(`insforge-functions/${slug}.js`);
    assert.doesNotMatch(artifact, /__commonJS/);
    assert.doesNotMatch(artifact, /\bmodule\.exports\b/);
    assert.doesNotMatch(artifact, /\brequire\(/);
  }
});
