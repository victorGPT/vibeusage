# Change: Verify user JWTs against JWKS (RS256)

## Why

- InsForge migrated authentication to asymmetric signing. `/.well-known/jwts.json` now publishes an RS256 key (`kty: RSA`, `alg: RS256`) and `INSFORGE_JWT_SECRET` is no longer injected into the edge function runtime — confirmed at runtime via `runtime-auth-probe-20260320` reporting `hasJwtSecret: false`.
- Our verifier only understood HS256, so every authenticated dashboard request was rejected in under a millisecond with `401 {"error":"Unauthorized"}`. Backend logs show the whole request fan-out (`usage-summary`, `usage-daily`, `user-status`, `viewer-identity`, …) failing this way.
- The dashboard treats HTTP 401 as session expiry, so the failure surfaced as `SESSION_EXPIRED / REAUTH_REQUIRED` and signing in again did not help — the newly issued token was also RS256.
- The pre-existing "no shared secret" fallback decoded JWT claims **without verifying the signature**. With the secret gone this became reachable in production: a hand-crafted bearer passed our authentication layer and was only stopped by the platform at the database call.
- Separately, the dashboard fell back from `/functions/{slug}` to `/api/functions/{slug}` on HTTP 404. `/api/functions/{slug}` is the admin management API, so a backend outage was reported to users as `Admin access required`, masking the real cause.

## What Changes

- Add `verifyUserJwtRs256`: resolve the signing key by `kid` from JWKS, verify with `RSASSA-PKCS1-v1_5` / SHA-256, and cache imported keys per `kid`.
- Add `verifyUserJwt` dispatching on the JWT header `alg`. HS256 remains supported for self-hosted deployments that still configure a shared secret.
- **BREAKING (internal):** remove the unverified claim-decoding fallback. A token that cannot be cryptographically verified is now rejected.
- Resolve the JWKS URL from the project base URL rather than the request origin — the Deno deployment fetching its own public URL trips an HTTP 508 loop.
- Remove the `/api/functions` legacy fallback and the `LEGACY_FUNCTION_PREFIX` constant so backend outages surface as themselves.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `insforge-src/shared/auth-core.{mjs,js}`, `insforge-src/shared/auth.js`, `insforge-src/functions-esm/shared/auth.js`, `insforge-src/functions-esm/vibeusage-debug-auth.js`, `dashboard/src/lib/vibeusage-api.ts`, `src/shared/vibeusage-function-contract.cjs`
- Deployment: all 28 edge functions redeployed. InsForge rate-limits function writes, so bulk deploys need backoff.
- Supersedes the 404-fallback behaviour introduced by `2025-12-26-fix-dashboard-functions-path`.

## Note on process

This shipped as a production hotfix ahead of the proposal: the dashboard was fully down for all signed-in users. The proposal is recorded after the fact because the change touches authentication.
