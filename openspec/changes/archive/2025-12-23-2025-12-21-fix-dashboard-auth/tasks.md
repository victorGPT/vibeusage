## 1. Implementation
- [x] 1.1 Pass `ANON_KEY` into edge client when validating user JWT
- [x] 1.2 Rebuild edge function bundles (`npm run build:insforge`)

## 2. Verification
- [x] 2.1 Run `node --test test/edge-functions.test.js`
- [x] 2.2 Manual smoke: `vibescore-usage-summary` returns 200 with valid token
