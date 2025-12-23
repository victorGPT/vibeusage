# 2025-12-19-remove-date-range-filters 任务清单

> 目标：Dashboard 移除自定义日期筛选，仅保留 day/week/month/total（UTC + Sunday start）。

## 1) Contract freeze

- [x] 确认 period 集合：`day|week|month|total`
- [x] 确认 week start：Sunday（UTC）
- [x] 确认默认 period（默认：`week`）
- [x] 写入一份“range 推导”样例（today=2025-12-19，UTC）

样例（today=2025-12-19）：

- `day`：`from=2025-12-19`，`to=2025-12-19`
- `week`（Sunday start）：`from=2025-12-14`，`to=2025-12-20`
- `month`：`from=2025-12-01`，`to=2025-12-31`
- `total`：`from=2000-01-01`（sentinel），`to=2025-12-19`

## 2) Frontend（Dashboard）

- [x] 移除 `From/To` date inputs（`DashboardPage`）
- [x] 新增 period selector（buttons/tabs/select；无自由输入）
- [x] 从 period 推导 `from/to`（UTC）并传给 `useUsageData`
- [x] 更新 sparkline / subtitles：显示 period 与范围
- [x] `total` 展示策略：仅展示 totals；隐藏 sparkline + daily table；用 heatmap 做趋势

## 3) Tests / Verification

- [x] `npm --prefix dashboard run build`
- [x] 手工回归步骤（你确认）：Dashboard 不再可选任意日期；切换 period 后 totals/sparkline/daily table 更新

## 4) OpenSpec

- [x] 更新 `openspec/changes/<id>/specs/vibescore-tracker/spec.md`
- [x] `openspec validate 2025-12-19-remove-date-range-filters --strict`
