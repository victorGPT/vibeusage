# Verification Report

## Scope
- Local unit/regression tests for InsForge usage guardrails and logging.
- Remote acceptance checks for oversized ranges and slow-query logs on production InsForge.

## Tests Run
- `npm test` (node --test test/*.test.js)
- `npm run build:insforge`
- Oversized range calls:
  - `GET /functions/vibescore-usage-summary?from=2024-01-01&to=2025-12-31`
  - `GET /functions/vibescore-usage-daily?from=2024-01-01&to=2025-12-31`
  - `GET /functions/vibescore-usage-model-breakdown?from=2024-01-01&to=2025-12-31`
- Valid range calls (365 days) after temporary slow-query threshold override:
  - `GET /functions/vibescore-usage-summary?from=2025-01-01&to=2025-12-31` (Authorization: `Bearer <REDACTED>`)
  - `GET /functions/vibescore-usage-daily?from=2025-01-01&to=2025-12-31` (Authorization: `Bearer <REDACTED>`)
  - `GET /functions/vibescore-usage-model-breakdown?from=2025-01-01&to=2025-12-31` (Authorization: `Bearer <REDACTED>`)
- InsForge logs pulled via MCP:
  - `function.logs`
  - `insforge.logs`

## Results
- `npm test` passed (131 tests).
- Oversized range acceptance passed on production after deployment:
  - `vibescore-usage-summary` → `400`
  - `vibescore-usage-daily` → `400`
  - `vibescore-usage-model-breakdown` → `400`
- Temporarily set `VIBESCORE_SLOW_QUERY_MS` default to `1ms` (no env var) and redeployed usage functions.
- `slow_query` logs still not observed in `function.logs` or `insforge.logs` after running valid 365-day requests (responses observed at ~0.3–2.1s).
- Restored default slow-query threshold to `2000ms` and redeployed usage functions.

## Evidence
- Terminal output captured in CLI session (2025-12-30, 2025-12-31).
- InsForge MCP log snapshots captured (2025-12-31).

## Remaining Risks
- Guardrail thresholds may be incorrect until validated in staging.
- Slow-query logs not observed in available MCP log sources even with 1ms threshold; log sink visibility may be limited or needs alternate capture.
