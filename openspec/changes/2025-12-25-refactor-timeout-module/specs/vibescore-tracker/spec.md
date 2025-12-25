## ADDED Requirements

### Requirement: Dashboard HTTP timeout config is deterministic
The dashboard HTTP timeout logic SHALL resolve timeout values deterministically based on `VITE_VIBESCORE_HTTP_TIMEOUT_MS` and clamp values into a safe range.

#### Scenario: Default timeout and clamp rules
- **GIVEN** `VITE_VIBESCORE_HTTP_TIMEOUT_MS` is unset or invalid
- **WHEN** the timeout value is resolved
- **THEN** the timeout SHALL default to `15000` milliseconds
- **AND** numeric values SHALL be clamped into `1000..30000`

### Requirement: HTTP timeout can be disabled
The dashboard HTTP timeout logic SHALL treat non-positive values as disabled and pass through to the underlying request without adding its own timeout controller.

#### Scenario: Disabled timeout bypasses wrapper
- **GIVEN** `VITE_VIBESCORE_HTTP_TIMEOUT_MS` is `0`
- **WHEN** the wrapper executes a request
- **THEN** it SHALL call the underlying `fetch` without injecting a new timeout controller

### Requirement: Caller abort takes precedence over timeout
The dashboard HTTP timeout wrapper MUST NOT mask caller-initiated aborts as timeouts.

#### Scenario: Caller abort is preserved
- **GIVEN** the caller provides an `AbortSignal`
- **WHEN** the caller aborts the request before the timeout fires
- **THEN** the wrapper SHALL surface the caller abort error
- **AND** it SHALL NOT emit the timeout error message

### Requirement: Timeout abort surfaces a consistent error
The dashboard HTTP timeout wrapper SHALL raise a consistent timeout error message when it aborts the request due to timeout.

#### Scenario: Timeout error message
- **GIVEN** a timeout is configured and the request exceeds it
- **WHEN** the wrapper aborts the request
- **THEN** it SHALL throw `Client timeout after ${ms}ms`
- **AND** it SHALL attach the original error as `cause`
