# Gemini CLI Usage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Gemini CLI session parsing so `tracker sync` aggregates Gemini token usage and model into UTC half-hour buckets.

**Architecture:** Extend `src/lib/rollout.js` with Gemini session discovery + parser (JSON, not JSONL), then call it from `src/commands/sync.js`. Cursor state tracks inode + last message index + last totals to ensure idempotent deltas. Tokens are mapped via allowlist only.

**Tech Stack:** Node.js (fs/promises, path), existing `rollout.js` aggregation utilities, node:test.

---

### Task 1: Add failing Gemini parser tests (RED)

**Files:**
- Modify: `test/rollout-parser.test.js`

**Step 1: Write the failing test**

```js
const { parseGeminiIncremental } = require('../src/lib/rollout');

test('parseGeminiIncremental aggregates gemini tokens and model', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-gemini-'));
  try {
    const sessionPath = path.join(tmp, 'session.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const session = {
      sessionId: 's1',
      projectHash: 'p1',
      startTime: '2025-12-26T08:00:00.000Z',
      lastUpdated: '2025-12-26T08:10:00.000Z',
      messages: [
        {
          id: 'm1',
          type: 'assistant',
          timestamp: '2025-12-26T08:05:00.000Z',
          model: 'gemini-3-flash-preview',
          content: { text: 'ignore me' },
          tokens: { input: 10, output: 1, cached: 2, thoughts: 0, tool: 1, total: 14 }
        }
      ]
    };

    await fs.writeFile(sessionPath, JSON.stringify(session), 'utf8');

    const res = await parseGeminiIncremental({ sessionFiles: [sessionPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].source, 'gemini');
    assert.equal(queued[0].model, 'gemini-3-flash-preview');
    assert.equal(queued[0].input_tokens, 10);
    assert.equal(queued[0].cached_input_tokens, 2);
    assert.equal(queued[0].output_tokens, 2); // output + tool
    assert.equal(queued[0].reasoning_output_tokens, 0);
    assert.equal(queued[0].total_tokens, 14);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseGeminiIncremental is idempotent with unchanged totals', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-gemini-'));
  try {
    const sessionPath = path.join(tmp, 'session.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const session = {
      sessionId: 's1',
      projectHash: 'p1',
      startTime: '2025-12-26T08:00:00.000Z',
      lastUpdated: '2025-12-26T08:10:00.000Z',
      messages: [
        {
          id: 'm1',
          type: 'assistant',
          timestamp: '2025-12-26T08:05:00.000Z',
          model: 'gemini-3-flash-preview',
          tokens: { input: 5, output: 1, cached: 0, thoughts: 0, tool: 0, total: 6 }
        }
      ]
    };

    await fs.writeFile(sessionPath, JSON.stringify(session), 'utf8');

    await parseGeminiIncremental({ sessionFiles: [sessionPath], cursors, queuePath });
    const afterFirst = await readJsonLines(queuePath);

    const res = await parseGeminiIncremental({ sessionFiles: [sessionPath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 0);

    const afterSecond = await readJsonLines(queuePath);
    assert.equal(afterSecond.length, afterFirst.length);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/rollout-parser.test.js`
Expected: FAIL (parseGeminiIncremental missing)

---

### Task 2: Implement Gemini parser (GREEN)

**Files:**
- Modify: `src/lib/rollout.js`

**Step 1: Write minimal implementation**

