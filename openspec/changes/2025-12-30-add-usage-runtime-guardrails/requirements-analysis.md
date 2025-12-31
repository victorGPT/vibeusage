# Requirement Analysis

## Goal
- Prevent InsForge edge runtime instability caused by heavy read queries, while preserving correct usage results.

## Scope
- In scope:
  - Usage read endpoints: `vibescore-usage-summary`, `vibescore-usage-daily`, `vibescore-usage-hourly`, `vibescore-usage-monthly`, `vibescore-usage-heatmap`, `vibescore-usage-model-breakdown`.
  - Slow-query observability with structured logs.
  - Server-side guardrails on query range for day-based endpoints.
- Out of scope:
  - New data models or aggregation tables.
  - Dashboard UI changes beyond existing error handling.
  - Infrastructure-level autoscaling or runtime configuration outside functions.

## Users / Actors
- Dashboard users (user JWT).
- InsForge edge functions (Deno runtime).
- Operators investigating incidents.

## Inputs
- HTTP query parameters: `from`, `to`, `day`, `months`, `weeks`, `tz`, `tz_offset_minutes`, `source`, `model`.
- Environment variables:
  - `VIBESCORE_SLOW_QUERY_MS` (slow-query threshold, default 2000).
  - `VIBESCORE_USAGE_MAX_DAYS` (max range in days, default 370).

## Outputs
- HTTP 200 responses for valid requests.
- HTTP 400 responses for invalid or oversized ranges.
- Structured logs with `stage=slow_query` and query metadata.

## Business Rules
- Day-range endpoints MUST reject requests whose day window exceeds the maximum range.
- Slow-query logging MUST only trigger when duration >= threshold to avoid log noise.
- Guardrails MUST preserve existing output shape for valid requests.

## Assumptions
- Dashboard requests stay within 52-week windows; a 370-day cap is sufficient.
- Returning HTTP 400 for oversized ranges is acceptable to clients.
- Log volume remains manageable with thresholded slow-query logging.

## Dependencies
- InsForge logs ingestion.
- `@insforge/sdk` database client behavior.
- Edge runtime environment variables.

## Risks
- Thresholds too low could reject legitimate backfills.
- Thresholds too high could miss early warning signals.
- Log payloads could omit critical context without careful field selection.
