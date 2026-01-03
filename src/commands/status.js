const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { readJson } = require('../lib/fs');
const { readCodexNotify, readEveryCodeNotify } = require('../lib/codex-config');
const {
  isClaudeHookConfigured,
  buildClaudeHookCommand,
  resolveClaudeHome,
  resolveClaudeSettingsPath
} = require('../lib/claude-config');
const {
  resolveGeminiConfigDir,
  resolveGeminiSettingsPath,
  isGeminiHookConfigured,
  buildGeminiHookCommand
} = require('../lib/gemini-config');
const { resolveOpencodeConfigDir, isOpencodePluginInstalled } = require('../lib/opencode-config');
const { normalizeState: normalizeUploadState } = require('../lib/upload-throttle');
const { collectTrackerDiagnostics } = require('../lib/diagnostics');

async function cmdStatus(argv = []) {
  const opts = parseArgs(argv);
  if (opts.diagnostics) {
    const diagnostics = await collectTrackerDiagnostics();
    process.stdout.write(JSON.stringify(diagnostics, null, 2) + '\n');
    return;
  }

  const home = os.homedir();
  const trackerDir = path.join(home, '.vibescore', 'tracker');
  const configPath = path.join(trackerDir, 'config.json');
  const queuePath = path.join(trackerDir, 'queue.jsonl');
  const queueStatePath = path.join(trackerDir, 'queue.state.json');
  const cursorsPath = path.join(trackerDir, 'cursors.json');
  const notifySignalPath = path.join(trackerDir, 'notify.signal');
  const throttlePath = path.join(trackerDir, 'sync.throttle');
  const uploadThrottlePath = path.join(trackerDir, 'upload.throttle.json');
  const autoRetryPath = path.join(trackerDir, 'auto.retry.json');
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const codexConfigPath = path.join(codexHome, 'config.toml');
  const codeHome = process.env.CODE_HOME || path.join(home, '.code');
  const codeConfigPath = path.join(codeHome, 'config.toml');
  const claudeHome = resolveClaudeHome({ home, env: process.env });
  const claudeSettingsPath = resolveClaudeSettingsPath({ claudeHome });
  const geminiConfigDir = resolveGeminiConfigDir({ home, env: process.env });
  const geminiSettingsPath = resolveGeminiSettingsPath({ configDir: geminiConfigDir });
  const opencodeConfigDir = resolveOpencodeConfigDir({ home, env: process.env });
  const claudeHookCommand = buildClaudeHookCommand(path.join(home, '.vibescore', 'bin', 'notify.cjs'));
  const geminiHookCommand = buildGeminiHookCommand(path.join(home, '.vibescore', 'bin', 'notify.cjs'));

  const config = await readJson(configPath);
  const cursors = await readJson(cursorsPath);
  const queueState = (await readJson(queueStatePath)) || { offset: 0 };
  const uploadThrottle = normalizeUploadState(await readJson(uploadThrottlePath));
  const autoRetry = await readJson(autoRetryPath);

  const queueSize = await safeStatSize(queuePath);
  const pendingBytes = Math.max(0, queueSize - (queueState.offset || 0));

  const lastNotify = (await safeReadText(notifySignalPath))?.trim() || null;
  const lastNotifySpawn = parseEpochMsToIso((await safeReadText(throttlePath))?.trim() || null);

  const codexNotify = await readCodexNotify(codexConfigPath);
  const notifyConfigured = Array.isArray(codexNotify) && codexNotify.length > 0;
  const everyCodeNotify = await readEveryCodeNotify(codeConfigPath);
  const everyCodeConfigured = Array.isArray(everyCodeNotify) && everyCodeNotify.length > 0;
  const claudeHookConfigured = await isClaudeHookConfigured({
    settingsPath: claudeSettingsPath,
    hookCommand: claudeHookCommand
  });
  const geminiHookConfigured = await isGeminiHookConfigured({
    settingsPath: geminiSettingsPath,
    hookCommand: geminiHookCommand
  });
  const opencodePluginConfigured = await isOpencodePluginInstalled({ configDir: opencodeConfigDir });

  const lastUpload = uploadThrottle.lastSuccessMs
    ? parseEpochMsToIso(uploadThrottle.lastSuccessMs)
    : typeof queueState.updatedAt === 'string'
      ? queueState.updatedAt
      : null;
  const nextUpload = parseEpochMsToIso(uploadThrottle.nextAllowedAtMs || null);
  const backoffUntil = parseEpochMsToIso(uploadThrottle.backoffUntilMs || null);
  const lastUploadError = uploadThrottle.lastError
    ? `${uploadThrottle.lastErrorAt || 'unknown'} ${uploadThrottle.lastError}`
    : null;
  const autoRetryAt = parseEpochMsToIso(autoRetry?.retryAtMs || null);
  const autoRetryLine = autoRetryAt
    ? `- Auto retry after: ${autoRetryAt} (${autoRetry?.reason || 'scheduled'}, pending ${Number(
        autoRetry?.pendingBytes || 0
      )} bytes)`
    : null;

  process.stdout.write(
    [
      'Status:',
      `- Base URL: ${config?.baseUrl || 'unset'}`,
      `- Device token: ${config?.deviceToken ? 'set' : 'unset'}`,
      `- Queue: ${pendingBytes} bytes pending`,
      `- Last parse: ${cursors?.updatedAt || 'never'}`,
      `- Last notify: ${lastNotify || 'never'}`,
      `- Last notify-triggered sync: ${lastNotifySpawn || 'never'}`,
      `- Last upload: ${lastUpload || 'never'}`,
      `- Next upload after: ${nextUpload || 'never'}`,
      `- Backoff until: ${backoffUntil || 'never'}`,
      lastUploadError ? `- Last upload error: ${lastUploadError}` : null,
      autoRetryLine,
      `- Codex notify: ${notifyConfigured ? JSON.stringify(codexNotify) : 'unset'}`,
      `- Every Code notify: ${everyCodeConfigured ? JSON.stringify(everyCodeNotify) : 'unset'}`,
      `- Claude hooks: ${claudeHookConfigured ? 'set' : 'unset'}`,
      `- Gemini hooks: ${geminiHookConfigured ? 'set' : 'unset'}`,
      `- Opencode plugin: ${opencodePluginConfigured ? 'set' : 'unset'}`,
      ''
    ]
      .filter(Boolean)
      .join('\n')
  );
}

function parseArgs(argv) {
  const out = { diagnostics: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diagnostics' || a === '--json') out.diagnostics = true;
    else throw new Error(`Unknown option: ${a}`);
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

module.exports = { cmdStatus };
