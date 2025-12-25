// Edge function: vibescore-pricing-sync
// Fetches OpenRouter Models API pricing and upserts into vibescore_pricing_profiles.
// Auth: Authorization: Bearer <service_role_key>

'use strict';

const { handleOptions, json, readJson, requireMethod } = require('../shared/http');
const { getBearerToken } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');
const { formatDateUTC, isDate } = require('../shared/date');
const { toPositiveIntOrNull } = require('../shared/numbers');
const { normalizeSource } = require('../shared/source');
const { normalizeModel } = require('../shared/model');
const { forEachPage } = require('../shared/pagination');

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const MAX_RATE_MICROS_PER_MILLION = 2147483647n;
const SCALE_MICROS_PER_MILLION = 12; // USD per token -> micro USD per million tokens
const UPSERT_BATCH_SIZE = 500;
const USAGE_MODEL_WINDOW_DAYS = 30;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: 'Admin key missing' }, 500);

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer || bearer !== serviceRoleKey) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const payload = body.data && typeof body.data === 'object' ? body.data : {};

  const effectiveFrom = isDate(payload.effective_from)
    ? payload.effective_from
    : formatDateUTC(new Date());

  const retentionDays = toPositiveIntOrNull(payload.retention_days);

  const allowModels = normalizeAllowList(payload.allow_models);

  const pricingSource = normalizeSource(payload.source) ||
    normalizeSource(getEnvValue('VIBESCORE_PRICING_SOURCE')) ||
    'openrouter';

  const openRouterKey = getEnvValue('OPENROUTER_API_KEY');
  if (!openRouterKey) return json({ error: 'OPENROUTER_API_KEY missing' }, 500);

  const headers = {
    Authorization: `Bearer ${openRouterKey}`
  };
  const referer = getEnvValue('OPENROUTER_HTTP_REFERER');
  if (referer) headers['HTTP-Referer'] = referer;
  const title = getEnvValue('OPENROUTER_APP_TITLE');
  if (title) headers['X-Title'] = title;

  const openrouterRes = await fetch(OPENROUTER_MODELS_URL, { headers });
  if (!openrouterRes.ok) {
    return json({
      error: 'OpenRouter fetch failed',
      status: openrouterRes.status
    }, 502);
  }

  let openrouterJson = null;
  try {
    openrouterJson = await openrouterRes.json();
  } catch (_err) {
    return json({ error: 'Invalid OpenRouter response' }, 502);
  }

  const models = Array.isArray(openrouterJson?.data) ? openrouterJson.data : [];
  if (!Array.isArray(openrouterJson?.data)) {
    return json({ error: 'Unexpected OpenRouter response shape' }, 502);
  }

  const rows = [];
  const pricingMeta = [];
  const pricingModelIds = new Set();
  let skipped = 0;

  for (const entry of models) {
    const modelId = normalizeModel(entry?.id);
    if (!modelId) {
      skipped += 1;
      continue;
    }
    if (!allowModel(modelId, allowModels)) continue;

    const pricing = entry?.pricing;
    if (!pricing || typeof pricing !== 'object') {
      skipped += 1;
      continue;
    }

    const promptUsd = pricing.prompt;
    const completionUsd = pricing.completion;
    const cachedUsd = pricing.input_cache_read != null ? pricing.input_cache_read : promptUsd;
    const reasoningUsd = pricing.internal_reasoning != null ? pricing.internal_reasoning : completionUsd;

    const inputRate = toRateMicrosPerMillion(promptUsd);
    const outputRate = toRateMicrosPerMillion(completionUsd);
    const cachedRate = toRateMicrosPerMillion(cachedUsd);
    const reasoningRate = toRateMicrosPerMillion(reasoningUsd);

    if (inputRate == null || outputRate == null || cachedRate == null || reasoningRate == null) {
      skipped += 1;
      continue;
    }

    rows.push({
      model: modelId,
      source: pricingSource,
      effective_from: effectiveFrom,
      input_rate_micro_per_million: inputRate,
      cached_input_rate_micro_per_million: cachedRate,
      output_rate_micro_per_million: outputRate,
      reasoning_output_rate_micro_per_million: reasoningRate,
      active: true
    });

    pricingModelIds.add(modelId.toLowerCase());
    pricingMeta.push({
      id: modelId,
      created: normalizeCreated(entry?.created),
      context_length: normalizeContextLength(entry?.context_length)
    });
  }

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey
  });

  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await serviceClient.database
      .from('vibescore_pricing_profiles')
      .upsert(batch, { onConflict: 'model,source,effective_from' });
    if (error) return json({ error: error.message }, 500);
    upserted += batch.length;
  }

  const usageModels = await listUsageModels({
    serviceClient,
    windowDays: USAGE_MODEL_WINDOW_DAYS
  });

  const aliasRows = buildAliasRows({
    usageModels,
    pricingModelIds,
    pricingMeta,
    pricingSource,
    effectiveFrom
  });

  let aliasesUpserted = 0;
  for (let i = 0; i < aliasRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = aliasRows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await serviceClient.database
      .from('vibescore_pricing_model_aliases')
      .upsert(batch, { onConflict: 'usage_model,pricing_source,effective_from' });
    if (error) return json({ error: error.message }, 500);
    aliasesUpserted += batch.length;
  }

  let retention = null;
  if (retentionDays) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffDate = formatDateUTC(cutoff);
    const { error } = await serviceClient.database
      .from('vibescore_pricing_profiles')
      .update({ active: false })
      .eq('source', pricingSource)
      .lt('effective_from', cutoffDate);
    if (error) return json({ error: error.message }, 500);

    const { error: aliasError } = await serviceClient.database
      .from('vibescore_pricing_model_aliases')
      .update({ active: false })
      .eq('pricing_source', pricingSource)
      .lt('effective_from', cutoffDate);
    if (aliasError) return json({ error: aliasError.message }, 500);

    retention = { retention_days: retentionDays, cutoff_date: cutoffDate };
  }

  return json({
    success: true,
    source: pricingSource,
    effective_from: effectiveFrom,
    models_total: models.length,
    models_processed: rows.length,
    models_skipped: skipped,
    rows_upserted: upserted,
    usage_models_total: usageModels.length,
    aliases_generated: aliasRows.length,
    aliases_upserted: aliasesUpserted,
    retention
  }, 200);
};

