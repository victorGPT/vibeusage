// Edge function: vibescore-leaderboard-settings
// Updates the current user's leaderboard privacy setting.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const leaderboardPublic = body.data?.leaderboard_public;
  if (typeof leaderboardPublic !== 'boolean') {
    return json({ error: 'leaderboard_public must be boolean' }, 400);
  }

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const updatedAt = new Date().toISOString();

  const { data: existing, error: selErr } = await auth.edgeClient.database
    .from('vibescore_user_settings')
    .select('user_id')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (selErr) return json({ error: selErr.message }, 500);

  if (existing?.user_id) {
    const { error: updErr } = await auth.edgeClient.database
      .from('vibescore_user_settings')
      .update({ leaderboard_public: leaderboardPublic, updated_at: updatedAt })
      .eq('user_id', auth.userId);
    if (updErr) return json({ error: updErr.message }, 500);
  } else {
    const { error: insErr } = await auth.edgeClient.database
      .from('vibescore_user_settings')
      .insert([{ user_id: auth.userId, leaderboard_public: leaderboardPublic, updated_at: updatedAt }]);
    if (insErr) return json({ error: insErr.message }, 500);
  }

  return json({ leaderboard_public: leaderboardPublic, updated_at: updatedAt }, 200);
};

