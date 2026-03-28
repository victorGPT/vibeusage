## 1. Implementation

- [ ] 1.1 Add failing regression coverage for the ESM-only hard cut: remaining legacy slugs must load from `insforge-src/functions-esm/`, build/load scripts must stop referencing `insforge-src/functions/`, and interaction/acceptance fixtures must stop depending on legacy sources.
- [ ] 1.2 Migrate the remaining non-ingest legacy functions to `insforge-src/functions-esm/` and delete their CommonJS author sources.
- [ ] 1.3 Migrate `vibeusage-ingest` and its direct shared dependencies to an ESM-only executable path, then delete the CommonJS ingest entry source.
- [ ] 1.4 Hard cut the build and load graph to `insforge-src/functions-esm/` only, rebuild `insforge-functions/`, and remove legacy fallback behavior.
- [ ] 1.5 Update acceptance scripts, interaction-sequence tooling, OpenSpec, and active docs so they all describe the same ESM-only deploy contract.
- [ ] 1.6 Deploy the migrated functions through Insforge and capture live smoke evidence plus freeze-record updates.

## 2. Verification

- [ ] 2.1 `openspec validate 2026-03-29-refactor-remaining-edge-functions-esm-hard-cut --strict`
- [ ] 2.2 `node --test test/insforge-esm-artifacts.test.js test/edge-functions.test.js test/interaction-sequence-canvas.test.js`
- [ ] 2.3 `node scripts/acceptance/device-token-issue-compensation.cjs`
- [ ] 2.4 `node scripts/acceptance/link-code-exchange.cjs`
- [ ] 2.5 `node scripts/acceptance/sync-heartbeat.cjs`
- [ ] 2.6 `node scripts/acceptance/ingest-duplicate-replay.cjs`
- [ ] 2.7 `node scripts/acceptance/ingest-service-role-upsert.cjs`
- [ ] 2.8 `node scripts/acceptance/ingest-batch-metrics.cjs`
- [ ] 2.9 `npm run build:insforge`
- [ ] 2.10 `npm run build:insforge:check`
- [ ] 2.11 `npm run ci:local`
