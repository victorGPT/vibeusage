const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const { scrubSourceCursors, listSupportedSources } = require("../src/lib/cursor-scrub");

const HOME = "/home/test";
const ENV = {};

function makeCursors() {
  return {
    version: 1,
    files: {
      [path.join(HOME, ".claude", "projects", "p1", "a.jsonl")]: { offset: 100 },
      [path.join(HOME, ".claude", "projects", "p2", "b.jsonl")]: { offset: 200 },
      [path.join(HOME, ".codex", "sessions", "s1.jsonl")]: { offset: 300 },
      [path.join(HOME, ".gemini", "tmp", "g1.jsonl")]: { offset: 400 },
      "/some/unrelated/path/x.jsonl": { offset: 999 },
    },
    hourly: {
      buckets: {
        "claude|claude-opus-4-7|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 1000 } },
        "claude|claude-sonnet-4-6|2026-04-26T05:30:00.000Z": { totals: { total_tokens: 500 } },
        "codex|gpt-5-codex|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 700 } },
        "gemini|gemini-pro|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 200 } },
      },
      groupQueued: {
        "claude|2026-04-26T05:00:00.000Z": "key1",
        "claude|2026-04-26T05:30:00.000Z": "key2",
        "codex|2026-04-26T05:00:00.000Z": "key3",
      },
    },
    projectHourly: {
      version: 2,
      buckets: {
        "victorgpt/vibeusage|claude|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 800 } },
        "victorgpt/vibeusage|claude|2026-04-26T05:30:00.000Z": { totals: { total_tokens: 400 } },
        "victorgpt/vibeusage|codex|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 600 } },
        "spacedriveapp/spacedrive|claude|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 300 } },
      },
      projects: {
        "victorgpt/vibeusage": { displayName: "vibeusage" },
        "spacedriveapp/spacedrive": { displayName: "spacedrive" },
      },
    },
    opencode: { lastSeen: "2026-04-26T00:00:00Z" },
    opencodeSqlite: { offset: 12345 },
    hermesLedger: { offset: 678 },
    openclawLedger: { offset: 901 },
  };
}

test("scrubSourceCursors removes claude files / buckets / groupQueued / projectBuckets and leaves others alone", async () => {
  const cursors = makeCursors();
  const result = scrubSourceCursors({ cursors, sourceId: "claude", home: HOME, env: ENV });

  assert.equal(result.filesRemoved, 2, "both .claude/projects entries gone");
  assert.equal(result.bucketsRemoved, 2, "both claude| buckets gone");
  assert.equal(result.groupsRemoved, 2, "both claude| groupQueued entries gone");
  assert.equal(result.projectBucketsRemoved, 3, "all claude project buckets gone (across both projects)");
  assert.deepEqual(result.extraCursorsCleared, [], "claude has no top-level cursor field");

  // Other sources untouched (global hourly)
  assert.ok(cursors.files[path.join(HOME, ".codex", "sessions", "s1.jsonl")]);
  assert.ok(cursors.files[path.join(HOME, ".gemini", "tmp", "g1.jsonl")]);
  assert.ok(cursors.files["/some/unrelated/path/x.jsonl"]);
  assert.ok(cursors.hourly.buckets["codex|gpt-5-codex|2026-04-26T05:00:00.000Z"]);
  assert.ok(cursors.hourly.buckets["gemini|gemini-pro|2026-04-26T05:00:00.000Z"]);
  assert.ok(cursors.hourly.groupQueued["codex|2026-04-26T05:00:00.000Z"]);
  assert.ok(cursors.opencode);
  assert.ok(cursors.hermesLedger);

  // Other sources' project buckets untouched, project metadata preserved.
  assert.ok(
    cursors.projectHourly.buckets["victorgpt/vibeusage|codex|2026-04-26T05:00:00.000Z"],
    "codex project bucket survives a claude rebuild",
  );
  assert.deepEqual(
    Object.keys(cursors.projectHourly.projects).sort(),
    ["spacedriveapp/spacedrive", "victorgpt/vibeusage"],
    "projectHourly.projects metadata is preserved (no token totals there)",
  );
});

