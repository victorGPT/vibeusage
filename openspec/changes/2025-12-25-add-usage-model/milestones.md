# Milestones

## M1 - Requirements & Acceptance
- Entry criteria:
  - TDD intake complete.
- Exit criteria:
  - Requirement analysis + acceptance criteria approved.
- Required artifacts:
  - `requirements-analysis.md`, `acceptance-criteria.md`.

## M2 - OpenSpec Proposal (if applicable)
- Entry criteria:
  - M1 complete.
- Exit criteria:
  - Proposal + tasks + spec delta validated (`openspec validate --strict`).
- Required artifacts:
  - `proposal.md`, `tasks.md`, `specs/vibescore-tracker/spec.md`.

## M3 - Unit Test Coverage
- Entry criteria:
  - M2 approved for implementation.
- Exit criteria:
  - CLI parser unit tests for model extraction + fallback pass.
- Required artifacts:
  - Updated CLI tests.

## M4 - Regression & Integration
- Entry criteria:
  - M3 complete.
- Exit criteria:
  - Ingest + usage endpoint integration tests pass.
  - Replay/idempotency test passes.
- Required artifacts:
  - Edge function tests + run logs.

## M5 - Release & Monitoring
- Entry criteria:
  - M4 complete.
- Exit criteria:
  - Deployment notes and smoke verification recorded.
- Required artifacts:
  - Verification report and freeze record (if applicable).
