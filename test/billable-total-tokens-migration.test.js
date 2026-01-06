'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');

const sql = fs.readFileSync('scripts/ops/billable-total-tokens-migration.sql', 'utf8');

assert.ok(sql.includes('billable_total_tokens'));
assert.ok(sql.includes('billable_rule_version'));
