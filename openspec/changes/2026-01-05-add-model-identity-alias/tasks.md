## 1. Spec
- [x] Draft requirements analysis + acceptance criteria + test strategy + milestones.
- [x] Add model identity requirements to spec delta.
- [x] Validate change with `openspec validate 2026-01-05-add-model-identity-alias --strict`.

## 2. Backend
- [x] Add model identity alias resolver in `insforge-src/shared`.
- [x] Update usage endpoints to emit `model_id` + display `model` and to filter by canonical.
- [x] Update usage model breakdown to aggregate by canonical and output display name.
- [x] Build `insforge-functions` output.

## 3. Frontend
- [x] Update model breakdown / Top Models to use `model_id` as stable key.
- [x] Update mocks to include `model_id` where relevant.

## 4. Tests & Verification
- [x] Add unit/integration tests for alias mapping and canonical filtering.
- [x] Run regression tests and record results.
