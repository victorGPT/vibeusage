'use strict';

const DEFAULT_MODEL = 'unknown';

function normalizeUsageModelKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildIdentityMap({ usageModels, aliasRows } = {}) {
  const normalized = new Set();
  for (const model of Array.isArray(usageModels) ? usageModels : []) {
    const key = normalizeUsageModelKey(model);
    if (key) normalized.add(key);
  }

  const map = new Map();
  const rows = Array.isArray(aliasRows) ? aliasRows : [];
  const limitToSet = normalized.size > 0;

  for (const row of rows) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    const canonical = normalizeUsageModelKey(row?.canonical_model);
    if (!usageKey || !canonical) continue;
    if (limitToSet && !normalized.has(usageKey)) continue;

    const display = normalizeDisplayName(row?.display_name) || canonical;
    const effective = String(row?.effective_from || '');
    const existing = map.get(usageKey);

    if (!existing || effective > existing.effective_from) {
      map.set(usageKey, {
        model_id: canonical,
        model: display,
        effective_from: effective
      });
    }
  }

  for (const key of normalized) {
    if (!map.has(key)) {
      map.set(key, { model_id: key, model: key, effective_from: '' });
    }
  }

  const result = new Map();
  for (const [key, value] of map.entries()) {
    result.set(key, { model_id: value.model_id, model: value.model });
  }
  return result;
}

function applyModelIdentity({ rawModel, identityMap } = {}) {
  const normalized = normalizeUsageModelKey(rawModel) || DEFAULT_MODEL;
  const entry = identityMap && typeof identityMap.get === 'function'
    ? identityMap.get(normalized)
    : null;
  if (entry) return { model_id: entry.model_id, model: entry.model };
  const display = normalizeDisplayName(rawModel) || DEFAULT_MODEL;
  return { model_id: normalized, model: display };
}

async function resolveModelIdentity({ edgeClient, usageModels, effectiveDate } = {}) {
  const models = Array.isArray(usageModels)
    ? usageModels.map(normalizeUsageModelKey).filter(Boolean)
    : [];
  if (!models.length) return new Map();

  if (!edgeClient || !edgeClient.database) {
    return buildIdentityMap({ usageModels: models, aliasRows: [] });
  }

  const dateKey =
    typeof effectiveDate === 'string' && effectiveDate.trim()
      ? effectiveDate.trim()
      : new Date().toISOString().slice(0, 10);

  const query = edgeClient.database
    .from('vibescore_model_aliases')
    .select('usage_model,canonical_model,display_name,effective_from')
    .eq('active', true)
    .in('usage_model', models)
    .lte('effective_from', dateKey)
    .order('effective_from', { ascending: false });

  const result = await query;
  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(query?.data)
      ? query.data
      : null;
  const error = result?.error || query?.error || null;

  if (error || !Array.isArray(data)) {
    return buildIdentityMap({ usageModels: models, aliasRows: [] });
  }

  return buildIdentityMap({ usageModels: models, aliasRows: data });
}

async function resolveUsageModelsForCanonical({ edgeClient, canonicalModel, effectiveDate } = {}) {
  const canonical = normalizeUsageModelKey(canonicalModel);
  if (!canonical) return { canonical: null, usageModels: [] };

  if (!edgeClient || !edgeClient.database) {
    return { canonical, usageModels: [canonical] };
  }

  const dateKey =
    typeof effectiveDate === 'string' && effectiveDate.trim()
      ? effectiveDate.trim()
      : new Date().toISOString().slice(0, 10);

  const query = edgeClient.database
    .from('vibescore_model_aliases')
    .select('usage_model,canonical_model,effective_from')
    .eq('active', true)
    .eq('canonical_model', canonical)
    .lte('effective_from', dateKey)
    .order('effective_from', { ascending: false });

  const result = await query;
  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(query?.data)
      ? query.data
      : null;
  const error = result?.error || query?.error || null;

  if (error || !Array.isArray(data)) {
    return { canonical, usageModels: [canonical] };
  }

  const usageMap = new Map();
  for (const row of data) {
    const usageKey = normalizeUsageModelKey(row?.usage_model);
    if (!usageKey) continue;
    const effective = String(row?.effective_from || '');
    const existing = usageMap.get(usageKey);
    if (!existing || effective > existing) usageMap.set(usageKey, effective);
  }

  const usageModels = new Set([canonical]);
  for (const usageKey of usageMap.keys()) {
    usageModels.add(usageKey);
  }

  return { canonical, usageModels: Array.from(usageModels.values()) };
}

module.exports = {
  normalizeUsageModelKey,
  buildIdentityMap,
  applyModelIdentity,
  resolveModelIdentity,
  resolveUsageModelsForCanonical
};
