## 1. Implementation

- [x] 1.1 Add failing regression coverage for the ESM-only hard cut: remaining legacy slugs must load from `insforge-src/functions-esm/`, build/load scripts must stop referencing `insforge-src/functions/`, and interaction/acceptance fixtures must stop depending on legacy sources.
- [x] 1.2 Migrate the remaining non-ingest legacy functions to `insforge-src/functions-esm/` and delete their CommonJS author sources.
- [x] 1.3 Migrate `vibeusage-ingest` and its direct shared dependencies to an ESM-only executable path, then delete the CommonJS ingest entry source.
- [x] 1.4 Hard cut the build and load graph to `insforge-src/functions-esm/` only, rebuild `insforge-functions/`, and remove legacy fallback behavior.
- [x] 1.5 Update acceptance scripts, interaction-sequence tooling, OpenSpec, and active docs so they all describe the same ESM-only deploy contract.
- [ ] 1.6 Deploy the migrated functions through Insforge and capture live smoke evidence plus freeze-record updates.
  - Blocked by provider/runtime `BOOT_FAILURE`: Insforge accepted updated code uploads, but runtime boot failed with `[ERR_MODULE_NOT_FOUND]` for `@insforge/shared-schemas/dist/database.schema`, so live smoke could not complete in this window.

## 2. Verification

- [x] 2.1 `openspec validate 2026-03-29-refactor-remaining-edge-functions-esm-hard-cut --strict`
- [x] 2.2 `node --test test/insforge-esm-artifacts.test.js test/edge-functions.test.js test/interaction-sequence-canvas.test.js`
- [x] 2.3 `node scripts/acceptance/device-token-issue-compensation.cjs`
- [x] 2.4 `node scripts/acceptance/link-code-exchange.cjs`
- [x] 2.5 `node scripts/acceptance/sync-heartbeat.cjs`
- [x] 2.6 `node scripts/acceptance/ingest-duplicate-replay.cjs`
- [x] 2.7 `node scripts/acceptance/ingest-service-role-upsert.cjs`
- [x] 2.8 `node scripts/acceptance/ingest-batch-metrics.cjs`
- [x] 2.9 `npm run build:insforge`
- [x] 2.10 `npm run build:insforge:check`
- [x] 2.11 `npm run ci:local`
