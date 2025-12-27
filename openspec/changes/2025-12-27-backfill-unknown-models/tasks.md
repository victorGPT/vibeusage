## 1. Spec
- [ ] Add spec delta for unknown backfill rules and deterministic tie-breaker.

## 2. CLI Parser
- [ ] Track per-bucket model totals (including unknown) during rollout parsing.
- [ ] Reassign unknown totals to dominant known model at enqueue time.
- [ ] Keep known models separate and deterministic tie-breaker.

## 3. Tests
- [ ] Add unit tests for backfill and tie-breaker in test/rollout-parser.test.js.
- [ ] Run parser regression tests and record results.

## 4. Docs
- [ ] Link design doc and backfill notes (optional) if needed.

## 5. Verification
- [ ] Update verification-report.md with commands and results.
