// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a timezone-aware date range.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam } = require('../shared/source');
const { getModelParam, normalizeModel } = require('../shared/model');
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

module.exports = async function(request) {
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

  const { error } = await forEachPage({
    createQuery: () => {
      let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select('hour_start,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
        .eq('user_id', auth.userId);
      if (source) query = query.eq('source', source);
      if (model) query = query.eq('model', model);
      return query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour_start', { ascending: true });
    },
    onPage: (rows) => {
      for (const row of rows) {
        totalTokens += toBigInt(row?.total_tokens);
        inputTokens += toBigInt(row?.input_tokens);
        cachedInputTokens += toBigInt(row?.cached_input_tokens);
        outputTokens += toBigInt(row?.output_tokens);
        reasoningOutputTokens += toBigInt(row?.reasoning_output_tokens);
        const normalizedModel = normalizeModel(row?.model);
        if (normalizedModel && normalizedModel.toLowerCase() !== 'unknown') {
          distinctModels.add(normalizedModel);
        }
      }
    }
  });

  if (error) return json({ error: error.message }, 500);

  const impliedModel =
    model || (distinctModels.size === 1 ? Array.from(distinctModels)[0] : null);
  const pricingProfile = await resolvePricingProfile({
    edgeClient: auth.edgeClient,
    model: impliedModel,
    effectiveDate: to
  });
  const cost = computeUsageCost(
    {
      total_tokens: totalTokens,
      input_tokens: inputTokens,
      cached_input_tokens: cachedInputTokens,
      output_tokens: outputTokens,
      reasoning_output_tokens: reasoningOutputTokens
    },
    pricingProfile
  );

  const totals = {
    total_tokens: totalTokens.toString(),
    input_tokens: inputTokens.toString(),
    cached_input_tokens: cachedInputTokens.toString(),
    output_tokens: outputTokens.toString(),
    reasoning_output_tokens: reasoningOutputTokens.toString(),
    total_cost_usd: formatUsdFromMicros(cost.cost_micros)
  };

  return json(
    {
      from,
      to,
      days: dayKeys.length,
      totals,
      pricing: buildPricingMetadata({
        profile: cost.profile,
        pricingMode: cost.pricing_mode
      })
    },
    200
  );
};
