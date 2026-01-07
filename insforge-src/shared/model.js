'use strict';

function normalizeModel(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUsageModel(value) {
  const normalized = normalizeModel(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  return lowered ? lowered : null;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function applyUsageModelFilter(query, usageModels) {
  if (!query || typeof query.or !== 'function') return query;
  const models = Array.isArray(usageModels) ? usageModels : [];
  const terms = [];
  const seen = new Set();

  for (const model of models) {
    const normalized = normalizeUsageModel(model);
    if (!normalized) continue;
    const safe = escapeLike(normalized);
    const exact = `model.ilike.${safe}`;
    if (!seen.has(exact)) {
      seen.add(exact);
      terms.push(exact);
    }
  }

  if (terms.length === 0) return query;
  return query.or(terms.join(','));
}

function getModelParam(url) {
  if (!url || typeof url.searchParams?.get !== 'function') {
    return { ok: false, error: 'Invalid request URL' };
  }
  const raw = url.searchParams.get('model');
  if (raw == null) return { ok: true, model: null };
  if (raw.trim() === '') return { ok: true, model: null };
  const normalized = normalizeUsageModel(raw);
  if (!normalized) return { ok: false, error: 'Invalid model' };
  return { ok: true, model: normalized };
}

module.exports = {
  normalizeModel,
  normalizeUsageModel,
  applyUsageModelFilter,
  getModelParam
};
