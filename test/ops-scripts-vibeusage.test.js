const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");

async function read(relPath) {
  return fs.readFile(path.join(repoRoot, relPath), "utf8");
}

test("ops scripts reference VibeUsage defaults", async () => {
  const backfill = await read("scripts/ops/backfill-codex-unknown.cjs");
  const ingest = await read("scripts/ops/ingest-canary.cjs");

  assert.ok(backfill.includes(".vibeusage"), "expected backfill to reference .vibeusage");
  assert.ok(backfill.includes("vibeusage"), "expected backfill to reference vibeusage package");
  assert.ok(!backfill.includes(".vibescore"), "backfill should not reference .vibescore");
  assert.ok(!backfill.includes("@vibescore/tracker"), "backfill should not reference @vibescore/tracker");

  assert.ok(ingest.includes("/functions/vibeusage-ingest"), "expected ingest canary to hit vibeusage endpoint");
  assert.ok(!ingest.includes("/functions/vibescore-ingest"), "ingest canary should not reference vibescore endpoint");
});
