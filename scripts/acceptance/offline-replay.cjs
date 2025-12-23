#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { drainQueueToCloud } = require('../../src/lib/uploader');
const { readJson, writeJson } = require('../../src/lib/fs');

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-offline-replay-'));

  const queuePath = path.join(tmp, 'queue.jsonl');
  const queueStatePath = path.join(tmp, 'queue.state.json');
  const buckets = buildBuckets();

  await fs.writeFile(queuePath, buckets.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  await writeJson(queueStatePath, { offset: 0 });

  let offlineError = null;
  try {
    await drainQueueToCloud({
      baseUrl: 'http://127.0.0.1:0',
      deviceToken: 'offline',
      queuePath,
      queueStatePath,
      maxBatches: 1,
      batchSize: 200
    });
  } catch (e) {
    offlineError = e;
  }
  assert.ok(offlineError, 'expected offline upload to fail');

  const afterFail = await readJson(queueStatePath);
  assert.equal(Number(afterFail?.offset || 0), 0);

  const stub = await startIngestStub();
  try {
    const baseUrl = `http://127.0.0.1:${stub.port}`;

    const first = await drainQueueToCloud({
      baseUrl,
      deviceToken: 'online',
      queuePath,
      queueStatePath,
      maxBatches: 10,
      batchSize: 200
    });

    const queueSize = (await fs.stat(queuePath)).size;
    const afterFirst = await readJson(queueStatePath);
    assert.equal(Number(afterFirst?.offset || 0), queueSize);
    assert.equal(first.inserted, buckets.length);
    assert.equal(first.skipped, 0);

    await writeJson(queueStatePath, { offset: 0 });
    const second = await drainQueueToCloud({
      baseUrl,
      deviceToken: 'online',
      queuePath,
      queueStatePath,
      maxBatches: 10,
      batchSize: 200
    });

    assert.equal(second.inserted, 0);
    assert.equal(second.skipped, buckets.length);

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          tmp: opts.keep ? tmp : null,
          offline_error: String(offlineError?.message || offlineError),
          first,
          second
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await new Promise((resolve) => stub.server.close(resolve));
    if (!opts.keep) await fs.rm(tmp, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const out = { keep: false };
  for (const a of argv) {
    if (a === '--keep') out.keep = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

function buildBuckets() {
  const iso = new Date('2025-12-19T00:00:00.000Z').toISOString();
  return [
    {
      hour_start: iso,
      input_tokens: 1,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
      total_tokens: 3
    },
    {
      hour_start: '2025-12-19T00:30:00.000Z',
      input_tokens: 2,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
      total_tokens: 6
    }
  ];
}

async function startIngestStub() {
  const seen = new Set();

  const server = http.createServer((req, res) => {
    if (!req.url) return respond(res, 400, { error: 'Missing url' });
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'POST' || url.pathname !== '/functions/vibescore-ingest') {
      return respond(res, 404, { error: 'Not found' });
    }

    const auth = req.headers.authorization || '';
    if (!String(auth).startsWith('Bearer ')) {
      return respond(res, 401, { error: 'Missing bearer token' });
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let data = null;
      try {
        data = JSON.parse(body);
      } catch (_e) {
        return respond(res, 400, { error: 'Invalid JSON' });
      }

      const events = Array.isArray(data?.hourly) ? data.hourly : [];
      let inserted = 0;
      let skipped = 0;

      for (const ev of events) {
        const hourStart = typeof ev?.hour_start === 'string' ? ev.hour_start : null;
        if (!hourStart) continue;
        if (seen.has(hourStart)) skipped += 1;
        else {
          seen.add(hourStart);
          inserted += 1;
        }
      }

      return respond(res, 200, { inserted, skipped });
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = addr && typeof addr === 'object' ? addr.port : null;
  if (!port) throw new Error('Failed to start stub server');
  return { server, port };
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
