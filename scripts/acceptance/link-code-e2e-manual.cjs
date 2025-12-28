#!/usr/bin/env node
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const opts = { linkCode: null, baseUrl: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--link-code') {
      opts.linkCode = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg.startsWith('--link-code=')) {
      opts.linkCode = arg.split('=').slice(1).join('=') || null;
      continue;
    }
    if (arg === '--base-url') {
      opts.baseUrl = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      opts.baseUrl = arg.split('=').slice(1).join('=') || null;
      continue;
    }
  }
  return opts;
}

function printUsage() {
  process.stdout.write(
    [
      'Manual E2E: Link code install flow',
      '',
      'Usage:',
      '  node scripts/acceptance/link-code-e2e-manual.cjs --link-code <code> --base-url <insforge_url>',
      '',
      'Prereq:',
      '  1) Log in to Dashboard and copy the install command with link code.',
      '  2) Extract the <code> part for this script.',
      '',
      'Notes:',
      '  - This script runs init in a temporary HOME to avoid touching your real config.',
      '  - It verifies token creation and rejects link code reuse.'
    ].join('\n') + '\n'
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printUsage();
    return;
  }
  if (!opts.linkCode || !opts.baseUrl) {
    printUsage();
    process.exit(1);
    return;
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibescore-link-code-'));
  const env = {
    ...process.env,
    HOME: tmpRoot,
    CODEX_HOME: path.join(tmpRoot, '.codex')
  };

  await fs.mkdir(env.CODEX_HOME, { recursive: true });
  await fs.writeFile(path.join(env.CODEX_HOME, 'config.toml'), '# test config\n', 'utf8');

  const initArgs = [
    path.join(repoRoot, 'bin', 'tracker.js'),
    'init',
    '--link-code',
    opts.linkCode,
    '--base-url',
    opts.baseUrl,
    '--no-open'
  ];

  const init = spawnSync(process.execPath, initArgs, { env, stdio: 'inherit' });
  if (init.status !== 0) {
    process.exit(init.status || 1);
    return;
  }

  const configPath = path.join(tmpRoot, '.vibescore', 'tracker', 'config.json');
  const configRaw = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(configRaw);
  if (!config.deviceToken || !config.deviceId) {
    console.error('Missing device token or device id in config');
    process.exit(1);
    return;
  }

  const reuse = spawnSync(process.execPath, initArgs, { env, stdio: 'inherit' });
  if (reuse.status === 0) {
    console.error('Expected link code reuse to fail but init succeeded');
    process.exit(1);
    return;
  }

  console.log('ok: link code init succeeded once and reuse failed as expected');
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