```js
async function listGeminiSessionFiles(tmpDir) {
  const out = [];
  const roots = await safeReadDir(tmpDir);
  for (const root of roots) {
    if (!root.isDirectory()) continue;
    const chatsDir = path.join(tmpDir, root.name, 'chats');
    const chats = await safeReadDir(chatsDir);
    for (const f of chats) {
      if (!f.isFile()) continue;
      if (!f.name.startsWith('session-') || !f.name.endsWith('.json')) continue;
      out.push(path.join(chatsDir, f.name));
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function parseGeminiIncremental({ sessionFiles, cursors, queuePath, onProgress, source }) {
  await ensureDir(path.dirname(queuePath));
  let filesProcessed = 0;
  let eventsAggregated = 0;
  const cb = typeof onProgress === 'function' ? onProgress : null;
  const totalFiles = Array.isArray(sessionFiles) ? sessionFiles.length : 0;
  const hourlyState = normalizeHourlyState(cursors?.hourly);
  const touchedBuckets = new Set();
  const defaultSource = normalizeSourceInput(source) || 'gemini';

  if (!cursors.files || typeof cursors.files !== 'object') {
    cursors.files = {};
  }

  for (let idx = 0; idx < sessionFiles.length; idx++) {
    const entry = sessionFiles[idx];
    const filePath = typeof entry === 'string' ? entry : entry?.path;
    if (!filePath) continue;
    const fileSource = typeof entry === 'string' ? defaultSource : normalizeSourceInput(entry?.source) || defaultSource;
    const st = await fs.stat(filePath).catch(() => null);
    if (!st || !st.isFile()) continue;

    const key = filePath;
    const prev = cursors.files[key] || null;
    const inode = st.ino || 0;
    const startIndex = prev && prev.inode === inode ? prev.lastIndex || -1 : -1;
    const lastTotals = prev && prev.inode === inode ? prev.lastTotals || null : null;
    const lastModel = prev && prev.inode === inode ? prev.lastModel || null : null;

    const result = await parseGeminiFile({
      filePath,
      startIndex,
      lastTotals,
      lastModel,
      hourlyState,
      touchedBuckets,
      source: fileSource
    });

    cursors.files[key] = {
      inode,
      lastIndex: result.lastIndex,
      lastTotals: result.lastTotals,
      lastModel: result.lastModel,
      updatedAt: new Date().toISOString()
    };

    filesProcessed += 1;
    eventsAggregated += result.eventsAggregated;

    if (cb) {
      cb({
        index: idx + 1,
        total: totalFiles,
        filePath,
        filesProcessed,
        eventsAggregated,
        bucketsQueued: touchedBuckets.size
      });
    }
  }

  const bucketsQueued = await enqueueTouchedBuckets({ queuePath, hourlyState, touchedBuckets });
  hourlyState.updatedAt = new Date().toISOString();
  cursors.hourly = hourlyState;

  return { filesProcessed, eventsAggregated, bucketsQueued };
}

async function parseGeminiFile({ filePath, startIndex, lastTotals, lastModel, hourlyState, touchedBuckets, source }) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!raw.trim()) return { lastIndex: startIndex, lastTotals, lastModel, eventsAggregated: 0 };

  let session;
  try {
    session = JSON.parse(raw);
  } catch (_e) {
    return { lastIndex: startIndex, lastTotals, lastModel, eventsAggregated: 0 };
  }

  const messages = Array.isArray(session?.messages) ? session.messages : [];
  let eventsAggregated = 0;
  let model = typeof lastModel === 'string' ? lastModel : null;
  let totals = lastTotals && typeof lastTotals === 'object' ? lastTotals : null;
  const begin = Number.isFinite(startIndex) ? startIndex + 1 : 0;

  for (let idx = begin; idx < messages.length; idx++) {
    const msg = messages[idx];
    if (!msg || typeof msg !== 'object') continue;
    if (typeof msg.model === 'string') model = msg.model;
    const timestamp = typeof msg.timestamp === 'string' ? msg.timestamp : null;
    const token = normalizeGeminiTokens(msg.tokens);
    if (!timestamp || !token) continue;

    const delta = diffGeminiTotals(token, totals);
    if (!delta || isAllZeroUsage(delta)) {
      totals = token;
      continue;
    }

    const bucketStart = toUtcHalfHourStart(timestamp);
    if (!bucketStart) {
      totals = token;
      continue;
    }

    const bucket = getHourlyBucket(hourlyState, source, model, bucketStart);
    addTotals(bucket.totals, delta);
    touchedBuckets.add(bucketKey(source, model, bucketStart));
    eventsAggregated += 1;
    totals = token;
  }

  return {
    lastIndex: messages.length - 1,
    lastTotals: totals,
    lastModel: model,
    eventsAggregated
  };
}

function normalizeGeminiTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return null;
  const input = Number(tokens.input) || 0;
  const cached = Number(tokens.cached) || 0;
  const output = Number(tokens.output) || 0;
  const tool = Number(tokens.tool) || 0;
  const thoughts = Number(tokens.thoughts) || 0;
  const total = Number(tokens.total) || 0;
  return {
    input_tokens: Math.max(0, input),
    cached_input_tokens: Math.max(0, cached),
    output_tokens: Math.max(0, output + tool),
    reasoning_output_tokens: Math.max(0, thoughts),
    total_tokens: Math.max(0, total)
  };
}

function diffGeminiTotals(current, previous) {
  if (!current) return null;
  if (!previous || typeof previous !== 'object') return current;

  const delta = {
    input_tokens: Math.max(0, (current.input_tokens || 0) - (previous.input_tokens || 0)),
    cached_input_tokens: Math.max(0, (current.cached_input_tokens || 0) - (previous.cached_input_tokens || 0)),
    output_tokens: Math.max(0, (current.output_tokens || 0) - (previous.output_tokens || 0)),
    reasoning_output_tokens: Math.max(0, (current.reasoning_output_tokens || 0) - (previous.reasoning_output_tokens || 0)),
    total_tokens: Math.max(0, (current.total_tokens || 0) - (previous.total_tokens || 0))
  };

  const totalReset = (current.total_tokens || 0) < (previous.total_tokens || 0);
  return totalReset ? current : delta;
}
```

