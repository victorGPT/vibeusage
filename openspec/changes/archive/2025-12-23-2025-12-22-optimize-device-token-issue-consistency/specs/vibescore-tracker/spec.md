## ADDED Requirements
### Requirement: Device token issuance SHALL compensate on partial failure
The system SHALL attempt to remove the newly created device record if token insertion fails, to avoid leaving orphaned devices.

#### Scenario: Token insert fails
- **WHEN** the device record is created but token insert fails
- **THEN** the system SHALL attempt to delete the newly created device record
- **AND** the endpoint SHALL return an error without exposing sensitive data
