'use strict';

function normalizeModel(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getModelParam(url) {
  if (!url || typeof url.searchParams?.get !== 'function') {
    return { ok: false, error: 'Invalid request URL' };
  }
  const raw = url.searchParams.get('model');
  if (raw == null) return { ok: true, model: null };
  if (raw.trim() === '') return { ok: true, model: null };
  const normalized = normalizeModel(raw);
  if (!normalized) return { ok: false, error: 'Invalid model' };
  return { ok: true, model: normalized };
}

module.exports = {
  normalizeModel,
  getModelParam
};
