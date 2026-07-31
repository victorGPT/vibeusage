const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

if (!globalThis.crypto) globalThis.crypto = webcrypto;

require("../insforge-src/shared/auth-core.js");
const authCore = globalThis.__vibeusageAuthCore;

const JWKS_URL = "https://example.insforge.app/.well-known/jwks.json";
const SUB = "88377842-7d72-4e19-96f1-2c96fea8840e";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

async function makeKeypair(kid) {
  const pair = await webcrypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, jwk: { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", use: "sig", kid } };
}

async function signRs256(privateKey, { kid, sub = SUB, expOffsetSec = 3600 }) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const payload = b64url(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expOffsetSec }));
  const data = `${header}.${payload}`;
  const sig = await webcrypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64url(sig)}`;
}

function jwksFetch(jwks, counter) {
  return async () => {
    if (counter) counter.calls += 1;
    return { ok: true, json: async () => ({ keys: jwks }) };
  };
}

test("verifies a genuine RS256 token against JWKS", async () => {
  const kid = `kid_happy_${Date.now()}`;
  const { pair, jwk } = await makeKeypair(kid);
  const token = await signRs256(pair.privateKey, { kid });

  const result = await authCore.verifyUserJwt({
    token,
    jwksUrl: JWKS_URL,
    fetchImpl: jwksFetch([jwk]),
  });
  assert.equal(result.ok, true);
  assert.equal(result.userId, SUB);
});

test("rejects a tampered RS256 signature", async () => {
  const kid = `kid_tampered_${Date.now()}`;
  const { pair, jwk } = await makeKeypair(kid);
  const token = await signRs256(pair.privateKey, { kid });
  const [h, p] = token.split(".");
  const forged = `${h}.${p}.${b64url(Buffer.alloc(256, 7))}`;

  const result = await authCore.verifyUserJwt({
    token: forged,
    jwksUrl: JWKS_URL,
    fetchImpl: jwksFetch([jwk]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Invalid signature");
});

test("rejects an expired RS256 token", async () => {
  const kid = `kid_expired_${Date.now()}`;
  const { pair, jwk } = await makeKeypair(kid);
  const token = await signRs256(pair.privateKey, { kid, expOffsetSec: -60 });

  const result = await authCore.verifyUserJwt({
    token,
    jwksUrl: JWKS_URL,
    fetchImpl: jwksFetch([jwk]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Token expired");
});

test("rejects a token whose kid is absent from JWKS", async () => {
  const kid = `kid_unknown_${Date.now()}`;
  const { pair } = await makeKeypair(kid);
  const other = await makeKeypair(`kid_other_${Date.now()}`);
  const token = await signRs256(pair.privateKey, { kid });

  const result = await authCore.verifyUserJwt({
    token,
    jwksUrl: JWKS_URL,
    fetchImpl: jwksFetch([other.jwk]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "unknown_kid");
});

test("rejects an unsigned token even when no jwt secret is configured", async () => {
  // Regression: the old code fell back to decoding claims without verifying them,
  // so a hand-crafted HS256 token with a junk signature passed authentication.
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: SUB, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const forged = `${header}.${payload}.not-a-real-signature`;

  const result = await authCore.getEdgeClientAndUserIdFast({
    baseUrl: "https://example.insforge.app",
    bearer: forged,
    jwtSecret: null,
    jwksUrl: JWKS_URL,
    createUserEdgeClient: () => ({ marker: "should-not-be-created" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.edgeClient, null);
});

test("caches JWKS keys by kid across verifications", async () => {
  const kid = `kid_cached_${Date.now()}`;
  const { pair, jwk } = await makeKeypair(kid);
  const counter = { calls: 0 };
  const fetchImpl = jwksFetch([jwk], counter);

  for (let i = 0; i < 3; i += 1) {
    const token = await signRs256(pair.privateKey, { kid });
    const result = await authCore.verifyUserJwt({ token, jwksUrl: JWKS_URL, fetchImpl });
    assert.equal(result.ok, true);
  }
  assert.equal(counter.calls, 1);
});

test("rejects a token signed with an alg we do not support", async () => {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: SUB, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const result = await authCore.verifyUserJwt({
    token: `${header}.${payload}.`,
    jwksUrl: JWKS_URL,
    fetchImpl: jwksFetch([]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_jwt");
});
