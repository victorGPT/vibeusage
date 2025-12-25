# Change: Add usage model breakdown endpoint

## Why
- The dashboard needs a reliable backend aggregate for model distribution and cost analysis.
- Client-side aggregation from raw hourly rows is inefficient and inconsistent.

## What Changes
- Add a new edge function `vibescore-usage-model-breakdown`.
- Aggregate `vibescore_tracker_hourly` by `source` + `model` for a requested date range.
- Return pricing metadata consistent with `vibescore-usage-summary`.
- Update API docs and verification artifacts.

## Impact
- Affected specs: `vibescore-tracker`.
- Affected code: `insforge-src/functions`, `insforge-functions`, docs.
- **BREAKING**: None.

## Architecture / Flow
- Request -> auth -> parse date range + source -> query hourly rows -> group by source/model -> compute totals + costs -> respond JSON.

## Risks & Mitigations
- Large ranges: use pagination and consider DB-side aggregation with fallback.
- Cost accuracy: document that pricing uses the default profile.
- Legacy null models: normalize to `unknown` in response.

## Rollout / Milestones
- M1 Requirements & Acceptance
- M2 Proposal + Spec Delta
- M3 Implementation + Unit Tests
- M4 Integration Verification
- M5 Deploy + Docs
