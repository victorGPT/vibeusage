const { cmdInit } = require('./commands/init');
const { cmdSync } = require('./commands/sync');
const { cmdStatus } = require('./commands/status');
const { cmdDiagnostics } = require('./commands/diagnostics');
const { cmdUninstall } = require('./commands/uninstall');

async function run(argv) {
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'init':
      await cmdInit(rest);
      return;
    case 'sync':
      await cmdSync(rest);
      return;
    case 'status':
      await cmdStatus(rest);
      return;
    case 'diagnostics':
      await cmdDiagnostics(rest);
      return;
    case 'uninstall':
      await cmdUninstall(rest);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHelp() {
  // Keep this short; npx users want quick guidance.
  process.stdout.write(
    [
      'vibeusage',
      '',
      'Usage:',
      '  npx vibeusage [--debug] init [--yes] [--dry-run] [--no-open] [--link-code <code>]',
      '  npx vibeusage [--debug] sync [--auto] [--drain]',
      '  npx vibeusage [--debug] status',
      '  npx vibeusage [--debug] diagnostics [--out diagnostics.json]',
      '  npx vibeusage [--debug] uninstall [--purge]',
      '',
      'Notes:',
      '  - init: consent first, local setup next, browser sign-in last.',
      '  - --yes skips the consent menu (non-interactive safe).',
      '  - --dry-run previews changes without writing files.',
      '  - optional: --link-code <code> skips browser login when provided by Dashboard.',
      '  - Every Code notify installs when ~/.code/config.toml exists.',
      '  - auto sync waits for a device token.',
      '  - optional: VIBEUSAGE_DASHBOARD_URL or --dashboard-url for hosted landing.',
      '  - sync parses ~/.codex/sessions/**/rollout-*.jsonl and ~/.code/sessions/**/rollout-*.jsonl, then uploads token deltas.',
      '  - --debug shows original backend errors.',
      ''
    ].join('\n')
  );
}

module.exports = { run };
