## Context
The dashboard fetches usage summary/daily and heatmap data from the backend. The heatmap hook already caches to `localStorage`, but usage summary/daily does not. When the backend fails, summary/daily are cleared, leaving blank panels even though prior data exists.

## Goals / Non-Goals
- Goals:
  - Preserve and display last-known usage data when the backend is unavailable.
  - Keep UX honest by marking cached data as stale with a timestamp.
  - Keep implementation minimal and aligned with existing `localStorage` usage.
- Non-Goals:
  - Offline writes or background sync.
  - Cross-device cache sharing.
  - Long-term cache retention policies beyond showing timestamps.

## Decisions
- Use `localStorage` for persistence (already used by `useActivityHeatmap`).
- Cache key includes user identity + period + range + includeDaily to avoid cross-user leakage.
- Apply a stale-while-revalidate flow: render cache immediately, then fetch; on error, keep cached data and set source=`cache`.
- Store metadata: `fetchedAt`, `period`, `from`, `to`, `summary`, `daily`.
- No hard TTL for display; rely on visible timestamp to avoid misleading freshness.

## Alternatives Considered
- IndexedDB or Service Worker cache: higher complexity and not required for MVP.
- Server-side cache: does not help offline or client-side failures.
- Memory-only cache: lost on refresh, fails the "first impression" requirement.

## Risks / Trade-offs
- Stale data could be mistaken for current data → mitigate with explicit "cached" label and timestamp.
- Storage quota/private mode failures → fall back gracefully to in-memory state.
- Auth changes could show another user's data → mitigate via per-user cache keys.

## Migration Plan
- No migration required. Cache populates on the next successful fetch.
- Rollback by disabling cache read path and clearing `localStorage` keys.

## Open Questions
- Should we also clear cached usage data on sign-out, or rely on user-scoped keys only?
- Where should the stale indicator live (Usage panel vs global footer)?
