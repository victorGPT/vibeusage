const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { readJson } = require('./fs');
const { readCodexNotify } = require('./codex-config');
const { normalizeState: normalizeUploadState } = require('./upload-throttle');

async function collectTrackerDiagnostics({
  home = os.homedir(),
  codexHome = process.env.CODEX_HOME || path.join(home, '.codex')
} = {}) {
  const trackerDir = path.join(home, '.vibescore', 'tracker');
  const configPath = path.join(trackerDir, 'config.json');
  const queuePath = path.join(trackerDir, 'queue.jsonl');
  const queueStatePath = path.join(trackerDir, 'queue.state.json');
  const cursorsPath = path.join(trackerDir, 'cursors.json');
  const notifySignalPath = path.join(trackerDir, 'notify.signal');
  const throttlePath = path.join(trackerDir, 'sync.throttle');
  const uploadThrottlePath = path.join(trackerDir, 'upload.throttle.json');
  const codexConfigPath = path.join(codexHome, 'config.toml');

  const config = await readJson(configPath);
  const cursors = await readJson(cursorsPath);
  const queueState = (await readJson(queueStatePath)) || { offset: 0 };
  const uploadThrottle = normalizeUploadState(await readJson(uploadThrottlePath));

  const queueSize = await safeStatSize(queuePath);
  const offsetBytes = Number(queueState.offset || 0);
  const pendingBytes = Math.max(0, queueSize - offsetBytes);

  const lastNotify = (await safeReadText(notifySignalPath))?.trim() || null;
  const lastNotifySpawn = parseEpochMsToIso((await safeReadText(throttlePath))?.trim() || null);

  const codexNotifyRaw = await readCodexNotify(codexConfigPath);
  const notifyConfigured = Array.isArray(codexNotifyRaw) && codexNotifyRaw.length > 0;
  const codexNotify = notifyConfigured ? codexNotifyRaw.map((v) => redactValue(v, home)) : null;

  const lastSuccessAt = uploadThrottle.lastSuccessMs ? new Date(uploadThrottle.lastSuccessMs).toISOString() : null;

  return {
    ok: true,
    version: 1,
    generated_at: new Date().toISOString(),
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    paths: {
      tracker_dir: redactValue(trackerDir, home),
      codex_home: redactValue(codexHome, home),
      codex_config: redactValue(codexConfigPath, home)
    },
    config: {
      base_url: typeof config?.baseUrl === 'string' ? config.baseUrl : null,
      device_token: config?.deviceToken ? 'set' : 'unset',
      device_id: maskId(config?.deviceId),
      installed_at: typeof config?.installedAt === 'string' ? config.installedAt : null
    },
    parse: {
      updated_at: typeof cursors?.updatedAt === 'string' ? cursors.updatedAt : null,
      file_count: cursors?.files && typeof cursors.files === 'object' ? Object.keys(cursors.files).length : null
    },
    queue: {
      size_bytes: queueSize,
      offset_bytes: offsetBytes,
      pending_bytes: pendingBytes,
      updated_at: typeof queueState.updatedAt === 'string' ? queueState.updatedAt : null
    },
    notify: {
      last_notify: lastNotify,
      last_notify_triggered_sync: lastNotifySpawn,
      codex_notify_configured: notifyConfigured,
      codex_notify: codexNotify
    },
    upload: {
      last_success_at: lastSuccessAt,
      next_allowed_after: parseEpochMsToIso(uploadThrottle.nextAllowedAtMs || null),
      backoff_until: parseEpochMsToIso(uploadThrottle.backoffUntilMs || null),
      last_error: uploadThrottle.lastError
        ? {
            at: uploadThrottle.lastErrorAt || null,
            message: redactError(String(uploadThrottle.lastError), home)
          }
        : null
    }
  };
}

function maskId(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < 12) return null;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function redactValue(value, home) {
  if (typeof value !== 'string') return value;
  if (typeof home !== 'string' || home.length === 0) return value;
  const homeNorm = home.endsWith(path.sep) ? home.slice(0, -1) : home;
  return value.startsWith(homeNorm) ? `~${value.slice(homeNorm.length)}` : value;
}

function redactError(message, home) {
  if (typeof message !== 'string') return message;
  if (typeof home !== 'string' || home.length === 0) return message;
  const homeNorm = home.endsWith(path.sep) ? home.slice(0, -1) : home;
  return message.split(homeNorm).join('~');
}

async function safeStatSize(p) {
  try {
    const st = await fs.stat(p);
    return st && st.isFile() ? st.size : 0;
  } catch (_e) {
    return 0;
  }
}

async function safeReadText(p) {
  try {
    return await fs.readFile(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function parseEpochMsToIso(v) {
  const ms = Number(v);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

module.exports = { collectTrackerDiagnostics };

