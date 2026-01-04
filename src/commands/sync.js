const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const cp = require('node:child_process');

const { ensureDir, readJson, writeJson, openLock } = require('../lib/fs');
const {
  listRolloutFiles,
  listClaudeProjectFiles,
  listGeminiSessionFiles,
  listOpencodeMessageFiles,
  parseRolloutIncremental,
  parseClaudeIncremental,
  parseGeminiIncremental,
  parseOpencodeIncremental
} = require('../lib/rollout');
const { drainQueueToCloud } = require('../lib/uploader');
const { createProgress, renderBar, formatNumber, formatBytes } = require('../lib/progress');
const { syncHeartbeat } = require('../lib/vibescore-api');
const {
  DEFAULTS: UPLOAD_DEFAULTS,
  normalizeState: normalizeUploadState,
  decideAutoUpload,
  recordUploadSuccess,
  recordUploadFailure
} = require('../lib/upload-throttle');
const { resolveTrackerPaths } = require('../lib/tracker-paths');

async function cmdSync(argv) {
  const opts = parseArgs(argv);
  const home = os.homedir();
  const { trackerDir } = await resolveTrackerPaths({ home, migrate: true });

  await ensureDir(trackerDir);

  const lockPath = path.join(trackerDir, 'sync.lock');
  const lock = await openLock(lockPath, { quietIfLocked: opts.auto });
  if (!lock) return;

  let progress = null;
  try {
    progress = !opts.auto ? createProgress({ stream: process.stdout }) : null;
    const configPath = path.join(trackerDir, 'config.json');
    const cursorsPath = path.join(trackerDir, 'cursors.json');
    const queuePath = path.join(trackerDir, 'queue.jsonl');
    const queueStatePath = path.join(trackerDir, 'queue.state.json');
    const uploadThrottlePath = path.join(trackerDir, 'upload.throttle.json');

    const config = await readJson(configPath);
    const cursors = (await readJson(cursorsPath)) || { version: 1, files: {}, updatedAt: null };
    const uploadThrottle = normalizeUploadState(await readJson(uploadThrottlePath));
    let uploadThrottleState = uploadThrottle;

    const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
    const codeHome = process.env.CODE_HOME || path.join(home, '.code');
    const claudeProjectsDir = path.join(home, '.claude', 'projects');
    const geminiHome = process.env.GEMINI_HOME || path.join(home, '.gemini');
    const geminiTmpDir = path.join(geminiHome, 'tmp');
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    const opencodeHome = process.env.OPENCODE_HOME || path.join(xdgDataHome, 'opencode');
    const opencodeStorageDir = path.join(opencodeHome, 'storage');

    const sources = [
      { source: 'codex', sessionsDir: path.join(codexHome, 'sessions') },
      { source: 'every-code', sessionsDir: path.join(codeHome, 'sessions') }
    ];

    const rolloutFiles = [];
    const seenSessions = new Set();
    for (const entry of sources) {
      if (seenSessions.has(entry.sessionsDir)) continue;
      seenSessions.add(entry.sessionsDir);
      const files = await listRolloutFiles(entry.sessionsDir);
      for (const filePath of files) {
        rolloutFiles.push({ path: filePath, source: entry.source });
      }
    }

    if (progress?.enabled) {
      progress.start(`Parsing ${renderBar(0)} 0/${formatNumber(rolloutFiles.length)} files | buckets 0`);
    }

    const parseResult = await parseRolloutIncremental({
      rolloutFiles,
      cursors,
      queuePath,
      onProgress: (p) => {
        if (!progress?.enabled) return;
        const pct = p.total > 0 ? p.index / p.total : 1;
        progress.update(
          `Parsing ${renderBar(pct)} ${formatNumber(p.index)}/${formatNumber(p.total)} files | buckets ${formatNumber(
            p.bucketsQueued
          )}`
        );
      }
    });

    const claudeFiles = await listClaudeProjectFiles(claudeProjectsDir);
    let claudeResult = { filesProcessed: 0, eventsAggregated: 0, bucketsQueued: 0 };
    if (claudeFiles.length > 0) {
      if (progress?.enabled) {
        progress.start(`Parsing Claude ${renderBar(0)} 0/${formatNumber(claudeFiles.length)} files | buckets 0`);
      }
      claudeResult = await parseClaudeIncremental({
        projectFiles: claudeFiles,
        cursors,
        queuePath,
        onProgress: (p) => {
          if (!progress?.enabled) return;
          const pct = p.total > 0 ? p.index / p.total : 1;
          progress.update(
            `Parsing Claude ${renderBar(pct)} ${formatNumber(p.index)}/${formatNumber(p.total)} files | buckets ${formatNumber(
              p.bucketsQueued
            )}`
          );
        },
        source: 'claude'
      });
    }

    const geminiFiles = await listGeminiSessionFiles(geminiTmpDir);
    let geminiResult = { filesProcessed: 0, eventsAggregated: 0, bucketsQueued: 0 };
    if (geminiFiles.length > 0) {
      if (progress?.enabled) {
        progress.start(`Parsing Gemini ${renderBar(0)} 0/${formatNumber(geminiFiles.length)} files | buckets 0`);
      }
      geminiResult = await parseGeminiIncremental({
        sessionFiles: geminiFiles,
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

    const opencodeFiles = await listOpencodeMessageFiles(opencodeStorageDir);
    let opencodeResult = { filesProcessed: 0, eventsAggregated: 0, bucketsQueued: 0 };
    if (opencodeFiles.length > 0) {
      if (progress?.enabled) {
        progress.start(`Parsing Opencode ${renderBar(0)} 0/${formatNumber(opencodeFiles.length)} files | buckets 0`);
      }
      opencodeResult = await parseOpencodeIncremental({
        messageFiles: opencodeFiles,
        cursors,
        queuePath,
        onProgress: (p) => {
          if (!progress?.enabled) return;
          const pct = p.total > 0 ? p.index / p.total : 1;
          progress.update(
            `Parsing Opencode ${renderBar(pct)} ${formatNumber(p.index)}/${formatNumber(
              p.total
            )} files | buckets ${formatNumber(p.bucketsQueued)}`
          );
        },
        source: 'opencode'
      });
    }

    cursors.updatedAt = new Date().toISOString();
    await writeJson(cursorsPath, cursors);

    progress?.stop();

    const deviceToken = config?.deviceToken || process.env.VIBEUSAGE_DEVICE_TOKEN || process.env.VIBESCORE_DEVICE_TOKEN || null;
    const baseUrl = config?.baseUrl ||
      process.env.VIBEUSAGE_INSFORGE_BASE_URL ||
      process.env.VIBESCORE_INSFORGE_BASE_URL ||
      'https://5tmappuk.us-east.insforge.app';

    let uploadResult = null;
    let uploadAttempted = false;
    if (deviceToken) {
      const beforeState = (await readJson(queueStatePath)) || { offset: 0 };
      const queueSize = await safeStatSize(queuePath);
      const pendingBytes = Math.max(0, queueSize - Number(beforeState.offset || 0));
      let maxBatches = opts.auto ? 3 : opts.drain ? 10_000 : 10;
      let batchSize = UPLOAD_DEFAULTS.batchSize;
      let allowUpload = pendingBytes > 0;
      let autoDecision = null;

      if (opts.auto) {
        autoDecision = decideAutoUpload({
          nowMs: Date.now(),
          pendingBytes,
          state: uploadThrottle
        });
        allowUpload = allowUpload && autoDecision.allowed;
        maxBatches = autoDecision.allowed ? autoDecision.maxBatches : 0;
        batchSize = autoDecision.batchSize;
        if (!autoDecision.allowed && pendingBytes > 0 && autoDecision.blockedUntilMs > 0) {
          const reason = deriveAutoSkipReason({ decision: autoDecision, state: uploadThrottle });
          await scheduleAutoRetry({
            trackerDir,
            retryAtMs: autoDecision.blockedUntilMs,
            reason,
            pendingBytes,
            source: 'auto-throttled'
          });
        }
      }

      if (progress?.enabled && pendingBytes > 0 && allowUpload) {
        const pct = queueSize > 0 ? Number(beforeState.offset || 0) / queueSize : 0;
        progress.start(
          `Uploading ${renderBar(pct)} ${formatBytes(Number(beforeState.offset || 0))}/${formatBytes(queueSize)} | inserted 0 skipped 0`
        );
      }

      if (allowUpload && maxBatches > 0) {
        uploadAttempted = true;
        try {
          uploadResult = await drainQueueToCloud({
            baseUrl,
            deviceToken,
            queuePath,
            queueStatePath,
            maxBatches,
            batchSize,
            onProgress: (u) => {
              if (!progress?.enabled) return;
              const pct = u.queueSize > 0 ? u.offset / u.queueSize : 1;
              progress.update(
                `Uploading ${renderBar(pct)} ${formatBytes(u.offset)}/${formatBytes(u.queueSize)} | inserted ${formatNumber(
                  u.inserted
                )} skipped ${formatNumber(u.skipped)}`
              );
            }
          });
          if (uploadResult.attempted > 0) {
            const next = recordUploadSuccess({ nowMs: Date.now(), state: uploadThrottleState });
            uploadThrottleState = next;
            await writeJson(uploadThrottlePath, next);
          }
        } catch (e) {
          const next = recordUploadFailure({ nowMs: Date.now(), state: uploadThrottleState, error: e });
          uploadThrottleState = next;
          await writeJson(uploadThrottlePath, next);
          if (opts.auto && pendingBytes > 0) {
            const retryAtMs = Math.max(next.nextAllowedAtMs || 0, next.backoffUntilMs || 0);
            if (retryAtMs > 0) {
              await scheduleAutoRetry({
                trackerDir,
                retryAtMs,
                reason: 'backoff',
                pendingBytes,
                source: 'auto-error'
              });
            }
          }
          throw e;
        }
      } else {
        uploadResult = { inserted: 0, skipped: 0 };
      }

      progress?.stop();
    }

    const afterState = (await readJson(queueStatePath)) || { offset: 0 };
    const queueSize = await safeStatSize(queuePath);
    const pendingBytes = Math.max(0, queueSize - Number(afterState.offset || 0));

    if (pendingBytes <= 0) {
      await clearAutoRetry(trackerDir);
    } else if (opts.auto && uploadAttempted) {
      const retryAtMs = Number(uploadThrottleState?.nextAllowedAtMs || 0);
      if (retryAtMs > Date.now()) {
        await scheduleAutoRetry({
          trackerDir,
          retryAtMs,
          reason: 'backlog',
          pendingBytes,
          source: 'auto-backlog'
        });
      }
    }

    await maybeSendHeartbeat({
      baseUrl,
      deviceToken,
      trackerDir,
      uploadResult,
      pendingBytes
    });

    if (!opts.auto) {
      const totalParsed =
        parseResult.filesProcessed +
        claudeResult.filesProcessed +
        geminiResult.filesProcessed +
        opencodeResult.filesProcessed;
      const totalBuckets =
        parseResult.bucketsQueued +
        claudeResult.bucketsQueued +
        geminiResult.bucketsQueued +
        opencodeResult.bucketsQueued;
      process.stdout.write(
        [
          'Sync finished:',
          `- Parsed files: ${totalParsed}`,
          `- New 30-min buckets queued: ${totalBuckets}`,
          deviceToken
            ? `- Uploaded: ${uploadResult.inserted} inserted, ${uploadResult.skipped} skipped`
            : '- Uploaded: skipped (no device token)',
          deviceToken && pendingBytes > 0 && !opts.drain
            ? `- Remaining: ${formatBytes(pendingBytes)} pending (run sync again, or use --drain)`
            : null,
          ''
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
  } finally {
    progress?.stop();
    await lock.release();
    await fs.unlink(lockPath).catch(() => {});
  }
}

function parseArgs(argv) {
  const out = {
    auto: false,
    fromNotify: false,
    fromRetry: false,
    drain: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--auto') out.auto = true;
    else if (a === '--from-notify') out.fromNotify = true;
    else if (a === '--from-retry') out.fromRetry = true;
    else if (a === '--drain') out.drain = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

module.exports = { cmdSync };

async function safeStatSize(p) {
  try {
    const st = await fs.stat(p);
    return st && st.isFile() ? st.size : 0;
  } catch (_e) {
    return 0;
  }
}

async function maybeSendHeartbeat({ baseUrl, deviceToken, trackerDir, uploadResult, pendingBytes }) {
  if (!deviceToken || !uploadResult) return;
  if (pendingBytes > 0) return;
  if (Number(uploadResult.inserted || 0) !== 0) return;

  const heartbeatPath = path.join(trackerDir, 'sync.heartbeat.json');
  const heartbeatState = await readJson(heartbeatPath);
  const lastPingAt = Date.parse(heartbeatState?.lastPingAt || '');
  const nowMs = Date.now();
  if (Number.isFinite(lastPingAt) && nowMs - lastPingAt < HEARTBEAT_MIN_INTERVAL_MS) return;

  try {
    await syncHeartbeat({ baseUrl, deviceToken });
    await writeJson(heartbeatPath, {
      lastPingAt: new Date(nowMs).toISOString(),
      minIntervalMinutes: HEARTBEAT_MIN_INTERVAL_MINUTES
    });
  } catch (_e) {
    // best-effort heartbeat; ignore failures
  }
}

function deriveAutoSkipReason({ decision, state }) {
  if (!decision || decision.reason !== 'throttled') return decision?.reason || 'unknown';
  const backoffUntilMs = Number(state?.backoffUntilMs || 0);
  const nextAllowedAtMs = Number(state?.nextAllowedAtMs || 0);
  if (backoffUntilMs > 0 && backoffUntilMs >= nextAllowedAtMs) return 'backoff';
  return 'throttled';
}

async function scheduleAutoRetry({ trackerDir, retryAtMs, reason, pendingBytes, source }) {
  const retryMs = coerceRetryMs(retryAtMs);
  if (!retryMs) return { scheduled: false, retryAtMs: 0 };

  const retryPath = path.join(trackerDir, AUTO_RETRY_FILENAME);
  const nowMs = Date.now();
  const existing = await readJson(retryPath);
  const existingMs = coerceRetryMs(existing?.retryAtMs);
  if (existingMs && existingMs >= retryMs - 1000) {
    return { scheduled: false, retryAtMs: existingMs };
  }

  const payload = {
    version: 1,
    retryAtMs: retryMs,
    retryAt: new Date(retryMs).toISOString(),
    reason: typeof reason === 'string' && reason.length > 0 ? reason : 'throttled',
    pendingBytes: Math.max(0, Number(pendingBytes || 0)),
    scheduledAt: new Date(nowMs).toISOString(),
    source: typeof source === 'string' ? source : 'auto'
  };

  await writeJson(retryPath, payload);

  const delayMs = Math.min(AUTO_RETRY_MAX_DELAY_MS, Math.max(0, retryMs - nowMs));
  if (delayMs <= 0) return { scheduled: false, retryAtMs: retryMs };
  if (process.env.VIBEUSAGE_AUTO_RETRY_NO_SPAWN === '1' || process.env.VIBESCORE_AUTO_RETRY_NO_SPAWN === '1') {
    return { scheduled: false, retryAtMs: retryMs };
  }

  spawnAutoRetryProcess({
    retryPath,
    trackerBinPath: path.join(trackerDir, 'app', 'bin', 'tracker.js'),
    fallbackPkg: 'vibeusage',
    delayMs
  });
  return { scheduled: true, retryAtMs: retryMs };
}

async function clearAutoRetry(trackerDir) {
  const retryPath = path.join(trackerDir, AUTO_RETRY_FILENAME);
  await fs.unlink(retryPath).catch(() => {});
}

function spawnAutoRetryProcess({ retryPath, trackerBinPath, fallbackPkg, delayMs }) {
  const script = buildAutoRetryScript({ retryPath, trackerBinPath, fallbackPkg, delayMs });
  try {
    const child = cp.spawn(process.execPath, ['-e', script], {
      detached: true,
      stdio: 'ignore',
      env: process.env
    });
    child.unref();
  } catch (_e) {}
}

function buildAutoRetryScript({ retryPath, trackerBinPath, fallbackPkg, delayMs }) {
  return `'use strict';\n` +
    `const fs = require('node:fs');\n` +
    `const cp = require('node:child_process');\n` +
    `const retryPath = ${JSON.stringify(retryPath)};\n` +
    `const trackerBinPath = ${JSON.stringify(trackerBinPath)};\n` +
    `const fallbackPkg = ${JSON.stringify(fallbackPkg)};\n` +
    `const delayMs = ${Math.max(0, Math.floor(delayMs || 0))};\n` +
    `setTimeout(() => {\n` +
    `  let retryAtMs = 0;\n` +
    `  try {\n` +
    `    const raw = fs.readFileSync(retryPath, 'utf8');\n` +
    `    retryAtMs = Number(JSON.parse(raw).retryAtMs || 0);\n` +
    `  } catch (_) {}\n` +
    `  if (!retryAtMs || Date.now() + 1000 < retryAtMs) process.exit(0);\n` +
    `  const argv = ['sync', '--auto', '--from-retry'];\n` +
    `  const cmd = fs.existsSync(trackerBinPath)\n` +
    `    ? [process.execPath, trackerBinPath, ...argv]\n` +
    `    : ['npx', '--yes', fallbackPkg, ...argv];\n` +
    `  try {\n` +
    `    const child = cp.spawn(cmd[0], cmd.slice(1), { detached: true, stdio: 'ignore', env: process.env });\n` +
    `    child.unref();\n` +
    `  } catch (_) {}\n` +
    `}, delayMs);\n`;
}

function coerceRetryMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

const HEARTBEAT_MIN_INTERVAL_MINUTES = 30;
const HEARTBEAT_MIN_INTERVAL_MS = HEARTBEAT_MIN_INTERVAL_MINUTES * 60 * 1000;
const AUTO_RETRY_FILENAME = 'auto.retry.json';
const AUTO_RETRY_MAX_DELAY_MS = 2 * 60 * 60 * 1000;
