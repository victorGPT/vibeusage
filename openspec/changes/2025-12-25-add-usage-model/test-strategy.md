# Test Strategy

## Objectives
- Verify model dimension is captured, persisted, and queryable without regressing existing usage aggregation.
- Ensure ingestion remains idempotent with the new key that includes `model`.
- Confirm Claude parser correctly extracts `message.model` and applies fallback.

## Test Levels
- Unit:
  - Claude JSONL parsing: model extraction + fallback.
  - Source/model normalization and bucket key composition.
- Integration:
  - `vibescore-ingest` upsert with `model` field.
  - Usage endpoints with optional `model` filter.
- Regression:
  - Existing usage endpoints without `model` behave identically.
  - CLI `sync` still queues/ingests without model for non-Claude sources.
- Performance:
  - Spot-check query latency for usage endpoints with and without model filter.

## Test Matrix
- Ingest persists model -> Integration -> Backend -> Edge function tests
- Model filter optional -> Integration -> Backend -> Endpoint tests
- Claude parser emits model -> Unit -> CLI -> Parser tests
- Missing model fallback -> Unit -> CLI -> Parser tests
- Backfill legacy rows -> Regression -> Backend -> Migration + smoke verification

## Environments
- Local Node test runner for CLI tests.
- InsForge local/staging for function tests (if available).

## Automation Plan
- Extend existing `node --test` suites for CLI parsing.
- Add/extend edge-function tests for ingest and model filtering.
- Add a replay test: re-ingest the same bucket with model and verify no duplicate totals.

## Entry / Exit Criteria
- Entry:
  - OpenSpec proposal approved.
  - DB migration plan drafted.
- Exit:
  - All unit + integration + regression tests pass.
  - Manual smoke: Claude session end produces modelled buckets; `sync` uploads without errors.

## Coverage Risks
- Query performance regressions due to increased cardinality.
- Backfill runtime impact and lock duration on large tables.
