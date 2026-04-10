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
- Integration lifecycle source of truth:
  - `src/lib/integrations/`
  - `src/commands/init.js`
  - `src/commands/status.js`
  - `src/lib/diagnostics.js`
  - `src/commands/uninstall.js`
- Common hotspots:
  - init/install flow: `src/commands/init.js`, `src/lib/integrations/`, `src/lib/hermes-config.js`, `src/templates/hermes-vibeusage-plugin/`
  - integration status/diagnostics: `src/commands/status.js`, `src/lib/diagnostics.js`, `src/lib/hermes-usage-ledger.js`
  - sync pipeline: `src/commands/sync.js`, `src/lib/rollout.js`, `src/lib/hermes-usage-ledger.js`, `src/lib/opencode-sqlite.js`, `src/lib/upload.js`
  - local state/config: `src/lib/runtime-config.js`, `src/lib/tracker-paths.js`, `src/lib/fs.js`, `src/lib/hermes-config.js`
  - InsForge CLI wrappers and device-token flows: `src/lib/insforge-client.js`, `src/lib/vibeusage-api.js`
- Hard-cut CLI integration contract:
  - `init` is the only supported command that mutates local AI CLI integration config.
  - `status`, `diagnostics`, `doctor`, and `sync` are read-only with respect to integration setup.
  - Legacy activation/auto-heal files were removed; do not reintroduce alternate integration entrypoints outside `src/lib/integrations/`.
- Root InsForge SDK loading contract:
  - Start at `src/lib/insforge-client.js` before touching CLI/device-token InsForge behavior.
  - Root CommonJS entrypoints load the official SDK via async `import("@insforge/sdk")`; direct `require("@insforge/sdk")` is not the repository-supported path.

### Dashboard

- Start here for web UI work:
  - `dashboard/src/main.jsx`
  - `dashboard/src/App.jsx`
  - `dashboard/src/pages/`
  - `dashboard/src/hooks/`
  - `dashboard/src/ui/matrix-a/components/`
- Auth/session integration first-read path:
  - `dashboard/src/main.jsx`
  - `dashboard/src/App.jsx`
  - `dashboard/src/lib/insforge-auth-client.ts`
  - `dashboard/src/lib/insforge-client.ts`
  - `dashboard/src/lib/vibeusage-api.ts`
- Dashboard InsForge session contract:
  - Hosted-auth restore is repository-owned and runs directly on `@insforge/sdk`; the dashboard does not use `@insforge/react` / `@insforge/react-router` as a runtime restore layer.
  - SDK session persistence and runtime session store are repository-owned and wrap the SDK token manager; `App.jsx` subscribes to that store instead of caching its own session truth.
  - Official refresh/state primitives currently used by local code are `auth.refreshSession()`, `auth.getCurrentUser()`, and `auth.signOut()`.
  - OAuth redirect entrypoints stay repository-owned, while PKCE callback exchange continues to run inside the SDK client.
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
  - Generated artifacts inject `npm:@insforge/sdk` and bind `globalThis.createClient` inside the artifact.
  - The live runtime does not provide `globalThis.createClient` automatically.
- Use generated artifacts only for deployment validation and deployment, not as authoring sources.

### Scripts And Validation

- Build and deploy helpers:
  - `scripts/build-insforge-functions.cjs`
  - `scripts/lib/load-edge-function.cjs`
- Acceptance and smoke:
  - `scripts/acceptance/`
  - `scripts/smoke/`
- Policy and validation:
  - `scripts/ops/pr-risk-layer-gate.cjs`
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
  - `docs/ops/pr-review-preflight.md`
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
