const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('link code table allows authenticated inserts for owner', () => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'openspec',
    'changes',
    '2025-12-28-add-one-login-link-code',
    'sql',
    '001_create_link_codes.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.ok(
    sql.includes('create policy vibescore_link_codes_insert_self'),
    'expected insert policy for link codes'
  );
  assert.ok(
    sql.includes('for insert'),
    'expected insert policy to be defined'
  );
  assert.ok(
    sql.includes('auth.uid() = user_id'),
    'expected insert policy to enforce user ownership'
  );
});
