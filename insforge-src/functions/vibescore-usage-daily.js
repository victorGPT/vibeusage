// Edge function: vibescore-usage-daily
// Returns daily token usage aggregates for the authenticated user (timezone-aware).

'use strict';

const { handleOptions, json } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam, normalizeSource } = require('../shared/source');
const { getModelParam, normalizeModel } = require('../shared/model');
const {
  applyModelIdentity,
  resolveModelIdentity,
  resolveUsageModelsForCanonical
} = require('../shared/model-identity');
const { applyCanaryFilter } = require('../shared/canary');
const {
  addDatePartsDays,
  formatLocalDateKey,
  getUsageMaxDays,
  getUsageTimeZoneContext,
  isUtcTimeZone,
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
const {
  addRowTotals,
  createTotals,
  fetchRollupRows,
  isRollupEnabled
} = require('../shared/usage-rollup');
const { logSlowQuery, withRequestLogging } = require('../shared/logging');
const { isDebugEnabled, withSlowQueryDebugPayload } = require('../shared/debug');

const DEFAULT_MODEL = 'unknown';

module.exports = withRequestLogging('vibescore-usage-daily', async function(request, logger) {
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
  const modelFilter = await resolveUsageModelsForCanonical({
    edgeClient: auth.edgeClient,
    canonicalModel: model,
    effectiveDate: to
  });
  const canonicalModel = modelFilter.canonical;
  const usageModels = modelFilter.usageModels;
  const hasModelFilter = Array.isArray(usageModels) && usageModels.length > 0;

  const buckets = new Map(
    dayKeys.map((day) => [
      day,
      {
        total: 0n,
        input: 0n,
        cached: 0n,
        output: 0n,
        reasoning: 0n
      }
    ])
  );

  let totals = createTotals();
  let sourcesMap = new Map();
  let distinctModels = new Set();

  const resetAggregation = () => {
    totals = createTotals();
    sourcesMap = new Map();
    distinctModels = new Set();
    rowCount = 0;
    rollupHit = false;
  };

  const ingestRow = (row) => {
    addRowTotals(totals, row);
    const sourceKey = normalizeSource(row?.source) || 'codex';
    const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
    addRowTotals(sourceEntry.totals, row);
    const normalizedModel = normalizeModel(row?.model);
    if (normalizedModel && normalizedModel.toLowerCase() !== 'unknown') {
      distinctModels.add(normalizedModel);
    }
  };

  const queryStartMs = Date.now();
  let rowCount = 0;
  let rollupHit = false;
  let hourlyError = null;
  const rollupEnabled = isRollupEnabled();

  const sumHourlyRange = async () => {
    const { error } = await forEachPage({
      createQuery: () => {
        let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select('hour_start,source,model,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
        .eq('user_id', auth.userId);
      if (source) query = query.eq('source', source);
      if (hasModelFilter) query = query.in('model', usageModels);
      query = applyCanaryFilter(query, { source, model: canonicalModel });
      return query
        .gte('hour_start', startIso)
        .lt('hour_start', endIso)
          .order('hour_start', { ascending: true })
          .order('device_id', { ascending: true })
          .order('source', { ascending: true })
          .order('model', { ascending: true });
      },
      onPage: (rows) => {
        const pageRows = Array.isArray(rows) ? rows : [];
        rowCount += pageRows.length;
        for (const row of pageRows) {
          const ts = row?.hour_start;
          if (!ts) continue;
          const dt = new Date(ts);
          if (!Number.isFinite(dt.getTime())) continue;
          const day = formatLocalDateKey(dt, tzContext);
          const bucket = buckets.get(day);
          if (!bucket) continue;
          bucket.total += toBigInt(row?.total_tokens);
          bucket.input += toBigInt(row?.input_tokens);
          bucket.cached += toBigInt(row?.cached_input_tokens);
          bucket.output += toBigInt(row?.output_tokens);
          bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
          ingestRow(row);
        }
      }
    });
    if (error) return { ok: false, error };
    return { ok: true };
  };

  const hasHourlyData = async (rangeStartIso, rangeEndIso) => {
    let query = auth.edgeClient.database
      .from('vibescore_tracker_hourly')
      .select('hour_start')
      .eq('user_id', auth.userId);
    if (source) query = query.eq('source', source);
    if (hasModelFilter) query = query.in('model', usageModels);
    query = applyCanaryFilter(query, { source, model: canonicalModel });
    const { data, error } = await query
      .gte('hour_start', rangeStartIso)
      .lt('hour_start', rangeEndIso)
      .order('hour_start', { ascending: true })
      .limit(1);
    if (error) return { ok: false, error };
    return { ok: true, hasRows: Array.isArray(data) && data.length > 0 };
  };

  if (rollupEnabled && isUtcTimeZone(tzContext)) {
    const rollupRes = await fetchRollupRows({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      fromDay: from,
      toDay: to,
      source,
      model: canonicalModel || null
    });
    if (rollupRes.ok) {
      const rows = Array.isArray(rollupRes.rows) ? rollupRes.rows : [];
      rowCount += rows.length;
      rollupHit = true;
      for (const row of rows) {
        const day = row?.day;
        const bucket = buckets.get(day);
        if (!bucket) continue;
        bucket.total += toBigInt(row?.total_tokens);
        bucket.input += toBigInt(row?.input_tokens);
        bucket.cached += toBigInt(row?.cached_input_tokens);
        bucket.output += toBigInt(row?.output_tokens);
        bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
        ingestRow(row);
      }

      if (rows.length === 0) {
        const hourlyCheck = await hasHourlyData(startIso, endIso);
        if (!hourlyCheck.ok) {
          hourlyError = hourlyCheck.error;
        } else if (hourlyCheck.hasRows) {
          resetAggregation();
          const hourlyRes = await sumHourlyRange();
          if (!hourlyRes.ok) hourlyError = hourlyRes.error;
        }
      }
    } else {
      resetAggregation();
      const hourlyRes = await sumHourlyRange();
      if (!hourlyRes.ok) hourlyError = hourlyRes.error;
    }
  } else {
    const hourlyRes = await sumHourlyRange();
    if (!hourlyRes.ok) hourlyError = hourlyRes.error;
  }

  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_daily',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: rollupHit
  });

  if (hourlyError) return respond({ error: hourlyError.message }, 500, queryDurationMs);

  const identityMap = await resolveModelIdentity({
    edgeClient: auth.edgeClient,
    usageModels: Array.from(distinctModels.values()),
    effectiveDate: to
  });
  const canonicalModels = new Set();
  for (const modelValue of distinctModels.values()) {
    const identity = applyModelIdentity({ rawModel: modelValue, identityMap });
    if (identity.model_id && identity.model_id !== DEFAULT_MODEL) {
      canonicalModels.add(identity.model_id);
    }
  }

  const rows = dayKeys.map((day) => {
    const bucket = buckets.get(day);
    return {
      day,
      total_tokens: bucket.total.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString()
    };
  });

  const impliedModelId =
    canonicalModel || (canonicalModels.size === 1 ? Array.from(canonicalModels)[0] : null);
  const impliedModelDisplay = resolveDisplayName(identityMap, impliedModelId);
  const hasModelParam = model != null;
  const pricingProfile = await resolvePricingProfile({
    edgeClient: auth.edgeClient,
    model: impliedModelId,
    effectiveDate: to
  });
  let totalCostMicros = 0n;
  const pricingModes = new Set();
  for (const entry of sourcesMap.values()) {
    const sourceCost = computeUsageCost(entry.totals, pricingProfile);
    totalCostMicros += sourceCost.cost_micros;
    pricingModes.add(sourceCost.pricing_mode);
  }

  const overallCost = computeUsageCost(totals, pricingProfile);

  let summaryPricingMode = overallCost.pricing_mode;
  if (pricingModes.size === 1) {
    summaryPricingMode = Array.from(pricingModes)[0];
  } else if (pricingModes.size > 1) {
    summaryPricingMode = 'mixed';
  }

  const summary = {
    totals: {
      total_tokens: totals.total_tokens.toString(),
      input_tokens: totals.input_tokens.toString(),
      cached_input_tokens: totals.cached_input_tokens.toString(),
      output_tokens: totals.output_tokens.toString(),
      reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
      total_cost_usd: formatUsdFromMicros(totalCostMicros)
    },
    pricing: buildPricingMetadata({
      profile: overallCost.profile,
      pricingMode: summaryPricingMode
    })
  };

  return respond(
    {
      from,
      to,
      model_id: hasModelParam ? impliedModelId || null : null,
      model: hasModelParam && impliedModelId ? impliedModelDisplay : null,
      data: rows,
      summary
    },
    200,
    queryDurationMs
  );
});

function getSourceEntry(map, source) {
  if (map.has(source)) return map.get(source);
  const entry = {
    source,
    totals: createTotals()
  };
  map.set(source, entry);
  return entry;
}

function resolveDisplayName(identityMap, modelId) {
  if (!modelId || !identityMap || typeof identityMap.values !== 'function') return modelId || null;
  for (const entry of identityMap.values()) {
    if (entry?.model_id === modelId && entry?.model) return entry.model;
  }
  return modelId;
}
