// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a timezone-aware date range.

'use strict';

const { handleOptions, json } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam, normalizeSource } = require('../shared/source');
const { getModelParam, normalizeModel } = require('../shared/model');
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
  fetchRollupRows
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
  let rowCount = 0;
  let rollupHit = false;

  const resetAggregation = () => {
    totals = createTotals();
    sourcesMap = new Map();
    distinctModels = new Set();
    rowCount = 0;
    rollupHit = false;
  };

  const ingestRow = (row) => {
    addRowTotals(totals, row);
    const sourceKey = normalizeSource(row?.source) || DEFAULT_SOURCE;
    const sourceEntry = getSourceEntry(sourcesMap, sourceKey);
    addRowTotals(sourceEntry.totals, row);
    const normalizedModel = normalizeModel(row?.model);
    if (normalizedModel && normalizedModel.toLowerCase() !== 'unknown') {
      distinctModels.add(normalizedModel);
    }
  };

  const sumHourlyRange = async (rangeStartIso, rangeEndIso) => {
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
    if (model) query = query.eq('model', model);
    query = applyCanaryFilter(query, { source, model });
    const { data, error } = await query
      .gte('hour_start', rangeStartIso)
      .lt('hour_start', rangeEndIso)
      .order('hour_start', { ascending: true })
      .limit(1);
    if (error) return { ok: false, error };
    return { ok: true, hasRows: Array.isArray(data) && data.length > 0 };
  };

  const countRollupDays = async (fromDay, toDay) => {
    let query = auth.edgeClient.database
      .from('vibescore_tracker_daily_rollup')
      .select('day')
      .eq('user_id', auth.userId)
      .gte('day', fromDay)
      .lte('day', toDay);
    if (source) query = query.eq('source', source);
    if (model) query = query.eq('model', model);
    query = applyCanaryFilter(query, { source, model });
    const { data, error } = await query.order('day', { ascending: true });
    if (error) return { ok: false, error };
    const daySet = new Set();
    for (const row of Array.isArray(data) ? data : []) {
      if (row?.day) daySet.add(row.day);
    }
    return { ok: true, uniqueDays: daySet.size };
  };

  const sumRollupRange = async (fromDay, toDay) => {
    const rollupRes = await fetchRollupRows({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      fromDay,
      toDay,
      source,
      model
    });
    if (!rollupRes.ok) return { ok: false, error: rollupRes.error };
    const rows = Array.isArray(rollupRes.rows) ? rollupRes.rows : [];
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

  let hourlyError = null;
  let rollupEmptyWithHourly = false;
  let rollupPartialWithHourly = false;
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
        } else {
          const expectedDays = rollupEndDate.getTime() >= rollupStartDate.getTime()
            ? Math.floor((rollupEndDate.getTime() - rollupStartDate.getTime()) / 86400000) + 1
            : 0;
          if (rollupRes.rowsCount === 0 && expectedDays > 0) {
            const hourlyCheck = await hasHourlyData(startIso, endIso);
            if (!hourlyCheck.ok) {
              hourlyError = hourlyCheck.error;
            } else if (hourlyCheck.hasRows) {
              rollupEmptyWithHourly = true;
            }
          } else if (expectedDays > 0) {
            const rollupCount = await countRollupDays(
              formatDateUTC(rollupStartDate),
              formatDateUTC(rollupEndDate)
            );
            if (!rollupCount.ok) {
              hourlyError = rollupCount.error;
            } else if (rollupCount.uniqueDays < expectedDays) {
              const hourlyCheck = await hasHourlyData(startIso, endIso);
              if (!hourlyCheck.ok) {
                hourlyError = hourlyCheck.error;
              } else if (hourlyCheck.hasRows) {
                rollupPartialWithHourly = true;
              }
            }
          }
        }
      }
    }
  }

  if (hourlyError || rollupEmptyWithHourly || rollupPartialWithHourly) {
    resetAggregation();
    const fallbackRes = await sumHourlyRange(startIso, endIso);
    if (!fallbackRes.ok) {
      const queryDurationMs = Date.now() - queryStartMs;
      return respond({ error: fallbackRes.error.message }, 500, queryDurationMs);
    }
  }

  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_summary',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: dayKeys.length,
    source: source || null,
    model: model || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
    rollup_hit: rollupHit
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

function getSourceEntry(map, source) {
  if (map.has(source)) return map.get(source);
  const entry = {
    source,
    totals: createTotals()
  };
  map.set(source, entry);
  return entry;
}
