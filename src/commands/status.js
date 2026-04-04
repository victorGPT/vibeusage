const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { readJson } = require("../lib/fs");
const { collectLocalSubscriptions } = require("../lib/subscriptions");
const { normalizeState: normalizeUploadState } = require("../lib/upload-throttle");
const { collectTrackerDiagnostics } = require("../lib/diagnostics");
const { createIntegrationContext, listIntegrations, probeIntegrations } = require("../lib/integrations");
const { resolveTrackerPaths } = require("../lib/tracker-paths");

async function cmdStatus(argv = []) {
  const opts = parseArgs(argv);
  if (opts.diagnostics) {
    const diagnostics = await collectTrackerDiagnostics();
    process.stdout.write(JSON.stringify(diagnostics, null, 2) + "\n");
    return;
  }

  const home = os.homedir();
  const { trackerDir } = await resolveTrackerPaths({ home });
  const configPath = path.join(trackerDir, "config.json");
  const queuePath = path.join(trackerDir, "queue.jsonl");
  const queueStatePath = path.join(trackerDir, "queue.state.json");
  const cursorsPath = path.join(trackerDir, "cursors.json");
  const notifySignalPath = path.join(trackerDir, "notify.signal");
  const openclawSignalPath = path.join(trackerDir, "openclaw.signal");
  const throttlePath = path.join(trackerDir, "sync.throttle");
  const uploadThrottlePath = path.join(trackerDir, "upload.throttle.json");
  const autoRetryPath = path.join(trackerDir, "auto.retry.json");
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
  const opencodeHome = process.env.OPENCODE_HOME || path.join(xdgDataHome, "opencode");
  const opencodeDbPath = path.join(opencodeHome, "opencode.db");

  const config = await readJson(configPath);
  const cursors = await readJson(cursorsPath);
  const queueState = (await readJson(queueStatePath)) || { offset: 0 };
  const uploadThrottle = normalizeUploadState(await readJson(uploadThrottlePath));
  const autoRetry = await readJson(autoRetryPath);

  const queueSize = await safeStatSize(queuePath);
  const pendingBytes = Math.max(0, queueSize - (queueState.offset || 0));

  const lastNotify = (await safeReadText(notifySignalPath))?.trim() || null;
  const lastOpenclawSync = (await safeReadText(openclawSignalPath))?.trim() || null;
  const lastNotifySpawn = parseEpochMsToIso((await safeReadText(throttlePath))?.trim() || null);

  const integrationContext = await createIntegrationContext({ home, env: process.env });
  const probes = await probeIntegrations(integrationContext);
  const descriptors = new Map(listIntegrations().map((integration) => [integration.name, integration]));
  const probeByName = new Map(probes.map((probe) => [probe.name, probe]));

  const lastUpload = uploadThrottle.lastSuccessMs
    ? parseEpochMsToIso(uploadThrottle.lastSuccessMs)
    : typeof queueState.updatedAt === "string"
      ? queueState.updatedAt
      : null;
  const nextUpload = parseEpochMsToIso(uploadThrottle.nextAllowedAtMs || null);
  const backoffUntil = parseEpochMsToIso(uploadThrottle.backoffUntilMs || null);
  const lastUploadError = uploadThrottle.lastError
    ? `${uploadThrottle.lastErrorAt || "unknown"} ${uploadThrottle.lastError}`
    : null;
  const autoRetryAt = parseEpochMsToIso(autoRetry?.retryAtMs || null);
  const autoRetryLine = autoRetryAt
    ? `- Auto retry after: ${autoRetryAt} (${autoRetry?.reason || "scheduled"}, pending ${Number(
        autoRetry?.pendingBytes || 0,
      )} bytes)`
    : null;

  const subscriptions = await collectLocalSubscriptions({
    home,
    env: process.env,
    probeKeychain: opts.probeKeychain,
    probeKeychainDetails: opts.probeKeychainDetails,
  });
  const subscriptionLines =
    subscriptions.length > 0 ? subscriptions.map(formatSubscriptionLine) : [];
  const codexProbe = probeByName.get("codex");
  const everyCodeProbe = probeByName.get("every-code");
  const claudeProbe = probeByName.get("claude");
  const geminiProbe = probeByName.get("gemini");
  const opencodeProbe = probeByName.get("opencode");
  const openclawSessionProbe = probeByName.get("openclaw-session");
  const opencodeDbPresent = Boolean((await safeStat(opencodeDbPath))?.isFile?.());
  const opencodeSqliteState =
    cursors?.opencodeSqlite && typeof cursors.opencodeSqlite === "object"
      ? cursors.opencodeSqlite
      : {};
  const opencodeSqliteReader =
    typeof opencodeSqliteState.lastStatus === "string" && opencodeSqliteState.lastStatus.trim()
      ? opencodeSqliteState.lastStatus.trim()
      : "never_checked";

  process.stdout.write(
    [
      "Status:",
      `- Base URL: ${config?.baseUrl || "unset"}`,
      `- Device token: ${config?.deviceToken ? "set" : "unset"}`,
      `- Queue: ${pendingBytes} bytes pending`,
      `- Last parse: ${cursors?.updatedAt || "never"}`,
      `- Last notify: ${lastNotify || "never"}`,
      `- Last OpenClaw-triggered sync: ${lastOpenclawSync || "never"}`,
      `- Last notify-triggered sync: ${lastNotifySpawn || "never"}`,
      `- Last upload: ${lastUpload || "never"}`,
      `- Next upload after: ${nextUpload || "never"}`,
      `- Backoff until: ${backoffUntil || "never"}`,
      lastUploadError ? `- Last upload error: ${lastUploadError}` : null,
      autoRetryLine,
      `- Codex notify: ${renderIntegrationStatus(descriptors.get("codex"), codexProbe)}`,
      `- Every Code notify: ${renderIntegrationStatus(descriptors.get("every-code"), everyCodeProbe)}`,
      `- Claude hooks: ${renderIntegrationStatus(descriptors.get("claude"), claudeProbe)}`,
      `- Gemini hooks: ${renderIntegrationStatus(descriptors.get("gemini"), geminiProbe)}`,
      `- Opencode plugin: ${renderIntegrationStatus(descriptors.get("opencode"), opencodeProbe)}`,
      `- OpenCode SQLite DB: ${opencodeDbPresent ? "present" : "missing"}`,
      `- OpenCode SQLite reader: ${opencodeSqliteReader}`,
      `- OpenClaw session plugin: ${renderIntegrationStatus(
        descriptors.get("openclaw-session"),
        openclawSessionProbe,
      )}`,
      ...subscriptionLines,
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function renderIntegrationStatus(descriptor, probe) {
  if (!probe) return "unknown";
  if (descriptor && typeof descriptor.renderStatusValue === "function") {
    return descriptor.renderStatusValue(probe);
  }
  if (probe.status === "ready") return "set";
  if (probe.status === "not_installed") return "unset";
  return probe.status || "unknown";
}

function formatSubscriptionLine(entry = {}) {
  const tool = String(entry.tool || "");
  const provider = String(entry.provider || "");
  const product = String(entry.product || "");
  const planType = String(entry.planType || "");
  const rateLimitTier = String(entry.rateLimitTier || "");
  const toolLabel =
    tool === "codex"
      ? "Codex"
      : tool === "opencode"
        ? "OpenCode"
        : tool === "claude"
          ? "Claude Code"
          : tool;

  if (!planType) return null;

  if (tool === "claude" && provider === "anthropic" && product === "subscription") {
    const suffix = rateLimitTier ? ` (rate limit tier: ${rateLimitTier})` : "";
    return `- ${toolLabel} subscription: ${planType}${suffix}`;
  }

  if (provider === "openai" && product === "chatgpt") {
    return `- ${toolLabel} ChatGPT plan: ${planType}`;
  }

  const productLabel = product ? product.replace(/_/g, " ") : "subscription";
  return `- ${toolLabel} ${productLabel}: ${planType}`;
}

function parseArgs(argv) {
  const out = { diagnostics: false, probeKeychain: false, probeKeychainDetails: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--diagnostics" || a === "--json") out.diagnostics = true;
    else if (a === "--probe-keychain") out.probeKeychain = true;
    else if (a === "--probe-keychain-details") {
      out.probeKeychainDetails = true;
      out.probeKeychain = true;
    } else throw new Error(`Unknown option: ${a}`);
  }

  return out;
}

async function safeStatSize(p) {
  try {
    const st = await fs.stat(p);
    return st.size || 0;
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

module.exports = { cmdStatus };
