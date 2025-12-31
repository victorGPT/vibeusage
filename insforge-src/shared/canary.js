'use strict';

function isCanaryTag(value) {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase() === 'canary';
}

function applyCanaryFilter(query, { source, model } = {}) {
  if (!query || typeof query.neq !== 'function') return query;
  if (isCanaryTag(source) || isCanaryTag(model)) return query;
  return query.neq('source', 'canary').neq('model', 'canary');
}

module.exports = {
  applyCanaryFilter,
  isCanaryTag
};
