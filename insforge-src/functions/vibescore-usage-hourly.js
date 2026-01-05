// Edge function: vibescore-usage-hourly
// Returns half-hour token usage aggregates for the authenticated user (timezone-aware).

'use strict';

const { handleOptions, json } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam } = require('../shared/source');
const { getModelParam } = require('../shared/model');
const { resolveUsageModelsForCanonical } = require('../shared/model-identity');
const { applyCanaryFilter } = require('../shared/canary');
const {
  addDatePartsDays,
  addUtcDays,
  formatDateParts,
  formatDateUTC,
  getLocalParts,
  isUtcTimeZone,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts,
  parseUtcDateString
} = require('../shared/date');
const { toBigInt } = require('../shared/numbers');
const { forEachPage } = require('../shared/pagination');
const { logSlowQuery, withRequestLogging } = require('../shared/logging');
const { isDebugEnabled, withSlowQueryDebugPayload } = require('../shared/debug');

const MIN_INTERVAL_MINUTES = 30;

module.exports = withRequestLogging('vibescore-usage-hourly', async function(request, logger) {
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

  if (isUtcTimeZone(tzContext)) {
    const dayRaw = url.searchParams.get('day');
    const today = parseUtcDateString(formatDateUTC(new Date()));
    const day = dayRaw ? parseUtcDateString(dayRaw) : today;
    if (!day) return respond({ error: 'Invalid day' }, 400, 0);

    const startUtc = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0)
    );
    const startIso = startUtc.toISOString();
    const endDate = addUtcDays(day, 1);
    const endUtc = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0)
    );
    const endIso = endUtc.toISOString();

    const dayLabel = formatDateUTC(day);
    const { hourKeys, buckets, bucketMap } = initHourlyBuckets(dayLabel);
    const syncMeta = await getSyncMeta({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      startUtc,
      endUtc,
      tzContext
    });

    const modelFilter = await resolveUsageModelsForCanonical({
      edgeClient: auth.edgeClient,
      canonicalModel: model,
      effectiveDate: dayLabel
    });
    const canonicalModel = modelFilter.canonical;
    const usageModels = modelFilter.usageModels;
    const hasModelFilter = Array.isArray(usageModels) && usageModels.length > 0;

    const aggregateStartMs = Date.now();
    const aggregateRows = await tryAggregateHourlyTotals({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      startIso,
      endIso,
      source,
      canonicalModel,
      usageModels
    });
    const aggregateDurationMs = Date.now() - aggregateStartMs;
    logSlowQuery(logger, {
      query_label: 'usage_hourly_aggregate',
      duration_ms: aggregateDurationMs,
      row_count: Array.isArray(aggregateRows) ? aggregateRows.length : 0,
      range_days: 1,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null,
      agg_hit: Boolean(aggregateRows)
    });

    if (aggregateRows) {
      for (const row of aggregateRows) {
        const key = formatHourKeyFromValue(row?.hour);
        const bucket = key ? bucketMap.get(key) : null;
        if (!bucket) continue;

        bucket.total += toBigInt(row?.sum_total_tokens);
        bucket.input += toBigInt(row?.sum_input_tokens);
        bucket.cached += toBigInt(row?.sum_cached_input_tokens);
        bucket.output += toBigInt(row?.sum_output_tokens);
        bucket.reasoning += toBigInt(row?.sum_reasoning_output_tokens);
      }

      return respond(
        {
          day: dayLabel,
          data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
          sync: buildSyncResponse(syncMeta)
        },
        200,
        aggregateDurationMs
      );
    }

    const queryStartMs = Date.now();
    let rowCount = 0;
    const { error } = await forEachPage({
      createQuery: () => {
        let query = auth.edgeClient.database
          .from('vibescore_tracker_hourly')
          .select('hour_start,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
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
          const hour = dt.getUTCHours();
          const minute = dt.getUTCMinutes();
          const slot = hour * 2 + (minute >= 30 ? 1 : 0);
          if (slot < 0 || slot > 47) continue;

          const bucket = buckets[slot];
          bucket.total += toBigInt(row?.total_tokens);
          bucket.input += toBigInt(row?.input_tokens);
          bucket.cached += toBigInt(row?.cached_input_tokens);
          bucket.output += toBigInt(row?.output_tokens);
          bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
        }
      }
    });
    const queryDurationMs = Date.now() - queryStartMs;
    logSlowQuery(logger, {
      query_label: 'usage_hourly_raw',
      duration_ms: queryDurationMs,
      row_count: rowCount,
      range_days: 1,
      source: source || null,
      model: canonicalModel || null,
      tz: tzContext?.timeZone || null,
      tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
    });

    if (error) return respond({ error: error.message }, 500, queryDurationMs);

    return respond(
      {
        day: dayLabel,
        data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
        sync: buildSyncResponse(syncMeta)
      },
      200,
      queryDurationMs
    );
  }

  const dayRaw = url.searchParams.get('day');
  const todayKey = formatDateParts(getLocalParts(new Date(), tzContext));
  if (dayRaw && !parseDateParts(dayRaw)) return respond({ error: 'Invalid day' }, 400, 0);
  const dayKey = dayRaw || todayKey;
  const dayParts = parseDateParts(dayKey);
  if (!dayParts) return respond({ error: 'Invalid day' }, 400, 0);

  const modelFilter = await resolveUsageModelsForCanonical({
    edgeClient: auth.edgeClient,
    canonicalModel: model,
    effectiveDate: dayKey
  });
  const canonicalModel = modelFilter.canonical;
  const usageModels = modelFilter.usageModels;
  const hasModelFilter = Array.isArray(usageModels) && usageModels.length > 0;

  const startUtc = localDatePartsToUtc({ ...dayParts, hour: 0, minute: 0, second: 0 }, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(dayParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const { hourKeys, buckets, bucketMap } = initHourlyBuckets(dayKey);
  const syncMeta = await getSyncMeta({
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    startUtc,
    endUtc,
    tzContext
  });

  const queryStartMs = Date.now();
  let rowCount = 0;
  const { error } = await forEachPage({
    createQuery: () => {
        let query = auth.edgeClient.database
          .from('vibescore_tracker_hourly')
          .select('hour_start,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
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
        const localParts = getLocalParts(dt, tzContext);
        const localDay = formatDateParts(localParts);
        if (localDay !== dayKey) continue;
        const hour = Number(localParts.hour);
        const minute = Number(localParts.minute);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
        const slot = hour * 2 + (minute >= 30 ? 1 : 0);
        if (slot < 0 || slot > 47) continue;

        const bucket = buckets[slot];
        bucket.total += toBigInt(row?.total_tokens);
        bucket.input += toBigInt(row?.input_tokens);
        bucket.cached += toBigInt(row?.cached_input_tokens);
        bucket.output += toBigInt(row?.output_tokens);
        bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
      }
    }
  });
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_hourly_raw',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_days: 1,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
  });

  if (error) return respond({ error: error.message }, 500, queryDurationMs);

  return respond(
    {
      day: dayKey,
      data: buildHourlyResponse(hourKeys, bucketMap, syncMeta?.missingAfterSlot),
      sync: buildSyncResponse(syncMeta)
    },
    200,
    queryDurationMs
  );
});