**Step 2: Run test to verify it passes**

Run: `node --test test/rollout-parser.test.js`
Expected: PASS

---

### Task 3: Wire Gemini parsing into sync

**Files:**
- Modify: `src/commands/sync.js`

**Step 1: Add discovery + parser call**

```js
const { listGeminiSessionFiles, parseGeminiIncremental } = require('../lib/rollout');

// inside cmdSync
const geminiTmpDir = process.env.GEMINI_HOME || path.join(home, '.gemini', 'tmp');
const geminiSessionFiles = await listGeminiSessionFiles(geminiTmpDir);
let geminiResult = { filesProcessed: 0, eventsAggregated: 0, bucketsQueued: 0 };
if (geminiSessionFiles.length > 0) {
  if (progress?.enabled) {
    progress.start(`Parsing Gemini ${renderBar(0)} 0/${formatNumber(geminiSessionFiles.length)} files | buckets 0`);
  }
  geminiResult = await parseGeminiIncremental({
    sessionFiles: geminiSessionFiles,
    cursors,
    queuePath,
    onProgress: (p) => {
      if (!progress?.enabled) return;
      const pct = p.total > 0 ? p.index / p.total : 1;
      progress.update(
        `Parsing Gemini ${renderBar(pct)} ${formatNumber(p.index)}/${formatNumber(p.total)} files | buckets ${formatNumber(
          p.bucketsQueued
        )}`
      );
    },
    source: 'gemini'
  });
}
```

**Step 2: Update totals output (optional)**

```js
const totalParsed = parseResult.filesProcessed + claudeResult.filesProcessed + geminiResult.filesProcessed;
const totalBuckets = parseResult.bucketsQueued + claudeResult.bucketsQueued + geminiResult.bucketsQueued;
```

**Step 3: Run test suite**

Run: `node --test test/rollout-parser.test.js`
Expected: PASS

---

### Task 4: Verification + regression notes

**Files:**
- Modify: `openspec/changes/2025-12-26-add-gemini-cli-usage/verification-report.md`

**Step 1: Run verification commands**

Run: `node --test test/rollout-parser.test.js`
Expected: PASS

**Step 2: Local smoke**

Run: `node bin/tracker.js sync`
Expected: `~/.vibescore/tracker/queue.jsonl` contains `source = "gemini"` when Gemini sessions exist.

**Step 3: Update verification report**
- Record commands and results.

