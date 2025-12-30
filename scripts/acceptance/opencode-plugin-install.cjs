const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawnSync } = require('node:child_process');

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-accept-'));
  const homeDir = tmpRoot;
  const codexHome = path.join(tmpRoot, '.codex');
  const opencodeConfigDir = path.join(tmpRoot, '.config', 'opencode');
  const pluginDir = path.join(opencodeConfigDir, 'plugin');
  const existingPluginPath = path.join(pluginDir, 'existing.js');

  const env = {
    ...process.env,
    HOME: homeDir,
    CODEX_HOME: codexHome
  };

  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(path.join(codexHome, 'config.toml'), '# test config\n', 'utf8');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(existingPluginPath, '// existing plugin\n', 'utf8');

  const init = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'bin', 'tracker.js'), 'init', '--no-auth', '--no-open', '--base-url', 'https://example.invalid'],
    { env, stdio: 'inherit' }
  );
  if (init.status !== 0) {
    process.exit(init.status || 1);
  }

  const pluginPath = path.join(pluginDir, 'vibescore-tracker.js');
  const pluginBody = await fs.readFile(pluginPath, 'utf8').catch(() => null);
  if (!pluginBody || !pluginBody.includes('VIBESCORE_TRACKER_PLUGIN')) {
    console.error('Missing or invalid opencode plugin file.');
    process.exit(1);
  }
  if (!pluginBody.includes('const proc = $`/usr/bin/env node ')) {
    console.error('Expected opencode plugin to use an unescaped `$` template command.');
    process.exit(1);
  }
  if (pluginBody.includes('const proc = $\\`/usr/bin/env node ')) {
    console.error('Unexpected escaped backtick in opencode plugin command.');
    process.exit(1);
  }

  const uninstall = spawnSync(process.execPath, [path.join(repoRoot, 'bin', 'tracker.js'), 'uninstall'], {
    env,
    stdio: 'inherit'
  });
  if (uninstall.status !== 0) {
    process.exit(uninstall.status || 1);
  }

  const removed = await fs.stat(pluginPath).then(() => false).catch(() => true);
  if (!removed) {
    console.error('Expected opencode plugin to be removed.');
    process.exit(1);
  }

  const existing = await fs.readFile(existingPluginPath, 'utf8');
  if (!existing.includes('existing plugin')) {
    console.error('Expected existing plugin to remain unchanged.');
    process.exit(1);
  }

  console.log('ok: opencode plugin install/uninstall acceptance passed');
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
