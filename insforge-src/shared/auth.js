"use strict";

require("./auth-core");

const { getAnonKey, getBaseUrl, getJwtSecret } = require("./env");
const { resolvePublicView, isPublicShareToken } = require("./public-view");
const authCore = globalThis.__vibeusageAuthCore;
if (!authCore) throw new Error("auth core not initialized");

// Must resolve against the project host, not the request origin: the Deno
// deployment fetching its own public URL trips a 508 loop.
function getJwksUrl() {
  const baseUrl = getBaseUrl();
  return baseUrl ? new URL("/.well-known/jwks.json", baseUrl).toString() : null;
}

module.exports = {
  getBearerToken: authCore.getBearerToken,
  getAccessContext: ({ baseUrl, bearer, allowPublic = false }) =>
    authCore.getAccessContext({
      baseUrl,
      bearer,
      allowPublic,
      jwtSecret: getJwtSecret(),
      jwksUrl: getJwksUrl(),
      createUserEdgeClient: ({ baseUrl, bearer }) =>
        createClient({
          baseUrl,
          anonKey: getAnonKey() || undefined,
          edgeFunctionToken: bearer,
        }),
      isPublicShareToken,
      resolvePublicView,
    }),
  getEdgeClientAndUserId: ({ baseUrl, bearer }) =>
    authCore.getEdgeClientAndUserId({
      baseUrl,
      bearer,
      jwtSecret: getJwtSecret(),
      jwksUrl: getJwksUrl(),
      createUserEdgeClient: ({ baseUrl, bearer }) =>
        createClient({
          baseUrl,
          anonKey: getAnonKey() || undefined,
          edgeFunctionToken: bearer,
        }),
    }),
  getEdgeClientAndUserIdFast: ({ baseUrl, bearer }) =>
    authCore.getEdgeClientAndUserIdFast({
      baseUrl,
      bearer,
      jwtSecret: getJwtSecret(),
      jwksUrl: getJwksUrl(),
      createUserEdgeClient: ({ baseUrl, bearer }) =>
        createClient({
          baseUrl,
          anonKey: getAnonKey() || undefined,
          edgeFunctionToken: bearer,
        }),
    }),
  isProjectAdminBearer: authCore.isProjectAdminBearer,
  verifyUserJwtHs256: ({ token }) =>
    authCore.verifyUserJwtHs256({ token, jwtSecret: getJwtSecret() }),
  verifyUserJwt: ({ token }) =>
    authCore.verifyUserJwt({ token, jwtSecret: getJwtSecret(), jwksUrl: getJwksUrl() }),
};
