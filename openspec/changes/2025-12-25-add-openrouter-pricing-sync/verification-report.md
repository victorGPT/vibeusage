# Verification Report

## Scope
- OpenRouter pricing sync, resolver selection, retention behavior, and ops health checks.

## Tests Run
- `node scripts/acceptance/openrouter-pricing-sync.cjs`
- `node scripts/acceptance/usage-summary-aggregate.cjs`
- `node scripts/acceptance/usage-model-breakdown.cjs`
- `npm run build:insforge`
- `grant usage on pricing_id sequence to project_admin` (via InsForge SQL)
- `POST /functions/vibescore-pricing-sync` (live)
- SQL check: `select ... from vibescore_pricing_profiles where source='openrouter'`

## Results
- Pricing sync acceptance passed (upsert + retention behavior).
- Summary and model breakdown acceptance passed.
- InsForge build succeeded.
- Live sync inserted OpenRouter pricing rows.
- Ops health check script added.

## Evidence
- Pricing sync acceptance output: `ok: true` (2 upserts, retention cutoff `2025-09-26`).
- Summary aggregate acceptance output: `ok: true` (totals and cost computed).
- Model breakdown acceptance output: `ok: true` (sources and totals consistent).
- Deployments:
  - `vibescore-usage-summary` updated at `2025-12-25T19:26:44.939Z`.
  - `vibescore-usage-model-breakdown` updated at `2025-12-25T19:26:45.701Z`.
  - `vibescore-pricing-sync` created at `2025-12-25T19:26:54.284Z`.
- Live sync response: `models_processed: 351`, `rows_upserted: 351`, `retention_days: 90`.
- SQL verification (sample): rows with `source='openrouter'` present (created_at `2025-12-25T19:40:04.622Z`).
- Ops health check: `scripts/ops/pricing-sync-health.sql` + `docs/ops/pricing-sync-health.md`.

## Remaining Risks
- OpenRouter schema drift could require mapping updates; tests cover only current fields.
- `OPENROUTER_API_KEY` and pricing defaults must be configured in InsForge env before schedule runs.
