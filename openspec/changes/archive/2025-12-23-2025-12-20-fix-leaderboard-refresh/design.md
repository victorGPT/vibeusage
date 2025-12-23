# Design: Stabilize leaderboard refresh automation

## First-principles diagnosis
A scheduled refresh succeeds only if **all** of the following are true:
1. **Reachability**: the workflow calls a public `INSFORGE_BASE_URL` reachable from GitHub Actions.
2. **Authorization**: the bearer token in the request **exactly matches** the refresh function's internal admin key (`getServiceRoleKey()`), otherwise the function returns `401` immediately.
3. **Database privileges**: the refresh function uses the admin key to read from `vibescore_leaderboard_source_*` views and write into `vibescore_leaderboard_snapshots`.

The code shows a strict equality check between the request bearer token and the runtime admin key; any mismatch is fatal before any DB work. The workflow currently selects `INSFORGE_API_KEY` or `INSFORGE_SERVICE_ROLE_KEY`, which only works if the chosen secret **is identical** to the runtime admin key. This is the most brittle and likely failure point when runs succeed once and then repeatedly fail.

A secondary failure mode is the `total` period: it depends on `vibescore_leaderboard_source_total` existing and being readable. If that view is missing or access is denied, refresh fails for that period and the workflow aborts the job.

## Module Brief (Integration Gate)
- **Scope (IN):** GitHub Actions automation, refresh endpoint invocation, and observability for `vibescore-leaderboard-refresh`.
- **Scope (OUT):** Changes to leaderboard ranking logic, data model schema, or user-facing leaderboard API.
- **Interfaces:**
  - Input: `POST /functions/vibescore-leaderboard-refresh?period=day|week|month|total`
  - Auth: `Authorization: Bearer <service_role_key>` (must match runtime admin key)
  - Output: JSON with `generated_at` and per-period `results`.
- **Data flow & constraints:**
  - GitHub Actions -> Edge Function -> DB views -> snapshots table.
  - Token equality is strict; no tolerance or fallback.
  - Refresh must remain idempotent for the same `(period, from_day, to_day)` window.
- **Non-negotiables:**
  - Admin token must be service-role level.
  - Snapshot writes must use admin privileges to bypass user RLS.
  - Automation logs must expose HTTP status and response body per period.
- **Test strategy:**
  - Manual `curl` for each period with the admin token.
  - Confirm `generated_at` advances via `GET /functions/vibescore-leaderboard?period=...`.
  - GitHub Actions run succeeds and logs status + body.
- **Milestones:**
  1) Capture failing run evidence (status + body).
  2) Align secrets and update workflow logging.
  3) Manual resync of all periods.
  4) Verify scheduled runs over 24 hours.
- **Plan B triggers:**
  - If auth is correct but refresh still fails with DB errors, move refresh to a server-side scheduled job inside InsForge (no external auth) or create a dedicated admin-only token with explicit DB grants.

## Options
- **Option A (Minimal, preferred):** Fix secrets and improve workflow diagnostics; keep refresh endpoint unchanged unless diagnostics require small changes.
- **Option B:** Add a dedicated automation token and allow refresh endpoint to accept it separately; reduces blast radius if the service role key rotates.
- **Option C:** Move refresh scheduling into the backend (cron inside InsForge) to remove GitHub dependency.

Chosen: **Option A** for lowest complexity and fastest recovery.

## Sync plan (after fix)
1. Manually call refresh for each period (`day`, `week`, `month`, `total`) with the admin token.
2. Verify `generated_at` changes in `GET /functions/vibescore-leaderboard?period=...`.
3. Re-enable/monitor the scheduled GitHub Action; confirm at least two consecutive successful runs.

## Assumptions
- The admin token in GitHub Secrets should be the same value as the Edge Function runtime service role key.
- The `vibescore_leaderboard_source_*` views exist and are accessible to the service role.
