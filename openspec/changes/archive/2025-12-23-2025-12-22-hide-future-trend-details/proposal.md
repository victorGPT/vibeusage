# Change: Hide future buckets in TREND and DETAILS

## 结论
根据需求“不要显示未来的数据，哪怕是 0”，需要在 TREND 与 DETAILS 模块 **彻底剔除未来时间桶**（不显示占位、零值或空线），保证展示截止到“当前时刻/当前日历边界”。

## Why
- 现有实现会用 `future` 标记占位，导致未来区间仍被展示（哪怕是 0/空）。
- 用户明确要求未来数据不显示，必须截止到当下。

## What Changes
- TREND：过滤掉未来桶，只保留“<= 当前时刻”的数据点与桶。
- DETAILS（日表）：过滤掉未来日期行，不显示“—/0/空”。
- 保持“缺失/未同步”在已发生区间的提示不变。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/hooks/use-trend-data.js`, `dashboard/src/hooks/use-usage-data.js`, `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/ui/matrix-a/components/TrendMonitor.jsx`
