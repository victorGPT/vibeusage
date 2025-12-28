# Verification Report

## Scope
- Link code edge functions (init/exchange)
- CLI init link code flow (regression)
- Dashboard install copy/masking UI
- Copy registry validation

## Tests Run
- `node --test test/edge-functions.test.js`
- `node --test test/init-uninstall.test.js`
- `node --test test/dashboard-link-code-install.test.js`
- `node --test test/dashboard-function-path.test.js`
- `node --test test/dashboard-link-code-expiry.test.js`
- `node --test test/dashboard-render-order.test.js`
- `node --test test/insforge-src-shared.test.js`
- `node --test test/link-code-rls.test.js`
- `node scripts/validate-copy-registry.cjs`
- `node scripts/acceptance/link-code-e2e-manual.cjs --help`

## Results
- All listed tests passed.
- Copy registry validation reported existing unused key warnings (unchanged):
  - `landing.meta.*` (title/description/og/twitter)
  - `usage.summary.since`
  - `dashboard.session.label`
- Manual E2E script requires a live link code; `--help` was used to verify usage output.

## Evidence
- Local test outputs recorded in this session.

## Remaining Risks
- Link code exchange RPC not executed against a live database in this run.
