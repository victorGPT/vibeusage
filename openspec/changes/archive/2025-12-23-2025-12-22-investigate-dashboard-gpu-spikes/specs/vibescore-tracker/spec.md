# Spec Delta: vibescore-tracker

## ADDED Requirements
### Requirement: Dashboard GPU spike investigation is reproducible
The system SHALL maintain a repeatable runbook for diagnosing idle GPU spikes on the dashboard, including baseline measurement, isolation steps, and evidence capture.

#### Scenario: Investigator can reproduce and isolate spikes
- **GIVEN** a dashboard idle GPU spike is reported
- **WHEN** the investigator follows the runbook
- **THEN** they SHALL be able to reproduce the spike, isolate major contributors, and record evidence (trace or screenshots)
