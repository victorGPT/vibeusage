## 1. Implementation
- [x] 1.1 Create `dashboard/src/lib/http-timeout.js` with `getHttpTimeoutMs` and `createTimeoutFetch` (injectable env for tests).
- [x] 1.2 Update `dashboard/src/lib/insforge-client.js` to use the new module without behavior change.
- [x] 1.3 Add unit tests: `test/http-timeout.test.js` (default/clamp/disable/timeout/caller-abort).
- [x] 1.4 Update docs if module API introduces new envs (expected none).

## 2. Verification
- [x] 2.1 Run `node --test test/http-timeout.test.js`.
- [x] 2.2 Run `node --test test/*.test.js`.
- [x] 2.3 Manual: load dashboard and confirm timeout behavior unchanged.
