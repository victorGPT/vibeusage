#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const binDir = path.join(root, 'node_modules', '.bin');

fs.mkdirSync(binDir, { recursive: true });

const targets = [
  { name: 'tracker', rel: '../../bin/tracker.js' },
  { name: 'vibeusage', rel: '../../bin/tracker.js' },
  { name: 'vibeusage-tracker', rel: '../../bin/tracker.js' },
  { name: 'vibescore-tracker', rel: '../../bin/tracker.js' }
];

for (const t of targets) {
  const p = path.join(binDir, t.name);
  const content = `#!/usr/bin/env node\nrequire(${JSON.stringify(t.rel)})\n`;
  fs.writeFileSync(p, content, { encoding: 'utf8' });
  try {
    fs.chmodSync(p, 0o755);
  } catch (_e) {}
}

process.stdout.write(`Created shims in ${binDir}\n`);
