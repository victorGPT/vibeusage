// Edge function: vibescore-usage-daily
// Returns UTC daily token usage aggregates for the authenticated user.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { normalizeDateRange } = require('../shared/date');

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
  const { from, to } = normalizeDateRange(url.searchParams.get('from'), url.searchParams.get('to'));

  const { data, error } = await auth.edgeClient.database
    .from('vibescore_tracker_daily')
    .select('day,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
    .eq('user_id', auth.userId)
    .gte('day', from)
    .lte('day', to)
    .order('day', { ascending: true });

  if (error) return json({ error: error.message }, 500);

  return json({ from, to, data: data || [] }, 200);
};

