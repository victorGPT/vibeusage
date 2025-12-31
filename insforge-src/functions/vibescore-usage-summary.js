// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a timezone-aware date range.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam, normalizeSource } = require('../shared/source');
const { getModelParam, normalizeModel } = require('../shared/model');
const { applyCanaryFilter } = require('../shared/canary');
const {
  addDatePartsDays,
  getUsageMaxDays,
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
const { logSlowQuery, withRequestLogging } = require('../shared/logging');

const DEFAULT_SOURCE = 'codex';

module.exports = withRequestLogging('vibescore-usage-summary', async function(request, logger) {
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
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return json({ error: modelResult.error }, 400);
  const model = modelResult.model;
  const { from, to } = normalizeDateRangeLocal(
    url.searchParams.get('from'),
    url.searchParams.get('to'),
    tzContext
  );

  const dayKeys = listDateStrings(from, to);
  const maxDays = getUsageMaxDays();
  if (dayKeys.length > maxDays) {
    return json({ error: `Date range too large (max ${maxDays} days)` }, 400);
  }

  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) return json({ error: 'Invalid date range' }, 400);

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(endParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  let totalTokens = 0n;
  let inputTokens = 0n;
  let cachedInputTokens = 0n;
  let outputTokens = 0n;
  let reasoningOutputTokens = 0n;
  const distinctModels = new Set();
  const sourcesMap = new Map();

  const queryStartMs = Date.now();
  let rowCount = 0;
  const { error } = await forEachPage({
    createQuery: () => {
      let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select(
          'hour_start,source,model,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens'
        )
        .eq('user_id', auth.userId);
      if (source) query = query.eq('source', source);
      if (model) query = query.eq('model', model);
      query = applyCanaryFilter(query, { source, model });
      return query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour_start', { ascending: true });
    },
    onPage: (rows) => {
      const pageRows = Array.isArray(rows) ? rows : [];
      rowCount += pageRows.length;
      for (const row of pageRows) {
        totalTokens += toBigInt(row?.total_tokens);
        inputTokens += toBigInt(row?.input_tokens);
        cachedInputTokens += toBigInt(row?.cached_input_tokens);
        outputTokens += toBigInt(row?.output_tokens);
        reasoningOutputTokens += toBigInt(row?.reasoning_output_tokens);
        const sourceKey = normalizeSource(row?.source) || DEFAULT_SOURCE;
        const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
        addTotals(sourceEntry.totals, row);
        const normalizedModel = normalizeModel(row?.model);
        if (normalizedModel && normalizedModel.toLowerCase() !== 'unknown') {
          distinctModels.add(normalizedModel);
        }
      }
    }
  });
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_summary',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: model || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
  });

  if (error) return json({ error: error.message }, 500);

  const impliedModel =
    model || (distinctModels.size === 1 ? Array.from(distinctModels)[0] : null);
  const pricingProfile = await resolvePricingProfile({
    edgeClient: auth.edgeClient,
    model: impliedModel,
    effectiveDate: to
  });
  let totalCostMicros = 0n;
  const pricingModes = new Set();
  for (const entry of sourcesMap.values()) {
    const sourceCost = computeUsageCost(entry.totals, pricingProfile);
    totalCostMicros += sourceCost.cost_micros;
    pricingModes.add(sourceCost.pricing_mode);
  }

  const overallCost = computeUsageCost(
    {
      total_tokens: totalTokens,
      input_tokens: inputTokens,
      cached_input_tokens: cachedInputTokens,
      output_tokens: outputTokens,
      reasoning_output_tokens: reasoningOutputTokens
    },
    pricingProfile
  );

  let summaryPricingMode = overallCost.pricing_mode;
  if (pricingModes.size === 1) {
    summaryPricingMode = Array.from(pricingModes)[0];
  } else if (pricingModes.size > 1) {
    summaryPricingMode = 'mixed';
  }

  const totals = {
    total_tokens: totalTokens.toString(),
    input_tokens: inputTokens.toString(),
    cached_input_tokens: cachedInputTokens.toString(),
    output_tokens: outputTokens.toString(),
    reasoning_output_tokens: reasoningOutputTokens.toString(),
    total_cost_usd: formatUsdFromMicros(totalCostMicros)
  };

  return json(
    {
      from,
      to,
      days: dayKeys.length,
      totals,
      pricing: buildPricingMetadata({
        profile: overallCost.profile,
        pricingMode: summaryPricingMode
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
    totals: createTotals()
  };
  map.set(source, entry);
  return entry;
}
