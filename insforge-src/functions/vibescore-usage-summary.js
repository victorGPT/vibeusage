// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a timezone-aware date range.

'use strict';

const { handleOptions, json } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam, normalizeSource } = require('../shared/source');
const { getModelParam, normalizeUsageModel, applyUsageModelFilter } = require('../shared/model');
const {
  applyModelIdentity,
  resolveModelIdentity,
  resolveUsageModelsForCanonical,
  normalizeUsageModelKey
} = require('../shared/model-identity');
const { applyCanaryFilter } = require('../shared/canary');
const {
  addDatePartsDays,
  addUtcDays,
  formatDateUTC,
  getUsageMaxDays,
  getUsageTimeZoneContext,
  listDateStrings,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  parseDateParts
} = require('../shared/date');
const { forEachPage } = require('../shared/pagination');
const {
  addRowTotals,
  createTotals,
  fetchRollupRows,
  isRollupEnabled
} = require('../shared/usage-rollup');
const { applyTotalsAndBillable, resolveBillableTotals } = require('../shared/usage-aggregate');
const {
  buildPricingMetadata,
  computeUsageCost,
  formatUsdFromMicros,
  resolvePricingProfile
} = require('../shared/pricing');
const { logSlowQuery, withRequestLogging } = require('../shared/logging');
const { isDebugEnabled, withSlowQueryDebugPayload } = require('../shared/debug');
const {
  buildAliasTimeline,
  extractDateKey,
  fetchAliasRows,
  resolveIdentityAtDate
} = require('../shared/model-alias-timeline');

