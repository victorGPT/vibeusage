const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const {
  parseRolloutIncremental,
  parseClaudeIncremental,
  parseGeminiIncremental,
  parseOpencodeIncremental
} = require('../src/lib/rollout');

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

test('parseGeminiIncremental aggregates gemini tokens and model', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-gemini-'));
  try {
    const sessionPath = path.join(tmp, 'session.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const session = buildGeminiSession({
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
    });

    await fs.writeFile(sessionPath, JSON.stringify(session), 'utf8');

    const res = await parseGeminiIncremental({ sessionFiles: [sessionPath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].source, 'gemini');
    assert.equal(queued[0].model, 'gemini-3-flash-preview');
    assert.equal(queued[0].hour_start, '2025-12-26T08:00:00.000Z');
    assert.equal(queued[0].input_tokens, 10);
    assert.equal(queued[0].cached_input_tokens, 2);
    assert.equal(queued[0].output_tokens, 2);
    assert.equal(queued[0].reasoning_output_tokens, 0);
    assert.equal(queued[0].total_tokens, 14);
    assert.equal(typeof queued[0].content, 'undefined');
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

    const session = buildGeminiSession({
      messages: [
        {
          id: 'm1',
          type: 'assistant',
          timestamp: '2025-12-26T08:05:00.000Z',
          model: 'gemini-3-flash-preview',
          tokens: { input: 5, output: 1, cached: 0, thoughts: 0, tool: 0, total: 6 }
        }
      ]
    });

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

test('parseGeminiIncremental defaults missing model to unknown', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-gemini-'));
  try {
    const sessionPath = path.join(tmp, 'session.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const session = buildGeminiSession({
      messages: [
        {
          id: 'm1',
          type: 'assistant',
          timestamp: '2025-12-26T08:05:00.000Z',
          tokens: { input: 1, output: 0, cached: 0, thoughts: 0, tool: 0, total: 1 }
        }
      ]
    });

    await fs.writeFile(sessionPath, JSON.stringify(session), 'utf8');

    const res = await parseGeminiIncremental({ sessionFiles: [sessionPath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'unknown');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseOpencodeIncremental aggregates message tokens and model', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-opencode-'));
  try {
    const messageDir = path.join(tmp, 'message', 'ses_test');
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, 'msg_test.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const message = buildOpencodeMessage({
      modelID: 'gpt-4o',
      created: '2025-12-29T10:14:00.000Z',
      completed: '2025-12-29T10:15:00.000Z',
      tokens: { input: 10, output: 2, reasoning: 1, cached: 3 }
    });

    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');

    const res = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(res.filesProcessed, 1);
    assert.equal(res.eventsAggregated, 1);
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].source, 'opencode');
    assert.equal(queued[0].model, 'gpt-4o');
    assert.equal(queued[0].hour_start, '2025-12-29T10:00:00.000Z');
    assert.equal(queued[0].input_tokens, 10);
    assert.equal(queued[0].cached_input_tokens, 3);
    assert.equal(queued[0].output_tokens, 2);
    assert.equal(queued[0].reasoning_output_tokens, 1);
    assert.equal(queued[0].total_tokens, 13);
    assert.equal(typeof queued[0].content, 'undefined');

    const resAgain = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(resAgain.bucketsQueued, 0);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseOpencodeIncremental defaults missing model to unknown', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-opencode-'));
  try {
    const messageDir = path.join(tmp, 'message', 'ses_test');
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, 'msg_test.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const message = buildOpencodeMessage({
      created: '2025-12-29T10:20:00.000Z',
      tokens: { input: 1, output: 0, reasoning: 0, cached: 0 }
    });

    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');

    const res = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'unknown');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseOpencodeIncremental falls back to model field when modelID missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-opencode-'));
  try {
    const messageDir = path.join(tmp, 'message', 'ses_test');
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, 'msg_test.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const message = buildOpencodeMessage({
      model: 'glm-4.7-free',
      created: '2025-12-29T10:30:00.000Z',
      tokens: { input: 2, output: 1, reasoning: 0, cached: 0 }
    });

    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');

    const res = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'glm-4.7-free');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseOpencodeIncremental does not double count after message rewrite', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-opencode-'));
  try {
    const messageDir = path.join(tmp, 'message', 'ses_test');
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, 'msg_test.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const message = buildOpencodeMessage({
      modelID: 'gpt-4o',
      created: '2025-12-29T10:14:00.000Z',
      completed: '2025-12-29T10:15:00.000Z',
      tokens: { input: 4, output: 1, reasoning: 0, cached: 0 }
    });

    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');

    const res = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    await fs.rm(messagePath);
    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');

    const resAgain = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(resAgain.bucketsQueued, 0);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].total_tokens, 5);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseOpencodeIncremental falls back to legacy cursors when opencode state missing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-opencode-'));
  try {
    const messageDir = path.join(tmp, 'message', 'ses_test');
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, 'msg_test.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const message = buildOpencodeMessage({
      modelID: 'gpt-4o',
      created: '2025-12-29T10:14:00.000Z',
      completed: '2025-12-29T10:15:00.000Z',
      tokens: { input: 4, output: 1, reasoning: 0, cached: 0 }
    });

    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');
    const res = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    delete cursors.opencode;

    await fs.rm(messagePath);
    await fs.writeFile(messagePath, JSON.stringify(message), 'utf8');

    const resAgain = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(resAgain.bucketsQueued, 0);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].total_tokens, 5);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseOpencodeIncremental updates totals after message rewrite with new tokens', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-opencode-'));
  try {
    const messageDir = path.join(tmp, 'message', 'ses_test');
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, 'msg_test.json');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const baseMessage = {
      modelID: 'gpt-4o',
      created: '2025-12-29T10:14:00.000Z',
      completed: '2025-12-29T10:15:00.000Z'
    };

    const messageV1 = buildOpencodeMessage({
      ...baseMessage,
      tokens: { input: 5, output: 0, reasoning: 0, cached: 0 }
    });

    await fs.writeFile(messagePath, JSON.stringify(messageV1), 'utf8');
    const res = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    await fs.rm(messagePath);
    const messageV2 = buildOpencodeMessage({
      ...baseMessage,
      tokens: { input: 8, output: 0, reasoning: 0, cached: 0 }
    });
    await fs.writeFile(messagePath, JSON.stringify(messageV2), 'utf8');

    const resAgain = await parseOpencodeIncremental({ messageFiles: [messagePath], cursors, queuePath });
    assert.equal(resAgain.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    assert.equal(queued[1].total_tokens, 8);
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

test('parseRolloutIncremental keeps buckets separate per model within the same hour', async () => {
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
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    const byModel = new Map(queued.map((row) => [row.model, row]));
    assert.ok(byModel.has('gpt-4o'));
    assert.ok(byModel.has('gpt-4o-mini'));
    assert.equal(byModel.get('gpt-4o').total_tokens, usage1.total_tokens);
    assert.equal(byModel.get('gpt-4o-mini').total_tokens, usage2.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental backfills unknown into dominant known model', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usageUnknown = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 2 };
    const usageA = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 3 };
    const usageB = { input_tokens: 3, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 4 };

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:05:00.000Z', last: usageUnknown, total: usageUnknown }),
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: usageA, total: usageA }),
      buildTurnContextLine({ model: 'gpt-4o-mini' }),
      buildTokenCountLine({ ts: '2025-12-17T00:15:00.000Z', last: usageB, total: usageB })
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 2);
    const byModel = new Map(queued.map((row) => [row.model, row]));
    assert.ok(byModel.has('gpt-4o'));
    assert.ok(byModel.has('gpt-4o-mini'));
    assert.equal(byModel.get('gpt-4o').total_tokens, usageA.total_tokens);
    assert.equal(byModel.get('gpt-4o-mini').total_tokens, usageB.total_tokens + usageUnknown.total_tokens);
    assert.ok(!byModel.has('unknown'));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental chooses dominant model deterministically on tie', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usageUnknown = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 1 };
    const usageA = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 3 };
    const usageB = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 3 };
    const totalsB = {
      input_tokens: usageUnknown.input_tokens + usageB.input_tokens,
      cached_input_tokens: 0,
      output_tokens: usageUnknown.output_tokens + usageB.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: usageUnknown.total_tokens + usageB.total_tokens
    };
    const totalsA = {
      input_tokens: totalsB.input_tokens + usageA.input_tokens,
      cached_input_tokens: 0,
      output_tokens: totalsB.output_tokens + usageA.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: totalsB.total_tokens + usageA.total_tokens
    };

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:05:00.000Z', last: usageUnknown, total: usageUnknown }),
      buildTurnContextLine({ model: 'gpt-4o-mini' }),
      buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: usageB, total: totalsB }),
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:15:00.000Z', last: usageA, total: totalsA })
    ];

    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    const byModel = new Map(queued.map((row) => [row.model, row]));
    assert.ok(byModel.has('gpt-4o'));
    assert.ok(byModel.has('gpt-4o-mini'));
    assert.equal(byModel.get('gpt-4o').total_tokens, usageA.total_tokens + usageUnknown.total_tokens);
    assert.equal(byModel.get('gpt-4o-mini').total_tokens, usageB.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental aligns every-code unknown to nearest codex model', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const codexPath = path.join(tmp, 'rollout-codex.jsonl');
    const everyPath = path.join(tmp, 'rollout-every.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const codexUsage = { input_tokens: 4, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 5 };
    const everyUsage = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 1 };

    const codexLines = [
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:30:00.000Z', last: codexUsage, total: codexUsage })
    ];
    const everyLines = [
      buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: everyUsage, total: everyUsage })
    ];

    await fs.writeFile(codexPath, codexLines.join('\n') + '\n', 'utf8');
    await fs.writeFile(everyPath, everyLines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    const bySource = new Map(queued.map((row) => [row.source, row]));
    assert.equal(bySource.get('every-code').model, 'gpt-4o');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental breaks ties by earlier codex bucket', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const codexPath = path.join(tmp, 'rollout-codex.jsonl');
    const everyPath = path.join(tmp, 'rollout-every.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usage = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 2 };

    const codexLines = [
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: usage, total: usage }),
      buildTurnContextLine({ model: 'gpt-4o-mini' }),
      buildTokenCountLine({ ts: '2025-12-17T01:00:00.000Z', last: usage, total: usage })
    ];
    const everyLines = [
      buildTokenCountLine({ ts: '2025-12-17T00:30:00.000Z', last: usage, total: usage })
    ];

    await fs.writeFile(codexPath, codexLines.join('\n') + '\n', 'utf8');
    await fs.writeFile(everyPath, everyLines.join('\n') + '\n', 'utf8');

    const res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.bucketsQueued, 2);

    const queued = await readJsonLines(queuePath);
    const bySource = new Map(queued.map((row) => [row.source, row]));
    assert.equal(bySource.get('every-code').model, 'gpt-4o');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental retracts prior every-code alignment when target changes', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const codexPath = path.join(tmp, 'rollout-codex.jsonl');
    const everyPath = path.join(tmp, 'rollout-every.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const codexUsage1 = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 2 };
    const codexUsage2 = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 2 };
    const codexTotals2 = {
      input_tokens: codexUsage1.input_tokens + codexUsage2.input_tokens,
      cached_input_tokens: 0,
      output_tokens: codexUsage1.output_tokens + codexUsage2.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: codexUsage1.total_tokens + codexUsage2.total_tokens
    };

    const everyUsage1 = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 1 };
    const everyUsage2 = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 1 };
    const everyTotals2 = {
      input_tokens: everyUsage1.input_tokens + everyUsage2.input_tokens,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: everyUsage1.total_tokens + everyUsage2.total_tokens
    };

    const codexLines = [
      buildTurnContextLine({ model: 'gpt-4o-mini' }),
      buildTokenCountLine({ ts: '2025-12-17T01:00:00.000Z', last: codexUsage1, total: codexUsage1 })
    ];
    const everyLines = [
      buildTokenCountLine({ ts: '2025-12-17T00:30:00.000Z', last: everyUsage1, total: everyUsage1 })
    ];

    await fs.writeFile(codexPath, codexLines.join('\n') + '\n', 'utf8');
    await fs.writeFile(everyPath, everyLines.join('\n') + '\n', 'utf8');

    let res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.bucketsQueued, 2);

    let queued = await readJsonLines(queuePath);
    let everyRows = queued.filter((row) => row.source === 'every-code');
    assert.equal(everyRows.length, 1);
    assert.equal(everyRows[0].model, 'gpt-4o-mini');

    const codexAppend = [
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: codexUsage2, total: codexTotals2 })
    ];
    const everyAppend = [
      buildTokenCountLine({ ts: '2025-12-17T00:30:00.000Z', last: everyUsage2, total: everyTotals2 })
    ];

    await fs.appendFile(codexPath, codexAppend.join('\n') + '\n', 'utf8');
    await fs.appendFile(everyPath, everyAppend.join('\n') + '\n', 'utf8');

    res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.bucketsQueued, 3);

    queued = await readJsonLines(queuePath);
    everyRows = queued.filter((row) => row.source === 'every-code' && row.hour_start === '2025-12-17T00:30:00.000Z');
    const byModel = new Map();
    for (const row of everyRows) {
      byModel.set(row.model, row);
    }
    assert.equal(byModel.get('gpt-4o-mini')?.total_tokens, 0);
    assert.equal(byModel.get('gpt-4o')?.total_tokens, everyTotals2.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental retracts unknown when known model appears later', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const rolloutPath = path.join(tmp, 'rollout-test.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const usageUnknown = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 1 };
    const usageKnown = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 3 };
    const totalsKnown = {
      input_tokens: usageUnknown.input_tokens + usageKnown.input_tokens,
      cached_input_tokens: 0,
      output_tokens: usageUnknown.output_tokens + usageKnown.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: usageUnknown.total_tokens + usageKnown.total_tokens
    };

    const lines = [
      buildTokenCountLine({ ts: '2025-12-17T00:05:00.000Z', last: usageUnknown, total: usageUnknown })
    ];
    await fs.writeFile(rolloutPath, lines.join('\n') + '\n', 'utf8');

    let res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 1);

    let queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].model, 'unknown');
    assert.equal(queued[0].total_tokens, usageUnknown.total_tokens);

    const append = [
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T00:10:00.000Z', last: usageKnown, total: totalsKnown })
    ];
    await fs.appendFile(rolloutPath, append.join('\n') + '\n', 'utf8');

    res = await parseRolloutIncremental({ rolloutFiles: [rolloutPath], cursors, queuePath });
    assert.equal(res.bucketsQueued, 2);

    queued = await readJsonLines(queuePath);
    const sameHour = queued.filter((row) => row.hour_start === '2025-12-17T00:00:00.000Z');
    const unknownRows = sameHour.filter((row) => row.model === 'unknown');
    assert.equal(unknownRows.length, 2);
    const unknownTotals = unknownRows.map((row) => row.total_tokens).sort((a, b) => a - b);
    assert.deepEqual(unknownTotals, [0, usageUnknown.total_tokens]);

    const knownRow = sameHour.find((row) => row.model === 'gpt-4o');
    assert.equal(knownRow?.total_tokens, usageKnown.total_tokens + usageUnknown.total_tokens);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('parseRolloutIncremental recomputes every-code alignment on codex-only updates', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-rollout-'));
  try {
    const codexPath = path.join(tmp, 'rollout-codex.jsonl');
    const everyPath = path.join(tmp, 'rollout-every.jsonl');
    const queuePath = path.join(tmp, 'queue.jsonl');
    const cursors = { version: 1, files: {}, updatedAt: null };

    const codexUsage1 = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 2 };
    const codexUsage2 = { input_tokens: 2, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 2 };
    const codexTotals2 = {
      input_tokens: codexUsage1.input_tokens + codexUsage2.input_tokens,
      cached_input_tokens: 0,
      output_tokens: codexUsage1.output_tokens + codexUsage2.output_tokens,
      reasoning_output_tokens: 0,
      total_tokens: codexUsage1.total_tokens + codexUsage2.total_tokens
    };
    const everyUsage = { input_tokens: 1, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 1 };

    const codexLines = [
      buildTurnContextLine({ model: 'gpt-4o' }),
      buildTokenCountLine({ ts: '2025-12-17T02:00:00.000Z', last: codexUsage1, total: codexUsage1 })
    ];
    const everyLines = [
      buildTokenCountLine({ ts: '2025-12-17T00:00:00.000Z', last: everyUsage, total: everyUsage })
    ];

    await fs.writeFile(codexPath, codexLines.join('\n') + '\n', 'utf8');
    await fs.writeFile(everyPath, everyLines.join('\n') + '\n', 'utf8');

    let res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.bucketsQueued, 2);

    const afterFirst = await readJsonLines(queuePath);
    const firstEvery = afterFirst.find((row) => row.source === 'every-code');
    assert.equal(firstEvery?.model, 'gpt-4o');

    const codexAppend = [
      buildTurnContextLine({ model: 'gpt-4o-mini' }),
      buildTokenCountLine({ ts: '2025-12-17T00:30:00.000Z', last: codexUsage2, total: codexTotals2 })
    ];
    await fs.appendFile(codexPath, codexAppend.join('\n') + '\n', 'utf8');

    res = await parseRolloutIncremental({
      rolloutFiles: [
        { path: codexPath, source: 'codex' },
        { path: everyPath, source: 'every-code' }
      ],
      cursors,
      queuePath
    });
    assert.equal(res.bucketsQueued, 3);

    const afterSecond = await readJsonLines(queuePath);
    const delta = afterSecond.slice(afterFirst.length);
    const everyDelta = delta.filter(
      (row) => row.source === 'every-code' && row.hour_start === '2025-12-17T00:00:00.000Z'
    );
    assert.equal(everyDelta.length, 2);
    const byModel = new Map(everyDelta.map((row) => [row.model, row]));
    assert.equal(byModel.get('gpt-4o')?.total_tokens, 0);
    assert.equal(byModel.get('gpt-4o-mini')?.total_tokens, everyUsage.total_tokens);
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
  return {
    sessionId: 'session-id',
    projectHash: 'project-hash',
    startTime: '2025-12-26T08:00:00.000Z',
    lastUpdated: '2025-12-26T08:10:00.000Z',
    messages
  };
}

function buildOpencodeMessage({ modelID, model, modelId, created, completed, tokens }) {
  const createdMs = created ? Date.parse(created) : null;
  const completedMs = completed ? Date.parse(completed) : null;
  return {
    id: 'msg_test',
    sessionID: 'ses_test',
    modelID,
    model,
    modelId,
    time: {
      created: Number.isFinite(createdMs) ? createdMs : undefined,
      completed: Number.isFinite(completedMs) ? completedMs : undefined
    },
    tokens: tokens
      ? {
          input: tokens.input,
          output: tokens.output,
          reasoning: tokens.reasoning,
          cache: { read: tokens.cached }
        }
      : undefined
  };
}

async function readJsonLines(filePath) {
  const text = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!text.trim()) return [];
  const lines = text.split('\n').filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}
