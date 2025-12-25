# Change: Restore Edge function availability and add client-side timeouts

## Why
- Edge function proxy to the Deno runtime is returning `ECONNRESET`, causing long hangs and 502s for usage and ingest endpoints.
- The CLI `init` path currently waits on a full `sync` run, which stalls when the backend is unresponsive.

## What Changes
- Re-deploy the affected Edge functions to restore runtime availability.
- Add bounded timeouts and graceful fallback in the CLI and dashboard so failures exit predictably.
- Keep existing API contracts and data models unchanged.

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code: `src/commands/init.js`, `src/lib/insforge-client.js`, `dashboard/src/lib/insforge-client.js`, `dashboard/src/lib/vibescore-api.js`
- **BREAKING**: No

## Architecture / Flow
- CLI `init` remains responsible for installing notify hooks, then attempts a best-effort `sync` with a bounded timeout.
- Dashboard usage requests use a client-side timeout; on timeout, the UI exits loading and falls back to cached data or a surfaced error.

## Risks & Mitigations
- Risk: Backend still unstable after redeploy.
  - Mitigation: Add client-side timeouts and clear error messaging; re-check runtime logs post-deploy.
- Risk: Timeout too short for large uploads.
  - Mitigation: Keep timeout configurable; default remains conservative.

## Rollout / Milestones
- M1: Confirm backend proxy errors and capture logs.
- M2: Re-deploy Edge functions and re-validate endpoints.
- M3: Implement CLI + dashboard timeout resilience.
- M4: Regression verification and documentation notes.
