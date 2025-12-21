## 1. Implementation
- [x] 1.1 Replace TrendMonitor with the provided v2 TUI layout and keep axes/grid/scan sweep.
- [x] 1.2 Make X-axis labels follow period (day=hours, week/month=dates, total=months).
- [x] 1.3 Update panel label to `Trend`.
- [x] 1.4 Add hover tooltip with exact value + UTC date.
- [x] 1.5 Format Y-axis tick labels using compact K/M/B notation.

## 2. Verification
- [ ] 2.1 Manual: switch `day|week|month|total` and confirm X-axis labels change accordingly.
- [ ] 2.2 Manual: verify TrendMonitor still renders data from the Zion_Index daily series.
- [ ] 2.3 Manual: hover the trend line and confirm tooltip shows exact value + UTC date.
- [ ] 2.4 Manual: confirm Y-axis uses compact K/M/B labels.
