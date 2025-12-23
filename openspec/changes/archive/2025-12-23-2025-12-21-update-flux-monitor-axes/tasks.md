## 1. Implementation
- [x] 1.1 Replace TrendMonitor with the provided v2 TUI layout and keep axes/grid/scan sweep.
- [x] 1.2 Make X-axis labels follow period (day=hours, week/month=dates, total=months).
- [x] 1.3 Update panel label to `Trend`.
- [x] 1.4 Add hover tooltip with exact value + UTC date.
- [x] 1.5 Format Y-axis tick labels using compact K/M/B notation.

## 2. Verification
- [x] 2.1 Manual: switch `day|week|month|total` and confirm X-axis labels change accordingly.
- [x] 2.2 Manual: verify TrendMonitor still renders data from the Zion_Index daily series.
- [x] 2.3 Manual: hover the trend line and confirm tooltip shows exact value + UTC date.
- [x] 2.4 Manual: hover shows vertical guide line and point marker.
- [x] 2.5 Manual: confirm Y-axis uses compact K/M/B labels.
