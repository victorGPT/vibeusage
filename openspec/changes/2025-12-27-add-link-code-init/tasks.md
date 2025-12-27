## 1. Backend (InsForge)
- [x] 1.1 Add link code table + RLS SQL (hash, user_id, expires_at, used_at, device_id, created_at).
- [x] 1.2 Implement `vibescore-link-code-issue` (user_jwt auth).
- [x] 1.3 Implement `vibescore-link-code-exchange` (validate code, issue device token, mark used).
- [x] 1.4 Build `insforge-functions` artifacts and update deploy notes.
- [x] 1.5 Update `BACKEND_API.md` with new endpoints.
- [x] 1.6 Add link code exchange RPC (atomic claim + insert).
- [x] 1.7 Update link code exchange function to use RPC.

## 2. CLI
- [x] 2.1 Add `--link-code` support in `src/commands/init.js`.
- [x] 2.2 Add client calls in `src/lib/vibescore-api.js` and `src/lib/insforge.js`.
- [x] 2.3 Update CLI help in `src/cli.js`.

## 3. Dashboard
- [x] 3.1 Request link code when signed in (Dashboard API).
- [x] 3.2 Render masked install command + copy button in install panel.
- [x] 3.3 Add copy registry keys in `dashboard/src/content/copy.csv`.

## 4. Tests & Regression
- [x] 4.1 Add edge function tests in `test/edge-functions.test.js`.
- [x] 4.2 Add CLI tests for link-code init flow.
- [x] 4.3 Add synthetic acceptance script under `scripts/acceptance/`.
- [x] 4.4 Run `npm test` and `node scripts/validate-copy-registry.cjs`.
- [x] 4.5 Add RPC path regression tests for link code exchange.

## 5. Verification
- [x] 5.1 Update `docs/plans/2025-12-27-link-code-init/verification-report.md`.
- [x] 5.2 Add freeze record entry in `docs/deployment/freeze.md`.
- [x] 5.3 Add PR gate record under `docs/pr/`.
