'use strict';

const { formatSummaryLine, renderBox, underline } = require('./cli-ui');

const DIVIDER = '----------------------------------------------';

function renderLocalReport({ summary, isDryRun }) {
  const header = isDryRun
    ? 'Dry run complete. Preview only; no changes were applied.'
    : 'Local configuration complete.';
  const lines = [header, '', 'Integration Status:'];
  for (const item of summary || []) lines.push(formatSummaryLine(item));
  process.stdout.write(`${lines.join('\n')}\n`);
}

function renderAuthTransition({ authUrl, canAutoOpen }) {
  const lines = ['', DIVIDER, '', 'Next: Registering device...'];
  if (canAutoOpen) {
    lines.push('Opening your browser to link account...');
    if (authUrl) lines.push(`If it does not open, visit: ${underline(authUrl)}`);
  } else {
    lines.push('Open the link below to sign in.');
    if (authUrl) lines.push(`Visit: ${underline(authUrl)}`);
  }
  lines.push('');
  process.stdout.write(`${lines.join('\n')}\n`);
}

function renderSuccessBox({ configPath, dashboardUrl }) {
  const identityLine = 'Account linked.';
  const lines = [
    'You are all set!',
    '',
    identityLine,
    `Token saved to: ${configPath}`,
    ''
  ];
  if (dashboardUrl) lines.push(`View your stats at: ${dashboardUrl}`);
  lines.push('You can close this terminal window.');
  process.stdout.write(`${renderBox(lines)}\n`);
}

module.exports = {
  DIVIDER,
  renderLocalReport,
  renderAuthTransition,
  renderSuccessBox
};
