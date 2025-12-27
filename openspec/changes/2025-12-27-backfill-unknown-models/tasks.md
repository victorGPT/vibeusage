## 1. Spec
- [x] Add spec delta for unknown backfill rules and deterministic tie-breaker.

## 2. CLI Parser
- [x] Track per-bucket model totals (including unknown) during rollout parsing.
- [x] Reassign unknown totals to dominant known model at enqueue time.
- [x] Keep known models separate and deterministic tie-breaker.
- [x] Align every-code unknown buckets to nearest codex dominant model (past or future).
- [x] Retract prior every-code alignment when the nearest codex model changes.
- [x] Retract unknown bucket when a known model appears later in the same half-hour.
- [x] Recompute every-code alignment when codex buckets update without new every-code events.

## 3. Tests
- [x] Add unit tests for backfill and tie-breaker in test/rollout-parser.test.js.
- [x] Add unit tests for every-code alignment and nearest-codex tie-breaker.
- [x] Run parser regression tests and record results.
- [x] Add unit test coverage for alignment change retractions.
- [x] Add unit test coverage for unknown retraction after known appears.
- [x] Add unit test coverage for codex-only alignment recomputation.

## 4. Docs
- [x] Link design doc and backfill notes (optional) if needed.

## 5. Verification
- [x] Update verification-report.md with commands and results.
