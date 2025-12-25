'use strict';

const { toBigInt } = require('./numbers');
const { normalizeModel } = require('./model');

const TOKENS_PER_MILLION = 1000000n;
const MICROS_PER_DOLLAR = 1000000n;

const DEFAULT_PROFILE = {
  model: 'gpt-5.2-codex',
  source: 'openrouter',
  effective_from: '2025-12-23',
  rates_micro_per_million: {
    input: 1750000,
    cached_input: 175000,
    output: 14000000,
    reasoning_output: 14000000
  }
};

function getDefaultPricingProfile() {
  return {
    model: DEFAULT_PROFILE.model,
    source: DEFAULT_PROFILE.source,
    effective_from: DEFAULT_PROFILE.effective_from,
    rates_micro_per_million: { ...DEFAULT_PROFILE.rates_micro_per_million }
  };
}

function getEnvValue(key) {
  try {
    if (typeof Deno !== 'undefined' && Deno?.env?.get) {
      return Deno.env.get(key);
    }
  } catch (_) {
    // Ignore Deno env lookup failures.
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return null;
}

function normalizeSource(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeModelValue(value) {
  const normalized = normalizeModel(value);
  if (!normalized || normalized.toLowerCase() === 'unknown') return null;
  return normalized;
}

function getPricingDefaults() {
  return {
    model: normalizeModelValue(getEnvValue('VIBESCORE_PRICING_MODEL')) || DEFAULT_PROFILE.model,
    source: normalizeSource(getEnvValue('VIBESCORE_PRICING_SOURCE')) || DEFAULT_PROFILE.source
  };
}

async function resolvePricingProfile({ edgeClient, effectiveDate, model, source } = {}) {
  const fallback = getDefaultPricingProfile();
  if (!edgeClient || !edgeClient.database) return fallback;

  const defaults = getPricingDefaults();
  const requestedModel = normalizeModelValue(model) || defaults.model;
  const requestedModelLower = requestedModel ? requestedModel.toLowerCase() : null;
  const requestedSource = normalizeSource(source) || defaults.source;

  const dateKey =
    typeof effectiveDate === 'string' && effectiveDate.trim()
      ? effectiveDate.trim()
      : new Date().toISOString().slice(0, 10);

  try {
    let resolvedModel = requestedModel;

    if (requestedModelLower) {
      const { data: aliasRows, error: aliasError } = await edgeClient.database
        .from('vibescore_pricing_model_aliases')
        .select('pricing_model,effective_from')
        .eq('active', true)
        .eq('pricing_source', requestedSource)
        .eq('usage_model', requestedModelLower)
        .lte('effective_from', dateKey)
        .order('effective_from', { ascending: false })
        .limit(1);

      if (!aliasError && Array.isArray(aliasRows) && aliasRows.length > 0) {
        const aliasModel = normalizeModelValue(aliasRows[0]?.pricing_model);
        if (aliasModel) resolvedModel = aliasModel;
      }
    }

    let query = edgeClient.database
      .from('vibescore_pricing_profiles')
      .select(
        [
          'model',
          'source',
          'effective_from',
          'input_rate_micro_per_million',
          'cached_input_rate_micro_per_million',
          'output_rate_micro_per_million',
          'reasoning_output_rate_micro_per_million'
        ].join(',')
      )
      .eq('active', true)
      .eq('source', requestedSource)
      .lte('effective_from', dateKey);

    if (resolvedModel) {
      if (resolvedModel.includes('/')) {
        query = query.eq('model', resolvedModel);
      } else {
        query = query.or(`model.eq.${resolvedModel},model.like.%/${resolvedModel}`);
      }
    }

    const { data, error } = await query.order('effective_from', { ascending: false }).limit(1);

    if (error || !Array.isArray(data) || data.length === 0) return fallback;

    const row = data[0];
    return normalizeProfile({
      model: row?.model,
      source: row?.source,
      effective_from: row?.effective_from,
      rates_micro_per_million: {
        input: row?.input_rate_micro_per_million,
        cached_input: row?.cached_input_rate_micro_per_million,
        output: row?.output_rate_micro_per_million,
        reasoning_output: row?.reasoning_output_rate_micro_per_million
      }
    });
  } catch (_err) {
    return fallback;
  }
}

function computeUsageCost(totals, profile) {
  const pricing = normalizeProfile(profile || DEFAULT_PROFILE);
  const input = toBigInt(totals?.input_tokens);
  const cached = toBigInt(totals?.cached_input_tokens);
  const output = toBigInt(totals?.output_tokens);
  const reasoning = toBigInt(totals?.reasoning_output_tokens);
  const total = toBigInt(totals?.total_tokens);

  const sumAdd = input + cached + output + reasoning;
  const sumOverlap = input + output;
  const canOverlap = cached <= input && reasoning <= output;

  let pricingMode = 'add';
  if (total > 0n && canOverlap) {
    const diffOverlap = absBigInt(total - sumOverlap);
    const diffAdd = absBigInt(total - sumAdd);
    if (diffOverlap <= diffAdd) pricingMode = 'overlap';
  }

  let costMicros = 0n;
  if (pricingMode === 'overlap') {
    const billableInput = input > cached ? input - cached : 0n;
    costMicros += mulRate(billableInput, pricing.rates_micro_per_million.input);
    costMicros += mulRate(cached, pricing.rates_micro_per_million.cached_input);
    costMicros += mulRate(output, pricing.rates_micro_per_million.output);
  } else {
    costMicros += mulRate(input, pricing.rates_micro_per_million.input);
    costMicros += mulRate(cached, pricing.rates_micro_per_million.cached_input);
    costMicros += mulRate(output, pricing.rates_micro_per_million.output);
    costMicros += mulRate(reasoning, pricing.rates_micro_per_million.reasoning_output);
  }

  return { cost_micros: costMicros, pricing_mode: pricingMode, profile: pricing };
}

function buildPricingMetadata({ profile, pricingMode }) {
  return {
    model: profile.model,
    pricing_mode: pricingMode,
    source: profile.source,
    effective_from: profile.effective_from,
    rates_per_million_usd: {
      input: formatUsdFromMicros(profile.rates_micro_per_million.input),
      cached_input: formatUsdFromMicros(profile.rates_micro_per_million.cached_input),
      output: formatUsdFromMicros(profile.rates_micro_per_million.output),
      reasoning_output: formatUsdFromMicros(profile.rates_micro_per_million.reasoning_output)
    }
  };
}

function formatUsdFromMicros(micros) {
  const value = normalizeBigInt(micros);
  const dollars = value / MICROS_PER_DOLLAR;
  const remainder = value % MICROS_PER_DOLLAR;
  return `${dollars.toString()}.${remainder.toString().padStart(6, '0')}`;
}

function mulRate(tokens, rateMicrosPerMillion) {
  const rate = BigInt(rateMicrosPerMillion || 0);
  if (tokens <= 0n || rate <= 0n) return 0n;
  return (tokens * rate) / TOKENS_PER_MILLION;
}

function absBigInt(value) {
  return value < 0n ? -value : value;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return getDefaultPricingProfile();
  return {
    model: typeof profile.model === 'string' ? profile.model : DEFAULT_PROFILE.model,
    source: typeof profile.source === 'string' ? profile.source : DEFAULT_PROFILE.source,
    effective_from:
      typeof profile.effective_from === 'string'
        ? profile.effective_from
        : DEFAULT_PROFILE.effective_from,
    rates_micro_per_million: {
      input: toPositiveInt(profile?.rates_micro_per_million?.input),
      cached_input: toPositiveInt(profile?.rates_micro_per_million?.cached_input),
      output: toPositiveInt(profile?.rates_micro_per_million?.output),
      reasoning_output: toPositiveInt(profile?.rates_micro_per_million?.reasoning_output)
    }
  };
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value >= 0n ? value : 0n;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return BigInt(Math.floor(n));
  return 0n;
}

module.exports = {
  buildPricingMetadata,
  computeUsageCost,
  formatUsdFromMicros,
  getDefaultPricingProfile,
  resolvePricingProfile
};
