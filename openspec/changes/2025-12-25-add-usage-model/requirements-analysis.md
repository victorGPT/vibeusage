# Requirement Analysis

## Goal
- Add a model dimension to half-hour usage aggregation and querying, starting from new ingests only.

## Scope
- In scope:
  - Capture `model` from Claude Code JSONL (`message.model`) during sync.
  - Persist `model` with half-hour buckets and update ingest upsert keys to include model.
  - Provide optional `model` query filters on usage endpoints (daily/hourly/summary/heatmap).
  - Default model when missing or when backfill is explicitly required.
- Out of scope:
  - Retroactive backfill of historical rows by default.
  - UI changes beyond wiring existing endpoints (unless explicitly requested).
  - Storing or uploading any prompt/response content.

## Users / Actors
- CLI users (Codex/Every Code/Claude Code).
- Backend ingestion service.
- Dashboard consumers (optional model filters).

## Inputs
- Claude JSONL: `message.model`, `message.usage.*`, `timestamp`.
- Existing bucket payloads from CLI.

## Outputs
- Half-hour buckets with `model` persisted.
- Usage endpoints optionally filtered by `model`.

## Business Rules
- Backfill existing rows to `model = "unknown"` when migration is applied.
- If a bucket lacks model, apply fallback model `unknown`.
- Buckets are keyed by `user_id + device_id + source + model + hour_start`.

## Assumptions
- Claude JSONL always contains `message.model` for usage records, or fallback will be used.
- Adding a model column and unique constraint change is acceptable for the DB.

## Dependencies
- InsForge DB migration for `model` column + backfill + unique key update.
- Edge function updates in `vibescore-ingest` and usage endpoints.
- CLI parser updates for Claude logs.

## Risks
- Cardinality increase for buckets (per model per half-hour).
- Query performance regressions on usage endpoints.
- Mixed model data within a single half-hour if model switches mid-session.