function initHourlyBuckets(dayLabel) {
  const hourKeys = [];
  const buckets = Array.from({ length: 48 }, () => ({
    total: 0n,
    input: 0n,
    cached: 0n,
    output: 0n,
    reasoning: 0n
  }));
  const bucketMap = new Map();

  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const key = `${dayLabel}T${String(hour).padStart(2, '0')}:${String(minute).padStart(
        2,
        '0'
      )}:00`;
      hourKeys.push(key);
      const slot = hour * 2 + (minute >= 30 ? 1 : 0);
      bucketMap.set(key, buckets[slot]);
    }
  }

  return { hourKeys, buckets, bucketMap };
}

function buildHourlyResponse(hourKeys, bucketMap, missingAfterSlot) {
  return hourKeys.map((key) => {
    const bucket = bucketMap.get(key);
    const row = {
      hour: key,
      total_tokens: bucket.total.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString()
    };
    if (typeof missingAfterSlot === 'number') {
      const slot = parseHalfHourSlotFromKey(key);
      if (Number.isFinite(slot) && slot > missingAfterSlot) row.missing = true;
    }
    return row;
  });
}

function formatHourKeyFromValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    if (value.length >= 16) {
      const day = value.slice(0, 10);
      const hour = value.slice(11, 13);
      const minute = value.slice(14, 16);
      const minuteNum = Number(minute);
      if (!Number.isFinite(minuteNum) || (minuteNum !== 0 && minuteNum !== 30)) return null;
      if (day && hour && minute) return `${day}T${hour}:${minute}:00`;
    }
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  const day = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
  const hour = String(dt.getUTCHours()).padStart(2, '0');
  const minute = String(dt.getUTCMinutes() >= 30 ? 30 : 0).padStart(2, '0');
  return `${day}T${hour}:${minute}:00`;
}

