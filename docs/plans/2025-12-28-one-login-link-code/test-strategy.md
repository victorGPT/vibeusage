# Test Strategy

## Objectives
- Validate link code issuance, expiry, and single-use exchange.
- Ensure UI copy/masking behavior follows copy registry and preserves full command for clipboard.

## Test Levels
- Unit:
  - UI masking logic and copy command composition.
  - Link code hashing and TTL calculation helpers.
- Integration:
  - Edge function: link code init/exchange with database.
  - Atomic exchange (single-use) behavior.
- Regression:
  - CLI `init` flow still succeeds with existing login path.
  - Dashboard login + install command rendering.
- Performance:
  - Not required for initial release; monitor exchange latency via function logs.

## Test Matrix
- Link code issuance -> Integration -> Backend -> Edge function tests
- Exchange atomic + idempotent -> Integration -> Backend -> RPC/DB transaction test
- UI masking + copy -> Unit -> Frontend -> Component/unit tests
- Expiry handling -> Integration -> Backend -> Edge function tests

## Environments
- Local dev (InsForge + dashboard + CLI).

## Automation Plan
- Add edge function tests for exchange/expiry/idempotency.
- Add frontend tests for copy/mask behavior.
- Add acceptance script for CLI init with link code.

## Entry / Exit Criteria
- Entry: Requirements and acceptance criteria approved.
- Exit: All unit/integration tests pass; regression path verified.

## Coverage Risks
- Cross-platform clipboard behavior not fully automated (manual check required).
