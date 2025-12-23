## ADDED Requirements
### Requirement: Backend probe SHOULD adapt its cadence
The dashboard SHALL adapt probe cadence based on backend health, using longer intervals on success and shorter retries on failure, without changing the external interface.

#### Scenario: Stable backend
- **WHEN** the backend probe succeeds repeatedly
- **THEN** the probe interval SHALL back off to reduce unnecessary load

#### Scenario: Backend failure
- **WHEN** the backend probe fails
- **THEN** the system SHALL retry using a shorter interval before declaring the backend down
