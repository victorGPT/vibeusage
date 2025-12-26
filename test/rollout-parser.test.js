const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { parseRolloutIncremental, parseClaudeIncremental, parseGeminiIncremental } = require('../src/lib/rollout');

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
    assert.equal(res.eventsAggregated, 2);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'unknown');
    assert.equal(
      queued.reduce((sum, ev) => sum + Number(ev.total_tokens || 0), 0),
      usage1.total_tokens + usage2.total_tokens
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental splits usage into half-hour buckets', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usage1 = {
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 1
    };
    const usage2 = {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 2
    };

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: usage1, total: usage1 }),
      buildTokenCountLine({ ts: '2025-12-17T00:40:00.000Z', last: usage2, total: usage2 })
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 2);
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    const byBucket = new Map(queued.map((row) => [row.hour_start, row]));
    assert.equal(byBucket.size, 2);
    assert.equal(byBucket.get('2025-12-17T00:00:00.000Z')?.total_tokens, usage1.total_tokens);
    assert.equal(byBucket.get('2025-12-17T00:30:00.000Z')?.total_tokens, usage2.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental migrates v1 hourly buckets without resetting totals', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = {
      version: 1,
      files: {},
      updatedAt: null,
      hourly: {
        version: 1,
        buckets: {
          'codex|2025-12-17T00:00:00.000Z': {
            totals: {
              input_tokens: 4,
              cached_input_tokens: 0,
              output_tokens: 3,
              reasoning_output_tokens: 0,
              total_tokens: 7
            },
            queuedKey: null
          }
        },
        updatedAt: null
      }
    };

    const usage = {
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 3
    };

    const lines = [buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: usage, total: usage })];
    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].total_tokens, 10);
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
    assert.equal(res.eventsAggregated, 3);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
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
    assert.equal(res.eventsAggregated, 3);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(
      queued.reduce((sum, ev) => sum + Number(ev.total_tokens || 0), 0),
      usageA.total_tokens + usageB.total_tokens + totalsReset.total_tokens
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental handles Every Code token_count envelope', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usage = {
      input_tokens: 2,
      cached_input_tokens: 1,
      output_tokens: 3,
      reasoning_output_tokens: 0,
      total_tokens: 6
    };

    const lines = [
      buildEveryCodeTokenCountLine({ ts: '2025-12-17T00:05:00.000Z', last: usage, total: usage })
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({
      rolloutFiles: [{ path: rolloutPath, source: 'every-code' }],
      cursors,
      queuePath
    });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].source, 'every-code');
    assert.equal(queued[0].total_tokens, usage.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental keeps buckets separate per source', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const codexPath = path.join(tmp, 'rollout-codex.jsonl');
    const everyPath = path.join(tmp, 'rollout-every.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usage = {
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2
    };

    const line = buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: usage, total: usage });
    await fs.writeFile(codexPath, line + '\n', 'utf8');
    await fs.writeFile(everyPath, buildEveryCodeTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: usage, total: usage }) + '\n', 'utf8');

    const res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.filesProcessed, 2);
    assert.equal(res.eventsAggregated, 2);
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    const sources = queued.map((row) => row.source).sort();
    assert.deepEqual(sources, ['codex', 'every-code']);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental aggregates multiple models within the same hour', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usage1 = {
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2
    };
    const usage2 = {
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 3
    };

    const totals2 = {
      input_tokens: usage1.input_tokens + usage2.input_tokens,
      cached_input_tokens: 0,
      output_tokens: usage1.output_tokens + usage2.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: usage1.total_tokens + usage2.total_tokens
    };

    const lines = [
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:05:00.000Z', last: usage1, total: usage1 }),
      buildTurnContextLine({ model: 'gpt-4o-mini' }),
      buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: usage2, total: totals2 })
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 2);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'unknown');
    assert.equal(queued[0].total_tokens, usage1.total_tokens + usage2.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseClaudeIncremental aggregates usage into half-hour buckets', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-claude-'));
  try {
    const claudePath = path.join(tmp, 'agent-claude.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const model = 'moonshotai/Kimi-K2-Thinking';
    const lines = [
      buildClaudeUsageLine({ ts: '2025-12-25T01:05:00.000Z', input: 100, output: 50, model }),
      buildClaudeUsageLine({ ts: '2025-12-25T01:40:00.000Z', input: 200, model }),
      JSON.stringify({ timestamp: '2025-12-25T01:41:00.000Z', message: { content: [{ type: 'text', text: 'skip' }] } })
    ];

    await fs.writeFile(claudePath, lines.join('\n') + '\n', 'utf8');

    const res = await parseClaudeIncremental({
      projectFiles: [{ path: claudePath, source: 'claude' }],
      cursors,
      queuePath
    });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 2);
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    assert.ok(queued.every((row) => row.source === 'claude'));
    assert.ok(queued.every((row) => row.model === model));
    const byBucket = new Map(queued.map((row) => [row.hour_start, row]));
    assert.equal(byBucket.get('2025-12-25T01:00:00.000Z')?.input_tokens, 100);
    assert.equal(byBucket.get('2025-12-25T01:00:00.000Z')?.output_tokens, 50);
    assert.equal(byBucket.get('2025-12-25T01:00:00.000Z')?.total_tokens, 150);
    assert.equal(byBucket.get('2025-12-25T01:30:00.000Z')?.input_tokens, 200);
    assert.equal(byBucket.get('2025-12-25T01:30:00.000Z')?.output_tokens, 0);
    assert.equal(byBucket.get('2025-12-25T01:30:00.000Z')?.total_tokens, 200);

    const resAgain = await parseClaudeIncremental({
      projectFiles: [{ path: claudePath, source: 'claude' }],
      cursors,
      queuePath
    });
    assert.equal(resAgain.bucketsQueued, 0);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseClaudeIncremental honors total_tokens when present', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-claude-'));
  try {
    const claudePath = path.join(tmp, 'agent-claude.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const lines = [buildClaudeUsageLine({ ts: '2025-12-25T01:10:00.000Z', input: 5, output: 1, total: 20 })];
    await fs.writeFile(claudePath, lines.join('\n') + '\n', 'utf8');

    const res = await parseClaudeIncremental({
      projectFiles: [{ path: claudePath, source: 'claude' }],
      cursors,
      queuePath
    });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].total_tokens, 20);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseClaudeIncremental defaults missing model to unknown', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-claude-'));
  try {
    const claudePath = path.join(tmp, 'agent-claude.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const lines = [buildClaudeUsageLine({ ts: '2025-12-25T02:05:00.000Z', input: 10, output: 5 })];
    await fs.writeFile(claudePath, lines.join('\n') + '\n', 'utf8');

    const res = await parseClaudeIncremental({
      projectFiles: [{ path: claudePath, source: 'claude' }],
      cursors,
      queuePath
    });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'unknown');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseGeminiIncremental maps tokens and aggregates half-hour buckets', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-gemini-'));
  try {
    const sessionPath = path.join(tmp, 'session.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const messages = [
      buildGeminiMessage({
        id: 'm1',
        ts: '2025-12-24T18:07:10.826Z',
        model: 'gemini-3-pro-preview',
        tokens: { input: 2, output: 3, cached: 1, thoughts: 4, tool: 5, total: 15 }
      })
    ];

    await fs.writeFile(sessionPath, buildGeminiSession({ messages }), 'utf8');

    const res = await parseGeminiIncremental({
      sessionFiles: [sessionPath],
      cursors,
      queuePath,
      source: 'gemini'
    });

    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].source, 'gemini');
    assert.equal(queued[0].model, 'gemini-3-pro-preview');
    assert.equal(queued[0].input_tokens, 2);
    assert.equal(queued[0].cached_input_tokens, 1);
    assert.equal(queued[0].reasoning_output_tokens, 4);
    assert.equal(queued[0].output_tokens, 8);
    assert.equal(queued[0].total_tokens, 15);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseGeminiIncremental is idempotent with cursor', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-gemini-'));
  try {
    const sessionPath = path.join(tmp, 'session.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const messages = [
      buildGeminiMessage({
        id: 'm1',
        ts: '2025-12-24T18:07:10.826Z',
        model: 'gemini-3-pro-preview',
        tokens: { input: 1, output: 1, cached: 0, thoughts: 0, tool: 1, total: 3 }
      })
    ];

    await fs.writeFile(sessionPath, buildGeminiSession({ messages }), 'utf8');

    const first = await parseGeminiIncremental({
      sessionFiles: [sessionPath],
      cursors,
      queuePath,
      source: 'gemini'
    });
    const second = await parseGeminiIncremental({
      sessionFiles: [sessionPath],
      cursors,
      queuePath,
      source: 'gemini'
    });

    assert.equal(first.eventsAggregated, 1);
    assert.equal(second.eventsAggregated, 0);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

function buildTurnContextLine({ model }) {
  return JSON.stringify({
    type: 'turn_context',
    payload: {
      model
    }
  });
}

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

function buildEveryCodeTokenCountLine({ ts, last, total }) {
  return JSON.stringify({
    type: 'event_msg',
    timestamp: ts,
    payload: {
      id: 'msg-id',
      event_seq: 1,
      msg: {
        type: 'token_count',
        info: {
          last_token_usage: last,
          total_token_usage: total
        }
      }
    }
  });
}

function buildClaudeUsageLine({ ts, input, output, model, total }) {
  return JSON.stringify({
    timestamp: ts,
    message: {
      model,
      usage: {
        input_tokens: input,
        output_tokens: output,
        total_tokens: typeof total === 'number' ? total : undefined
      }
    }
  });
}

function buildGeminiSession({ messages }) {
  return JSON.stringify({
    sessionId: 'session-1',
    projectHash: 'proj-1',
    startTime: '2025-12-24T18:00:00.000Z',
    lastUpdated: '2025-12-24T18:10:00.000Z',
    messages
  });
}

function buildGeminiMessage({ id, ts, model, tokens, content = 'ignored', thoughts = 'ignored' }) {
  return {
    id,
    timestamp: ts,
    type: 'assistant',
    model,
    content,
    thoughts,
    tokens
  };
}

async function readJsonLines(filePath) {
  const text = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!text.trim()) return [];
  const lines = text.split('\n').filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}
