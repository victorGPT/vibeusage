'use strict';

function getBearerToken(headerValue) {
  if (!headerValue) return null;
  const prefix = 'Bearer ';
  if (!headerValue.startsWith(prefix)) return null;
  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

async function getEdgeClientAndUserId({ baseUrl, bearer }) {
  const edgeClient = createClient({ baseUrl, edgeFunctionToken: bearer });
  const { data: userData, error: userErr } = await edgeClient.auth.getCurrentUser();
  const userId = userData?.user?.id;
  if (userErr || !userId) return { ok: false, edgeClient: null, userId: null };
  return { ok: true, edgeClient, userId };
}

module.exports = {
  getBearerToken,
  getEdgeClientAndUserId
};

