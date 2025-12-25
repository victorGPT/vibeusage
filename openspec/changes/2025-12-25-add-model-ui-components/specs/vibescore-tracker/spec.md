## ADDED Requirements
### Requirement: Dashboard UI library exposes model breakdown components
The system SHALL provide reusable UI components for model mix visualization and cost analysis in the dashboard UI library.

#### Scenario: UI library components exist
- **WHEN** a developer imports the components from `dashboard/src/ui/matrix-a/components`
- **THEN** `NeuralDivergenceMap` and `CostAnalysisModal` SHALL be available for use

### Requirement: UI copy is registry-driven
The system SHALL source all visible text in the new components from `dashboard/src/content/copy.csv`.

#### Scenario: No hardcoded text
- **WHEN** the components render
- **THEN** visible titles and labels SHALL come from `copy()` keys

### Requirement: Module titles are mainstream labels
The system SHALL use user-facing titles that follow common dashboard terminology.

#### Scenario: Titles align with common naming
- **WHEN** the map and modal render
- **THEN** their titles SHALL use labels such as "Model Breakdown" and "Cost Breakdown"

### Requirement: Dashboard surfaces model breakdown and cost modal
The dashboard SHALL render the model breakdown map and SHALL provide a cost breakdown modal accessible from the usage summary cost value.

#### Scenario: Cost info opens modal
- **GIVEN** the dashboard summary displays `total_cost_usd`
- **WHEN** the user clicks the cost info affordance
- **THEN** the cost breakdown modal SHALL open

#### Scenario: Model breakdown map renders on dashboard
- **WHEN** a signed-in user opens the dashboard
- **THEN** the model breakdown map SHALL render alongside the usage summary and trend panels
