# Requirement Analysis

## Goal
- Add reusable dashboard UI components for model breakdown and cost analysis with copy-registry compliant labels.

## Scope
- In scope:
  - Port `MatrixConstants`, `NeuralAdaptiveFleet`, `NeuralDivergenceMap`, and `CostAnalysisModal` into `dashboard/src/ui/matrix-a/components`.
  - Replace all visible text with `copy()` keys from `dashboard/src/content/copy.csv`.
  - Use mainstream module titles for the two new UI modules.
  - Wire the model map + cost modal into `DashboardPage`.
  - Fetch model breakdown data from `GET /functions/vibescore-usage-model-breakdown`.
- Out of scope:
  - New backend endpoints or data aggregation logic (handled by separate change).
  - UX changes beyond the new components.

## Users / Actors
- Dashboard developers consuming the UI library.
- End users viewing model and cost breakdowns.

## Inputs
- `GET /functions/vibescore-usage-model-breakdown` response.
- `fleetData` props shaped as:
  - `[{ label, totalPercent, usd, models: [{ name, share, calc? }] }]`.

## Outputs
- UI components rendered in `DashboardPage` with backend data mapped into model share bars and cost breakdown modal.

## Business Rules
- All visible text MUST come from `dashboard/src/content/copy.csv`.
- Components must handle empty arrays without throwing.
- Titles must be mainstream, user-facing labels.

## Assumptions
- Data assembly (model shares and cost values) is handled by the page or hook layer.
- The breakdown endpoint is available and authenticated with `user_jwt`.

## Dependencies
- `dashboard/src/lib/copy.js` and `dashboard/src/content/copy.csv`.
- Existing `AsciiBox` component.
- `dashboard/src/lib/vibescore-api.js` and breakdown endpoint.

## Risks
- Missing copy keys causing blank UI or console warnings.
- Data shape mismatches when mapping breakdown response into `fleetData`.
