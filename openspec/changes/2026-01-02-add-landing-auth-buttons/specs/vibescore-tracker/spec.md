## ADDED Requirements
### Requirement: Landing page shows auth buttons
The dashboard landing page SHALL show Login and Sign Up buttons in the top-right header area, with labels sourced from the copy registry and URLs generated via the auth URL builder.

#### Scenario: Landing header provides auth entry points
- **GIVEN** an unauthenticated visitor on the landing page
- **WHEN** the landing page renders
- **THEN** Login and Sign Up buttons SHALL be visible without scrolling
- **AND** the labels SHALL use copy keys `landing.nav.login` and `landing.nav.signup`
- **AND** the buttons SHALL link to `/auth/sign-in` and `/auth/sign-up` with the correct redirect URL
