# Repository Sitemap

## Purpose

This document is the single source of truth for repository navigation. Use it to locate the active modules, find the current entrypoints, and understand which files should be read first for non-trivial changes.

## How To Use

1. Start with the top-level map.
2. Open only the section that matches the area you are changing.
3. Follow the listed file paths before reading broader directories.
4. Update this document when a change alters active module boundaries, data flow, or the preferred entry files.

## Top-Level Map

- `bin/`
  - CLI entrypoints shipped to users.
- `src/`
  - Local tracker runtime, parsing, sync, auth, storage, and command implementation.
- `dashboard/`
  - React/Vite web app and public web assets.
- `insforge-src/functions-esm/`
  - Authoritative source for all live `vibeusage-*` InsForge edge functions.
- `insforge-src/shared/`
  - Shared backend helpers; ESM authoring helpers live in `*.mjs`.
- `insforge-src/functions/`
  - Retired legacy CommonJS path. Do not use for authoring, tests, or deploy decisions.
- `insforge-functions/`
  - Generated single-file ESM deploy artifacts. Do not edit by hand.
- `scripts/`
  - Operational scripts, validation scripts, build helpers, smoke checks, and acceptance tooling.
- `test/`
  - Node test suite for CLI, edge functions, scripts, and regression coverage.
- `docs/`
  - Runbooks, plans, PR notes, retrospective records, and navigation docs.
- `openspec/`
  - Change proposals, tasks, designs, and stable requirements.

## Core Runtime Areas

### CLI Runtime

- Start here for user-facing CLI behavior:
  - `bin/tracker.js`
  - `src/commands/`
  - `src/lib/`
- Common hotspots:
  - init/install flow: `src/commands/init.js`
  - sync pipeline: `src/commands/sync.js`, `src/lib/rollout.js`, `src/lib/upload.js`
  - local state/config: `src/lib/config.js`, `src/lib/state.js`

### Dashboard

- Start here for web UI work:
  - `dashboard/src/App.jsx`
  - `dashboard/src/pages/`
  - `dashboard/src/hooks/`
  - `dashboard/src/ui/matrix-a/components/`
- Copy and content source of truth:
  - `dashboard/src/content/copy.csv`
- Public web assets:
  - `dashboard/public/`
- Model display rule:
  - Usage dashboards should prefer backend-provided `display_model` for presentation.
  - `model_id` remains the only canonical key for filtering, pricing, and aggregation.
- Model display debug path:
  - Start at `dashboard/src/hooks/use-usage-model-breakdown.ts` for live fetch, cache fallback, and live snapshot reuse.
  - Then read `dashboard/src/lib/model-breakdown.ts` for final fleet/top-model label derivation.
  - Then read `dashboard/src/pages/DashboardPage.jsx` for summary-level fallback selection.
  - Then read `dashboard/src/ui/matrix-a/components/TopModelsPanel.jsx`, `NeuralAdaptiveFleet.jsx`, and `CostAnalysisModal.jsx` for final rendered text.
  - Browser-local cache helpers live in `dashboard/src/lib/dashboard-cache.ts` and `dashboard/src/lib/dashboard-live-snapshot.ts`.

### Edge Functions

- Author source path:
  - `insforge-src/functions-esm/`
- Shared helpers consumed by ESM functions:
  - `insforge-src/functions-esm/shared/`
  - `insforge-src/shared/*.mjs`
- Retired path:
  - `insforge-src/functions/`
- Usage response contract hotspots:
  - `insforge-src/shared/usage-pricing-core.js`
  - `insforge-src/shared/usage-pricing-core.mjs`
  - `insforge-src/shared/usage-metrics-core.js`
  - `insforge-src/shared/usage-metrics-core.mjs`
- Usage summary and breakdown responses may expose both:
  - `model_id` as the canonical pricing and aggregation key
  - `display_model` as a response-only display field derived from `model_id` or `model`
- `vibeusage-pricing-sync` canonical identity sync rule:
  - deterministic raw-to-canonical aliases are backfilled to the earliest observed usage date in the scan window
  - pricing alias generation still consumes canonical models only; the backfill only affects `raw -> canonical`
- Generated deploy output:
  - `insforge-functions/`
- Build/load contract is ESM-only:
  - `scripts/build-insforge-functions.cjs`
  - `scripts/lib/load-edge-function.cjs`
- Runtime contract:
  - Generated artifacts expect the InsForge runtime to provide `globalThis.createClient`.
- Use generated artifacts only for deployment validation and deployment, not as authoring sources.

### Scripts And Validation

- Build and deploy helpers:
  - `scripts/build-insforge-functions.cjs`
  - `scripts/lib/load-edge-function.cjs`
- Acceptance and smoke:
  - `scripts/acceptance/`
  - `scripts/smoke/`
- Policy and validation:
  - `scripts/validate-architecture-guardrails.cjs`
  - `scripts/validate-copy-registry.cjs`
  - `scripts/validate-retros.cjs`

### Tests

- Primary test roots:
  - `test/*.test.js`
- Read the test file nearest to the module you are changing before widening scope.

## Documentation Map

- Product and backend overview:
  - `README.md`
  - `BACKEND_API.md`
- Workflow and runbooks:
  - `docs/ops/`
  - `docs/tdd/README.md`
- Coordination:
  - `docs/coordination/index.yaml`
  - `docs/coordination/tasks/`
- Architecture/navigation source of truth:
  - `docs/repo-sitemap.md`

## OpenSpec Map

- Project conventions:
  - `openspec/project.md`
  - `openspec/AGENTS.md`
- Active changes:
  - `openspec/changes/`
- Stable requirements:
  - `openspec/specs/vibeusage-tracker/spec.md`

## Update Triggers

Update this sitemap when any of the following changes:

- the preferred source path for a module
- cross-module data flow or ownership boundaries
- active build/deploy entrypoints
- the first-read files for a major workflow
