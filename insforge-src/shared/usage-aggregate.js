'use strict';

const { toBigInt } = require('./numbers');
const { computeBillableTotalTokens } = require('./usage-billable');
const { addRowTotals } = require('./usage-rollup');

function resolveBillableTotals({ row, source, totals, billableField = 'billable_total_tokens', hasStoredBillable } = {}) {
  const stored = typeof hasStoredBillable === 'boolean'
    ? hasStoredBillable
    : Boolean(row && Object.prototype.hasOwnProperty.call(row, billableField) && row[billableField] != null);
  const resolvedTotals = totals || row;
  const billable = stored
    ? toBigInt(row?.[billableField])
    : computeBillableTotalTokens({ source, totals: resolvedTotals });
  return { billable, hasStoredBillable: stored };
}

function applyTotalsAndBillable({ totals, row, billable, hasStoredBillable } = {}) {
  if (!totals || !row) return;
  addRowTotals(totals, row);
  if (!hasStoredBillable) {
    totals.billable_total_tokens += toBigInt(billable);
  }
}

module.exports = {
  resolveBillableTotals,
  applyTotalsAndBillable
};
