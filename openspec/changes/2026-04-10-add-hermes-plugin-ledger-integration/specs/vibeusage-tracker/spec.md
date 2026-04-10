## ADDED Requirements

### Requirement: Hermes integration is installed through `init` only

The system SHALL support Hermes as a first-class integration, and `vibeusage init` SHALL be the only supported command that installs or mutates Hermes integration state. Hermes integration state SHALL be expressed as a VibeUsage-managed Hermes plugin plus its expected local ledger contract.

#### Scenario: `init` installs Hermes plugin

- **GIVEN** Hermes is installed and its plugin directory is writable
- **WHEN** a user runs `npx vibeusage init`
- **THEN** the CLI SHALL install or reconcile the Hermes VibeUsage plugin
- **AND** the setup summary SHALL report Hermes using plugin terminology

#### Scenario: non-init commands stay read-only for Hermes setup

- **WHEN** a user runs `npx vibeusage sync`, `status`, `diagnostics`, or `doctor`
- **THEN** those commands SHALL NOT create, modify, or repair Hermes plugin files

### Requirement: Hermes usage collection uses a plugin-written local ledger

The system SHALL collect Hermes usage through a Hermes plugin that listens to lifecycle hooks and writes a local append-only usage ledger. That ledger SHALL be the only supported local source of Hermes usage truth. The system MUST NOT parse `~/.hermes/state.db`, `~/.hermes/sessions/`, trajectory files, or other Hermes internal stores for usage ingestion.

#### Scenario: Hermes usage is sourced only from ledger records

- **GIVEN** the Hermes plugin has written usage records to the local ledger
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** the client SHALL read Hermes usage only from that ledger
- **AND** it SHALL NOT inspect Hermes internal session or SQLite stores

#### Scenario: unsupported internal-store fallback is absent

- **GIVEN** the Hermes plugin ledger is missing
- **WHEN** the user runs `npx vibeusage sync`
- **THEN** the client SHALL report no Hermes ledger data available
- **AND** it SHALL NOT fall back to parsing Hermes internal stores

### Requirement: Hermes ledger stores only privacy-safe normalized usage facts

The Hermes plugin SHALL write only privacy-safe, minimal records required for usage aggregation: session boundaries, source identity, model/provider metadata, timestamps, and normalized numeric token usage. The ledger MUST NOT persist or upload prompt text, response text, reasoning text, tool arguments, tool results, raw request bodies, or raw response bodies.

#### Scenario: usage record excludes content fields

- **WHEN** Hermes completes an API request and the plugin writes a usage record
- **THEN** the record SHALL contain only allowed metadata and numeric token fields
- **AND** no prompt/response/tool/reasoning text SHALL be persisted

### Requirement: Hermes plugin hook path is local-only and non-blocking

The Hermes plugin SHALL use lifecycle hooks for local collection only and MUST NOT upload directly to the backend from hook execution. Hook work MUST remain append-only local ledger writes so that Hermes agent execution is not blocked on network sync.

#### Scenario: hook writes locally without direct upload

- **WHEN** the Hermes plugin handles a usage event
- **THEN** it SHALL append a local ledger record
- **AND** it SHALL NOT issue direct ingest or sync network requests from the hook path

### Requirement: Hermes sync maps normalized usage into half-hour buckets

The system SHALL incrementally parse the Hermes usage ledger, aggregate records into UTC half-hour buckets with `source = "hermes"`, and project normalized Hermes usage into the current upload contract without storing extra text fields. `cache_read_tokens + cache_write_tokens` SHALL map to `cached_input_tokens`, and `reasoning_tokens` SHALL map to `reasoning_output_tokens`.

#### Scenario: Hermes usage projects into upload bucket fields

- **WHEN** a Hermes ledger usage record contains normalized usage fields
- **THEN** `sync` SHALL aggregate it into a UTC half-hour bucket with `source = "hermes"`
- **AND** `cached_input_tokens` SHALL equal `cache_read_tokens + cache_write_tokens`
- **AND** `reasoning_output_tokens` SHALL equal `reasoning_tokens`

#### Scenario: repeated sync remains idempotent

- **GIVEN** Hermes ledger records were already parsed and uploaded
- **WHEN** the user runs `npx vibeusage sync` again without new Hermes ledger entries
- **THEN** the client SHALL not enqueue or upload duplicate Hermes half-hour buckets
