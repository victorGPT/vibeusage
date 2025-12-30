const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawnSync } = require('node:child_process');

function flattenHookEntries(entries) {
  return entries.flatMap((entry) => (Array.isArray(entry?.hooks) ? entry.hooks : [entry]));
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-accept-'));
  const homeDir = tmpRoot;
  const codexHome = path.join(tmpRoot, '.codex');
  const geminiHome = path.join(tmpRoot, '.gemini');

  const env = {
    ...process.env,
    HOME: homeDir,
    CODEX_HOME: codexHome,
    GEMINI_HOME: geminiHome
  };

  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(path.join(codexHome, 'config.toml'), '# test config\n', 'utf8');
  await fs.mkdir(geminiHome, { recursive: true });

  const settingsPath = path.join(geminiHome, 'settings.json');
  const existingCommand = 'echo existing-gemini';
  const settings = {
    tools: { enableHooks: false },
    hooks: {
      SessionEnd: [
        {
          matcher: 'exit',
          hooks: [{ name: 'existing-gemini', type: 'command', command: existingCommand }]
        }
      ]
    }
  };
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  const init = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'bin', 'tracker.js'), 'init', '--no-auth', '--no-open', '--base-url', 'https://example.invalid'],
    { env, stdio: 'inherit' }
  );
  if (init.status !== 0) {
    process.exit(init.status || 1);
  }

  const installedRaw = await fs.readFile(settingsPath, 'utf8');
  const installed = JSON.parse(installedRaw);
  const sessionEnd = installed?.hooks?.SessionEnd || [];
  const hooks = flattenHookEntries(sessionEnd);
  if (installed?.tools?.enableHooks !== true) {
    console.error('Expected tools.enableHooks to be true after init.');
    process.exit(1);
  }

  const hasExisting = hooks.some((hook) => hook?.command === existingCommand);
  if (!hasExisting) {
    console.error('Expected existing Gemini hook to remain.');
    process.exit(1);
  }

  const trackerHook = hooks.find(
    (hook) =>
      hook?.name === 'vibescore-tracker' &&
      typeof hook?.command === 'string' &&
      hook.command.includes('notify.cjs') &&
      hook.command.includes('--source=gemini')
  );
  if (!trackerHook) {
    console.error('Expected tracker Gemini hook to be added.');
    process.exit(1);
  }

  const uninstall = spawnSync(process.execPath, [path.join(repoRoot, 'bin', 'tracker.js'), 'uninstall'], {
    env,
    stdio: 'inherit'
  });
  if (uninstall.status !== 0) {
    process.exit(uninstall.status || 1);
  }

  const restoredRaw = await fs.readFile(settingsPath, 'utf8');
  const restored = JSON.parse(restoredRaw);
  const restoredHooks = flattenHookEntries(restored?.hooks?.SessionEnd || []);
  const restoredExisting = restoredHooks.some((hook) => hook?.command === existingCommand);
  const restoredTracker = restoredHooks.some((hook) => hook?.name === 'vibescore-tracker');

  if (!restoredExisting) {
    console.error('Expected existing Gemini hook to remain after uninstall.');
    process.exit(1);
  }
  if (restoredTracker) {
    console.error('Expected tracker Gemini hook to be removed after uninstall.');
    process.exit(1);
  }

  console.log('ok: gemini hook install/uninstall acceptance passed');
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
