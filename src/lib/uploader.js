const fs = require('node:fs/promises');
const fssync = require('node:fs');
const readline = require('node:readline');

const { ensureDir, readJson, writeJson } = require('./fs');
const { ingestEvents } = require('./vibescore-api');

async function drainQueueToCloud({ baseUrl, deviceToken, queuePath, queueStatePath, maxBatches, batchSize, onProgress }) {
  await ensureDir(require('node:path').dirname(queueStatePath));

  const state = (await readJson(queueStatePath)) || { offset: 0 };
  let offset = Number(state.offset || 0);
  let inserted = 0;
  let skipped = 0;
  let attempted = 0;

  const cb = typeof onProgress === 'function' ? onProgress : null;
  const queueSize = await safeFileSize(queuePath);
  const maxEvents = Math.max(1, Math.floor(Number(batchSize || 200)));

  for (let batch = 0; batch < maxBatches; batch++) {
    const res = await readBatch(queuePath, offset, maxEvents);
    if (res.events.length === 0) break;

    attempted += res.events.length;
    const ingest = await ingestEvents({ baseUrl, deviceToken, events: res.events });
    inserted += ingest.inserted || 0;
    skipped += ingest.skipped || 0;

    offset = res.nextOffset;
    state.offset = offset;
    state.updatedAt = new Date().toISOString();
    await writeJson(queueStatePath, state);

    if (cb) {
      cb({
        batch: batch + 1,
        maxBatches,
        offset,
        queueSize,
        inserted,
        skipped
      });
    }
  }

  return { inserted, skipped, attempted };
}

async function readBatch(queuePath, startOffset, maxEvents) {
  const st = await fs.stat(queuePath).catch(() => null);
  if (!st || !st.isFile()) return { events: [], nextOffset: startOffset };
  if (startOffset >= st.size) return { events: [], nextOffset: startOffset };

  const stream = fssync.createReadStream(queuePath, { encoding: 'utf8', start: startOffset });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const events = [];
  let offset = startOffset;
  for await (const line of rl) {
    const bytes = Buffer.byteLength(line, 'utf8') + 1;
    offset += bytes;
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch (_e) {
      continue;
    }
    events.push(ev);
    if (events.length >= maxEvents) break;
  }

  rl.close();
  stream.close?.();
  return { events, nextOffset: offset };
}

async function safeFileSize(p) {
  try {
    const st = await fs.stat(p);
    return st && st.isFile() ? st.size : 0;
  } catch (_e) {
    return 0;
  }
}

module.exports = { drainQueueToCloud };
