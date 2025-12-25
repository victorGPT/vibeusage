# Verification Report

## Scope
- Usage model breakdown endpoint.

## Tests Run
- `npm run build:insforge`
- `node scripts/acceptance/usage-model-breakdown.cjs`

## Results
- Passed.

## Evidence
- Build output: `Built 15 InsForge edge functions into insforge-functions/`.
- Acceptance output: `{ ok: true, sources: ["codex", "every-code"], codex_total: "30" }`.

## Remaining Risks
- Live endpoint not re-validated in this run.
- Model values depend on client-provided `model`; missing values appear as `unknown`.
