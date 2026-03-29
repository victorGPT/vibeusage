## Context

Before this change, the repository had already proved the ESM deploy path with the usage, identity, public-view, and pricing-sync batches. The remaining legacy functions still kept the build graph in a dual state because `scripts/build-insforge-functions.cjs` scanned both `insforge-src/functions/` and `insforge-src/functions-esm/`, and `scripts/lib/load-edge-function.cjs` preserved a migrated whitelist plus generated-artifact fallback.

The requested change is a hard cut. That means no compatibility wrappers, no fallback branch for unmigrated functions, and no long-lived CJS-only shared dependency path. The deployed artifact contract also moves to ESM-only without local SDK import injection.

## Goals / Non-Goals

- Goals:
  - Make `insforge-src/functions-esm/` the only active author path for edge functions
  - Preserve the current HTTP contracts, auth boundaries, idempotency behavior, and merge-duplicates ingest path
  - Remove build-time and load-time dual paths from the repository
  - Keep active docs and OpenSpec aligned with the final code before closure
  - Deploy the migrated functions and capture live evidence
- Non-Goals:
  - Redesigning endpoint schemas or auth semantics
  - Rewriting archived plans or archived change history
  - Reintroducing local SDK import fallbacks, CommonJS entrypoints, or generated-artifact fallback loading

## Decisions

- Decision: migrate non-ingest functions first and isolate `vibeusage-ingest` as the last batch
  - Why: `vibeusage-ingest` depends on concurrency plus ingest core/db helpers and has the highest replay/idempotency risk

- Decision: hard-cut build and local loader after the final legacy entrypoint is migrated
  - Why: the repository must not keep a compatibility branch after the migration lands

- Decision: generated artifacts use a runtime-safe client loader that prefers injected `globalThis.createClient` and otherwise dynamically imports `npm:@insforge/sdk`
  - Why: live Insforge ESM probes showed the runtime executes ESM correctly but does not always inject `globalThis.createClient`; preserving a dynamic npm import as an external dependency keeps one ESM-only contract without restoring legacy CommonJS or dual author paths

- Decision: treat doc/spec reconciliation as a blocking post-commit gate
  - Why: the user explicitly requires code and active docs to be unified immediately after each task commit window

## Risks / Trade-offs

- `vibeusage-ingest` currently depends on CJS-oriented helper modules that must gain ESM-consumable equivalents without changing ingest behavior
- Acceptance scripts currently load some legacy sources directly; the test harness must be unified or it will reintroduce a second source-of-truth
- The build and loader cutover will affect broad regression coverage, so the contract tests must be strengthened before production code changes
- The build must keep `npm:@insforge/sdk` external so Node-based local tests do not try to resolve a Deno npm specifier while live Insforge deployments can still load it at runtime
- Remote verification depends on endpoint-level smoke after deploy because artifact upload success alone does not prove the client factory exists in the target runtime

## Verification

- `node --test test/insforge-esm-artifacts.test.js`
- `node --test test/edge-functions.test.js`
- `node --test test/interaction-sequence-canvas.test.js`
- `node scripts/acceptance/device-token-issue-compensation.cjs`
- `node scripts/acceptance/link-code-exchange.cjs`
- `node scripts/acceptance/sync-heartbeat.cjs`
- `node scripts/acceptance/ingest-duplicate-replay.cjs`
- `node scripts/acceptance/ingest-service-role-upsert.cjs`
- `node scripts/acceptance/ingest-batch-metrics.cjs`
- `npm run build:insforge`
- `npm run build:insforge:check`
- `npm run ci:local`
- `openspec validate 2026-03-29-refactor-remaining-edge-functions-esm-hard-cut --strict`
