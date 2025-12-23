## ADDED Requirements
### Requirement: Usage summary includes total cost
The system SHALL return `total_cost_usd` in the usage summary response, computed from token totals using a pricing profile. The computation MUST avoid double-counting cached input and reasoning output tokens by treating them as subcategories of input and output, respectively. The response SHALL include pricing metadata indicating the model, pricing mode, and rates used.

#### Scenario: Summary response includes cost and pricing basis
- **WHEN** a user requests `GET /functions/vibescore-usage-summary` for a date range
- **THEN** the response SHALL include `totals.total_cost_usd` as a string
- **AND** the response SHALL include pricing metadata (`model`, `pricing_mode`, `rates`)
- **AND** cached input tokens SHALL be billed at cached rates without being billed again as full input tokens

### Requirement: Dashboard shows cost only in total summary
The dashboard SHALL display usage cost only in the total summary for day/week/month/total views, and SHALL NOT display per-day or per-month cost rows.

#### Scenario: Daily and monthly views show cost only in summary
- **WHEN** a signed-in user views day, week, or month usage
- **THEN** cost SHALL appear only in the total summary
- **AND** daily or monthly rows SHALL NOT show cost values