test("scrubSourceCursors handles env-overridden session roots (CODEX_HOME)", async () => {
  // With CODEX_HOME=/custom/codex, the helper looks under /custom/codex/sessions.
  // The default-path entry (~/.codex/sessions/s1.jsonl) does not match the
  // configured prefix and stays put. This is the right behavior: when the
  // user has redirected CODEX_HOME, the live data lives at the new location
  // and the legacy default-path entry is not part of "this source's" state.
  const env = { CODEX_HOME: "/custom/codex" };
  const cursors = makeCursors();
  cursors.files["/custom/codex/sessions/x.jsonl"] = { offset: 1 };

  const result = scrubSourceCursors({ cursors, sourceId: "codex", home: HOME, env });
  assert.equal(result.filesRemoved, 1, "only the env-prefixed file matches");
  assert.equal(cursors.files["/custom/codex/sessions/x.jsonl"], undefined);
  assert.ok(
    cursors.files[path.join(HOME, ".codex", "sessions", "s1.jsonl")],
    "default-path entry stays when CODEX_HOME is overridden — not part of the active source root",
  );
});

test("scrubSourceCursors clears opencode top-level cursors but no files prefix matches", async () => {
  const cursors = makeCursors();
  const result = scrubSourceCursors({ cursors, sourceId: "opencode", home: HOME, env: ENV });

  assert.equal(result.filesRemoved, 0);
  assert.equal(result.bucketsRemoved, 0);
  assert.equal(result.groupsRemoved, 0);
  assert.deepEqual(
    result.extraCursorsCleared.sort(),
    ["opencode", "opencodeSqlite"],
    "both opencode-specific cursor fields must be deleted",
  );
  assert.equal(cursors.opencode, undefined);
  assert.equal(cursors.opencodeSqlite, undefined);
});

test("scrubSourceCursors clears hermes ledger cursor only", async () => {
  const cursors = makeCursors();
  const result = scrubSourceCursors({ cursors, sourceId: "hermes", home: HOME, env: ENV });
  assert.deepEqual(result.extraCursorsCleared, ["hermesLedger"]);
  assert.equal(cursors.hermesLedger, undefined);
  assert.ok(cursors.openclawLedger, "openclaw ledger remains");
});

test("scrubSourceCursors throws on unknown source id", async () => {
  assert.throws(
    () => scrubSourceCursors({ cursors: {}, sourceId: "made-up", home: HOME, env: ENV }),
    /unknown sourceId/,
  );
});

test("scrubSourceCursors throws when cursors is not an object", async () => {
  assert.throws(
    () => scrubSourceCursors({ cursors: null, sourceId: "claude", home: HOME, env: ENV }),
    /cursors must be an object/,
  );
});

test("scrubSourceCursors is robust to missing cursor sub-objects", async () => {
  const cursors = { version: 1 };
  const result = scrubSourceCursors({ cursors, sourceId: "claude", home: HOME, env: ENV });
  assert.equal(result.filesRemoved, 0);
  assert.equal(result.bucketsRemoved, 0);
  assert.equal(result.groupsRemoved, 0);
  assert.equal(result.projectBucketsRemoved, 0);
});

test("scrubSourceCursors keys projectHourly buckets by middle segment, not substring", async () => {
  // The split-on-`|` check guards against a project_key that *contains* the
  // source name as a substring. e.g. a hypothetical "codexlab/foo" project
  // key paired with a "claude" source must not be deleted by sourceId="codex".
  const cursors = {
    projectHourly: {
      version: 2,
      buckets: {
        "codexlab/foo|claude|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 1 } },
        "myproj/bar|codex|2026-04-26T05:00:00.000Z": { totals: { total_tokens: 2 } },
      },
      projects: {},
    },
  };
  const result = scrubSourceCursors({ cursors, sourceId: "codex", home: HOME, env: ENV });
  assert.equal(result.projectBucketsRemoved, 1);
  assert.ok(
    cursors.projectHourly.buckets["codexlab/foo|claude|2026-04-26T05:00:00.000Z"],
    "project key containing 'codex' as a substring must NOT be removed by sourceId=codex",
  );
  assert.equal(
    cursors.projectHourly.buckets["myproj/bar|codex|2026-04-26T05:00:00.000Z"],
    undefined,
  );
});

test("listSupportedSources returns the registered set", async () => {
  const ids = listSupportedSources();
  assert.ok(ids.includes("claude"));
  assert.ok(ids.includes("codex"));
  assert.ok(ids.includes("opencode"));
  assert.ok(ids.includes("hermes"));
});
