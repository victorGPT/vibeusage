import "../../shared/auth-core.mjs";

import { getAnonKey, getBaseUrl, getJwtSecret } from "./env.js";
import { createEdgeClient } from "./insforge-client.js";
import { isPublicShareToken, resolvePublicView as resolvePublicViewImpl } from "./public-view.js";

const authCore = globalThis.__vibeusageAuthCore;
if (!authCore) throw new Error("auth core not initialized");

// Must resolve against the project host, not the request origin: the Deno
// deployment fetching its own public URL trips a 508 loop.
function getJwksUrl() {
  const baseUrl = getBaseUrl();
  return baseUrl ? new URL("/.well-known/jwks.json", baseUrl).toString() : null;
}

function createUserEdgeClient({ baseUrl, bearer }) {
  return createEdgeClient({
    baseUrl,
    anonKey: getAnonKey() || undefined,
    edgeFunctionToken: bearer,
  });
}

export const getBearerToken = authCore.getBearerToken;
export const isProjectAdminBearer = authCore.isProjectAdminBearer;
export const resolvePublicView = resolvePublicViewImpl;
export const verifyUserJwtHs256 = ({ token }) =>
  authCore.verifyUserJwtHs256({ token, jwtSecret: getJwtSecret() });
export const verifyUserJwt = ({ token }) =>
  authCore.verifyUserJwt({ token, jwtSecret: getJwtSecret(), jwksUrl: getJwksUrl() });
export const getEdgeClientAndUserIdFast = ({ baseUrl, bearer }) =>
  authCore.getEdgeClientAndUserIdFast({
    baseUrl,
    bearer,
    jwtSecret: getJwtSecret(),
    jwksUrl: getJwksUrl(),
    createUserEdgeClient,
  });
export const getEdgeClientAndUserId = ({ baseUrl, bearer }) =>
  authCore.getEdgeClientAndUserId({
    baseUrl,
    bearer,
    jwtSecret: getJwtSecret(),
    jwksUrl: getJwksUrl(),
    createUserEdgeClient,
  });
export const getAccessContext = ({ baseUrl, bearer, allowPublic = false }) =>
  authCore.getAccessContext({
    baseUrl,
    bearer,
    allowPublic,
    jwtSecret: getJwtSecret(),
    jwksUrl: getJwksUrl(),
    createUserEdgeClient,
    isPublicShareToken,
    resolvePublicView: resolvePublicViewImpl,
  });
