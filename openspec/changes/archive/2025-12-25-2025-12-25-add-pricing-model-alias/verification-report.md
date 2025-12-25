# Verification Report

## Scope
- Pricing model alias mapping and sync behavior.

## Tests Run
- `node scripts/acceptance/pricing-model-alias.cjs`
- `node scripts/acceptance/openrouter-pricing-sync.cjs`
- `node scripts/acceptance/usage-summary-aggregate.cjs`
- `node scripts/acceptance/usage-model-breakdown.cjs`
- `npm run build:insforge`
- SQL: create alias table + policies + sequence grant
- Live sync: `POST /functions/vibescore-pricing-sync` (retention_days=90)
- SQL: unmatched usage models check

## Results
- Alias resolution acceptance passed.
- Pricing sync acceptance passed (alias generation + retention).
- Summary and model breakdown acceptance passed.
- InsForge build succeeded.
- Live sync inserted alias rows.
- No unmatched usage models after alias generation.

## Evidence
- Acceptance outputs:
  - `pricing-model-alias.cjs` -> `ok: true`.
  - `openrouter-pricing-sync.cjs` -> `ok: true`, `alias_upserts: 1`.
  - `usage-summary-aggregate.cjs` -> `ok: true`.
  - `usage-model-breakdown.cjs` -> `ok: true`.
- Deployments:
  - `vibescore-pricing-sync` updated at `2025-12-25T20:09:50.525Z`.
  - `vibescore-usage-summary` updated at `2025-12-25T20:09:51.111Z`.
  - `vibescore-usage-model-breakdown` updated at `2025-12-25T20:09:51.664Z`.
- Live sync response: `aliases_generated: 3`, `aliases_upserted: 3`.
- SQL check: unmatched usage models returned 0 rows.

## Remaining Risks
- Vendor rules cover only `claude-*` and `gpt-*` prefixes.
- New vendor prefixes will require explicit rule additions.
