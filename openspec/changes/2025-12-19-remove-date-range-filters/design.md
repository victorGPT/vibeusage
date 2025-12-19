# Design: remove dashboard date range filters

## Scope

IN:
- Dashboard 不再允许用户输入 `from/to`
- 仅支持 `period = day|week|month|total`
- 范围计算固定为 UTC，周起始固定 Sunday（0:00 UTC）

OUT:
- 任何“历史自定义范围”能力（例如 `from=YYYY-MM-DD&to=YYYY-MM-DD` 的 UI 控件）
- 后端接口重构（本次仅限制 UI）

## Contract (Dashboard)

### Periods

- `day`: today (UTC)
- `week`: current week (UTC, Sunday start)
- `month`: current month (UTC)
- `total`: all-time (UI 语义为 “from earliest day we can query” 到 today UTC)

### Range derivation (UTC)

Dashboard 通过纯前端 deterministic 逻辑从 `period` 推导 `from/to`（格式 `YYYY-MM-DD`）：
- week start：`from = todayUtc - todayUtc.getUTCDay()`
- month start：`from = YYYY-MM-01`
- total：使用固定 sentinel `from = 1970-01-01`（或 `2000-01-01`），确保不会漏数据；展示层可用实际数据首日替换显示

## Data flow

1. 用户在 Dashboard 选择 `period`
2. Dashboard 计算 `from/to`（UTC）
3. Dashboard 使用现有 endpoints 查询数据：
   - `GET /functions/vibescore-usage-daily?from&to`
   - `GET /functions/vibescore-usage-summary?from&to`
4. UI 渲染 totals / sparkline / daily table

## Non-negotiables

- 页面上不得出现 `type="date"` 的输入框
- 不支持 querystring 驱动任意 `from/to`（避免“变相自定义筛选”）
- 计算逻辑必须基于 UTC（不得使用本地时区）

## Verification

- `npm --prefix dashboard run build`
- 手工回归（你执行）：确认无法选择任意日期，只能切 day/week/month/total，且范围显示符合 UTC 口径

