## ADDED Requirements
### Requirement: Gemini CLI usage parsing from session JSON
The system SHALL parse Gemini CLI session JSON files under `~/.gemini/tmp/**/chats/session-*.json` and MUST only extract numeric token usage fields from `messages[].tokens`, aggregating into UTC half-hour buckets with `source = "gemini"`. The system MUST ignore `messages[].content` and MUST NOT persist or upload any non-numeric content.

#### Scenario: Content fields are ignored
- **GIVEN** a Gemini session JSON includes `messages[].content`
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** no content text SHALL be persisted or uploaded

#### Scenario: Model is captured or set to unknown
- **GIVEN** a Gemini session JSON includes `messages[].model`
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the bucket SHALL record the trimmed model string
- **AND** if missing or empty, the bucket SHALL set `model = "unknown"`

### Requirement: Gemini token mapping matches allowlist
The system SHALL map Gemini token usage fields from `messages[].tokens` as follows: `input_tokens = input`, `cached_input_tokens = cached`, `output_tokens = output + tool`, `reasoning_output_tokens = thoughts`, and `total_tokens = total`.

#### Scenario: Output tokens include tool tokens
- **GIVEN** `messages[].tokens` includes `output` and `tool`
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the bucket SHALL store `output_tokens = output + tool`
