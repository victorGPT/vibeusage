"use strict";

const CORE_KEY = "__vibeusageAuthCore";

function getBearerToken(headerValue) {
  if (!headerValue) return null;
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) return null;
  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function decodeBase64Url(value) {
  if (typeof value !== "string") return null;
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (pad) normalized += "=".repeat(4 - pad);
  try {
    if (typeof atob === "function") return atob(normalized);
  } catch (_error) {
    // fall through
  }
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("utf8");
    }
  } catch (_error) {
    // ignore
  }
  return null;
}

function decodeJwtSection(token, index) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < index + 1) return null;
  const raw = decodeBase64Url(parts[index]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function decodeJwtPayload(token) {
  return decodeJwtSection(token, 1);
}

function decodeJwtHeader(token) {
  return decodeJwtSection(token, 0);
}

function getJwtRole(token) {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  if (typeof role === "string" && role.length > 0) return role;
  const appRole = payload?.app_metadata?.role;
  if (typeof appRole === "string" && appRole.length > 0) return appRole;
  const roles = payload?.app_metadata?.roles;
  if (Array.isArray(roles)) {
    if (roles.includes("project_admin")) return "project_admin";
    const match = roles.find((value) => typeof value === "string" && value.length > 0);
    if (match) return match;
  }
  return null;
}

function isProjectAdminBearer(token) {
  return getJwtRole(token) === "project_admin";
}

function isJwtExpired(payload) {
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return false;
  return exp * 1000 <= Date.now();
}

function base64UrlEncode(value) {
  let base64 = null;
  try {
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(value).toString("base64");
    }
  } catch (_error) {
    // ignore
  }
  if (!base64 && typeof btoa === "function" && value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    base64 = btoa(binary);
  }
  if (!base64) return null;
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function verifyUserJwtHs256({ token, jwtSecret }) {
  const secret = typeof jwtSecret === "string" && jwtSecret.length > 0 ? jwtSecret : null;
  if (!secret) {
    return { ok: false, userId: null, error: "Missing jwt secret", code: "missing_jwt_secret" };
  }
  if (typeof token !== "string") return { ok: false, userId: null, error: "Invalid token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, userId: null, error: "Invalid token" };
  const header = decodeJwtHeader(token);
  if (!header || header.alg !== "HS256") {
    return { ok: false, userId: null, error: "Unsupported alg" };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) return { ok: false, userId: null, error: "Invalid payload" };
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return { ok: false, userId: null, error: "Missing exp" };
  if (isJwtExpired(payload)) return { ok: false, userId: null, error: "Token expired" };
  const cryptoSubtle = globalThis.crypto?.subtle;
  if (!cryptoSubtle) return { ok: false, userId: null, error: "Crypto unavailable" };
  const data = `${parts[0]}.${parts[1]}`;
  const encoder = new TextEncoder();
  const key = await cryptoSubtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await cryptoSubtle.sign("HMAC", key, encoder.encode(data));
  const expected = base64UrlEncode(signature);
  if (!expected || expected !== parts[2]) {
    return { ok: false, userId: null, error: "Invalid signature" };
  }
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return { ok: false, userId: null, error: "Missing sub" };
  return { ok: true, userId, error: null };
}

function decodeBase64UrlBytes(value) {
  const raw = decodeBase64Url(value);
  if (raw == null) return null;
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// ponytail: unbounded kid -> CryptoKey cache. Insforge publishes one signing key
// and rotation mints a new kid, so this grows by one entry per rotation.
const jwksKeyCache = new Map();

async function loadJwksKeys({ jwksUrl, fetchImpl }) {
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof doFetch !== "function") return false;
  const res = await doFetch(jwksUrl);
  if (!res?.ok) return false;
  const body = await res.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  let imported = false;
  for (const jwk of keys) {
    if (jwk?.kty !== "RSA" || typeof jwk.kid !== "string") continue;
    if (jwk.alg && jwk.alg !== "RS256") continue;
    const key = await globalThis.crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    jwksKeyCache.set(jwk.kid, key);
    imported = true;
  }
  return imported;
}

async function getJwksKey({ jwksUrl, kid, fetchImpl }) {
  if (typeof kid !== "string" || kid.length === 0) return null;
  const cached = jwksKeyCache.get(kid);
  if (cached) return cached;
  await loadJwksKeys({ jwksUrl, fetchImpl });
  return jwksKeyCache.get(kid) || null;
}

async function verifyUserJwtRs256({ token, jwksUrl, fetchImpl }) {
  if (typeof jwksUrl !== "string" || jwksUrl.length === 0) {
    return { ok: false, userId: null, error: "Missing jwks url", code: "missing_jwks_url" };
  }
  if (typeof token !== "string") return { ok: false, userId: null, error: "Invalid token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, userId: null, error: "Invalid token" };
  const header = decodeJwtHeader(token);
  if (!header || header.alg !== "RS256") {
    return { ok: false, userId: null, error: "Unsupported alg" };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) return { ok: false, userId: null, error: "Invalid payload" };
  if (!Number.isFinite(Number(payload?.exp))) {
    return { ok: false, userId: null, error: "Missing exp" };
  }
  if (isJwtExpired(payload)) return { ok: false, userId: null, error: "Token expired" };
  const cryptoSubtle = globalThis.crypto?.subtle;
  if (!cryptoSubtle) return { ok: false, userId: null, error: "Crypto unavailable" };
  const signature = decodeBase64UrlBytes(parts[2]);
  if (!signature) return { ok: false, userId: null, error: "Invalid signature" };

  let key = null;
  try {
    key = await getJwksKey({ jwksUrl, kid: header.kid, fetchImpl });
  } catch (_error) {
    return { ok: false, userId: null, error: "Jwks unavailable", code: "jwks_unavailable" };
  }
  if (!key) return { ok: false, userId: null, error: "Unknown signing key", code: "unknown_kid" };

  const verified = await cryptoSubtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) return { ok: false, userId: null, error: "Invalid signature" };
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return { ok: false, userId: null, error: "Missing sub" };
  return { ok: true, userId, error: null };
}

// Insforge signs user tokens with RS256 (JWKS) since the 2026-07 auth migration;
// HS256 stays supported for self-hosted deployments that still set a shared secret.
async function verifyUserJwt({ token, jwtSecret, jwksUrl, fetchImpl }) {
  const header = decodeJwtHeader(token);
  const alg = header?.alg;
  if (alg === "RS256") return verifyUserJwtRs256({ token, jwksUrl, fetchImpl });
  if (alg === "HS256") return verifyUserJwtHs256({ token, jwtSecret });
  return { ok: false, userId: null, error: "Unsupported alg", code: "invalid_jwt" };
}

async function getEdgeClientAndUserIdFast({
  baseUrl,
  bearer,
  createUserEdgeClient,
  jwtSecret,
  jwksUrl,
  fetchImpl,
} = {}) {
  const local = await verifyUserJwt({ token: bearer, jwtSecret, jwksUrl, fetchImpl });
  if (!local.ok) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      status: 401,
      error: "Unauthorized",
      code: local?.code || "invalid_jwt",
    };
  }
  const edgeClient =
    typeof createUserEdgeClient === "function"
      ? await createUserEdgeClient({ baseUrl, bearer })
      : null;
  return { ok: true, edgeClient, userId: local.userId };
}

