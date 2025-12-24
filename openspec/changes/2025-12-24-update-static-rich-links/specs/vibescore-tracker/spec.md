## ADDED Requirements
### Requirement: Landing page serves static social metadata
The dashboard landing page HTML SHALL include Open Graph and Twitter card metadata in the initial HTML response, without requiring client-side JavaScript execution. The metadata values SHALL be sourced from the copy registry `landing.meta.*`, and `og:url` SHALL be `https://www.vibescore.space`.

#### Scenario: Crawler reads static meta tags
- **GIVEN** the dashboard is built via `npm --prefix dashboard run build`
- **WHEN** a crawler fetches `dashboard/dist/index.html`
- **THEN** the HTML SHALL include `meta` tags for `description`, `og:title`, `og:description`, `og:image`, `og:site_name`, `og:type`, `og:url`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- **AND** the `content` values SHALL match the copy registry `landing.meta.*` entries
- **AND** `og:url` SHALL equal `https://www.vibescore.space`
