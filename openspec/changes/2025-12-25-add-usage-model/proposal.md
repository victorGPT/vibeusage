# Change: Add model dimension to usage tracking

## Why
- Model-level visibility is required; current `source` only identifies channel, not model.

## What Changes
- Add `model` to half-hour buckets and ingest upsert keys.
- Capture `message.model` from Claude JSONL; apply fallback when missing.
- Add optional `model` filter to usage endpoints.
- Backfill legacy rows to `model = "unknown"` and set `model` non-nullable.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: CLI parser, ingest edge function, usage endpoints, DB schema.
- **BREAKING**: Potential DB unique constraint change (requires migration).

## Architecture / Flow
- CLI parses usage -> bucket includes `source` + `model` -> queue -> ingest upserts by `user_id + device_id + source + model + hour_start`.
- Usage endpoints accept optional `model` filter; default aggregates across models.

## Risks & Mitigations
- Cardinality increase: monitor query latency; add index on `(user_id, device_id, source, model, hour_start)`.
- Missing model: apply fallback `unknown` to avoid nulls.
- Backfill impact: run migration in low-traffic window; validate row count before/after.

## Rollout / Milestones
- M1 Requirements & Acceptance
- M2 Proposal + Spec Delta
- M3 CLI parser tests
- M4 Ingest + endpoints integration tests
- M5 Release + smoke verification
