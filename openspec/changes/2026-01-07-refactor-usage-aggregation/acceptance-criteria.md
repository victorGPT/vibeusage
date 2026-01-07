# Acceptance Criteria

1. Usage endpoints compute totals and billable totals consistently using shared aggregation rules.
2. Daily totals sum equals summary totals for the same range.
3. Model-breakdown totals sum equals summary totals for the same range.
4. Hourly, heatmap, and monthly outputs remain unchanged for identical inputs.
5. No additional database queries are introduced in usage endpoints.
6. Full test suite passes (`node --test test/*.test.js`).
