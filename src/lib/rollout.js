const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const crypto = require('node:crypto');

const { ensureDir } = require('./fs');

async function listRolloutFiles(sessionsDir) {
  const out = [];
  const years = await safeReadDir(sessionsDir);
  for (const y of years) {
    if (!/^[0-9]{4}$/.test(y.name) || !y.isDirectory()) continue;
    const yearDir = path.join(sessionsDir, y.name);
    const months = await safeReadDir(yearDir);
    for (const m of months) {
      if (!/^[0-9]{2}$/.test(m.name) || !m.isDirectory()) continue;
      const monthDir = path.join(yearDir, m.name);
      const days = await safeReadDir(monthDir);
      for (const d of days) {
        if (!/^[0-9]{2}$/.test(d.name) || !d.isDirectory()) continue;
        const dayDir = path.join(monthDir, d.name);
        const files = await safeReadDir(dayDir);
        for (const f of files) {
          if (!f.isFile()) continue;
          if (!f.name.startsWith('rollout-') || !f.name.endsWith('.jsonl')) continue;
          out.push(path.join(dayDir, f.name));
        }
      }
    }
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function parseRolloutIncremental({ rolloutFiles, cursors, queuePath, onProgress }) {
  await ensureDir(path.dirname(queuePath));
  let filesProcessed = 0;
  let eventsQueued = 0;

  const cb = typeof onProgress === 'function' ? onProgress : null;
  const totalFiles = Array.isArray(rolloutFiles) ? rolloutFiles.length : 0;

  for (let idx = 0; idx < rolloutFiles.length; idx++) {
    const filePath = rolloutFiles[idx];
    const st = await fs.stat(filePath).catch(() => null);
    if (!st || !st.isFile()) continue;

    const key = filePath;
    const prev = cursors.files[key] || null;
    const inode = st.ino || 0;
    const startOffset = prev && prev.inode === inode ? prev.offset || 0 : 0;
    const lastTotal = prev && prev.inode === inode ? prev.lastTotal || null : null;
    const lastModel = prev && prev.inode === inode ? prev.lastModel || null : null;

    const result = await parseRolloutFile({
      filePath,
      startOffset,
      lastTotal,
      lastModel,
      queuePath
    });

    cursors.files[key] = {
      inode,
      offset: result.endOffset,
      lastTotal: result.lastTotal,
      lastModel: result.lastModel,
      updatedAt: new Date().toISOString()
    };

    filesProcessed += 1;
    eventsQueued += result.eventsQueued;

    if (cb) {
      cb({
        index: idx + 1,
        total: totalFiles,
        filePath,
        filesProcessed,
        eventsQueued
      });
    }
  }

  return { filesProcessed, eventsQueued };
}

async function parseRolloutFile({ filePath, startOffset, lastTotal, lastModel, queuePath }) {
  const st = await fs.stat(filePath);
  const endOffset = st.size;
  if (startOffset >= endOffset) {
    return { endOffset, lastTotal, lastModel, eventsQueued: 0 };
  }

  const stream = fssync.createReadStream(filePath, { encoding: 'utf8', start: startOffset });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const toAppend = [];
  let model = typeof lastModel === 'string' ? lastModel : null;
  let totals = lastTotal && typeof lastTotal === 'object' ? lastTotal : null;
  let eventsQueued = 0;

  for await (const line of rl) {
    if (!line) continue;
    const maybeTokenCount = line.includes('"token_count"');
    const maybeTurnContext = !maybeTokenCount && line.includes('"turn_context"') && line.includes('"model"');
    if (!maybeTokenCount && !maybeTurnContext) continue;

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_e) {
      continue;
    }

    if (obj?.type === 'turn_context' && obj?.payload && typeof obj.payload.model === 'string') {
      model = obj.payload.model;
      continue;
    }

    const payload = obj?.payload;
    if (!payload || payload.type !== 'token_count') continue;

    const info = payload.info;
    if (!info || typeof info !== 'object') continue;

    const tokenTimestamp = typeof obj.timestamp === 'string' ? obj.timestamp : null;
    if (!tokenTimestamp) continue;

    const lastUsage = info.last_token_usage;
    const totalUsage = info.total_token_usage;

    const delta = pickDelta(lastUsage, totalUsage, totals);
    if (!delta) continue;

    if (totalUsage && typeof totalUsage === 'object') {
      totals = totalUsage;
    }

    const event = {
      event_id: sha256Hex(line),
      token_timestamp: tokenTimestamp,
      model: model || null,
      input_tokens: delta.input_tokens || 0,
      cached_input_tokens: delta.cached_input_tokens || 0,
      output_tokens: delta.output_tokens || 0,
      reasoning_output_tokens: delta.reasoning_output_tokens || 0,
      total_tokens: delta.total_tokens || 0
    };

    toAppend.push(JSON.stringify(event));
    eventsQueued += 1;
  }

  if (toAppend.length > 0) {
    await fs.appendFile(queuePath, toAppend.join('\n') + '\n', 'utf8');
  }

  return { endOffset, lastTotal: totals, lastModel: model, eventsQueued };
}

function pickDelta(lastUsage, totalUsage, prevTotals) {
  const hasLast = isNonEmptyObject(lastUsage);
  const hasTotal = isNonEmptyObject(totalUsage);
  const hasPrevTotals = isNonEmptyObject(prevTotals);

  // Codex rollout logs sometimes emit duplicate token_count records where total_token_usage does not
  // change between adjacent entries. Counting last_token_usage in those cases will double-count.
  if (hasTotal && hasPrevTotals && sameUsage(totalUsage, prevTotals)) {
    return null;
  }

  if (!hasLast && hasTotal && hasPrevTotals && totalsReset(totalUsage, prevTotals)) {
    const normalized = normalizeUsage(totalUsage);
    return isAllZeroUsage(normalized) ? null : normalized;
  }

  if (hasLast) {
    return normalizeUsage(lastUsage);
  }

  if (hasTotal && hasPrevTotals) {
    const delta = {};
    for (const k of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']) {
      const a = Number(totalUsage[k]);
      const b = Number(prevTotals[k]);
      if (Number.isFinite(a) && Number.isFinite(b)) delta[k] = Math.max(0, a - b);
    }
    const normalized = normalizeUsage(delta);
    return isAllZeroUsage(normalized) ? null : normalized;
  }

  if (hasTotal) {
    const normalized = normalizeUsage(totalUsage);
    return isAllZeroUsage(normalized) ? null : normalized;
  }

  return null;
}

function normalizeUsage(u) {
  const out = {};
  for (const k of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']) {
    const n = Number(u[k] || 0);
    out[k] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  return out;
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function isNonEmptyObject(v) {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0);
}

function isAllZeroUsage(u) {
  if (!u || typeof u !== 'object') return true;
  for (const k of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']) {
    if (Number(u[k] || 0) !== 0) return false;
  }
  return true;
}

function sameUsage(a, b) {
  for (const k of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']) {
    if (toNonNegativeInt(a?.[k]) !== toNonNegativeInt(b?.[k])) return false;
  }
  return true;
}

function totalsReset(curr, prev) {
  const currTotal = curr?.total_tokens;
  const prevTotal = prev?.total_tokens;
  if (!isFiniteNumber(currTotal) || !isFiniteNumber(prevTotal)) return false;
  return currTotal < prevTotal;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function toNonNegativeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function safeReadDir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
}

module.exports = {
  listRolloutFiles,
  parseRolloutIncremental
};
