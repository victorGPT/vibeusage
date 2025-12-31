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
      '@vibescore/tracker',
      '',
      'Usage:',
      '  npx @vibescore/tracker [--debug] init',
      '  npx @vibescore/tracker [--debug] sync [--auto] [--drain]',
      '  npx @vibescore/tracker [--debug] status',
      '  npx @vibescore/tracker [--debug] diagnostics [--out diagnostics.json]',
      '  npx @vibescore/tracker [--debug] uninstall [--purge]',
      '',
      'Notes:',
      '  - init: local setup first, browser sign-in last.',
      '  - optional: --link-code <code> skips browser login when provided by Dashboard.',
      '  - Every Code notify installs when ~/.code/config.toml exists.',
      '  - auto sync waits for a device token.',
      '  - optional: VIBESCORE_DASHBOARD_URL or --dashboard-url for hosted landing.',
      '  - sync parses ~/.codex/sessions/**/rollout-*.jsonl and ~/.code/sessions/**/rollout-*.jsonl, then uploads token deltas.',
      '  - --debug shows original backend errors.',
      ''
    ].join('\n')
  );
}

module.exports = { run };
