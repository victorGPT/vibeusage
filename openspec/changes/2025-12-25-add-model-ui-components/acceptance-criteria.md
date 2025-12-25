# Acceptance Criteria

## Feature: Dashboard model insights UI

### Requirement: Model breakdown map component is available
- Rationale: Provide a reusable map for model share distribution.

#### Scenario: Map renders with fleet data
- WHEN `NeuralDivergenceMap` receives `fleetData` with model shares
- THEN it SHALL render a list of fleets with model mix bars
- AND it SHALL render a title using the copy registry

### Requirement: Model breakdown is surfaced on the dashboard
- Rationale: Users must see the model mix without wiring custom pages.

#### Scenario: Dashboard renders model breakdown map
- WHEN a signed-in user opens the dashboard
- THEN the model breakdown map SHALL render between the usage summary and trend panel
- AND it SHALL be populated from `GET /functions/vibescore-usage-model-breakdown`

### Requirement: Cost analysis modal component is available
- Rationale: Provide a reusable modal for cost breakdown details.

#### Scenario: Modal toggles visibility
- WHEN `CostAnalysisModal` is rendered with `isOpen=false`
- THEN it SHALL render nothing
- AND WHEN `isOpen=true` it SHALL render the modal contents

### Requirement: Cost info affordance opens the modal
- Rationale: Users need a direct path from the cost value to detailed breakdown.

#### Scenario: Cost icon opens modal
- GIVEN the dashboard summary displays `total_cost_usd`
- WHEN the user clicks the cost info `[?]` affordance
- THEN the cost analysis modal SHALL open

### Requirement: All visible text is copy-registry driven
- Rationale: Enforce Copy Registry governance.

#### Scenario: No hardcoded UI text
- WHEN the new components render
- THEN all visible labels and captions SHALL come from `copy()` keys

### Requirement: Module titles use mainstream labels
- Rationale: Align with common dashboard naming conventions.

#### Scenario: Titles are user-facing
- WHEN the map and modal are rendered
- THEN their titles SHALL use mainstream labels (e.g. "Model Breakdown", "Cost Breakdown")
