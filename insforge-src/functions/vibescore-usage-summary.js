// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a timezone-aware date range.

'use strict';

const { handleOptions, json } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam, normalizeSource } = require('../shared/source');
const { getModelParam, normalizeModel } = require('../shared/model');
const {
  addDatePartsDays,
  getUsageMaxDays,
  getUsageTimeZoneContext,
  listDateStrings,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  parseDateParts
} = require('../shared/date');
const {
  addRowTotals,
  createTotals
} = require('../shared/usage-rollup');
const {
  buildPricingMetadata,
  computeUsageCost,
  formatUsdFromMicros,
  resolvePricingProfile
} = require('../shared/pricing');
const { logSlowQuery, withRequestLogging } = require('../shared/logging');
const { isDebugEnabled, withSlowQueryDebugPayload } = require('../shared/debug');

const DEFAULT_SOURCE = 'codex';

module.exports = withRequestLogging('vibescore-usage-summary', async function(request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const url = new URL(request.url);
  const debugEnabled = isDebugEnabled(url);
  const respond = (body, status, durationMs) => json(
    debugEnabled ? withSlowQueryDebugPayload(body, { logger, durationMs, status }) : body,
    status
  );

  if (request.method !== 'GET') return respond({ error: 'Method not allowed' }, 405, 0);

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return respond({ error: 'Missing bearer token' }, 401, 0);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (!auth.ok) return respond({ error: 'Unauthorized' }, 401, 0);

  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;
  const { from, to } = normalizeDateRangeLocal(
    url.searchParams.get('from'),
    url.searchParams.get('to'),
    tzContext
  );

  const dayKeys = listDateStrings(from, to);
  const maxDays = getUsageMaxDays();
  if (dayKeys.length > maxDays) {
    return respond({ error: `Date range too large (max ${maxDays} days)` }, 400, 0);
  }

  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) return respond({ error: 'Invalid date range' }, 400, 0);

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(endParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  let totals = createTotals();
  let sourcesMap = new Map();
  let distinctModels = new Set();

  const queryStartMs = Date.now();
  // NOTE: Insforge edge runtime does not support database.rpc yet; keep this path gated for future enablement.
  const rpcResult = await auth.edgeClient.database.rpc('vibescore_usage_summary_agg', {
    p_from: startIso,
    p_to: endIso,
    p_source: source,
    p_model: model
  });
  const queryDurationMs = Date.now() - queryStartMs;

  if (rpcResult.error) {
    const rpcError = {
      message: rpcResult.error.message || 'RPC failed',
      code: rpcResult.error.code ?? null,
      details: rpcResult.error.details ?? null,
      hint: rpcResult.error.hint ?? null
    };
    if (logger && typeof logger.log === 'function') {
      logger.log({
        stage: 'rpc_error',
        status: 500,
        rpc: 'vibescore_usage_summary_agg',
        error_message: rpcError.message,
        error_code: rpcError.code,
        error_details: rpcError.details,
        error_hint: rpcError.hint,
        from,
        to,
        source: source || null,
        model: model || null,
        tz: tzContext?.timeZone || null,
        tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
      });
    }
    const responseBody = { error: rpcError.message };
    if (debugEnabled) {
      responseBody.rpc_error = rpcError;
    }
    return respond(responseBody, 500, queryDurationMs);
  }

  const rows = Array.isArray(rpcResult.data) ? rpcResult.data : [];
  const groupCount = rows.length;
  const rowCount = getRowsScannedTotal(rows);

  for (const row of rows) {
    addRowTotals(totals, row);
    const sourceKey = normalizeSource(row?.source) || DEFAULT_SOURCE;
    const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
    addRowTotals(sourceEntry.totals, row);
    const normalizedModel = normalizeModel(row?.model);
    if (normalizedModel && normalizedModel.toLowerCase() !== 'unknown') {
      distinctModels.add(normalizedModel);
    }
  }
  logSlowQuery(logger, {
    query_label: 'usage_summary',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    rows_out: groupCount,
    group_count: groupCount,
    range_days: dayKeys.length,
    source: source || null,
    model: model || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
  });

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
      total_tokens: totals.total_tokens,
      input_tokens: totals.input_tokens,
      cached_input_tokens: totals.cached_input_tokens,
      output_tokens: totals.output_tokens,
      reasoning_output_tokens: totals.reasoning_output_tokens
    },
    pricingProfile
  );

  let summaryPricingMode = overallCost.pricing_mode;
  if (pricingModes.size === 1) {
    summaryPricingMode = Array.from(pricingModes)[0];
  } else if (pricingModes.size > 1) {
    summaryPricingMode = 'mixed';
  }

  const totalsPayload = {
    total_tokens: totals.total_tokens.toString(),
    input_tokens: totals.input_tokens.toString(),
    cached_input_tokens: totals.cached_input_tokens.toString(),
    output_tokens: totals.output_tokens.toString(),
    reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
    total_cost_usd: formatUsdFromMicros(totalCostMicros)
  };

  return respond(
    {
      from,
      to,
      days: dayKeys.length,
      totals: totalsPayload,
      pricing: buildPricingMetadata({
        profile: overallCost.profile,
        pricingMode: summaryPricingMode
      })
    },
    200,
    queryDurationMs
  );
});

function getRowsScannedTotal(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const raw = rows[0]?.rows_scanned_total ?? rows[0]?.rows_scanned;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
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
