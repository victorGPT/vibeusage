## 1. Implementation
- [x] 1.1 Create `dashboard/src/lib/http-timeout.js` with `getHttpTimeoutMs` and `createTimeoutFetch` (injectable env for tests).
- [x] 1.2 Update `dashboard/src/lib/insforge-client.js` to use the new module without behavior change.
- [x] 1.3 Add unit tests: `test/http-timeout.test.js` (default/clamp/disable/timeout/caller-abort).
- [x] 1.4 Update docs if module API introduces new envs (expected none).
- [x] 1.5 Add OpenSpec delta spec for timeout behavior (`openspec/changes/2025-12-25-refactor-timeout-module/specs/vibescore-tracker/spec.md`).

## 2. Verification
- [x] 2.1 Run `node --test test/http-timeout.test.js`.
- [x] 2.2 Run `node --test test/*.test.js`.
- [x] 2.3 Manual: load dashboard and confirm timeout behavior unchanged.
- [x] 2.4 Run `openspec validate 2025-12-25-refactor-timeout-module --strict`.
