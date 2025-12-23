# Change: Add usage source dimension (multi-product)

## Why
- We need to track token usage across multiple CLI products (Codex, Every Code, Claude Code, Gemini CLI) without conflating sources.
- Using device_id to separate sources is a temporary workaround that does not scale for long-term product analytics.

## What Changes
- Ingest accepts optional `source` on half-hour buckets and defaults missing/empty values to `codex`.
- Storage and dedupe keys include `source` so different products do not collide.
- Usage queries accept optional `source` to filter; when omitted, results aggregate across sources (preserve current behavior).

## Impact
- Affected specs: vibescore-tracker
- Affected code: `insforge-src/functions/*`, database schema/migrations, dashboard query hooks (if/when UI adds source filter), CLI uploader (optional)
- **BREAKING**: none (backward compatible defaults)

## Architecture / Flow
- Client emits half-hour buckets with optional `source` -> ingest normalizes default `codex` -> store with `source` -> queries can filter by `source` or aggregate across all.

## Risks & Mitigations
- Risk: Inconsistent source values (typos) → Mitigation: normalize to lowercase, treat empty as `codex`, cap length.
- Risk: Historical rows missing source → Mitigation: backfill or default to `codex` at query time.

## Rollout / Milestones
- M1: Spec + schema change validated
- M2: Ingest + query compatibility tests
- M3: Optional dashboard filter (future)
