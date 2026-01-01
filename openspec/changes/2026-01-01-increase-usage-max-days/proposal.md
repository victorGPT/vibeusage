# Change: Increase default usage max-day guardrail to 800 days

## Why
- The dashboard "total" period queries a ~24-month window (~730 days), which exceeds the current default (370 days) and returns HTTP 400.
- We need a higher default while keeping guardrails in place.

## What Changes
- Update the default `VIBESCORE_USAGE_MAX_DAYS` to 800 days in the shared guardrail helper.
- Keep the env override behavior intact.
- Update documentation to reflect the new default.

## Impact
- Affected specs: `vibescore-tracker`.
- Affected code: `insforge-src/shared/date.js`, usage endpoints relying on the default, tests, `BACKEND_API.md`.
- **BREAKING**: None (guardrail remains; default only increases).

## Architecture / Flow
- Guardrail enforcement remains at request validation, only the default threshold changes.

## Risks & Mitigations
- Risk: Larger default range could increase query latency or load.
  - Mitigation: Env override remains available; existing slow-query logging retained.

## Rollout / Milestones
- M1/M2: Requirements + OpenSpec proposal approved.
- M3: Implement default change + tests + docs.
- M4: Regression + acceptance checks.
