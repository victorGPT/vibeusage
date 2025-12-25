## 1. Spec
- [x] Add model-dimension requirements to spec delta.
- [x] Confirm backfill policy and fallback model behavior.

## 2. Data / Backend
- [x] Add `model` column to `vibescore_tracker_hourly` and backfill to `unknown`; update key to include `model`.
- [x] Update ingest function to accept/store `model` with fallback `unknown` when missing.
- [x] Update usage endpoints to support optional `model` query filter.

## 3. CLI
- [x] Parse `message.model` from Claude JSONL and attach to buckets.
- [x] Apply fallback model `unknown` when model is missing.

## 4. Tests
- [x] Unit: Claude parser extracts model + fallback.
- [x] Integration: ingest upserts with model dimension.
- [x] Integration: usage endpoints filter by model.
- [x] Regression: existing usage endpoints behavior unchanged without model.
- [x] Replay/idempotency: re-ingest same bucket with model yields no double-count.

## 5. Verification
- [x] `node --test` for CLI parser.
- [x] Edge function test suite for ingest + endpoints.
- [ ] Manual smoke: Claude session -> bucket includes model -> sync upload.
- [ ] Manual smoke: query usage endpoints with `model` filter using real `user_jwt`.

## 6. Release
- [x] Apply DB migration (model backfill + new PK).
- [x] Deploy updated edge functions (ingest + usage endpoints).
- [x] Publish CLI package update (`@vibescore/tracker@0.0.8`).
