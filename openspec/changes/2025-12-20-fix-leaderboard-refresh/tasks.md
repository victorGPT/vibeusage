# Tasks

- [ ] Capture GitHub Actions failure evidence (HTTP status + response body) from the latest "Refresh Leaderboard Snapshots" run and attach it to the change notes.
- [ ] Audit and align secrets: ensure `INSFORGE_BASE_URL` is the public base URL, and the workflow token equals the runtime admin key (`INSFORGE_SERVICE_ROLE_KEY`).
- [x] Update `.github/workflows/vibescore-leaderboard-refresh.yml` to log per-period status + body (e.g., `curl -w`), and keep failures explicit.
- [ ] (If required) add a small diagnostic response path in the refresh endpoint to surface DB errors clearly.
- [ ] Add a short runbook to `BACKEND_API.md` for manual refresh + verification.
- [ ] Verification:
  - Run manual refresh for each period with `curl` and confirm `success: true`.
  - Call `GET /functions/vibescore-leaderboard?period=...` and verify `generated_at` advances.
  - Trigger `workflow_dispatch` and confirm the job completes successfully.
