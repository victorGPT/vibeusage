## 1. Spec
- [x] Add dashboard function path compatibility requirement to spec delta.

## 2. Dashboard
- [x] Introduce a function-path resolver that prefers `/functions` and falls back to `/api/functions` on 404 (GET only).
- [x] Update dashboard request flow to use the resolver for usage endpoints and backend probe.
- [x] Guard access to `import.meta.env` in dashboard config for Node test runs.

## 3. Tests
- [x] Unit: resolver returns preferred path and falls back on simulated 404.
- [x] Unit: non-404 errors do not trigger fallback.
- [ ] Regression: repeatable manual script/curl confirming `/functions` is reachable and `/api/functions` fallback works when needed.

## 4. Docs
- [x] Update `docs/dashboard/api.md` to note preferred `/functions` path and 404 fallback.
- [x] Align `BACKEND_API.md` with gateway path guidance.

## 5. Verification
- [x] `node --test test/dashboard-function-path.test.js`.
- [ ] Manual check: dashboard fetch succeeds on target environment.
