'use strict';

const { toBigInt } = require('./numbers');
const { normalizeSource } = require('./source');

const BILLABLE_INPUT_OUTPUT_REASONING = new Set(['codex', 'every-code']);
const BILLABLE_ADD_ALL = new Set(['claude', 'opencode']);
const BILLABLE_TOTAL = new Set(['gemini']);

function computeBillableTotalTokens({ source, totals } = {}) {
  const normalizedSource = normalizeSource(source) || 'unknown';
  const input = toBigInt(totals?.input_tokens);
  const cached = toBigInt(totals?.cached_input_tokens);
  const output = toBigInt(totals?.output_tokens);
  const reasoning = toBigInt(totals?.reasoning_output_tokens);
  const total = toBigInt(totals?.total_tokens);
  const hasTotal = Boolean(totals && Object.prototype.hasOwnProperty.call(totals, 'total_tokens'));

  if (BILLABLE_TOTAL.has(normalizedSource)) return total;
  if (BILLABLE_ADD_ALL.has(normalizedSource)) return input + cached + output + reasoning;
  if (BILLABLE_INPUT_OUTPUT_REASONING.has(normalizedSource)) return input + output + reasoning;
  if (hasTotal) return total;
  return input + output + reasoning;
}

module.exports = {
  computeBillableTotalTokens
};
