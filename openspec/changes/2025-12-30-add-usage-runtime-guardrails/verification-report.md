# Verification Report

## Scope
- Local unit/regression tests for InsForge usage guardrails and logging.
- Remote acceptance checks for oversized ranges and slow-query logs on production InsForge.

## Tests Run
- `npm test` (node --test test/*.test.js)
- Oversized range calls:
  - `GET /functions/vibescore-usage-summary?from=2024-01-01&to=2025-12-31`
  - `GET /functions/vibescore-usage-daily?from=2024-01-01&to=2025-12-31`
  - `GET /functions/vibescore-usage-model-breakdown?from=2024-01-01&to=2025-12-31`
- InsForge logs pulled via MCP:
  - `function.logs`
  - `insforge.logs`
  - `postgREST.logs`

## Results
- `npm test` passed (131 tests).
- Oversized range acceptance failed on production: all three endpoints returned `200` with full payload instead of `400`.
- `slow_query` logs not observed in `function.logs` after the oversized-range requests.

## Evidence
- Terminal output captured in CLI session (2025-12-30).
- InsForge MCP log snapshots captured (2025-12-31).

## Remaining Risks
- Guardrail thresholds may be incorrect until validated in staging.
- Production does not enforce day-range guardrails yet; likely not deployed.
- Slow-query logs not observed in production logs (likely due to missing deployment).
