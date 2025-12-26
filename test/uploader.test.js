const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { test } = require('node:test');

function stubIngestHourly() {
  const calls = [];
  const apiPath = require.resolve('../src/lib/vibescore-api');
  const uploaderPath = require.resolve('../src/lib/uploader');
  const original = require.cache[apiPath];
  const originalUploader = require.cache[uploaderPath];
  require.cache[apiPath] = {
    exports: {
      ingestHourly: async ({ hourly }) => {
        calls.push(hourly);
        return { inserted: hourly.length, skipped: 0 };
      }
    }
  };
  delete require.cache[uploaderPath];

  const restore = () => {
    if (original) require.cache[apiPath] = original;
    else delete require.cache[apiPath];
    if (originalUploader) require.cache[uploaderPath] = originalUploader;
    else delete require.cache[uploaderPath];
  };

  return { calls, restore };
}

test('drainQueueToCloud defaults missing source to codex', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-uploader-'));
  const queuePath = path.join(tmp, 'queue.jsonl');
  const queueStatePath = path.join(tmp, 'queue.state.json');

  const bucket = {
    hour_start: '2025-12-17T00:00:00.000Z',
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 2,
    reasoning_output_tokens: 0,
    total_tokens: 3
  };

  await fs.writeFile(queuePath, JSON.stringify(bucket) + '\n', 'utf8');

  const stub = stubIngestHourly();
  try {
    const { drainQueueToCloud } = require('../src/lib/uploader');
    await drainQueueToCloud({
      baseUrl: 'http://localhost',
      deviceToken: 'device-token',
      queuePath,
      queueStatePath,
      maxBatches: 1,
      batchSize: 10
    });

    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].length, 1);
    assert.equal(stub.calls[0][0].source, 'codex');
    assert.equal(stub.calls[0][0].model, 'unknown');
  } finally {
    stub.restore();
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('drainQueueToCloud keeps buckets separate per model when hour/source match', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-uploader-'));
  const queuePath = path.join(tmp, 'queue.jsonl');
  const queueStatePath = path.join(tmp, 'queue.state.json');

  const lines = [
    JSON.stringify({
      hour_start: '2025-12-17T00:00:00.000Z',
      source: 'codex',
      model: 'gpt-4o',
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 1,
      reasoning_output_tokens: 0,
      total_tokens: 2
    }),
    JSON.stringify({
      hour_start: '2025-12-17T00:00:00.000Z',
      source: 'codex',
      model: 'unknown',
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 4
    })
  ];

  await fs.writeFile(queuePath, lines.join('\n') + '\n', 'utf8');

  const stub = stubIngestHourly();
  try {
    const { drainQueueToCloud } = require('../src/lib/uploader');
    await drainQueueToCloud({
      baseUrl: 'http://localhost',
      deviceToken: 'device-token',
      queuePath,
      queueStatePath,
      maxBatches: 1,
      batchSize: 10
    });

    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].length, 2);
    const byModel = new Map(stub.calls[0].map((row) => [row.model, row]));
    assert.ok(byModel.has('gpt-4o'));
    assert.ok(byModel.has('unknown'));
    assert.equal(byModel.get('gpt-4o').total_tokens, 2);
    assert.equal(byModel.get('unknown').total_tokens, 4);
  } finally {
    stub.restore();
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
