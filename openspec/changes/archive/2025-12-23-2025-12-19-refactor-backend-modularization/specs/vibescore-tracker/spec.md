## ADDED Requirements

### Requirement: Edge Functions are modular in-source but single-file in deployment
The system SHALL keep Edge Function source code modular (multi-file) while still producing single-file deployable artifacts, to respect InsForge2's single-file Edge Function deployment constraint.

#### Scenario: Build generates deployable single-file artifacts
- **GIVEN** a developer modifies shared Edge Function logic (e.g., auth/CORS helpers)
- **WHEN** the developer runs the Edge Function build script
- **THEN** the repository SHALL generate updated deployable artifacts under `insforge-functions/`
- **AND** each artifact SHALL remain a single file exporting `module.exports = async function(request) { ... }`

