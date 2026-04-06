const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { readJson } = require("./fs");
const { normalizeState: normalizeUploadState } = require("./upload-throttle");
const { createIntegrationContext, probeIntegrations } = require("./integrations");

async function collectTrackerDiagnostics({
  home = os.homedir(),
  codexHome = process.env.CODEX_HOME || path.join(home, ".codex"),
  codeHome = process.env.CODE_HOME || path.join(home, ".code"),
} = {}) {
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
  const opencodeHome = process.env.OPENCODE_HOME || path.join(xdgDataHome, "opencode");
  const opencodeStorageDir = path.join(opencodeHome, "storage");
  const opencodeDbPath = path.join(opencodeHome, "opencode.db");
  const integrationContext = await createIntegrationContext({
    home,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODE_HOME: codeHome,
    },
  });
  const trackerDir = integrationContext.trackerPaths.trackerDir;
  const configPath = path.join(trackerDir, "config.json");
  const queuePath = path.join(trackerDir, "queue.jsonl");
  const queueStatePath = path.join(trackerDir, "queue.state.json");
  const cursorsPath = path.join(trackerDir, "cursors.json");
  const notifySignalPath = path.join(trackerDir, "notify.signal");
  const openclawSignalPath = path.join(trackerDir, "openclaw.signal");
  const throttlePath = path.join(trackerDir, "sync.throttle");
  const uploadThrottlePath = path.join(trackerDir, "upload.throttle.json");
  const autoRetryPath = path.join(trackerDir, "auto.retry.json");
  const codexConfigPath = path.join(codexHome, "config.toml");
  const codeConfigPath = path.join(codeHome, "config.toml");

  const config = await readJson(configPath);
  const cursors = await readJson(cursorsPath);
  const queueState = (await readJson(queueStatePath)) || { offset: 0 };
  const uploadThrottle = normalizeUploadState(await readJson(uploadThrottlePath));
  const autoRetry = await readJson(autoRetryPath);
  const probes = await probeIntegrations(integrationContext);
  const probeByName = new Map(probes.map((probe) => [probe.name, probe]));
  const opencodeSqliteCursor =
    cursors?.opencodeSqlite && typeof cursors.opencodeSqlite === "object" ? cursors.opencodeSqlite : {};
  const opencodeDbStat = await safeStat(opencodeDbPath);

  const queueSize = await safeStatSize(queuePath);
  const offsetBytes = Number(queueState.offset || 0);
  const pendingBytes = Math.max(0, queueSize - offsetBytes);

  const lastNotify = (await safeReadText(notifySignalPath))?.trim() || null;
  const lastOpenclawSync = (await safeReadText(openclawSignalPath))?.trim() || null;
  const lastNotifySpawn = parseEpochMsToIso((await safeReadText(throttlePath))?.trim() || null);

  const codexProbe = probeByName.get("codex");
  const everyCodeProbe = probeByName.get("every-code");
  const claudeProbe = probeByName.get("claude");
  const geminiProbe = probeByName.get("gemini");
  const opencodeProbe = probeByName.get("opencode");
  const openclawSessionProbe = probeByName.get("openclaw-session");

  const codexNotify = Array.isArray(codexProbe?.currentNotify)
    ? codexProbe.currentNotify.map((value) => redactValue(value, home))
    : null;
  const everyCodeNotify = Array.isArray(everyCodeProbe?.currentNotify)
    ? everyCodeProbe.currentNotify.map((value) => redactValue(value, home))
    : null;

  const lastSuccessAt = uploadThrottle.lastSuccessMs
    ? new Date(uploadThrottle.lastSuccessMs).toISOString()
    : null;
  const autoRetryAt = parseEpochMsToIso(autoRetry?.retryAtMs);

  return {
    ok: true,
    version: 1,
    generated_at: new Date().toISOString(),
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    paths: {
      tracker_dir: redactValue(trackerDir, home),
      codex_home: redactValue(codexHome, home),
      codex_config: redactValue(codexConfigPath, home),
      code_home: redactValue(codeHome, home),
      code_config: redactValue(codeConfigPath, home),
      claude_config: redactValue(integrationContext.claude.settingsPath, home),
      gemini_config: redactValue(integrationContext.gemini.settingsPath, home),
      opencode_config: redactValue(integrationContext.opencode.configDir, home),
    },
    config: {
      base_url: typeof config?.baseUrl === "string" ? config.baseUrl : null,
      device_token: config?.deviceToken ? "set" : "unset",
      device_id: maskId(config?.deviceId),
      installed_at: typeof config?.installedAt === "string" ? config.installedAt : null,
    },
    parse: {
      updated_at: typeof cursors?.updatedAt === "string" ? cursors.updatedAt : null,
      file_count:
        cursors?.files && typeof cursors.files === "object"
          ? Object.keys(cursors.files).length
          : null,
    },
    queue: {
      size_bytes: queueSize,
      offset_bytes: offsetBytes,
      pending_bytes: pendingBytes,
      updated_at: typeof queueState.updatedAt === "string" ? queueState.updatedAt : null,
    },
    opencode: {
      storage_dir: redactValue(opencodeStorageDir, home),
      db_path: redactValue(opencodeDbPath, home),
      sqlite_db_present: Boolean(opencodeDbStat?.isFile?.()),
      sqlite_status:
        typeof opencodeSqliteCursor.lastStatus === "string" && opencodeSqliteCursor.lastStatus.trim()
          ? opencodeSqliteCursor.lastStatus.trim()
          : "never_checked",
      sqlite_last_checked_at:
        typeof opencodeSqliteCursor.lastCheckedAt === "string"
          ? opencodeSqliteCursor.lastCheckedAt
          : null,
      sqlite_cursor_updated_at:
        typeof opencodeSqliteCursor.updatedAt === "string" ? opencodeSqliteCursor.updatedAt : null,
      sqlite_error_code:
        typeof opencodeSqliteCursor.lastErrorCode === "string"
          ? opencodeSqliteCursor.lastErrorCode
          : null,
    },
    notify: {
      last_notify: lastNotify,
      last_openclaw_triggered_sync: lastOpenclawSync,
      last_notify_triggered_sync: lastNotifySpawn,
      codex_notify_status: codexProbe?.status || "unknown",
      codex_notify_configured: Boolean(codexProbe?.configured),
      codex_notify: codexNotify,
      every_code_notify_status: everyCodeProbe?.status || "unknown",
      every_code_notify_configured: Boolean(everyCodeProbe?.configured),
      every_code_notify: everyCodeNotify,
      claude_plugin_status: claudeProbe?.status || "unknown",
      claude_plugin_configured: Boolean(claudeProbe?.configured),
      gemini_hook_status: geminiProbe?.status || "unknown",
      gemini_hook_configured: Boolean(geminiProbe?.configured),
      opencode_plugin_status: opencodeProbe?.status || "unknown",
      opencode_plugin_configured: Boolean(opencodeProbe?.configured),
      openclaw_session_plugin_status: openclawSessionProbe?.status || "unknown",
      openclaw_session_plugin_configured: Boolean(openclawSessionProbe?.configured),
      openclaw_session_plugin_linked: Boolean(openclawSessionProbe?.linked),
      openclaw_session_plugin_enabled: Boolean(openclawSessionProbe?.enabled),
      openclaw_session_plugin_detail:
        typeof openclawSessionProbe?.detail === "string"
          ? redactError(openclawSessionProbe.detail, home)
          : null,
    },
    upload: {
      last_success_at: lastSuccessAt,
      next_allowed_after: parseEpochMsToIso(uploadThrottle.nextAllowedAtMs || null),
      backoff_until: parseEpochMsToIso(uploadThrottle.backoffUntilMs || null),
      last_error: uploadThrottle.lastError
        ? {
            at: uploadThrottle.lastErrorAt || null,
            message: redactError(String(uploadThrottle.lastError), home),
          }
        : null,
    },
    auto_retry: autoRetryAt
      ? {
          next_retry_at: autoRetryAt,
          reason: typeof autoRetry?.reason === "string" ? autoRetry.reason : null,
          pending_bytes: Number.isFinite(Number(autoRetry?.pendingBytes))
            ? Math.max(0, Number(autoRetry.pendingBytes))
            : null,
          scheduled_at: typeof autoRetry?.scheduledAt === "string" ? autoRetry.scheduledAt : null,
          source: typeof autoRetry?.source === "string" ? autoRetry.source : null,
        }
      : null,
  };
}

function maskId(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 12) return null;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function redactValue(value, home) {
  if (typeof value !== "string") return value;
  if (typeof home !== "string" || home.length === 0) return value;
  const homeNorm = home.endsWith(path.sep) ? home.slice(0, -1) : home;
  return value.startsWith(homeNorm) ? `~${value.slice(homeNorm.length)}` : value;
}

function redactError(message, home) {
  if (typeof message !== "string") return message;
  if (typeof home !== "string" || home.length === 0) return message;
  const homeNorm = home.endsWith(path.sep) ? home.slice(0, -1) : home;
  return message.split(homeNorm).join("~");
}

async function safeStatSize(p) {
  try {
    const st = await fs.stat(p);
    return st && st.isFile() ? st.size : 0;
  } catch (_e) {
    return 0;
  }
}

async function safeStat(p) {
  try {
    return await fs.stat(p);
  } catch (_e) {
    return null;
  }
}

async function safeReadText(p) {
  try {
    return await fs.readFile(p, "utf8");
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
