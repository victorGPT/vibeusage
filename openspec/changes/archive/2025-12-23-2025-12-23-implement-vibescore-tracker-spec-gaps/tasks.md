# 2025-12-23-implement-vibescore-tracker-spec-gaps 任务清单

## 0. 需求对齐与差距清单
- [x] 0.1 建立 requirement → 实现/证据映射表（文件/函数/测试/脚本）。
- [x] 0.2 标注缺口（未实现/无验证/行为不一致），给出优先级与影响面。
- [x] 0.3 与你确认缺口清单与优先级（范围聚焦为已落地的四项时区/日历改动）。

### 本次改动点（已落地）
- Heatmap 口径改为本地日历（带 `tz`）。
- UI 显示时区基准且与请求参数一致。
- `period=week` 语义改为本地日历周一开始。
- TREND 未来桶与当前期判断改为本地日历口径。

## 1. 证据记录（对应四项改动）
- [x] 1.1 记录 Heatmap 本地日历 + `tz` 口径证据（代码位置 + 验证步骤）。
- [x] 1.2 记录 UI 时区基准一致性证据（UsagePanel/Heatmap/页脚等）。
- [x] 1.3 记录 `period=week` 周一起始的证据（范围计算 + 渲染）。
- [x] 1.4 记录 TREND 未来桶截断的证据（future 标记与渲染）。

### 证据（代码位置）
- Heatmap 本地日历 + `tz`：`dashboard/src/hooks/use-activity-heatmap.js`（`getHeatmapRangeLocal` + `getUsageHeatmap` 透传 `tz/tz_offset_minutes`），`insforge-src/functions/vibescore-usage-heatmap.js`（按 `tz` 聚合），`dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx`（按返回周格渲染）。
- UI 时区基准一致性：`dashboard/src/pages/DashboardPage.jsx`（`timeZoneRangeLabel = Local time (UTC±HH:MM)`，传入 `UsagePanel`/`ActivityHeatmap`/页脚），`dashboard/src/ui/matrix-a/components/UsagePanel.jsx`（展示 `rangeTimeZoneLabel`）。
- `period=week` 周一起始：`dashboard/src/lib/date-range.js`（`offset = (day + 6) % 7`），`dashboard/src/pages/DashboardPage.jsx`（`getRangeForPeriod('week', ...)`）。
- TREND 未来桶截断：`dashboard/src/hooks/use-trend-data.js`（`fillDailyGaps`/`markHourlyFuture` 使用本地日历判断 future），`dashboard/src/ui/matrix-a/components/TrendMonitor.jsx`（`future` 行不连线）。

## 2. 验证
- [x] 2.1 补充最小可重复验证（脚本或手工步骤）。
- [x] 2.2 执行验证并记录结果。

### 验证记录（线上，JWT 已脱敏）
- API 验证（`tz=Asia/Shanghai&tz_offset_minutes=480`，`week_starts_on=mon`）：
  - `summary`: `days=7`（区间 `2025-12-16` → `2025-12-22`）。
  - `daily`: `count=7`，`first=2025-12-16`，`last=2025-12-22`。
  - `hourly`: `first=2025-12-23T00:00:00`，`last=2025-12-23T23:00:00`（本地日历日验证）。
  - `heatmap`: `week_starts_on=mon`，`active_days=34`，`streak_days=17`。
- UI 手工验证步骤（需浏览器）：
  1) 打开 Dashboard → 选择 `week` → 观察范围从本地周一开始。
  2) 查看 UsagePanel/Heatmap/页脚时区标识为 `Local time (UTC±HH:MM)`。
  3) TREND 在当前日期之后不再连线（future 桶空线）。
- UI 观察结果（https://www.vibescore.space/）：
  - UsagePanel 显示 `SINCE 2025-12-22..2025-12-28 Local time (UTC+08:00)`（周一起始 + 本地时区）。
  - Activity heatmap 显示 `LOCAL TIME (UTC+08:00)`，并显示 `RANGE: 2024-12-29..2025-12-23`。
  - 页脚显示 `LOCAL TIME (UTC+08:00) • CLICK REFRESH TO RELOAD`。

## 3. 文档
- [x] 3.1 更新相关文档（如 `BACKEND_API.md`/运行手册/变更记录）。

### 文档更新记录
- `BACKEND_API.md`：补充 Dashboard 的本地日历与时区参数约定说明。
