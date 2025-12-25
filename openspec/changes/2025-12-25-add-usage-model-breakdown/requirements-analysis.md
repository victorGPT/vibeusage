# Requirement Analysis

## Goal
- Provide a backend aggregation endpoint that returns per-source, per-model usage totals (and estimated cost) for a date range so the dashboard can render the model breakdown and cost modal.

## Scope
- In scope:
  - New edge function `vibescore-usage-model-breakdown`.
  - Auth via `Bearer <user_jwt>`.
  - Inputs: `from`, `to`, optional `tz`/`tz_offset_minutes`, optional `source`.
  - Output grouped totals by `source` and `model` with pricing metadata.
  - Normalize missing `model` to `unknown`.
  - Docs + verification artifacts.
- Out of scope:
  - Frontend integration.
  - New pricing tables per model (use current pricing profile only).
  - Ingest changes or data backfill.

## Users / Actors
- Dashboard frontend (signed-in user).
- Backend ops / docs consumers.

## Inputs
- HTTP GET query params: `from`, `to`, `tz`/`tz_offset_minutes`, optional `source`.
- Authorization header: `Bearer <user_jwt>`.

## Outputs
- JSON response with `from`, `to`, `days`, `sources[]` (grouped totals incl. `total_cost_usd`), and `pricing` metadata.

## Business Rules
- Aggregate from `vibescore_tracker_hourly` within the normalized local date range.
- Group by `source` and `model`.
- If `model` is null/empty, return `unknown`.
- Totals and cost fields are strings.
- Costs use the same pricing profile as `vibescore-usage-summary`.

## Assumptions
- `vibescore_tracker_hourly` already stores `source` and `model`.
- Existing auth, date, and pricing helpers are reused.
- Model values are normalized at ingest; legacy nulls are rare.

## Dependencies
- InsForge auth helpers, database access, date helpers, pricing helpers.
- `getSourceParam` and shared model normalization.

## Risks
- Large ranges may require pagination or DB-side aggregation to avoid memory pressure.
- Pricing profile is global; cost by model is approximate.
- Legacy rows lacking model normalization could skew distribution.
