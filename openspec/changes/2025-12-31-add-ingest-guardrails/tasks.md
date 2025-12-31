## 1. Specification
- [x] Draft requirements analysis + acceptance criteria + test strategy + milestones
- [x] Add OpenSpec delta for M1 logs, ingest concurrency guard, and canary probe

## 2. Implementation
- [x] Add concurrency guard helper and wire into `vibescore-ingest`
- [x] Add M1 logging wrapper to `vibescore-ingest`, `vibescore-device-token-issue`, `vibescore-sync-ping`
- [x] Add canary script (ops)
- [x] Enforce canary isolation + tag guard in canary script
- [x] Exclude canary buckets from usage queries by default
- [x] Add synthetic acceptance script for concurrency guard
- [x] Update backend docs for 429 + env vars
- [x] Rebuild `insforge-functions`

## 3. Tests & Verification
- [x] Add/adjust tests for ingest concurrency guard
- [x] Add/adjust tests for canary exclusion behavior
- [x] Define regression steps and expected signals
