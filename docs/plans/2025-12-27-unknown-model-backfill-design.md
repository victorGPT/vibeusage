# Unknown Model Backfill Design (Half-hour Dominant Model)

## Summary
Reduce model = "unknown" by reassigning unknown token totals to the dominant known model within the same source + half-hour bucket. Keep known models separate. If no known model exists in the bucket, keep unknown.

## Goals
- Minimize unknown model buckets without cross-file inference.
- Preserve per-model separation for known models.
- Keep total token counts unchanged.
- Maintain idempotent sync behavior.

## Non-Goals
- No backend or schema changes.
- No dashboard filtering changes.
- No cross-file or cross-session model inference.

## Approach
Parse token_count events as usual, but accumulate per-bucket totals by model (including unknown). At enqueue time, choose the dominant known model (max total_tokens) and move unknown totals into it. If no known models exist, emit unknown as-is.

## Data Flow
rollout JSONL -> parseRolloutFile -> per-bucket modelTotals -> enqueueTouchedBuckets -> queue.jsonl -> uploader -> ingest

## Algorithm
- Track bucket.modelTotals: Map<model, totals>.
- When token_count arrives:
  - If current model is known, add delta to modelTotals[model].
  - If current model is unknown, add delta to modelTotals["unknown"].
- At enqueue:
  - If any known models exist, find dominant known model by total_tokens.
  - Add unknown totals into dominant known model.
  - Do not enqueue an unknown model bucket in that case.
  - If no known models exist, enqueue unknown as-is.
- Tie-breaker: deterministic (lexicographic model name).

## Edge Cases
- Multiple known models within the same half-hour: keep both, only reassign unknown.
- Only unknown models in a half-hour: keep unknown.
- Identical dominant totals: select lexicographic to keep idempotent output.

## Risks
- Unknown may be attributed to a dominant known model even if it came from a different model in the same half-hour.
- Historical buckets may change if users re-run sync (expected).

## Verification
- Unit tests for backfill behavior and tie-breaker.
- Regression: repeat sync with no new events does not change totals.

## Rollout
- Ship as CLI parser change only.
- Optional manual backfill: remove cursors/queue and re-run sync to re-derive buckets.
