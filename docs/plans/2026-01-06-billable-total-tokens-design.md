# Billable Total Tokens Backfill Design

> Decision: Option C (full backfill on hourly rows)

**Goal**
- Make `billable_total_tokens` the single source of truth for usage totals.
- Backfill historical `vibescore_tracker_hourly` rows so historical data stays comparable.
- Keep online load low by running backfill offline with throttling and resume.

**Non-Goals**
- No daily rollup backfill (rollup remains disabled).
- No retroactive pricing changes beyond the current billing rule.

## Architecture
- **Source of truth:** `vibescore_tracker_hourly.billable_total_tokens`.
- **Compute location:** only in write path (ingest) and offline backfill.
- **Read path:** aggregate `billable_total_tokens` only. Temporary fallback to computed billable for NULL rows until backfill completes, then remove fallback.
- **Rollup:** continue deriving daily/monthly/summary from hourly; if rollup is enabled later, rebuild from hourly.

## Data Model
- Add columns on `vibescore_tracker_hourly`:
  - `billable_total_tokens` (bigint, nullable during backfill).
  - `billable_rule_version` (smallint, optional but recommended for rule upgrades).
- Migration (Postgres example):
```sql
alter table public.vibescore_tracker_hourly
  add column if not exists billable_total_tokens bigint,
  add column if not exists billable_rule_version smallint;
```
- Optional backfill index (temporary, drop after backfill):
```sql
create index concurrently if not exists vibescore_tracker_hourly_billable_null_idx
  on public.vibescore_tracker_hourly (hour_start)
  where billable_total_tokens is null;
```

## Write Path
- Ingest path computes `billable_total_tokens` using `computeBillableTotalTokens` and writes it alongside raw token fields.
- When `billable_rule_version` is available, write it with the current rule version.
- Upsert key (existing): `user_id,device_id,source,model,hour_start` (same key used by ingest upsert).

## Backfill Job
- Script: `scripts/ops/billable-total-tokens-backfill.cjs`.
- Behavior:
  - Scan hourly rows by time window (UTC) or by primary key range.
  - Only update rows where `billable_total_tokens IS NULL` (idempotent).
  - Update predicate uses the upsert key: `user_id,device_id,source,model,hour_start`.
  - Throttle with batch size + sleep to reduce load.
  - Resume support (last processed timestamp/ID).
  - Dry-run mode to report row counts and estimated updates.

## Fallback Rules (Temporary)
- Aggregation logic: use `billable_total_tokens` when present; otherwise compute once with `computeBillableTotalTokens`.
- Never sum both raw totals and computed billable in the same row (avoid double-count).
- Remove fallback once `billable_total_tokens IS NULL` count is zero.

## Rollout
1. Ship write-path changes + backfill script.
2. Run dry-run to estimate volume and cost.
3. Backfill in low-traffic windows with throttling.
4. Verify NULL count is zero, then remove fallback from read path.

## Validation
- `SELECT count(*) FROM vibescore_tracker_hourly WHERE billable_total_tokens IS NULL;`
- Sample compare: recompute billable totals on a small window and validate against stored values.
- Smoke regression:
  - `node --test test/edge-functions.test.js`

## Risks & Mitigations
- **DB load:** throttle + low-traffic execution + pause/resume.
- **Rule drift:** pin `billable_rule_version` and track changes in code.
- **Partial backfill:** keep temporary fallback only until coverage is 100%.

## Regression Notes
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06, rerun)
- `node --test test/edge-functions.test.js` (FAIL, 2026-01-06) — expected until hourly aggregate + monthly billable paths are updated.
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06)
- `node --test test/edge-functions.test.js` (PASS, 2026-01-06)
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06, rerun)
- `node --test test/billable-total-tokens-backfill.test.js` (PASS, 2026-01-06, rerun)
- `node --test test/architecture-canvas.test.js` (PASS, 2026-01-06, rerun)
