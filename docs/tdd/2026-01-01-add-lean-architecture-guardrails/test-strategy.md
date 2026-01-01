# Test Strategy

## Objectives
- Verify architecture guardrails without introducing heavy operational overhead.
- Ensure security and privacy invariants hold across CLI, Edge Functions, and Dashboard.
- Keep regression scope small for a small team.

## Test Levels
- Unit:
  - Normalization and validation helpers (UUID, payload checks).
  - Schema rule checks (lint-style validations where applicable).
- Integration:
  - Edge Functions with database mocks for boundary enforcement.
- Regression:
  - CLI sync + ingest idempotency path.
  - Dashboard reads via Edge Functions.
- Performance:
  - Query range limits enforced (max days).
  - Aggregate path preferred when available.

## Test Matrix
- Module boundaries -> Integration -> Backend/CLI owners -> API contract tests
- Client SDK boundary -> Unit -> Frontend/CLI owners -> guardrail script checks
- Postgres single source of truth -> Regression -> Backend owners -> storage path review checklist
- Data minimization -> Integration -> Backend owners -> ingest allowlist tests
- Schema safety -> Unit/Review -> Backend owners -> migration checklist
- Performance guardrails -> Regression -> Backend owners -> range-limit tests

## Environments
- Local Node test environment.
- InsForge dev environment (optional for integration verification).

## Automation Plan
- Extend `node --test test/edge-functions.test.js` for boundary cases.
- Add lightweight schema/contract checks in CI (future task).
- Enforce client SDK/internal URL guardrails via `scripts/validate-architecture-guardrails.cjs`.

## Entry / Exit Criteria
- Entry: Requirements + acceptance criteria approved.
- Exit: All regression tests pass; no new high-risk paths uncovered.

## Coverage Risks
- Guardrails enforced by process rather than automated checks.
- RLS verification may require staging data and manual validation.