function getEnvValue(key) {
  try {
    if (typeof Deno !== 'undefined' && Deno?.env?.get) {
      return Deno.env.get(key);
    }
  } catch (_) {
    // ignore
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return null;
}

function normalizeAllowList(raw) {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((entry) => normalizeModel(entry))
    .filter((entry) => typeof entry === 'string' && entry.length > 0);
  return list.length > 0 ? list : null;
}

function allowModel(modelId, allowList) {
  if (!allowList || allowList.length === 0) return true;
  for (const entry of allowList) {
    if (modelId === entry) return true;
    if (!entry.includes('/') && modelId.endsWith(`/${entry}`)) return true;
  }
  return false;
}

function normalizeCreated(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeContextLength(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function listUsageModels({ serviceClient, windowDays }) {
  const models = new Set();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const since = cutoff.toISOString();

  const { error } = await forEachPage({
    createQuery: () =>
      serviceClient.database
        .from('vibescore_tracker_hourly')
        .select('model')
        .gte('hour_start', since),
    onPage: (rows) => {
      for (const row of rows || []) {
        const normalized = normalizeUsageModel(row?.model);
        if (normalized) models.add(normalized);
      }
    }
  });

  if (error) throw new Error(error.message || 'Failed to list usage models');
  return Array.from(models.values());
}

function normalizeUsageModel(value) {
  const normalized = normalizeModel(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (!lowered || lowered === 'unknown') return null;
  return lowered;
}

function buildAliasRows({ usageModels, pricingModelIds, pricingMeta, pricingSource, effectiveFrom }) {
  const rows = [];
  for (const usageModel of usageModels) {
    if (matchesPricingModel(usageModel, pricingModelIds)) continue;

    const rule = inferVendorRule(usageModel);
    if (!rule) continue;

    const candidate = selectLatestCandidate(pricingMeta, rule);
    if (!candidate) continue;

    rows.push({
      usage_model: usageModel,
      pricing_model: candidate.id,
      pricing_source: pricingSource,
      effective_from: effectiveFrom,
      active: true
    });
  }
  return rows;
}

function matchesPricingModel(usageModel, pricingModelIds) {
  if (!usageModel) return false;
  if (pricingModelIds.has(usageModel)) return true;
  for (const id of pricingModelIds) {
    if (id.endsWith(`/${usageModel}`)) return true;
    if (usageModel.endsWith(`/${id}`)) return true;
  }
  return false;
}

function inferVendorRule(usageModel) {
  if (usageModel.startsWith('claude-')) {
    return {
      vendor: 'anthropic',
      family: inferFamily(usageModel, ['opus', 'sonnet', 'haiku'])
    };
  }
  if (usageModel.startsWith('gpt-')) {
    return {
      vendor: 'openai',
      family: inferFamily(usageModel, ['codex'])
    };
  }
  return null;
}

function inferFamily(usageModel, families) {
  for (const family of families) {
    if (usageModel.includes(family)) return family;
  }
  return null;
}

function selectLatestCandidate(pricingMeta, rule) {
  const candidates = pricingMeta.filter((entry) => {
    const id = String(entry?.id || '').toLowerCase();
    if (!id.startsWith(`${rule.vendor}/`)) return false;
    if (rule.family && !id.includes(rule.family)) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) => {
    if (!best) return current;
    if (current.created !== best.created) return current.created > best.created ? current : best;
    if (current.context_length !== best.context_length) {
      return current.context_length > best.context_length ? current : best;
    }
    return String(current.id).localeCompare(String(best.id)) > 0 ? current : best;
  }, null);
}

function toRateMicrosPerMillion(value) {
  const scaled = scaleDecimal(value, SCALE_MICROS_PER_MILLION);
  if (scaled == null) return null;
  if (scaled < 0n || scaled > MAX_RATE_MICROS_PER_MILLION) return null;
  return Number(scaled);
}

function scaleDecimal(value, scale) {
  if (value == null) return null;
  let str = typeof value === 'string' ? value.trim() : String(value).trim();
  if (!str) return null;
  if (str.startsWith('-')) return null;
  if (str.includes('e') || str.includes('E')) {
    const n = Number(str);
    if (!Number.isFinite(n) || n < 0) return null;
    return BigInt(Math.round(n * Math.pow(10, scale)));
  }

  const parts = str.split('.');
  const whole = parts[0] || '0';
  const frac = parts[1] || '';
  if (!/^[0-9]+$/.test(whole) || (frac && !/^[0-9]+$/.test(frac))) return null;

  const digits = (whole.replace(/^0+(?=\d)/, '') || '0') + frac;
  const fracLen = frac.length;

  if (scale >= fracLen) {
    const zeros = '0'.repeat(scale - fracLen);
    return BigInt(digits + zeros);
  }

  const cut = fracLen - scale;
  const keepLen = digits.length - cut;
  const kept = digits.slice(0, keepLen) || '0';
  const next = digits.slice(keepLen, keepLen + 1);
  let rounded = BigInt(kept);
  if (next && Number(next) >= 5) rounded += 1n;
  return rounded;
}