function parseHalfHourSlotFromKey(key) {
  if (typeof key !== 'string' || key.length < 16) return null;
  const hour = Number(key.slice(11, 13));
  const minute = Number(key.slice(14, 16));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute !== 0 && minute !== 30) return null;
  return hour * 2 + (minute >= 30 ? 1 : 0);
}

async function tryAggregateHourlyTotals({ edgeClient, userId, startIso, endIso, source, canonicalModel, usageModels }) {
  try {
    let query = edgeClient.database
      .from('vibescore_tracker_hourly')
      .select(
        'hour:hour_start,sum_total_tokens:sum(total_tokens),sum_input_tokens:sum(input_tokens),sum_cached_input_tokens:sum(cached_input_tokens),sum_output_tokens:sum(output_tokens),sum_reasoning_output_tokens:sum(reasoning_output_tokens)'
      )
      .eq('user_id', userId);
    if (source) query = query.eq('source', source);
    if (Array.isArray(usageModels) && usageModels.length > 0) {
      query = query.in('model', usageModels);
    }
    query = applyCanaryFilter(query, { source, model: canonicalModel });
    const { data, error } = await query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour', { ascending: true });

    if (error) return null;
    return data || [];
  } catch (_e) {
    return null;
  }
}

async function getSyncMeta({ edgeClient, userId, startUtc, endUtc, tzContext }) {
  const lastSyncAt = await getLastSyncAt({ edgeClient, userId });
  const lastSyncIso = normalizeIso(lastSyncAt);
  if (
    !lastSyncIso ||
    !(startUtc instanceof Date) ||
    !(endUtc instanceof Date) ||
    !Number.isFinite(startUtc.getTime()) ||
    !Number.isFinite(endUtc.getTime())
  ) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: null };
  }

  const dayStartMs = startUtc.getTime();
  const dayEndMs = endUtc.getTime();
  const lastMs = Date.parse(lastSyncIso);
  if (!Number.isFinite(lastMs)) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: null };
  }

  if (lastMs < dayStartMs) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: -1 };
  }
  if (lastMs >= dayEndMs) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: 47 };
  }

  const lastParts = getLocalParts(new Date(lastMs), tzContext);
  const lastHour = Number(lastParts?.hour);
  const lastMinute = Number(lastParts?.minute || 0);
  if (!Number.isFinite(lastHour) || !Number.isFinite(lastMinute)) {
    return { lastSyncAt: lastSyncIso, missingAfterSlot: null };
  }
  const slot = lastHour * 2 + (lastMinute >= 30 ? 1 : 0);
  return { lastSyncAt: lastSyncIso, missingAfterSlot: slot };
}

async function getLastSyncAt({ edgeClient, userId }) {
  try {
    const { data, error } = await edgeClient.database
      .from('vibescore_tracker_device_tokens')
      .select('last_sync_at')
      .eq('user_id', userId)
      .order('last_sync_at', { ascending: false })
      .limit(1);

    if (error) return null;
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0]?.last_sync_at || null;
  } catch (_e) {
    return null;
  }
}

function normalizeIso(value) {
  if (typeof value !== 'string') return null;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toISOString();
}

function buildSyncResponse(syncMeta) {
  return {
    last_sync_at: syncMeta?.lastSyncAt || null,
    min_interval_minutes: MIN_INTERVAL_MINUTES
  };
}
