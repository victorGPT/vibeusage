const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { ensureDir, readJson, writeJson, openLock } = require('../lib/fs');
const { listRolloutFiles, parseRolloutIncremental } = require('../lib/rollout');
const { drainQueueToCloud } = require('../lib/uploader');
const { createProgress, renderBar, formatNumber, formatBytes } = require('../lib/progress');
const {
  DEFAULTS: UPLOAD_DEFAULTS,
  normalizeState: normalizeUploadState,
  decideAutoUpload,
  recordUploadSuccess,
  recordUploadFailure
} = require('../lib/upload-throttle');

async function cmdSync(argv) {
  const opts = parseArgs(argv);
  const home = os.homedir();
  const rootDir = path.join(home, '.vibescore');
  const trackerDir = path.join(rootDir, 'tracker');

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

    const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
    const sessionsDir = path.join(codexHome, 'sessions');
    const rolloutFiles = await listRolloutFiles(sessionsDir);

    if (progress?.enabled) {
      progress.start(`Parsing ${renderBar(0)} 0/${formatNumber(rolloutFiles.length)} files | queued 0`);
    }

    const parseResult = await parseRolloutIncremental({
      rolloutFiles,
      cursors,
      queuePath,
      onProgress: (p) => {
        if (!progress?.enabled) return;
        const pct = p.total > 0 ? p.index / p.total : 1;
        progress.update(
          `Parsing ${renderBar(pct)} ${formatNumber(p.index)}/${formatNumber(p.total)} files | queued ${formatNumber(p.eventsQueued)}`
        );
      }
    });

    cursors.updatedAt = new Date().toISOString();
    await writeJson(cursorsPath, cursors);

    progress?.stop();

    const deviceToken = config?.deviceToken || process.env.VIBESCORE_DEVICE_TOKEN || null;
    const baseUrl = config?.baseUrl || process.env.VIBESCORE_INSFORGE_BASE_URL || 'https://5tmappuk.us-east.insforge.app';

    let uploadResult = null;
    if (deviceToken) {
      const beforeState = (await readJson(queueStatePath)) || { offset: 0 };
      const queueSize = await safeStatSize(queuePath);
      const pendingBytes = Math.max(0, queueSize - Number(beforeState.offset || 0));
      let maxBatches = opts.auto ? 3 : opts.drain ? 10_000 : 10;
      let batchSize = UPLOAD_DEFAULTS.batchSize;
      let allowUpload = pendingBytes > 0;

      if (opts.auto) {
        const decision = decideAutoUpload({
          nowMs: Date.now(),
          pendingBytes,
          state: uploadThrottle
        });
        allowUpload = allowUpload && decision.allowed;
        maxBatches = decision.allowed ? decision.maxBatches : 0;
        batchSize = decision.batchSize;
      }

      if (progress?.enabled && pendingBytes > 0 && allowUpload) {
        const pct = queueSize > 0 ? Number(beforeState.offset || 0) / queueSize : 0;
        progress.start(
          `Uploading ${renderBar(pct)} ${formatBytes(Number(beforeState.offset || 0))}/${formatBytes(queueSize)} | inserted 0 skipped 0`
        );
      }

      if (allowUpload && maxBatches > 0) {
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
            const next = recordUploadSuccess({ nowMs: Date.now(), state: uploadThrottle });
            await writeJson(uploadThrottlePath, next);
          }
        } catch (e) {
          const next = recordUploadFailure({ nowMs: Date.now(), state: uploadThrottle, error: e });
          await writeJson(uploadThrottlePath, next);
          throw e;
        }
      } else {
        uploadResult = { inserted: 0, skipped: 0 };
      }

      progress?.stop();
    }

    if (!opts.auto) {
      const afterState = (await readJson(queueStatePath)) || { offset: 0 };
      const queueSize = await safeStatSize(queuePath);
      const pendingBytes = Math.max(0, queueSize - Number(afterState.offset || 0));

      process.stdout.write(
        [
          'Sync finished:',
          `- Parsed files: ${parseResult.filesProcessed}`,
          `- New events queued: ${parseResult.eventsQueued}`,
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
    drain: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--auto') out.auto = true;
    else if (a === '--from-notify') out.fromNotify = true;
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
