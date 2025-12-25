# Change: Add model breakdown UI components

## Why
- The dashboard needs a model mix map and a cost analysis modal powered by the new breakdown endpoint.

## What Changes
- Add four UI components to `dashboard/src/ui/matrix-a/components`.
- Wire `NeuralDivergenceMap` + `CostAnalysisModal` into `DashboardPage`.
- Fetch model breakdown data from `GET /functions/vibescore-usage-model-breakdown`.
- Replace hardcoded labels with copy registry keys.
- Use mainstream titles for the new modules.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: Dashboard UI components, hooks, API client, mock data, copy registry.
- **BREAKING**: None (additive UI + endpoint consumption).

## Architecture / Flow
- `useUsageModelBreakdown` pulls data from the breakdown endpoint.
- `DashboardPage` maps response -> `fleetData` for map + modal.
- Components remain presentational and receive `fleetData` props.

## Risks & Mitigations
- Copy registry omissions -> add explicit copy keys and validate.
- Data shape mismatch -> normalize in `DashboardPage` and guard empty states.

## Rollout / Milestones
- M1 Requirements & Acceptance
- M2 Proposal + Spec Delta
- M3 Component Implementation
- M4 Manual Verification
- M5 Release
