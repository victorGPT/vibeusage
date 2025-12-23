# Change: Add explicit data source indicator to the dashboard

## Why
当前仪表盘在 `edge/cache/mock` 之间切换时没有明确提示，用户容易误判数据真实性（尤其在缓存兜底或 mock 模式下）。需要把数据来源显式展示出来，降低排查与沟通成本。

## What Changes
- 在 Dashboard 头部组件展示统一的 `DATA_SOURCE: EDGE|CACHE|MOCK` 标识。
- `useUsageData` 与 `useActivityHeatmap` 统一输出数据来源枚举，便于 UI 显示。
- 保持现有数据逻辑与缓存行为不变，仅增加可观测性。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code:
  - `dashboard/src/pages/DashboardPage.jsx`
  - `dashboard/src/hooks/use-usage-data.js`
  - `dashboard/src/hooks/use-activity-heatmap.js`
  - `dashboard/src/ui/matrix-a/components/UsagePanel.jsx`
  - `dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx`
