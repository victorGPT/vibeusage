# Module Brief: Unknown Model Backfill (CLI Parser)

## Scope
- IN: CLI parser aggregation and enqueue logic to reassign unknown totals within same source + half-hour.
- OUT: backend schema, ingest logic, dashboard filtering, cross-file inference.

## Interfaces
- Input: rollout JSONL token_count + turn_context within src/lib/rollout.js
- Output: queue.jsonl half-hour buckets consumed by uploader

## Data Flow and Constraints
- Backfill only within the same source + half-hour bucket.
- Do not merge known models with each other.
- Preserve total token counts.
- Deterministic tie-breaker for dominant model.

## Non-Negotiables
- Do not read or store conversational content.
- Do not infer models across files or sessions.
- Keep unknown when no known models exist.

## Test Strategy
- Unit tests for backfill logic and tie-breaker.
- Regression: sync idempotency and existing parser tests.

## Milestones
- M1: Requirements + acceptance + spec delta drafted.
- M2: Parser change implemented with unit tests.
- M3: Regression run and verification report updated.

## Plan B Triggers
- If backfill causes inconsistent totals or non-deterministic output, revert to unknown preservation.

## Upgrade Plan (disabled)
- None.
