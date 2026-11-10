const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { listPiSessionFiles, parsePiIncremental } = require("../src/lib/rollout");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-pi-rollout-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Shapes taken from real pi 1.5.0 session files (~/.pi/agent/sessions).
function header({ ts = "2026-04-01T00:00:00.000Z", parentSession } = {}) {
  return JSON.stringify({ type: "session", version: 3, id: "s1", timestamp: ts, cwd: "/tmp/x", parentSession });
}

function assistant({ id, ts, model = "glm-5", usage }) {
  return JSON.stringify({
    type: "message",
    id,
    parentId: null,
    timestamp: ts,
    message: { role: "assistant", content: [], provider: "sealion", model, usage, timestamp: Date.parse(ts) - 500 },
  });
}

function usage({ input = 0, output = 0, cacheRead = 0, cacheWrite = 0, reasoning = 0 }) {
  return { input, output, cacheRead, cacheWrite, reasoning, totalTokens: input + output + cacheRead + cacheWrite };
}

async function readQueue(queuePath) {
  const text = await fs.readFile(queuePath, "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// The queue holds one row per (source, model, half-hour) every time a bucket is
// touched; the latest row carries that bucket's running totals.
function latestBySourceModel(rows) {
  const out = new Map();
  for (const r of rows) out.set(`${r.source}|${r.model}|${r.hour_start}`, r);
  return [...out.values()];
}

async function writeSession(dir, name, lines, { trailingNewline = true } = {}) {
  const projectDir = path.join(dir, "sessions", "--tmp-x--");
  await fs.mkdir(projectDir, { recursive: true });
  const p = path.join(projectDir, name);
  await fs.writeFile(p, lines.join("\n") + (trailingNewline ? "\n" : ""), "utf8");
  return p;
}

test("listPiSessionFiles finds <cwd-slug>/<ts>_<uuid>.jsonl and ignores other files", async () => {
  await withTempDir(async (dir) => {
    const p = await writeSession(dir, "2026-04-01T00-00-00-000Z_abc.jsonl", [header()]);
    await fs.writeFile(path.join(path.dirname(p), "notes.txt"), "x");
    assert.deepEqual(await listPiSessionFiles(path.join(dir, "sessions")), [p]);
    assert.deepEqual(await listPiSessionFiles(path.join(dir, "missing")), []);
  });
});

test("parsePiIncremental maps pi usage channels into a half-hour bucket", async () => {
  await withTempDir(async (dir) => {
    const p = await writeSession(dir, "a.jsonl", [
      header(),
      JSON.stringify({ type: "message", id: "u1", timestamp: "2026-04-01T00:05:00.000Z", message: { role: "user", content: "hi" } }),
      assistant({ id: "a1", ts: "2026-04-01T00:05:10.000Z", usage: usage({ input: 100, output: 30, cacheRead: 1000, cacheWrite: 50, reasoning: 10 }) }),
      "{not json",
      JSON.stringify({ type: "message", id: "t1", timestamp: "2026-04-01T00:05:11.000Z", message: { role: "toolResult", content: [] } }),
      assistant({ id: "a2", ts: "2026-04-01T00:20:00.000Z", usage: usage({ input: 5, output: 7 }) }),
    ]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parsePiIncremental({ sessionFiles: [p], cursors, queuePath });
    assert.equal(result.eventsAggregated, 2);

    const rows = latestBySourceModel(await readQueue(queuePath));
    assert.equal(rows.length, 1);
    const b = rows[0];
    assert.equal(b.source, "pi");
    assert.equal(b.model, "glm-5");
    assert.equal(b.hour_start, "2026-04-01T00:00:00.000Z");
    // input = input + cacheWrite; cached = cacheRead; output excludes reasoning (pi's output includes it)
    assert.equal(b.input_tokens, 150 + 5);
    assert.equal(b.cached_input_tokens, 1000);
    assert.equal(b.output_tokens, 20 + 7);
    assert.equal(b.reasoning_output_tokens, 10);
    assert.equal(b.total_tokens, 1180 + 12);
  });
});

test("parsePiIncremental resumes from cursor without double counting", async () => {
  await withTempDir(async (dir) => {
    const p = await writeSession(dir, "a.jsonl", [
      header(),
      assistant({ id: "a1", ts: "2026-04-01T00:05:00.000Z", usage: usage({ input: 10, output: 4 }) }),
    ]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    await parsePiIncremental({ sessionFiles: [p], cursors, queuePath });
    const again = await parsePiIncremental({ sessionFiles: [p], cursors, queuePath });
    assert.equal(again.eventsAggregated, 0);

    await fs.appendFile(p, assistant({ id: "a2", ts: "2026-04-01T00:06:00.000Z", usage: usage({ input: 2, output: 3 }) }) + "\n");
    const result = await parsePiIncremental({ sessionFiles: [p], cursors, queuePath });
    assert.equal(result.eventsAggregated, 1);

    const [b] = latestBySourceModel(await readQueue(queuePath));
    assert.equal(b.input_tokens, 12);
    assert.equal(b.total_tokens, 19);
  });
});

test("parsePiIncremental does not lose a line that was half-written during sync", async () => {
  await withTempDir(async (dir) => {
    const full = assistant({ id: "a1", ts: "2026-04-01T00:05:00.000Z", usage: usage({ input: 10, output: 4 }) });
    const half = full.slice(0, 40);
    const p = await writeSession(dir, "a.jsonl", [header(), half], { trailingNewline: false });
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const first = await parsePiIncremental({ sessionFiles: [p], cursors, queuePath });
    assert.equal(first.eventsAggregated, 0);

    await fs.appendFile(p, full.slice(40) + "\n");
    const second = await parsePiIncremental({ sessionFiles: [p], cursors, queuePath });
    assert.equal(second.eventsAggregated, 1);
  });
});

async function syncOnce(files, cursors, queuePath, extra = {}) {
  return parsePiIncremental({ sessionFiles: files, cursors, queuePath, ...extra });
}

async function bucketTotal(queuePath) {
  return latestBySourceModel(await readQueue(queuePath)).reduce((s, r) => s + r.total_tokens, 0);
}

test("pi fork whose copied entry has the same ms as the fork header is counted once (separate syncs)", async () => {
  await withTempDir(async (dir) => {
    const ts = "2026-04-01T00:10:00.000Z";
    const copied = assistant({ id: "a1", ts, usage: usage({ input: 10, output: 4 }) });
    const parent = await writeSession(dir, "parent.jsonl", [header(), copied]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    await syncOnce([parent], cursors, queuePath);
    const fork = await writeSession(dir, "fork.jsonl", [header({ ts, parentSession: parent }), copied]);
    await syncOnce([parent, fork], cursors, queuePath);
    assert.equal(await bucketTotal(queuePath), 14);
  });
});

test("pi entry re-appended with the same id after a sync is not counted again", async () => {
  await withTempDir(async (dir) => {
    const line = assistant({ id: "a1", ts: "2026-04-01T00:05:00.000Z", usage: usage({ input: 10, output: 4 }) });
    const p = await writeSession(dir, "a.jsonl", [header(), line]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    await syncOnce([p], cursors, queuePath);
    await fs.appendFile(p, line + "\n");
    const r = await syncOnce([p], cursors, queuePath);
    assert.equal(r.eventsAggregated, 0);
    assert.equal(await bucketTotal(queuePath), 14);
  });
});

test("pi fork whose parent was never scanned still counts the inherited usage once", async () => {
  await withTempDir(async (dir) => {
    const copied = assistant({ id: "a1", ts: "2026-04-01T00:05:00.000Z", usage: usage({ input: 10, output: 4 }) });
    const fork = await writeSession(dir, "fork.jsonl", [
      header({ ts: "2026-04-01T00:10:00.000Z", parentSession: "/elsewhere/parent.jsonl" }),
      copied,
      assistant({ id: "b1", ts: "2026-04-01T00:11:00.000Z", usage: usage({ input: 1, output: 1 }) }),
    ]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    await syncOnce([fork], cursors, queuePath);
    await syncOnce([fork], cursors, queuePath);
    assert.equal(await bucketTotal(queuePath), 16);
  });
});

test("pi top-level type:usage entries (cache-warm refreshes) are counted under their model", async () => {
  await withTempDir(async (dir) => {
    // Shape from pi 1.5.0 SessionManager.appendUsage.
    const warm = JSON.stringify({
      type: "usage",
      id: "w1",
      parentId: null,
      timestamp: "2026-04-01T00:07:00.000Z",
      kind: "cache_warm",
      provider: "anthropic",
      model: "claude-x",
      usage: usage({ input: 3, cacheRead: 200, output: 1 }),
    });
    const p = await writeSession(dir, "a.jsonl", [header(), warm]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const r = await syncOnce([p], cursors, queuePath);
    assert.equal(r.eventsAggregated, 1);
    const [b] = latestBySourceModel(await readQueue(queuePath));
    assert.equal(b.model, "claude-x");
    assert.equal(b.cached_input_tokens, 200);
    assert.equal(b.total_tokens, 204);
  });
});

test("pi compaction usage is counted under the session's last model, across syncs", async () => {
  await withTempDir(async (dir) => {
    const a1 = assistant({
      id: "a1",
      ts: "2026-04-01T00:05:00.000Z",
      model: "glm-5",
      usage: usage({ input: 10, output: 4 }),
    });
    const p = await writeSession(dir, "a.jsonl", [header(), a1]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    await syncOnce([p], cursors, queuePath);

    // Shape from pi 1.5.0 compaction entries: top-level usage, no model.
    const compaction = JSON.stringify({
      type: "compaction",
      id: "c1",
      parentId: "a1",
      timestamp: "2026-04-01T00:06:00.000Z",
      tokensBefore: 113747,
      usage: usage({ input: 50, output: 7 }),
    });
    await fs.appendFile(p, compaction + "\n");
    const r = await syncOnce([p], cursors, queuePath);
    assert.equal(r.eventsAggregated, 1);
    const [b] = latestBySourceModel(await readQueue(queuePath));
    assert.equal(b.model, "glm-5");
    assert.equal(b.total_tokens, 71);
  });
});

test("pi project attribution uses the session header cwd, not the sessions dir", async () => {
  await withTempDir(async (dir) => {
    const repoRoot = path.join(dir, "repo");
    await fs.mkdir(path.join(repoRoot, ".git"), { recursive: true });
    await fs.writeFile(path.join(repoRoot, ".git", "config"), `[remote "origin"]\n\turl = https://github.com/acme/alpha.git\n`);
    const projectDir = path.join(dir, "sessions", "--repo--");
    await fs.mkdir(projectDir, { recursive: true });
    const p = path.join(projectDir, "a.jsonl");
    const head = JSON.stringify({ type: "session", version: 3, id: "s1", timestamp: "2026-04-01T00:00:00.000Z", cwd: repoRoot });
    await fs.writeFile(p, [head, assistant({ id: "a1", ts: "2026-04-01T00:05:00.000Z", usage: usage({ input: 10, output: 4 }) })].join("\n") + "\n");
    const queuePath = path.join(dir, "queue.jsonl");
    const projectQueuePath = path.join(dir, "project.queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const publicRepoResolver = async ({ projectRef }) => ({ status: "public_verified", projectKey: "acme/alpha", projectRef });
    await syncOnce([p], cursors, queuePath, { projectQueuePath, publicRepoResolver });
    const rows = await readQueue(projectQueuePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].project_key, "acme/alpha");
    assert.equal(rows[0].source, "pi");
    assert.equal(rows[0].total_tokens, 14);
  });
});

test("parsePiIncremental counts entries a fork copied from its parent session once", async () => {
  await withTempDir(async (dir) => {
    const copied = assistant({ id: "a1", ts: "2026-04-01T00:05:00.000Z", usage: usage({ input: 10, output: 4 }) });
    const parent = await writeSession(dir, "parent.jsonl", [header(), copied]);
    const fork = await writeSession(dir, "fork.jsonl", [
      header({ ts: "2026-04-01T00:10:00.000Z", parentSession: parent }),
      copied,
      assistant({ id: "b1", ts: "2026-04-01T00:11:00.000Z", usage: usage({ input: 1, output: 1 }) }),
    ]);
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parsePiIncremental({ sessionFiles: [parent, fork], cursors, queuePath });
    assert.equal(result.eventsAggregated, 2);

    // Resuming the fork must keep honouring the fork point.
    await fs.appendFile(fork, copied + "\n");
    const again = await parsePiIncremental({ sessionFiles: [parent, fork], cursors, queuePath });
    assert.equal(again.eventsAggregated, 0);

    const [b] = latestBySourceModel(await readQueue(queuePath));
    assert.equal(b.total_tokens, 14 + 2);
  });
});
