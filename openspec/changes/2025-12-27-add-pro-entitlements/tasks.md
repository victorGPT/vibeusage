## 1. Implementation
- [x] 1.1 Add `vibescore_user_entitlements` table + RLS policies
- [x] 1.2 Add shared Pro status computation helper (cutoff + entitlements + expiry)
- [x] 1.3 Implement `GET /functions/vibescore-user-status`
- [x] 1.4 Implement admin endpoints to grant/revoke entitlements
- [x] 1.5 Add edge function tests for status + entitlement endpoints
- [x] 1.6 Update `BACKEND_API.md` with new endpoints
- [x] 1.7 Add `created_at` fallback via service-role lookup

## 2. Verification
- [x] 2.1 Run targeted tests (`node --test test/edge-functions.test.js`)
- [x] 2.2 Run `openspec validate 2025-12-27-add-pro-entitlements --strict`
