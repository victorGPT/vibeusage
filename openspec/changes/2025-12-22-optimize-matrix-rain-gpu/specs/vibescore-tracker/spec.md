## ADDED Requirements
### Requirement: Matrix rain rendering is GPU-budgeted
The UI SHALL render the Matrix rain animation with a capped update rate and reduced internal render resolution, and SHALL pause rendering when the document is hidden, so steady-state GPU usage remains below 2% on the reference device.

#### Scenario: Visible page uses capped update rate and scaled buffer
- **WHEN** a user views the dashboard or landing page with Matrix rain enabled
- **THEN** the renderer SHALL cap updates to `<= 12 fps`
- **AND** the internal render buffer SHALL be scaled to `<= 60%` of the viewport on each axis

#### Scenario: Hidden document pauses rendering
- **WHEN** the document visibility state becomes `hidden`
- **THEN** the renderer SHALL stop scheduling animation frames until it becomes visible again

#### Scenario: GPU budget holds on reference device
- **GIVEN** the reference device environment (macOS + Chrome Task Manager GPU process)
- **WHEN** the page is idle in the foreground for 60 seconds
- **THEN** steady-state GPU usage SHALL remain `<= 2%` on average
