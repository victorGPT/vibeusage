const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.join(
  __dirname,
  '..',
  'dashboard',
  'src',
  'pages',
  'DashboardPage.jsx'
);

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('DashboardPage schedules link code expiry tick', () => {
  const src = readFile(pagePath);
  assert.ok(
    src.includes('linkCodeExpiryTick'),
    'expected link code expiry tick state'
  );
  assert.ok(
    src.includes('setLinkCodeExpiryTick'),
    'expected link code expiry tick updater'
  );
  assert.ok(
    src.includes('setTimeout') || src.includes('setTimeout(') || src.includes('setTimeout ('),
    'expected expiry timer to re-evaluate link code expiration'
  );
});
