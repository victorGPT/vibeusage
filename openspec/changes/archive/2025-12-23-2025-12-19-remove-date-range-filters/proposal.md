# Change: Remove custom date filters (dashboard uses day/week/month/total only)

## 结论

Dashboard 移除 `From/To` 自定义日期输入，改为仅支持固定的 `day / week / month / total` 视图（**UTC**，且 **week starts on Sunday**）。页面上不再提供任何“任意日期范围筛选”的能力。

本变更目标是让“时间口径”在产品层面保持一致（尤其是与 leaderboard 口径一致），避免用户误解或因时区差异产生困惑。

## Why

- 统一口径：我们已经决定产品不支持自定义日期筛选，所有统计都基于 UTC 自然日/周/月 + total。
- 减少歧义：`from/to` 日期输入在全球用户场景下会引入时区、周起始等一致性问题。
- 简化 UX：固定 period selector 更符合“排行榜/贡献热力图”的产品心智。

## What Changes

- Dashboard：
  - 移除 `From` / `To` 的 `<input type="date">`
  - 新增 `period` 选择器：`day | week | month | total`
  - UI 只展示（或只读展示）当前 period 推导出的 `from/to`（UTC）
  - 所有查询都从 period 推导范围，不再让用户输入任意日期

## Impact

- Affected specs：`vibescore-tracker`
- Affected code：
  - `dashboard/src/pages/DashboardPage.jsx`
  - `dashboard/src/hooks/use-usage-data.js`（接口/调用方式可能调整，取决于实现）
  - `dashboard/src/lib/date-range.js`（可能迁移为 period range 工具）
- 风险：
  - 失去“任意历史区间”的灵活查询（符合我们产品决定）
  - `period=total` 可能返回较长 daily 列表（需要评估前端渲染与请求量）

## 非目标

- 不修改既有后端接口的能力边界（即使后端仍支持 `from/to`，Dashboard 也不再暴露）
- 不引入自定义日期筛选 UI（包括 querystring 驱动）

