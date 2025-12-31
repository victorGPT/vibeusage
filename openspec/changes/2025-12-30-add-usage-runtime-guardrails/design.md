## Context
- InsForge function logs show proxy failures at 2025-12-30T19:17:31Z across multiple usage endpoints.
- We need bounded queries and actionable observability to reduce runtime resets.

## Goals / Non-Goals
- Goals:
  - Bound day-range queries for usage endpoints.
  - Emit slow-query logs with minimal overhead.
  - Keep response contracts intact for valid requests.
- Non-Goals:
  - New aggregation tables or schema changes.
  - Dashboard UI redesign or new user controls.

## Decisions
- Decision: Enforce max day-range for summary/daily/model-breakdown.
  - Rationale: These endpoints accept `from/to` and can scan long ranges; bounding prevents runaway scans.
  - Default: `VIBESCORE_USAGE_MAX_DAYS=370` (52 weeks + buffer).
- Decision: Emit `slow_query` logs with threshold `VIBESCORE_SLOW_QUERY_MS` (default 2000ms).
  - Rationale: Provides early signals without high log volume.
- Decision: Keep heatmap/monthly existing limits; only log slow queries.

## Risks / Trade-offs
- Range cap may block legitimate long-history views.
  - Mitigation: Configurable max days and clear error response.
- Logging overhead in hot paths.
  - Mitigation: Only log when over threshold and minimal payload.

## Migration Plan
- Add guardrails and logging in source, rebuild `insforge-functions`, deploy.
- Monitor slow-query logs and adjust thresholds if necessary.

## Open Questions
- Final accepted max day range for summary/daily/model-breakdown?
- Should we surface range-limit errors in dashboard UI messaging?
