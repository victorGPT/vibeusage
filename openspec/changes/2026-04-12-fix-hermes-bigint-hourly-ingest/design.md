## Goal

Hermes can emit per-bucket token counts above the PostgreSQL `integer` ceiling. `vibeusage_tracker_hourly` still accepts/writes those fields as `integer` on live Insforge, which causes hourly upserts to fail even though ingest batch rows land.

## Minimal complete fix

1. Change all raw token columns on `public.vibeusage_tracker_hourly` to `bigint`.
2. Keep the ingest write path string-safe for large integers so JSON/PostgREST does not coerce through JS `Number`.
3. Preserve `billable_rule_version` as a normal integer.
4. Recreate dependent views separately only where live deployment requires it (`scripts/ops/hermes-token-bigint-migration.sql`).

## Scope

- `vibeusage_tracker_hourly` schema
- Hermes hourly/project ingest parsing/build rows
- Regression test for bigint-scale payloads

## Non-goals

- Rewriting archived historical openspec SQL
- Changing leaderboard rank field types