## 1. Spec

- [x] Record JWT signature verification requirement and remove the legacy path-fallback requirement.

## 2. Backend auth

- [x] Add `verifyUserJwtRs256` with JWKS key lookup by `kid` and per-`kid` key caching.
- [x] Add `verifyUserJwt` dispatching on header `alg` (RS256 / HS256, everything else rejected).
- [x] Remove the unverified claim-decoding fallback from `getEdgeClientAndUserIdFast`.
- [x] Thread `jwksUrl` through `getAccessContext` / `getEdgeClientAndUserId` / `getEdgeClientAndUserIdFast`.
- [x] Resolve the JWKS URL from the project base URL, not the request origin.
- [x] Point `vibeusage-debug-auth` at `verifyUserJwt` so it reports the real failure reason.
- [x] Keep `auth-core.js` byte-identical to `auth-core.mjs` (SSOT assertion).

## 3. Dashboard

- [x] Remove `requestWithFallback` / `requestWithFallbackPost` / `shouldFallbackToLegacy`.
- [x] Collapse `buildFunctionPaths` to `buildFunctionPath`; drop `fallbackPath` from the in-flight request key.
- [x] Remove `LEGACY_FUNCTION_PREFIX` from the function contract and its type declarations.

## 4. Tests

- [x] Unit: genuine RS256 token verifies against JWKS.
- [x] Unit: tampered signature, expired token, unknown `kid`, unsupported `alg` all rejected.
- [x] Unit: JWKS fetched once across repeated verifications (key cache).
- [x] Regression: forged token rejected when no shared secret is configured, with no edge client created.
- [x] Integration: `vibeusage-usage-hourly` serves an RS256 identity verified via a stubbed JWKS.
- [x] Update the two tests that asserted the unverified fallback behaviour.
- [x] Update `dashboard-function-path.test.js` to assert 404 propagates and `/api/functions` is never called.

## 5. Verification

- [x] `npm test` — 852/852.
- [x] `npm --prefix dashboard test` — 108/108; `npm --prefix dashboard run build` clean.
- [x] `npm run build:insforge` — 28 artifacts rebuilt.
- [x] Production: 28/28 functions deployed; 35/35 live.
- [x] Production: forged HS256 and forged RS256 (unknown `kid`) both return 401 at the auth layer.
- [x] Production: CLI device-token ingest unaffected (`sync` uploaded rows successfully).
- [ ] Production: signed-in dashboard loads data with a real RS256 session token (needs a browser session; not verifiable from CLI).
