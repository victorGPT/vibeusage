## ADDED Requirements
### Requirement: New edge functions emit M1 structured logs
The system SHALL emit structured request logs for `vibescore-user-status`, `vibescore-entitlements`, `vibescore-entitlements-revoke`, `vibescore-usage-model-breakdown`, and `vibescore-pricing-sync`. Each log entry SHALL include `request_id`, `function`, `stage`, `status`, `latency_ms`, `error_code`, `upstream_status`, and `upstream_latency_ms`.

#### Scenario: Request completes with a response
- **WHEN** a client calls any listed endpoint
- **THEN** the function SHALL emit a structured log entry containing all required fields.

#### Scenario: Pricing sync records upstream status
- **GIVEN** `vibescore-pricing-sync` calls the OpenRouter Models API
- **WHEN** the upstream request completes
- **THEN** the log entry SHALL include upstream HTTP status and latency.
