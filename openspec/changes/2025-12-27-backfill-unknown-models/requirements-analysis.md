# Requirement Analysis

## Goal
- Reduce "unknown" model buckets by reassigning unknown totals to the dominant known model within the same source + half-hour bucket, while preserving known model separation.

## Scope
- In scope:
  - CLI parser aggregation and enqueue logic for model attribution.
  - Deterministic dominant model selection within a half-hour bucket.
- Out of scope:
  - Backend schema or ingest changes.
  - Dashboard filtering changes.
  - Cross-file or cross-session model inference.

## Users / Actors
- Codex CLI users and Every Code users relying on model breakdown.

## Inputs
- rollout JSONL token_count events
- turn_context model hints (when available)

## Outputs
- queue.jsonl half-hour buckets with model attribution

## Business Rules
- Only reassign unknown when a known model exists in the same source + half-hour bucket.
- Known models remain separate; no merging among known models.
- Deterministic tie-breaker when dominant totals are equal.
- If no known models exist, keep unknown.

## Assumptions
- token_count events do not include model.
- turn_context model appears intermittently within a file.
- Total tokens must remain unchanged after backfill.

## Dependencies
- src/lib/rollout.js aggregation pipeline
- Existing tests in test/rollout-parser.test.js

## Risks
- Unknown totals may be attributed to a dominant model that did not generate all unknown usage.
- Re-running sync can change per-model distribution for past buckets.
