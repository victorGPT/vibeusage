# Requirement Analysis

## Goal
- Allow the dashboard "total" window (last ~24 months) to succeed by raising the default usage max-day guardrail to 800 days while keeping the guardrail in place.

## Scope
- In scope:
  - Default `VIBESCORE_USAGE_MAX_DAYS` behavior for `vibescore-usage-summary`, `vibescore-usage-daily`, and `vibescore-usage-model-breakdown`.
  - Documentation updates for the default limit.
- Out of scope:
  - Dashboard range calculation changes or client-side chunking.
  - Any schema or data model changes.
  - Performance optimizations beyond existing query paths.

## Users / Actors
- Dashboard users (user JWT).
- InsForge edge functions (Deno runtime).
- Operators configuring env vars.

## Inputs
- HTTP query parameters: `from`, `to`, `source`, `model`, `tz`, `tz_offset_minutes`.
- Environment variable: `VIBESCORE_USAGE_MAX_DAYS` (default changes to 800).

## Outputs
- HTTP 200 for valid ranges (<= 800 days by default).
- HTTP 400 with max-day error message for oversized ranges (> 800 days by default).

## Business Rules
- The system MUST keep the day-range guardrail and only change the default value to 800 days.
- `VIBESCORE_USAGE_MAX_DAYS` MUST continue to override the default when set.
- Response shapes for valid requests MUST remain unchanged.

## Assumptions
- A default of 800 days safely covers a 24-month window (~730 days).
- Operators can reduce the range via env var if runtime pressure increases.

## Dependencies
- `insforge-src/shared/date.js` guardrail helper.
- Usage endpoints that call `getUsageMaxDays()`.
- `BACKEND_API.md` and `openspec/specs/vibescore-tracker/spec.md` documentation.

## Risks
- Larger default range may increase query latency or load.
  - Mitigation: env override remains available; existing slow-query logging remains active.