async function getEdgeClientAndUserId({
  baseUrl,
  bearer,
  createUserEdgeClient,
  jwtSecret,
  jwksUrl,
  fetchImpl,
} = {}) {
  const auth = await getEdgeClientAndUserIdFast({
    baseUrl,
    bearer,
    createUserEdgeClient,
    jwtSecret,
    jwksUrl,
    fetchImpl,
  });
  if (!auth.ok) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      status: auth.status ?? 401,
      error: auth.error ?? "Unauthorized",
      code: auth.code ?? null,
    };
  }
  return { ok: true, edgeClient: auth.edgeClient, userId: auth.userId };
}

async function getAccessContext({
  baseUrl,
  bearer,
  allowPublic = false,
  createUserEdgeClient,
  jwtSecret,
  jwksUrl,
  fetchImpl,
  isPublicShareToken,
  resolvePublicView,
} = {}) {
  if (!bearer) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: 401,
      error: "Unauthorized",
      code: "missing_bearer",
    };
  }

  const auth = await getEdgeClientAndUserIdFast({
    baseUrl,
    bearer,
    createUserEdgeClient,
    jwtSecret,
    jwksUrl,
    fetchImpl,
  });
  if (auth.ok) {
    return { ok: true, edgeClient: auth.edgeClient, userId: auth.userId, accessType: "user" };
  }
  if (!allowPublic) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: auth.status ?? 401,
      error: auth.error ?? "Unauthorized",
      code: auth.code ?? null,
    };
  }

  if (typeof isPublicShareToken !== "function" || !isPublicShareToken(bearer)) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: auth.status ?? 401,
      error: auth.error ?? "Unauthorized",
      code: auth.code ?? null,
    };
  }

  const publicView =
    typeof resolvePublicView === "function"
      ? await resolvePublicView({ baseUrl, shareToken: bearer })
      : null;
  if (!publicView?.ok) {
    return {
      ok: false,
      edgeClient: null,
      userId: null,
      accessType: null,
      status: 401,
      error: "Unauthorized",
    };
  }
  return {
    ok: true,
    edgeClient: publicView.edgeClient,
    userId: publicView.userId,
    accessType: "public",
  };
}

if (!globalThis[CORE_KEY]) {
  Object.defineProperty(globalThis, CORE_KEY, {
    value: {
      getBearerToken,
      isProjectAdminBearer,
      verifyUserJwtHs256,
      verifyUserJwtRs256,
      verifyUserJwt,
      getEdgeClientAndUserIdFast,
      getEdgeClientAndUserId,
      getAccessContext,
    },
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
