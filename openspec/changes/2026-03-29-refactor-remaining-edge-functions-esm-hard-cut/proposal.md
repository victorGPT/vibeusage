# Change: Hard cut remaining edge functions onto the single ESM deploy contract

## Why

The repository still publishes edge functions through a split build graph: some slugs author from `insforge-src/functions-esm/`, while the remaining legacy slugs still author from `insforge-src/functions/` and rely on a CommonJS deploy shape. That leaves production deployment on a hidden dual track, which violates the single-source-of-truth rule and keeps active documentation out of sync with the real deploy contract.

## What Changes

- Migrate the remaining legacy edge functions from `insforge-src/functions/` to `insforge-src/functions-esm/`
- Remove the legacy CommonJS author path and any build or loader fallback that preserves it
- Update acceptance tooling, tests, OpenSpec, and active docs so the repository describes one ESM-only deploy contract
- Deploy the migrated functions through Insforge and record live smoke evidence in the freeze record

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `insforge-src/functions/`
  - `insforge-src/functions-esm/`
  - `insforge-src/shared/`
  - `insforge-functions/`
  - `scripts/build-insforge-functions.cjs`
  - `scripts/lib/load-edge-function.cjs`
  - `scripts/acceptance/*`
  - `test/*`
  - `docs/repo-sitemap.md`
  - `docs/deployment/freeze.md`
  - `BACKEND_API.md`
  - `openspec/project.md`