const DEFAULT_SOURCE = 'codex';
const DEFAULT_MODEL = 'unknown';
const PRICING_BUCKET_SEP = '::';

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
  const hasModelParam = model != null;
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
  let aliasTimeline = null;
  if (hasModelFilter) {
    const aliasRows = await fetchAliasRows({
      edgeClient: auth.edgeClient,
      usageModels,
      effectiveDate: to
    });
    aliasTimeline = buildAliasTimeline({ usageModels, aliasRows });
  }

  let totals = createTotals();
  let sourcesMap = new Map();
  let distinctModels = new Set();
  const distinctUsageModels = new Set();
  const pricingBuckets = hasModelParam ? null : new Map();

  const queryStartMs = Date.now();
  let rowCount = 0;
  let rollupHit = false;
  const rollupEnabled = isRollupEnabled();

  const resetAggregation = () => {
    totals = createTotals();
    sourcesMap = new Map();
    distinctModels = new Set();
    rowCount = 0;
    rollupHit = false;
  };

  const shouldIncludeRow = (row) => {
    if (!hasModelFilter) return true;
    const rawModel = normalizeUsageModel(row?.model);
    const usageKey = normalizeUsageModelKey(rawModel);
    const dateKey = extractDateKey(row?.hour_start || row?.day) || to;
    const identity = resolveIdentityAtDate({
      rawModel,
      usageKey,
      dateKey,
      timeline: aliasTimeline
    });
    const filterIdentity = resolveIdentityAtDate({
      rawModel: canonicalModel,
      usageKey: canonicalModel,
      dateKey,
      timeline: aliasTimeline
    });
    return identity.model_id === filterIdentity.model_id;
  };

  const ingestRow = (row) => {
    if (!shouldIncludeRow(row)) return;
    const sourceKey = normalizeSource(row?.source) || DEFAULT_SOURCE;
    const { billable, hasStoredBillable } = resolveBillableTotals({ row, source: sourceKey });
    applyTotalsAndBillable({ totals, row, billable, hasStoredBillable });
    const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
    applyTotalsAndBillable({ totals: sourceEntry.totals, row, billable, hasStoredBillable });
    const normalizedModel = normalizeUsageModel(row?.model);
    if (normalizedModel && normalizedModel !== 'unknown') {
      distinctModels.add(normalizedModel);
    }
    if (!hasModelParam && pricingBuckets) {
      const usageKey = normalizeUsageModelKey(normalizedModel) || DEFAULT_MODEL;
      const dateKey = extractDateKey(row?.hour_start || row?.day) || to;
      const bucketKey = `${usageKey}${PRICING_BUCKET_SEP}${dateKey}`;
      const bucket = pricingBuckets.get(bucketKey) || createTotals();
      addRowTotals(bucket, row);
      pricingBuckets.set(bucketKey, bucket);
      distinctUsageModels.add(usageKey);
    }
  };

  const sumHourlyRange = async (rangeStartIso, rangeEndIso) => {
    const { error } = await forEachPage({
      createQuery: () => {
        let query = auth.edgeClient.database
          .from('vibescore_tracker_hourly')
          .select(
            'hour_start,source,model,billable_total_tokens,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens'
          )
          .eq('user_id', auth.userId);
        if (source) query = query.eq('source', source);
        if (hasModelFilter) query = applyUsageModelFilter(query, usageModels);
        query = applyCanaryFilter(query, { source, model: canonicalModel });
        return query
          .gte('hour_start', rangeStartIso)
          .lt('hour_start', rangeEndIso)
          .order('hour_start', { ascending: true })
          .order('device_id', { ascending: true })
          .order('source', { ascending: true })
          .order('model', { ascending: true });
      },
      onPage: (rows) => {
        const pageRows = Array.isArray(rows) ? rows : [];
        rowCount += pageRows.length;
        for (const row of pageRows) ingestRow(row);
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
    if (hasModelFilter) query = applyUsageModelFilter(query, usageModels);
    query = applyCanaryFilter(query, { source, model: canonicalModel });
    const { data, error } = await query
      .gte('hour_start', rangeStartIso)
      .lt('hour_start', rangeEndIso)
      .order('hour_start', { ascending: true })
      .limit(1);
    if (error) return { ok: false, error };
    return { ok: true, hasRows: Array.isArray(data) && data.length > 0 };
  };

  const sumRollupRange = async (fromDay, toDay) => {
    let rows = [];
    if (hasModelFilter && Array.isArray(usageModels) && usageModels.length > 0) {
      for (const usageModel of usageModels) {
        const rollupRes = await fetchRollupRows({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          fromDay,
          toDay,
          source,
          model: usageModel
        });
        if (!rollupRes.ok) return { ok: false, error: rollupRes.error };
        rows = rows.concat(Array.isArray(rollupRes.rows) ? rollupRes.rows : []);
      }
    } else {
      const rollupRes = await fetchRollupRows({
        edgeClient: auth.edgeClient,
        userId: auth.userId,
        fromDay,
        toDay,
        source,
        model: canonicalModel || null
      });
      if (!rollupRes.ok) return { ok: false, error: rollupRes.error };
      rows = Array.isArray(rollupRes.rows) ? rollupRes.rows : [];
    }
    rowCount += rows.length;
    rollupHit = true;
    for (const row of rows) ingestRow(row);
    return { ok: true, rowsCount: rows.length };
  };

  const startDayUtc = new Date(Date.UTC(
    startUtc.getUTCFullYear(),
    startUtc.getUTCMonth(),
    startUtc.getUTCDate()
  ));
  const endDayUtc = new Date(Date.UTC(
    endUtc.getUTCFullYear(),
    endUtc.getUTCMonth(),
    endUtc.getUTCDate()
  ));

  const sameUtcDay = startDayUtc.getTime() === endDayUtc.getTime();
  const startIsBoundary = startUtc.getTime() === startDayUtc.getTime();
  const endIsBoundary = endUtc.getTime() === endDayUtc.getTime();

  if (!rollupEnabled) {
    const hourlyRes = await sumHourlyRange(startIso, endIso);
    if (!hourlyRes.ok) {
      const queryDurationMs = Date.now() - queryStartMs;
      return respond({ error: hourlyRes.error.message }, 500, queryDurationMs);
    }
  } else {
    let hourlyError = null;
    let rollupEmptyWithHourly = false;
    if (sameUtcDay) {
      const hourlyRes = await sumHourlyRange(startIso, endIso);
      if (!hourlyRes.ok) hourlyError = hourlyRes.error;
    } else {
      const rollupStartDate = startIsBoundary
        ? startDayUtc
        : addUtcDays(startDayUtc, 1);
      const rollupEndDate = addUtcDays(endDayUtc, -1);

      if (!startIsBoundary) {
        const hourlyRes = await sumHourlyRange(startIso, rollupStartDate.toISOString());
        if (!hourlyRes.ok) hourlyError = hourlyRes.error;
      }

      if (!endIsBoundary && !hourlyError) {
        const hourlyRes = await sumHourlyRange(endDayUtc.toISOString(), endIso);
        if (!hourlyRes.ok) hourlyError = hourlyRes.error;
      }

      if (!hourlyError) {
        if (rollupStartDate.getTime() <= rollupEndDate.getTime()) {
          const rollupRes = await sumRollupRange(
            formatDateUTC(rollupStartDate),
            formatDateUTC(rollupEndDate)
          );
          if (!rollupRes.ok) {
            hourlyError = rollupRes.error;
          } else if (rollupRes.rowsCount === 0) {
            const hourlyCheck = await hasHourlyData(startIso, endIso);
            if (!hourlyCheck.ok) {
              hourlyError = hourlyCheck.error;
            } else if (hourlyCheck.hasRows) {
              rollupEmptyWithHourly = true;
            }
          }
        }
      }
    }

    if (hourlyError || rollupEmptyWithHourly) {
      resetAggregation();
      const fallbackRes = await sumHourlyRange(startIso, endIso);
      if (!fallbackRes.ok) {
        const queryDurationMs = Date.now() - queryStartMs;
        return respond({ error: fallbackRes.error.message }, 500, queryDurationMs);
      }
    }
  }

  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_summary',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: rollupHit
  });

  const identityMap = await resolveModelIdentity({
    edgeClient: auth.edgeClient,
    usageModels: Array.from(distinctModels.values()),
    effectiveDate: to
  });
  let canonicalModels = new Set();
  for (const modelValue of distinctModels.values()) {
    const identity = applyModelIdentity({ rawModel: modelValue, identityMap });
    if (identity.model_id && identity.model_id !== DEFAULT_MODEL) {
      canonicalModels.add(identity.model_id);
    }
  }

  let totalCostMicros = 0n;
  const pricingModes = new Set();
  let pricingProfile = null;

  if (!hasModelParam && pricingBuckets && pricingBuckets.size > 0) {
    const usageModelList = Array.from(distinctUsageModels.values());
    if (usageModelList.length > 0) {
      const aliasRows = await fetchAliasRows({
        edgeClient: auth.edgeClient,
        usageModels: usageModelList,
        effectiveDate: to
      });
      const timeline = buildAliasTimeline({ usageModels: usageModelList, aliasRows });
      const rangeCanonicalModels = new Set();
      const profileCache = new Map();

      const getProfile = async (modelId, dateKey) => {
        const key = `${modelId || ''}${PRICING_BUCKET_SEP}${dateKey || ''}`;
        if (profileCache.has(key)) return profileCache.get(key);
        const profile = await resolvePricingProfile({
          edgeClient: auth.edgeClient,
          model: modelId,
          effectiveDate: dateKey
        });
        profileCache.set(key, profile);
        return profile;
      };

      for (const [bucketKey, bucketTotals] of pricingBuckets.entries()) {
        const sepIndex = bucketKey.indexOf(PRICING_BUCKET_SEP);
        const usageKey =
          sepIndex === -1 ? bucketKey : bucketKey.slice(0, sepIndex);
        const dateKey =
          sepIndex === -1 ? to : bucketKey.slice(sepIndex + PRICING_BUCKET_SEP.length);
        const identity = resolveIdentityAtDate({
          usageKey,
          dateKey,
          timeline
        });
        if (identity.model_id && identity.model_id !== DEFAULT_MODEL) {
          rangeCanonicalModels.add(identity.model_id);
        }
        const profile = await getProfile(identity.model_id, dateKey);
        const cost = computeUsageCost(bucketTotals, profile);
        totalCostMicros += cost.cost_micros;
        pricingModes.add(cost.pricing_mode);
      }

      canonicalModels = rangeCanonicalModels;
    }
  }

  const impliedModelId =
    canonicalModel || (canonicalModels.size === 1 ? Array.from(canonicalModels)[0] : null);
  const impliedModelDisplay = resolveDisplayName(identityMap, impliedModelId);

  if (!pricingProfile) {
    pricingProfile = await resolvePricingProfile({
      edgeClient: auth.edgeClient,
      model: impliedModelId,
      effectiveDate: to
    });
  }

  if (pricingModes.size === 0) {
    for (const entry of sourcesMap.values()) {
      const sourceCost = computeUsageCost(entry.totals, pricingProfile);
      totalCostMicros += sourceCost.cost_micros;
      pricingModes.add(sourceCost.pricing_mode);
    }
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
    billable_total_tokens: totals.billable_total_tokens.toString(),
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
      model_id: hasModelParam ? impliedModelId || null : null,
      model: hasModelParam && impliedModelId ? impliedModelDisplay : null,
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
