const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { parseRolloutIncremental } = require('../src/lib/rollout');

test('parseRolloutIncremental skips duplicate token_count records (unchanged total_token_usage)', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usage1 = {
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 3
    };
    const usage2 = {
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2
    };

    const totals1 = usage1;
    const totals2 = {
      input_tokens: usage1.input_tokens + usage2.input_tokens,
      cached_input_tokens: 0,
      output_tokens: usage1.output_tokens + usage2.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: usage1.total_tokens + usage2.total_tokens
    };

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: usage1, total: totals1 }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:01.000Z', last: usage1, total: totals1 }), // duplicate
      buildTokenCountLine({ ts: '2025-12-17T00:00:02.000Z', last: usage2, total: totals2 }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:03.000Z', last: usage2, total: totals2 }) // duplicate
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsQueued, 2);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    assert.equal(
      queued.reduce((sum, ev) => sum + Number(ev.total_tokens || 0), 0),
      usage1.total_tokens + usage2.total_tokens
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental handles total_token_usage reset by counting last_token_usage', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usageA = {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 10
    };
    const usageB = {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 5
    };
    const usageReset = {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 7
    };

    const totalsA = usageA;
    const totalsB = { ...usageA, total_tokens: usageA.total_tokens + usageB.total_tokens };
    const totalsReset = usageReset; // reset: totals decreased from totalsB.total_tokens

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: usageA, total: totalsA }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:01.000Z', last: usageB, total: totalsB }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:02.000Z', last: usageReset, total: totalsReset }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:03.000Z', last: usageReset, total: totalsReset }) // duplicate after reset
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsQueued, 3);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 3);
    assert.equal(
      queued.reduce((sum, ev) => sum + Number(ev.total_tokens || 0), 0),
      usageA.total_tokens + usageB.total_tokens + usageReset.total_tokens
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental handles total_token_usage reset when last_token_usage is missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usageA = {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 4
    };
    const usageB = {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 6
    };

    const totalsA = usageA;
    const totalsB = { ...usageA, total_tokens: usageA.total_tokens + usageB.total_tokens };
    const totalsReset = { ...usageA, total_tokens: 5 };

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: usageA, total: totalsA }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:01.000Z', last: usageB, total: totalsB }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:02.000Z', last: null, total: totalsReset }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:03.000Z', last: null, total: totalsReset }) // duplicate after reset
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsQueued, 3);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 3);
    assert.equal(
      queued.reduce((sum, ev) => sum + Number(ev.total_tokens || 0), 0),
      usageA.total_tokens + usageB.total_tokens + totalsReset.total_tokens
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

function buildTokenCountLine({ ts, last, total }) {
  return JSON.stringify({
    type: 'event_msg',
    timestamp: ts,
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: last,
        total_token_usage: total
      }
    }
  });
}

async function readJsonLines(filePath) {
  const text = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!text.trim()) return [];
  const lines = text.split('\n').filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}
