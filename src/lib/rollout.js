const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const { ensureDir } = require('./fs');

const DEFAULT_SOURCE = 'codex';
const DEFAULT_MODEL = 'unknown';
const BUCKET_SEPARATOR = '|';

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

async function listClaudeProjectFiles(projectsDir) {
  const out = [];
  await walkClaudeProjects(projectsDir, out);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function listGeminiSessionFiles(tmpDir) {
  const out = [];
  const roots = await safeReadDir(tmpDir);
  for (const root of roots) {
    if (!root.isDirectory()) continue;
    const chatsDir = path.join(tmpDir, root.name, 'chats');
    const chats = await safeReadDir(chatsDir);
    for (const entry of chats) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('session-') || !entry.name.endsWith('.json')) continue;
      out.push(path.join(chatsDir, entry.name));
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function listOpencodeMessageFiles(storageDir) {
  const out = [];
  const messageDir = path.join(storageDir, 'message');
  await walkOpencodeMessages(messageDir, out);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function parseRolloutIncremental({ rolloutFiles, cursors, queuePath, onProgress, source }) {
  await ensureDir(path.dirname(queuePath));
  let filesProcessed = 0;
  let eventsAggregated = 0;

  const cb = typeof onProgress === 'function' ? onProgress : null;
  const totalFiles = Array.isArray(rolloutFiles) ? rolloutFiles.length : 0;
  const hourlyState = normalizeHourlyState(cursors?.hourly);
  const touchedBuckets = new Set();
  const defaultSource = normalizeSourceInput(source) || DEFAULT_SOURCE;

  if (!cursors.files || typeof cursors.files !== 'object') {
    cursors.files = {};
  }

  for (let idx = 0; idx < rolloutFiles.length; idx++) {
    const entry = rolloutFiles[idx];
    const filePath = typeof entry === 'string' ? entry : entry?.path;
    if (!filePath) continue;
    const fileSource =
      typeof entry === 'string' ? defaultSource : normalizeSourceInput(entry?.source) || defaultSource;
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
      hourlyState,
      touchedBuckets,
      source: fileSource
    });

    cursors.files[key] = {
      inode,
      offset: result.endOffset,
      lastTotal: result.lastTotal,
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

async function parseClaudeIncremental({ projectFiles, cursors, queuePath, onProgress, source }) {
  await ensureDir(path.dirname(queuePath));
  let filesProcessed = 0;
  let eventsAggregated = 0;

  const cb = typeof onProgress === 'function' ? onProgress : null;
  const files = Array.isArray(projectFiles) ? projectFiles : [];
  const totalFiles = files.length;
  const hourlyState = normalizeHourlyState(cursors?.hourly);
  const touchedBuckets = new Set();
  const defaultSource = normalizeSourceInput(source) || 'claude';

  if (!cursors.files || typeof cursors.files !== 'object') {
    cursors.files = {};
  }

  for (let idx = 0; idx < files.length; idx++) {
    const entry = files[idx];
    const filePath = typeof entry === 'string' ? entry : entry?.path;
    if (!filePath) continue;
    const fileSource =
      typeof entry === 'string' ? defaultSource : normalizeSourceInput(entry?.source) || defaultSource;
    const st = await fs.stat(filePath).catch(() => null);
    if (!st || !st.isFile()) continue;

    const key = filePath;
    const prev = cursors.files[key] || null;
    const inode = st.ino || 0;
    const startOffset = prev && prev.inode === inode ? prev.offset || 0 : 0;

    const result = await parseClaudeFile({
      filePath,
      startOffset,
      hourlyState,
      touchedBuckets,
      source: fileSource
    });

    cursors.files[key] = {
      inode,
      offset: result.endOffset,
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

async function parseGeminiIncremental({ sessionFiles, cursors, queuePath, onProgress, source }) {
  await ensureDir(path.dirname(queuePath));
  let filesProcessed = 0;
  let eventsAggregated = 0;

  const cb = typeof onProgress === 'function' ? onProgress : null;
  const files = Array.isArray(sessionFiles) ? sessionFiles : [];
  const totalFiles = files.length;
  const hourlyState = normalizeHourlyState(cursors?.hourly);
  const touchedBuckets = new Set();
  const defaultSource = normalizeSourceInput(source) || 'gemini';

  if (!cursors.files || typeof cursors.files !== 'object') {
    cursors.files = {};
  }

  for (let idx = 0; idx < files.length; idx++) {
    const entry = files[idx];
    const filePath = typeof entry === 'string' ? entry : entry?.path;
    if (!filePath) continue;
    const fileSource =
      typeof entry === 'string' ? defaultSource : normalizeSourceInput(entry?.source) || defaultSource;
    const st = await fs.stat(filePath).catch(() => null);
    if (!st || !st.isFile()) continue;

    const key = filePath;
    const prev = cursors.files[key] || null;
    const inode = st.ino || 0;
    let startIndex = prev && prev.inode === inode ? Number(prev.lastIndex || -1) : -1;
    let lastTotals = prev && prev.inode === inode ? prev.lastTotals || null : null;
    let lastModel = prev && prev.inode === inode ? prev.lastModel || null : null;

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

async function parseOpencodeIncremental({ messageFiles, cursors, queuePath, onProgress, source }) {
  await ensureDir(path.dirname(queuePath));
  let filesProcessed = 0;
  let eventsAggregated = 0;

  const cb = typeof onProgress === 'function' ? onProgress : null;
  const files = Array.isArray(messageFiles) ? messageFiles : [];
  const totalFiles = files.length;
  const hourlyState = normalizeHourlyState(cursors?.hourly);
  const opencodeState = normalizeOpencodeState(cursors?.opencode);
  const messageIndex = opencodeState.messages;
  const touchedBuckets = new Set();
  const defaultSource = normalizeSourceInput(source) || 'opencode';

  if (!cursors.files || typeof cursors.files !== 'object') {
    cursors.files = {};
  }

  for (let idx = 0; idx < files.length; idx++) {
    const entry = files[idx];
    const filePath = typeof entry === 'string' ? entry : entry?.path;
    if (!filePath) continue;
    const fileSource =
      typeof entry === 'string' ? defaultSource : normalizeSourceInput(entry?.source) || defaultSource;
    const st = await fs.stat(filePath).catch(() => null);
    if (!st || !st.isFile()) continue;

    const key = filePath;
    const prev = cursors.files[key] || null;
    const inode = st.ino || 0;
    const size = Number.isFinite(st.size) ? st.size : 0;
    const mtimeMs = Number.isFinite(st.mtimeMs) ? st.mtimeMs : 0;
    const unchanged = prev && prev.inode === inode && prev.size === size && prev.mtimeMs === mtimeMs;
    if (unchanged) {
      filesProcessed += 1;
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
      continue;
    }

    const fallbackTotals = prev && typeof prev.lastTotals === 'object' ? prev.lastTotals : null;
    const result = await parseOpencodeMessageFile({
      filePath,
      messageIndex,
      fallbackTotals,
      hourlyState,
      touchedBuckets,
      source: fileSource
    });

    cursors.files[key] = {
      inode,
      size,
      mtimeMs,
      lastTotals: result.lastTotals,
      messageKey: result.messageKey || null,
      updatedAt: new Date().toISOString()
    };

    filesProcessed += 1;
    eventsAggregated += result.eventsAggregated;

    if (result.messageKey && result.shouldUpdate) {
      messageIndex[result.messageKey] = {
        lastTotals: result.lastTotals,
        updatedAt: new Date().toISOString()
      };
    }

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
  opencodeState.updatedAt = new Date().toISOString();
  cursors.opencode = opencodeState;

  return { filesProcessed, eventsAggregated, bucketsQueued };
}

async function parseRolloutFile({
  filePath,
  startOffset,
  lastTotal,
  lastModel,
  hourlyState,
  touchedBuckets,
  source
}) {
  const st = await fs.stat(filePath);
  const endOffset = st.size;
  if (startOffset >= endOffset) {
    return { endOffset, lastTotal, lastModel, eventsAggregated: 0 };
  }

  const stream = fssync.createReadStream(filePath, { encoding: 'utf8', start: startOffset });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let model = typeof lastModel === 'string' ? lastModel : null;
  let totals = lastTotal && typeof lastTotal === 'object' ? lastTotal : null;
  let eventsAggregated = 0;

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

    const token = extractTokenCount(obj);
    if (!token) continue;

    const info = token.info;
    if (!info || typeof info !== 'object') continue;

    const tokenTimestamp = typeof token.timestamp === 'string' ? token.timestamp : null;
    if (!tokenTimestamp) continue;

    const lastUsage = info.last_token_usage;
    const totalUsage = info.total_token_usage;

    const delta = pickDelta(lastUsage, totalUsage, totals);
    if (!delta) continue;

    if (totalUsage && typeof totalUsage === 'object') {
      totals = totalUsage;
    }

    const bucketStart = toUtcHalfHourStart(tokenTimestamp);
    if (!bucketStart) continue;

    const bucket = getHourlyBucket(hourlyState, source, model, bucketStart);
    addTotals(bucket.totals, delta);
    touchedBuckets.add(bucketKey(source, model, bucketStart));
    eventsAggregated += 1;
  }

  return { endOffset, lastTotal: totals, lastModel: model, eventsAggregated };
}

async function parseClaudeFile({ filePath, startOffset, hourlyState, touchedBuckets, source }) {
  const st = await fs.stat(filePath).catch(() => null);
  if (!st || !st.isFile()) return { endOffset: startOffset, eventsAggregated: 0 };

  const endOffset = st.size;
  if (startOffset >= endOffset) return { endOffset, eventsAggregated: 0 };

  const stream = fssync.createReadStream(filePath, { encoding: 'utf8', start: startOffset });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let eventsAggregated = 0;
  for await (const line of rl) {
    if (!line || !line.includes('\"usage\"')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_e) {
      continue;
    }

    const usage = obj?.message?.usage || obj?.usage;
    if (!usage || typeof usage !== 'object') continue;

    const model = normalizeModelInput(obj?.message?.model || obj?.model) || DEFAULT_MODEL;
    const tokenTimestamp = typeof obj?.timestamp === 'string' ? obj.timestamp : null;
    if (!tokenTimestamp) continue;

    const delta = normalizeClaudeUsage(usage);
    if (!delta || isAllZeroUsage(delta)) continue;

    const bucketStart = toUtcHalfHourStart(tokenTimestamp);
    if (!bucketStart) continue;

    const bucket = getHourlyBucket(hourlyState, source, model, bucketStart);
    addTotals(bucket.totals, delta);
    touchedBuckets.add(bucketKey(source, model, bucketStart));
    eventsAggregated += 1;
  }

  rl.close();
  stream.close?.();
  return { endOffset, eventsAggregated };
}

async function parseGeminiFile({
  filePath,
  startIndex,
  lastTotals,
  lastModel,
  hourlyState,
  touchedBuckets,
  source
}) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!raw.trim()) return { lastIndex: startIndex, lastTotals, lastModel, eventsAggregated: 0 };

  let session;
  try {
    session = JSON.parse(raw);
  } catch (_e) {
    return { lastIndex: startIndex, lastTotals, lastModel, eventsAggregated: 0 };
  }

  const messages = Array.isArray(session?.messages) ? session.messages : [];
  if (startIndex >= messages.length) {
    startIndex = -1;
    lastTotals = null;
    lastModel = null;
  }

  let eventsAggregated = 0;
  let model = typeof lastModel === 'string' ? lastModel : null;
  let totals = lastTotals && typeof lastTotals === 'object' ? lastTotals : null;
  const begin = Number.isFinite(startIndex) ? startIndex + 1 : 0;

  for (let idx = begin; idx < messages.length; idx++) {
    const msg = messages[idx];
    if (!msg || typeof msg !== 'object') continue;

    const normalizedModel = normalizeModelInput(msg.model);
    if (normalizedModel) model = normalizedModel;

    const timestamp = typeof msg.timestamp === 'string' ? msg.timestamp : null;
    const currentTotals = normalizeGeminiTokens(msg.tokens);
    if (!timestamp || !currentTotals) {
      totals = currentTotals || totals;
      continue;
    }

    const delta = diffGeminiTotals(currentTotals, totals);
    if (!delta || isAllZeroUsage(delta)) {
      totals = currentTotals;
      continue;
    }

    const bucketStart = toUtcHalfHourStart(timestamp);
    if (!bucketStart) {
      totals = currentTotals;
      continue;
    }

    const bucket = getHourlyBucket(hourlyState, source, model, bucketStart);
    addTotals(bucket.totals, delta);
    touchedBuckets.add(bucketKey(source, model, bucketStart));
    eventsAggregated += 1;
    totals = currentTotals;
  }

  return {
    lastIndex: messages.length - 1,
    lastTotals: totals,
    lastModel: model,
    eventsAggregated
  };
}

async function parseOpencodeMessageFile({
  filePath,
  messageIndex,
  fallbackTotals,
  hourlyState,
  touchedBuckets,
  source
}) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  if (!raw.trim()) return { messageKey: null, lastTotals: null, eventsAggregated: 0, shouldUpdate: false };

  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (_e) {
    return { messageKey: null, lastTotals: null, eventsAggregated: 0, shouldUpdate: false };
  }

  const messageKey = deriveOpencodeMessageKey(msg, filePath);
  const prev = messageIndex && messageKey ? messageIndex[messageKey] : null;
  const legacyTotals = fallbackTotals && typeof fallbackTotals === 'object' ? fallbackTotals : null;
  const lastTotals = prev && typeof prev.lastTotals === 'object' ? prev.lastTotals : legacyTotals;

  const currentTotals = normalizeOpencodeTokens(msg?.tokens);
  if (!currentTotals) {
    return { messageKey, lastTotals, eventsAggregated: 0, shouldUpdate: false };
  }

  const delta = diffGeminiTotals(currentTotals, lastTotals);
  if (!delta || isAllZeroUsage(delta)) {
    return { messageKey, lastTotals: currentTotals, eventsAggregated: 0, shouldUpdate: true };
  }

  const timestampMs = coerceEpochMs(msg?.time?.completed) || coerceEpochMs(msg?.time?.created);
  if (!timestampMs) {
    return { messageKey, lastTotals: currentTotals, eventsAggregated: 0, shouldUpdate: true };
  }

  const tsIso = new Date(timestampMs).toISOString();
  const bucketStart = toUtcHalfHourStart(tsIso);
  if (!bucketStart) {
    return { messageKey, lastTotals: currentTotals, eventsAggregated: 0, shouldUpdate: true };
  }

  const model = normalizeModelInput(msg?.modelID || msg?.model || msg?.modelId) || DEFAULT_MODEL;
  const bucket = getHourlyBucket(hourlyState, source, model, bucketStart);
  addTotals(bucket.totals, delta);
  touchedBuckets.add(bucketKey(source, model, bucketStart));
  return { messageKey, lastTotals: currentTotals, eventsAggregated: 1, shouldUpdate: true };
}

async function enqueueTouchedBuckets({ queuePath, hourlyState, touchedBuckets }) {
  if (!touchedBuckets || touchedBuckets.size === 0) return 0;

  const touchedGroups = new Set();
  for (const bucketStart of touchedBuckets) {
    const parsed = parseBucketKey(bucketStart);
    const hourStart = parsed.hourStart;
    if (!hourStart) continue;
    touchedGroups.add(groupBucketKey(parsed.source, hourStart));
  }
  if (touchedGroups.size === 0) return 0;

  const groupQueued = hourlyState.groupQueued && typeof hourlyState.groupQueued === 'object' ? hourlyState.groupQueued : {};
  let codexTouched = false;
  const legacyGroups = new Set();
  for (const groupKey of touchedGroups) {
    if (Object.prototype.hasOwnProperty.call(groupQueued, groupKey)) {
      legacyGroups.add(groupKey);
    }
    if (!codexTouched && groupKey.startsWith(`${DEFAULT_SOURCE}${BUCKET_SEPARATOR}`)) {
      codexTouched = true;
    }
  }

  const groupedBuckets = new Map();
  for (const [key, bucket] of Object.entries(hourlyState.buckets || {})) {
    if (!bucket || !bucket.totals) continue;
    const parsed = parseBucketKey(key);
    const hourStart = parsed.hourStart;
    if (!hourStart) continue;
    const groupKey = groupBucketKey(parsed.source, hourStart);
    if (!touchedGroups.has(groupKey) || legacyGroups.has(groupKey)) continue;

    const source = normalizeSourceInput(parsed.source) || DEFAULT_SOURCE;
    const model = normalizeModelInput(parsed.model) || DEFAULT_MODEL;
    let group = groupedBuckets.get(groupKey);
    if (!group) {
      group = { source, hourStart, buckets: new Map() };
      groupedBuckets.set(groupKey, group);
    }

    if (bucket.queuedKey != null && typeof bucket.queuedKey !== 'string') {
      bucket.queuedKey = null;
    }
    group.buckets.set(model, bucket);
  }

  if (codexTouched) {
    const recomputeGroups = new Set();
    for (const [key, bucket] of Object.entries(hourlyState.buckets || {})) {
      if (!bucket || !bucket.totals) continue;
      const parsed = parseBucketKey(key);
      const hourStart = parsed.hourStart;
      if (!hourStart) continue;
      const source = normalizeSourceInput(parsed.source) || DEFAULT_SOURCE;
      if (source !== 'every-code') continue;
      const groupKey = groupBucketKey(source, hourStart);
      if (legacyGroups.has(groupKey) || groupedBuckets.has(groupKey)) continue;
      const model = normalizeModelInput(parsed.model) || DEFAULT_MODEL;
      if (model !== DEFAULT_MODEL) continue;
      recomputeGroups.add(groupKey);
    }

    if (recomputeGroups.size > 0) {
      for (const [key, bucket] of Object.entries(hourlyState.buckets || {})) {
        if (!bucket || !bucket.totals) continue;
        const parsed = parseBucketKey(key);
        const hourStart = parsed.hourStart;
        if (!hourStart) continue;
        const source = normalizeSourceInput(parsed.source) || DEFAULT_SOURCE;
        const groupKey = groupBucketKey(source, hourStart);
        if (!recomputeGroups.has(groupKey)) continue;
        let group = groupedBuckets.get(groupKey);
        if (!group) {
          group = { source, hourStart, buckets: new Map() };
          groupedBuckets.set(groupKey, group);
        }
        if (bucket.queuedKey != null && typeof bucket.queuedKey !== 'string') {
          bucket.queuedKey = null;
        }
        const model = normalizeModelInput(parsed.model) || DEFAULT_MODEL;
        group.buckets.set(model, bucket);
      }
    }
  }

  const codexDominants = collectCodexDominantModels(hourlyState);

  const toAppend = [];
  for (const group of groupedBuckets.values()) {
    const unknownBucket = group.buckets.get(DEFAULT_MODEL) || null;
    const dominantModel = pickDominantModel(group.buckets);
    let alignedModel = null;
    if (unknownBucket?.alignedModel) {
      const normalized = normalizeModelInput(unknownBucket.alignedModel);
      alignedModel = normalized && normalized !== DEFAULT_MODEL ? normalized : null;
    }
    const zeroTotals = initTotals();
    const zeroKey = totalsKey(zeroTotals);

    if (dominantModel) {
      if (alignedModel && !group.buckets.has(alignedModel)) {
        toAppend.push(
          JSON.stringify({
            source: group.source,
            model: alignedModel,
            hour_start: group.hourStart,
            input_tokens: zeroTotals.input_tokens,
            cached_input_tokens: zeroTotals.cached_input_tokens,
            output_tokens: zeroTotals.output_tokens,
            reasoning_output_tokens: zeroTotals.reasoning_output_tokens,
            total_tokens: zeroTotals.total_tokens
          })
        );
      }
      if (unknownBucket && !alignedModel && unknownBucket.queuedKey && unknownBucket.queuedKey !== zeroKey) {
        if (unknownBucket.retractedUnknownKey !== zeroKey) {
          toAppend.push(
            JSON.stringify({
              source: group.source,
              model: DEFAULT_MODEL,
              hour_start: group.hourStart,
              input_tokens: zeroTotals.input_tokens,
              cached_input_tokens: zeroTotals.cached_input_tokens,
              output_tokens: zeroTotals.output_tokens,
              reasoning_output_tokens: zeroTotals.reasoning_output_tokens,
              total_tokens: zeroTotals.total_tokens
            })
          );
          unknownBucket.retractedUnknownKey = zeroKey;
        }
      }
      if (unknownBucket) unknownBucket.alignedModel = null;
      for (const [model, bucket] of group.buckets.entries()) {
        if (model === DEFAULT_MODEL) continue;
        let totals = bucket.totals;
        if (model === dominantModel && unknownBucket?.totals) {
          totals = cloneTotals(bucket.totals);
          addTotals(totals, unknownBucket.totals);
        }
        const key = totalsKey(totals);
        if (bucket.queuedKey === key) continue;
        toAppend.push(
          JSON.stringify({
            source: group.source,
            model,
            hour_start: group.hourStart,
            input_tokens: totals.input_tokens,
            cached_input_tokens: totals.cached_input_tokens,
            output_tokens: totals.output_tokens,
            reasoning_output_tokens: totals.reasoning_output_tokens,
            total_tokens: totals.total_tokens
          })
        );
        bucket.queuedKey = key;
      }
      continue;
    }

    if (!unknownBucket?.totals) continue;
    let outputModel = DEFAULT_MODEL;
    if (group.source === 'every-code') {
      const aligned = findNearestCodexModel(group.hourStart, codexDominants);
      if (aligned) outputModel = aligned;
    }
    const nextAligned = outputModel !== DEFAULT_MODEL ? outputModel : null;
    if (alignedModel && alignedModel !== nextAligned) {
      toAppend.push(
        JSON.stringify({
          source: group.source,
          model: alignedModel,
          hour_start: group.hourStart,
          input_tokens: zeroTotals.input_tokens,
          cached_input_tokens: zeroTotals.cached_input_tokens,
          output_tokens: zeroTotals.output_tokens,
          reasoning_output_tokens: zeroTotals.reasoning_output_tokens,
          total_tokens: zeroTotals.total_tokens
        })
      );
    }
    if (!alignedModel && nextAligned && unknownBucket.queuedKey && unknownBucket.queuedKey !== zeroKey) {
      if (unknownBucket.retractedUnknownKey !== zeroKey) {
        toAppend.push(
          JSON.stringify({
            source: group.source,
            model: DEFAULT_MODEL,
            hour_start: group.hourStart,
            input_tokens: zeroTotals.input_tokens,
            cached_input_tokens: zeroTotals.cached_input_tokens,
            output_tokens: zeroTotals.output_tokens,
            reasoning_output_tokens: zeroTotals.reasoning_output_tokens,
            total_tokens: zeroTotals.total_tokens
          })
        );
        unknownBucket.retractedUnknownKey = zeroKey;
      }
    }
    if (unknownBucket) unknownBucket.alignedModel = nextAligned;
    const key = totalsKey(unknownBucket.totals);
    const outputKey = outputModel === DEFAULT_MODEL ? key : `${key}|${outputModel}`;
    if (unknownBucket.queuedKey === outputKey) continue;
    toAppend.push(
      JSON.stringify({
        source: group.source,
        model: outputModel,
        hour_start: group.hourStart,
        input_tokens: unknownBucket.totals.input_tokens,
        cached_input_tokens: unknownBucket.totals.cached_input_tokens,
        output_tokens: unknownBucket.totals.output_tokens,
        reasoning_output_tokens: unknownBucket.totals.reasoning_output_tokens,
        total_tokens: unknownBucket.totals.total_tokens
      })
    );
    unknownBucket.queuedKey = outputKey;
  }

  if (legacyGroups.size > 0) {
    const grouped = new Map();
    for (const [key, bucket] of Object.entries(hourlyState.buckets || {})) {
      if (!bucket || !bucket.totals) continue;
      const parsed = parseBucketKey(key);
      const hourStart = parsed.hourStart;
      if (!hourStart) continue;
      const groupKey = groupBucketKey(parsed.source, hourStart);
      if (!legacyGroups.has(groupKey)) continue;

      let group = grouped.get(groupKey);
      if (!group) {
        group = {
          source: normalizeSourceInput(parsed.source) || DEFAULT_SOURCE,
          hourStart,
          models: new Set(),
          totals: initTotals()
        };
        grouped.set(groupKey, group);
      }
      group.models.add(parsed.model || DEFAULT_MODEL);
      addTotals(group.totals, bucket.totals);
    }

    for (const group of grouped.values()) {
      const model = group.models.size === 1 ? [...group.models][0] : DEFAULT_MODEL;
      const key = totalsKey(group.totals);
      const groupKey = groupBucketKey(group.source, group.hourStart);
      if (groupQueued[groupKey] === key) continue;
      toAppend.push(
        JSON.stringify({
          source: group.source,
          model,
          hour_start: group.hourStart,
          input_tokens: group.totals.input_tokens,
          cached_input_tokens: group.totals.cached_input_tokens,
          output_tokens: group.totals.output_tokens,
          reasoning_output_tokens: group.totals.reasoning_output_tokens,
          total_tokens: group.totals.total_tokens
        })
      );
      groupQueued[groupKey] = key;
    }
  }

  hourlyState.groupQueued = groupQueued;

  if (toAppend.length > 0) {
    await fs.appendFile(queuePath, toAppend.join('\n') + '\n', 'utf8');
  }

  return toAppend.length;
}

function pickDominantModel(buckets) {
  let dominantModel = null;
  let dominantTotal = -1;
  for (const [model, bucket] of buckets.entries()) {
    if (model === DEFAULT_MODEL) continue;
    const total = Number(bucket?.totals?.total_tokens || 0);
    if (
      dominantModel == null ||
      total > dominantTotal ||
      (total === dominantTotal && model < dominantModel)
    ) {
      dominantModel = model;
      dominantTotal = total;
    }
  }
  return dominantModel;
}

function cloneTotals(totals) {
  const cloned = initTotals();
  addTotals(cloned, totals || {});
  return cloned;
}

function collectCodexDominantModels(hourlyState) {
  const grouped = new Map();
  for (const [key, bucket] of Object.entries(hourlyState.buckets || {})) {
    if (!bucket || !bucket.totals) continue;
    const parsed = parseBucketKey(key);
    const hourStart = parsed.hourStart;
    if (!hourStart) continue;
    const source = normalizeSourceInput(parsed.source) || DEFAULT_SOURCE;
    if (source !== DEFAULT_SOURCE) continue;
    const model = normalizeModelInput(parsed.model) || DEFAULT_MODEL;
    if (model === DEFAULT_MODEL) continue;

    let models = grouped.get(hourStart);
    if (!models) {
      models = new Map();
      grouped.set(hourStart, models);
    }
    const total = Number(bucket.totals.total_tokens || 0);
    models.set(model, (models.get(model) || 0) + total);
  }

  const dominants = [];
  for (const [hourStart, models] of grouped.entries()) {
    let dominantModel = null;
    let dominantTotal = -1;
    for (const [model, total] of models.entries()) {
      if (
        dominantModel == null ||
        total > dominantTotal ||
        (total === dominantTotal && model < dominantModel)
      ) {
        dominantModel = model;
        dominantTotal = total;
      }
    }
    if (dominantModel) {
      dominants.push({ hourStart, model: dominantModel });
    }
  }

  return dominants;
}

function findNearestCodexModel(hourStart, dominants) {
  if (!hourStart || !dominants || dominants.length === 0) return null;
  const target = Date.parse(hourStart);
  if (!Number.isFinite(target)) return null;

  let best = null;
  for (const entry of dominants) {
    const candidate = Date.parse(entry.hourStart);
    if (!Number.isFinite(candidate)) continue;
    const diff = Math.abs(candidate - target);
    if (!best || diff < best.diff || (diff === best.diff && candidate < best.time)) {
      best = { diff, time: candidate, model: entry.model };
    }
  }

  return best ? best.model : null;
}

function normalizeHourlyState(raw) {
  const state = raw && typeof raw === 'object' ? raw : {};
  const version = Number(state.version || 1);
  const rawBuckets = state.buckets && typeof state.buckets === 'object' ? state.buckets : {};
  const buckets = {};
  const groupQueued = {};

  if (!Number.isFinite(version) || version < 2) {
    for (const [key, value] of Object.entries(rawBuckets)) {
      const parsed = parseBucketKey(key);
      const hourStart = parsed.hourStart;
      if (!hourStart) continue;
      const source = normalizeSourceInput(parsed.source) || DEFAULT_SOURCE;
      const normalizedKey = bucketKey(source, DEFAULT_MODEL, hourStart);
      buckets[normalizedKey] = value;
      if (value?.queuedKey) {
        groupQueued[groupBucketKey(source, hourStart)] = value.queuedKey;
      }
    }
    return {
      version: 3,
      buckets,
      groupQueued,
      updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null
    };
  }

  for (const [key, value] of Object.entries(rawBuckets)) {
    const parsed = parseBucketKey(key);
    const hourStart = parsed.hourStart;
    if (!hourStart) continue;
    const normalizedKey = bucketKey(parsed.source, parsed.model, hourStart);
    buckets[normalizedKey] = value;
  }

  const existingGroupQueued =
    state.groupQueued && typeof state.groupQueued === 'object' ? state.groupQueued : {};

  return {
    version: 3,
    buckets,
    groupQueued: version >= 3 ? existingGroupQueued : {},
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null
  };
}

function normalizeOpencodeState(raw) {
  const state = raw && typeof raw === 'object' ? raw : {};
  const messages = state.messages && typeof state.messages === 'object' ? state.messages : {};
  return {
    messages,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null
  };
}

function normalizeMessageKeyPart(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function deriveOpencodeMessageKey(msg, fallback) {
  const sessionId = normalizeMessageKeyPart(msg?.sessionID || msg?.sessionId || msg?.session_id);
  const messageId = normalizeMessageKeyPart(msg?.id || msg?.messageID || msg?.messageId);
  if (sessionId && messageId) return `${sessionId}|${messageId}`;
  return fallback;
}

function getHourlyBucket(state, source, model, hourStart) {
  const buckets = state.buckets;
  const normalizedSource = normalizeSourceInput(source) || DEFAULT_SOURCE;
  const normalizedModel = normalizeModelInput(model) || DEFAULT_MODEL;
  const key = bucketKey(normalizedSource, normalizedModel, hourStart);
  let bucket = buckets[key];
  if (!bucket || typeof bucket !== 'object') {
    bucket = { totals: initTotals(), queuedKey: null };
    buckets[key] = bucket;
    return bucket;
  }

  if (!bucket.totals || typeof bucket.totals !== 'object') {
    bucket.totals = initTotals();
  }

  if (bucket.queuedKey != null && typeof bucket.queuedKey !== 'string') {
    bucket.queuedKey = null;
  }

  return bucket;
}

function initTotals() {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0
  };
}

function addTotals(target, delta) {
  target.input_tokens += delta.input_tokens || 0;
  target.cached_input_tokens += delta.cached_input_tokens || 0;
  target.output_tokens += delta.output_tokens || 0;
  target.reasoning_output_tokens += delta.reasoning_output_tokens || 0;
  target.total_tokens += delta.total_tokens || 0;
}

function totalsKey(totals) {
  return [
    totals.input_tokens || 0,
    totals.cached_input_tokens || 0,
    totals.output_tokens || 0,
    totals.reasoning_output_tokens || 0,
    totals.total_tokens || 0
  ].join('|');
}

function toUtcHalfHourStart(ts) {
  const dt = new Date(ts);
  if (!Number.isFinite(dt.getTime())) return null;
  const minutes = dt.getUTCMinutes();
  const halfMinute = minutes >= 30 ? 30 : 0;
  const bucketStart = new Date(
    Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      dt.getUTCHours(),
      halfMinute,
      0,
      0
    )
  );
  return bucketStart.toISOString();
}

function bucketKey(source, model, hourStart) {
  const safeSource = normalizeSourceInput(source) || DEFAULT_SOURCE;
  const safeModel = normalizeModelInput(model) || DEFAULT_MODEL;
  return `${safeSource}${BUCKET_SEPARATOR}${safeModel}${BUCKET_SEPARATOR}${hourStart}`;
}

function groupBucketKey(source, hourStart) {
  const safeSource = normalizeSourceInput(source) || DEFAULT_SOURCE;
  return `${safeSource}${BUCKET_SEPARATOR}${hourStart}`;
}

function parseBucketKey(key) {
  if (typeof key !== 'string') return { source: DEFAULT_SOURCE, model: DEFAULT_MODEL, hourStart: '' };
  const first = key.indexOf(BUCKET_SEPARATOR);
  if (first <= 0) return { source: DEFAULT_SOURCE, model: DEFAULT_MODEL, hourStart: key };
  const second = key.indexOf(BUCKET_SEPARATOR, first + 1);
  if (second <= 0) {
    return { source: key.slice(0, first), model: DEFAULT_MODEL, hourStart: key.slice(first + 1) };
  }
  return {
    source: key.slice(0, first),
    model: key.slice(first + 1, second),
    hourStart: key.slice(second + 1)
  };
}

function normalizeSourceInput(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeModelInput(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGeminiTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return null;
  const input = toNonNegativeInt(tokens.input);
  const cached = toNonNegativeInt(tokens.cached);
  const output = toNonNegativeInt(tokens.output);
  const tool = toNonNegativeInt(tokens.tool);
  const thoughts = toNonNegativeInt(tokens.thoughts);
  const total = toNonNegativeInt(tokens.total);

  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output + tool,
    reasoning_output_tokens: thoughts,
    total_tokens: total
  };
}

function normalizeOpencodeTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return null;
  const input = toNonNegativeInt(tokens.input);
  const output = toNonNegativeInt(tokens.output);
  const reasoning = toNonNegativeInt(tokens.reasoning);
  const cached = toNonNegativeInt(tokens.cache?.read);
  const total = input + output + reasoning;

  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: total
  };
}

function sameGeminiTotals(a, b) {
  if (!a || !b) return false;
  return (
    a.input_tokens === b.input_tokens &&
    a.cached_input_tokens === b.cached_input_tokens &&
    a.output_tokens === b.output_tokens &&
    a.reasoning_output_tokens === b.reasoning_output_tokens &&
    a.total_tokens === b.total_tokens
  );
}

function diffGeminiTotals(current, previous) {
  if (!current || typeof current !== 'object') return null;
  if (!previous || typeof previous !== 'object') return current;
  if (sameGeminiTotals(current, previous)) return null;

  const totalReset = (current.total_tokens || 0) < (previous.total_tokens || 0);
  if (totalReset) return current;

  const delta = {
    input_tokens: Math.max(0, (current.input_tokens || 0) - (previous.input_tokens || 0)),
    cached_input_tokens: Math.max(0, (current.cached_input_tokens || 0) - (previous.cached_input_tokens || 0)),
    output_tokens: Math.max(0, (current.output_tokens || 0) - (previous.output_tokens || 0)),
    reasoning_output_tokens: Math.max(0, (current.reasoning_output_tokens || 0) - (previous.reasoning_output_tokens || 0)),
    total_tokens: Math.max(0, (current.total_tokens || 0) - (previous.total_tokens || 0))
  };

  return isAllZeroUsage(delta) ? null : delta;
}

function extractTokenCount(obj) {
  const payload = obj?.payload;
  if (!payload) return null;
  if (payload.type === 'token_count') {
    return { info: payload.info, timestamp: obj?.timestamp || null };
  }
  const msg = payload.msg;
  if (msg && msg.type === 'token_count') {
    return { info: msg.info, timestamp: obj?.timestamp || null };
  }
  return null;
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

function normalizeClaudeUsage(u) {
  const inputTokens = toNonNegativeInt(u?.input_tokens);
  const outputTokens = toNonNegativeInt(u?.output_tokens);
  const hasTotal = u && Object.prototype.hasOwnProperty.call(u, 'total_tokens');
  const totalTokens = hasTotal ? toNonNegativeInt(u?.total_tokens) : inputTokens + outputTokens;
  return {
    input_tokens: inputTokens,
    cached_input_tokens: toNonNegativeInt(u?.cache_read_input_tokens),
    output_tokens: outputTokens,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens
  };
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

function coerceEpochMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n < 1e12) return Math.floor(n * 1000);
  return Math.floor(n);
}

async function safeReadDir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
}

async function walkClaudeProjects(dir, out) {
  const entries = await safeReadDir(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkClaudeProjects(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(fullPath);
  }
}

async function walkOpencodeMessages(dir, out) {
  const entries = await safeReadDir(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkOpencodeMessages(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.startsWith('msg_') && entry.name.endsWith('.json')) out.push(fullPath);
  }
}

module.exports = {
  listRolloutFiles,
  listClaudeProjectFiles,
  listGeminiSessionFiles,
  listOpencodeMessageFiles,
  parseRolloutIncremental,
  parseClaudeIncremental,
  parseGeminiIncremental,
  parseOpencodeIncremental
};
