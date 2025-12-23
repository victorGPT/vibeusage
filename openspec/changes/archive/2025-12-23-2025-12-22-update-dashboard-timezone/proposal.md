# Change: Update dashboard usage aggregates to browser timezone

## Why
当前 Dashboard 以 UTC 日切分展示使用量，导致跨时区用户看到“今天/本周/本月”边界错位。根据第一性原理（用户感知与行为发生在本地时区），聚合边界应以浏览器时区为准，才能保证认知一致性与行动反馈一致。

## What Changes
- Dashboard 自动读取浏览器时区（IANA + offset），并在所有 usage 请求中附带 `tz`/`tz_offset_minutes`。
- Usage 相关 Edge Functions 在收到时区参数时，按本地日/小时/月做聚合；无参数则保持 UTC 默认行为。
- UI 文案与提示从 `UTC` 调整为本地时区显示（含 Range/Tooltip/Heatmap 标签）。
- 更新 `BACKEND_API.md` 以记录时区参数与返回含义。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code:
  - `insforge-src/shared/date.js`
  - `insforge-src/functions/vibescore-usage-*.js`
  - `dashboard/src/lib/date-range.js`
  - `dashboard/src/lib/activity-heatmap.js`
  - `dashboard/src/lib/vibescore-api.js`
  - `dashboard/src/lib/timezone.js` (new)
  - `dashboard/src/hooks/use-usage-data.js`
  - `dashboard/src/hooks/use-trend-data.js`
  - `dashboard/src/hooks/use-activity-heatmap.js`
  - `dashboard/src/ui/matrix-a/components/UsagePanel.jsx`
  - `dashboard/src/ui/matrix-a/components/TrendMonitor.jsx`
  - `dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx`
  - `dashboard/src/pages/DashboardPage.jsx`
  - `dashboard/src/lib/mock-data.js`
  - `BACKEND_API.md`
