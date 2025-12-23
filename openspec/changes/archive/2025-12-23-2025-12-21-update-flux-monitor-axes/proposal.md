# Change: Update flux monitor axes and linkage

## Why
The Neural_Flux_Monitor currently shows an animated graph without explicit axes and can feel visually noisy. It also does not clearly communicate its relationship to the Zion_Index period/range, which reduces interpretability.

## What Changes
- Replace the current trend panel with the provided TUI-style TrendMonitor v2 layout.
- Keep axes, grid, and scan sweep visuals as specified.
- Make X-axis labels follow the selected period: day=hours, week/month=dates, total=months.
- Add hover tooltip that shows the exact value and UTC date for the hovered point.
- Format Y-axis tick labels using compact K/M/B notation.
- Keep the panel label as `Trend` and retain compatibility with existing data flow.

## Impact
- Affected specs: `specs/vibescore-tracker/spec.md`
- Affected code: `dashboard/src/ui/matrix-a/components/NeuralFluxMonitor.jsx`, `dashboard/src/pages/DashboardPage.jsx`
