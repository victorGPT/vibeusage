// Edge function: vibescore-usage-monthly
// Returns monthly token usage aggregates for the authenticated user (timezone-aware).

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const {
  addDatePartsDays,
  addDatePartsMonths,
  formatDateParts,
  formatDateUTC,
  getLocalParts,
  isUtcTimeZone,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts,
  parseUtcDateString
} = require('../shared/date');
const { toBigInt, toPositiveIntOrNull } = require('../shared/numbers');

const MAX_MONTHS = 24;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const tzContext = getUsageTimeZoneContext(url);
  const monthsRaw = url.searchParams.get('months');
  const monthsParsed = toPositiveIntOrNull(monthsRaw);
  const months = monthsParsed == null ? MAX_MONTHS : monthsParsed;
  if (months < 1 || months > MAX_MONTHS) return json({ error: 'Invalid months' }, 400);

  const toRaw = url.searchParams.get('to');
  if (isUtcTimeZone(tzContext)) {
    const today = parseUtcDateString(formatDateUTC(new Date()));
    const toDate = toRaw ? parseUtcDateString(toRaw) : today;
    if (!toDate) return json({ error: 'Invalid to date' }, 400);

    const startMonth = new Date(
      Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() - (months - 1), 1)
    );
    const from = formatDateUTC(startMonth);
    const to = formatDateUTC(toDate);

    const { monthKeys, buckets } = initMonthlyBuckets(startMonth, months);

    const aggregateRows = await tryAggregateMonthlyTotals({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      from,
      to
    });

    if (aggregateRows) {
      for (const row of aggregateRows) {
        const key = formatMonthKeyFromValue(row?.month);
        const bucket = key ? buckets.get(key) : null;
        if (!bucket) continue;

        bucket.total += toBigInt(row?.sum_total_tokens);
        bucket.input += toBigInt(row?.sum_input_tokens);
        bucket.cached += toBigInt(row?.sum_cached_input_tokens);
        bucket.output += toBigInt(row?.sum_output_tokens);
        bucket.reasoning += toBigInt(row?.sum_reasoning_output_tokens);
      }

      return json({ from, to, months, data: buildMonthlyResponse(monthKeys, buckets) }, 200);
    }

    const { data, error } = await auth.edgeClient.database
      .from('vibescore_tracker_daily')
      .select('day,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
      .eq('user_id', auth.userId)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true });

    if (error) return json({ error: error.message }, 500);

    for (const row of data || []) {
      const day = row?.day;
      if (typeof day !== 'string' || day.length < 7) continue;
      const key = day.slice(0, 7);
      const bucket = buckets.get(key);
      if (!bucket) continue;

      bucket.total += toBigInt(row?.total_tokens);
      bucket.input += toBigInt(row?.input_tokens);
      bucket.cached += toBigInt(row?.cached_input_tokens);
      bucket.output += toBigInt(row?.output_tokens);
      bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
    }

    return json({ from, to, months, data: buildMonthlyResponse(monthKeys, buckets) }, 200);
  }

  const todayParts = getLocalParts(new Date(), tzContext);
  const toParts = toRaw ? parseDateParts(toRaw) : {
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day
  };
  if (!toParts) return json({ error: 'Invalid to date' }, 400);

  const startMonthParts = addDatePartsMonths(
    { year: toParts.year, month: toParts.month, day: 1 },
    -(months - 1)
  );
  const from = formatDateParts(startMonthParts);
  const to = formatDateParts(toParts);

  if (!from || !to) return json({ error: 'Invalid to date' }, 400);

  const startUtc = localDatePartsToUtc(
    { ...startMonthParts, hour: 0, minute: 0, second: 0 },
    tzContext
  );
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const { data, error } = await auth.edgeClient.database
    .from('vibescore_tracker_events')
    .select('token_timestamp,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
    .eq('user_id', auth.userId)
    .gte('token_timestamp', startIso)
    .lt('token_timestamp', endIso);

  if (error) return json({ error: error.message }, 500);

  const monthKeys = [];
  const buckets = new Map();

  for (let i = 0; i < months; i += 1) {
    const parts = addDatePartsMonths(startMonthParts, i);
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    monthKeys.push(key);
    buckets.set(key, {
      total: 0n,
      input: 0n,
      cached: 0n,
      output: 0n,
      reasoning: 0n
    });
  }

  for (const row of data || []) {
    const ts = row?.token_timestamp;
    if (!ts) continue;
    const dt = new Date(ts);
    if (!Number.isFinite(dt.getTime())) continue;
    const localParts = getLocalParts(dt, tzContext);
    const key = `${localParts.year}-${String(localParts.month).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += toBigInt(row?.total_tokens);
    bucket.input += toBigInt(row?.input_tokens);
    bucket.cached += toBigInt(row?.cached_input_tokens);
    bucket.output += toBigInt(row?.output_tokens);
    bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
  }

  const monthly = monthKeys.map((key) => {
    const bucket = buckets.get(key);
    return {
      month: key,
      total_tokens: bucket.total.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString()
    };
  });

  return json({ from, to, months, data: monthly }, 200);
};

function initMonthlyBuckets(startMonth, months) {
  const monthKeys = [];
  const buckets = new Map();

  for (let i = 0; i < months; i += 1) {
    const dt = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + i, 1));
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
    buckets.set(key, {
      total: 0n,
      input: 0n,
      cached: 0n,
      output: 0n,
      reasoning: 0n
    });
  }

  return { monthKeys, buckets };
}

function buildMonthlyResponse(monthKeys, buckets) {
  return monthKeys.map((key) => {
    const bucket = buckets.get(key);
    return {
      month: key,
      total_tokens: bucket.total.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString()
    };
  });
}

function formatMonthKeyFromValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    if (value.length >= 7) return value.slice(0, 7);
    return null;
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function tryAggregateMonthlyTotals({ edgeClient, userId, from, to }) {
  try {
    const { data, error } = await edgeClient.database
      .from('vibescore_tracker_daily')
      .select(
        "month:date_trunc('month', day),sum_total_tokens:sum(total_tokens),sum_input_tokens:sum(input_tokens),sum_cached_input_tokens:sum(cached_input_tokens),sum_output_tokens:sum(output_tokens),sum_reasoning_output_tokens:sum(reasoning_output_tokens)"
      )
      .eq('user_id', userId)
      .gte('day', from)
      .lte('day', to)
      .order('month', { ascending: true });

    if (error) return null;
    return data || [];
  } catch (_e) {
    return null;
  }
}
