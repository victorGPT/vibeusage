## Context
The dashboard includes a Neural_Flux_Monitor sparkline panel, but it lacks axis labels and does not explicitly align with the period selection used by Zion_Index. Users interpret it as a moving effect rather than a comparable metric.

## Goals / Non-Goals
- Goals:
  - Implement the provided TUI-style TrendMonitor v2 layout without altering its structure.
  - Preserve axis/grid/scan sweep visuals and fixed time labels for the X-axis.
  - Keep the UI consistent with Matrix UI A typography and color system.
- Non-Goals:
  - Add new backend endpoints or change data aggregation.
  - Introduce heavy charting libraries.

## Decisions
- Use the provided v2 layout as-is, with only the component name and label adjusted.
- Keep X-axis labels fixed at `-24H/-18H/-12H/-6H/NOW` as specified.
- Use the existing usage data series (same source as Zion_Index) to feed the chart.
- Keep the scan sweep defined inline via the component style block.

## Alternatives Considered
- Keep current minimalist view: rejected because readability is poor.
- Add a full charting library: rejected due to unnecessary complexity.

## Risks / Trade-offs
- Adding axes may reduce the “retro” feel if too prominent → mitigate via subtle styling.
- For sparse data, axis ticks might look empty → mitigate by showing baseline ticks only.

## Migration Plan
- Pure UI change. No data migration needed.

## Open Questions
- None.
