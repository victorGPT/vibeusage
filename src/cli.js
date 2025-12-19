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
      '  npx @vibescore/tracker init',
      '  npx @vibescore/tracker sync [--auto] [--drain]',
      '  npx @vibescore/tracker status',
      '  npx @vibescore/tracker diagnostics [--out diagnostics.json]',
      '  npx @vibescore/tracker uninstall [--purge]',
      '',
      'Notes:',
      '  - init installs a Codex notify hook and issues a device token (default: browser sign in/up).',
      '  - optional: set VIBESCORE_DASHBOARD_URL (or --dashboard-url) to use a hosted /connect page.',
      '  - sync parses ~/.codex/sessions/**/rollout-*.jsonl and uploads token_count deltas.',
      ''
    ].join('\n')
  );
}

module.exports = { run };
