// Edge function: vibescore-usage-model-breakdown
// Returns per-source, per-model usage aggregates for the authenticated user over a date range.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam, normalizeSource } = require('../shared/source');
const { normalizeModel } = require('../shared/model');
const {
  addDatePartsDays,
  getUsageTimeZoneContext,
  listDateStrings,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  parseDateParts
} = require('../shared/date');
const { toBigInt } = require('../shared/numbers');
const { forEachPage } = require('../shared/pagination');
const {
  buildPricingMetadata,
  computeUsageCost,
  formatUsdFromMicros,
  resolvePricingProfile
} = require('../shared/pricing');
const { withRequestLogging } = require('../shared/logging');

const DEFAULT_SOURCE = 'codex';
const DEFAULT_MODEL = 'unknown';

module.exports = withRequestLogging('vibescore-usage-model-breakdown', async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return json({ error: sourceResult.error }, 400);
  const sourceFilter = sourceResult.source;

  const { from, to } = normalizeDateRangeLocal(
    url.searchParams.get('from'),
    url.searchParams.get('to'),
    tzContext
  );

  const dayKeys = listDateStrings(from, to);

  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) return json({ error: 'Invalid date range' }, 400);

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(endParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const sourcesMap = new Map();
  const distinctModels = new Set();

  const { error } = await forEachPage({
    createQuery: () => {
      let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select(
          'source,model,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens'
        )
        .eq('user_id', auth.userId);
      if (sourceFilter) query = query.eq('source', sourceFilter);
      return query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour_start', { ascending: true });
    },
    onPage: (rows) => {
      for (const row of rows || []) {
        const source = normalizeSource(row?.source) || DEFAULT_SOURCE;
        const model = normalizeModel(row?.model) || DEFAULT_MODEL;
        const entry = getSourceEntry(sourcesMap, source);
        const modelEntry = getModelEntry(entry.models, model);
        addTotals(entry.totals, row);
        addTotals(modelEntry.totals, row);
        if (model !== DEFAULT_MODEL) {
          distinctModels.add(model);
        }
      }
    }
  });

  if (error) return json({ error: error.message }, 500);

  const pricingModel = distinctModels.size === 1 ? Array.from(distinctModels)[0] : null;
  const pricingProfile = await resolvePricingProfile({
    edgeClient: auth.edgeClient,
    model: pricingModel,
    effectiveDate: to
  });
  const grandTotals = createTotals();

  const sources = Array.from(sourcesMap.values())
    .map((entry) => {
      addTotals(grandTotals, entry.totals);
      const models = Array.from(entry.models.values())
        .map((modelEntry) => formatTotals(modelEntry, pricingProfile))
        .sort(compareTotals);
      const totals = formatTotals(entry, pricingProfile).totals;
      return {
        source: entry.source,
        totals,
        models
      };
    })
    .sort((a, b) => a.source.localeCompare(b.source));

  const overallCost = computeUsageCost(grandTotals, pricingProfile);

  return json(
    {
      from,
      to,
      days: dayKeys.length,
      sources,
      pricing: buildPricingMetadata({
        profile: overallCost.profile,
        pricingMode: overallCost.pricing_mode
      })
    },
    200
  );
});

function createTotals() {
  return {
    total_tokens: 0n,
    input_tokens: 0n,
    cached_input_tokens: 0n,
    output_tokens: 0n,
    reasoning_output_tokens: 0n
  };
}

function addTotals(target, row) {
  if (!target || !row) return;
  target.total_tokens = toBigInt(target.total_tokens) + toBigInt(row.total_tokens);
  target.input_tokens = toBigInt(target.input_tokens) + toBigInt(row.input_tokens);
  target.cached_input_tokens =
    toBigInt(target.cached_input_tokens) + toBigInt(row.cached_input_tokens);
  target.output_tokens = toBigInt(target.output_tokens) + toBigInt(row.output_tokens);
  target.reasoning_output_tokens =
    toBigInt(target.reasoning_output_tokens) + toBigInt(row.reasoning_output_tokens);
}

function getSourceEntry(map, source) {
  if (map.has(source)) return map.get(source);
  const entry = {
    source,
    totals: createTotals(),
    models: new Map()
  };
  map.set(source, entry);
  return entry;
}

function getModelEntry(map, model) {
  if (map.has(model)) return map.get(model);
  const entry = {
    model,
    totals: createTotals()
  };
  map.set(model, entry);
  return entry;
}

function formatTotals(entry, pricingProfile) {
  const totals = entry.totals;
  const cost = computeUsageCost(totals, pricingProfile);
  return {
    ...entry,
    totals: {
      total_tokens: totals.total_tokens.toString(),
      input_tokens: totals.input_tokens.toString(),
      cached_input_tokens: totals.cached_input_tokens.toString(),
      output_tokens: totals.output_tokens.toString(),
      reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
      total_cost_usd: formatUsdFromMicros(cost.cost_micros)
    }
  };
}

function compareTotals(a, b) {
  const aTotal = toBigInt(a?.totals?.total_tokens);
  const bTotal = toBigInt(b?.totals?.total_tokens);
  if (aTotal === bTotal) return String(a?.model || '').localeCompare(String(b?.model || ''));
  return aTotal > bTotal ? -1 : 1;
}
