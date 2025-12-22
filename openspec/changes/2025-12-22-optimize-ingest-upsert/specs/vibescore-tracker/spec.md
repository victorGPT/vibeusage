## ADDED Requirements
### Requirement: Service-role ingest avoids redundant pre-reads
When ingesting with service-role credentials, the system MUST avoid a pre-read of existing events by default and SHOULD use an upsert-with-ignore-duplicates strategy to preserve idempotency.

#### Scenario: Service-role ingest uses upsert fast path
- **GIVEN** a service-role token
- **WHEN** the device uploads a batch with potential duplicate `event_id`
- **THEN** the server SHALL attempt an `on_conflict` insert with `ignore-duplicates`
- **AND** fall back to the legacy path only if upsert is unsupported
