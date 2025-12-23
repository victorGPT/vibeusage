# Design: hourly + monthly usage aggregates for TREND

## Scope

IN:
- 新增 **hourly** 与 **monthly** 聚合接口（UTC）。
- Dashboard TREND 按 period 切换数据粒度（day=hourly，total=monthly 24）。
- 与现有 daily/summary/heatmap 兼容，不引入自定义日期筛选。

OUT:
- 历史任意范围小时级查询（仅 day 当天 24 小时）。
- 全量 monthly 分页浏览（先固定 24 个月窗口）。
- 对外公开 API（仅已登录用户）。

## Module Brief

### Scope

IN:
- `GET /functions/vibescore-usage-hourly`（单日 24 小时）
- `GET /functions/vibescore-usage-monthly`（最近 24 个月）
- 前端 TREND 数据源切换与标签对齐

OUT:
- 自定义 `from/to` 时间选择
- 预聚合/物化表（若性能触发再升级）

### Interfaces

- Hourly:
  - `GET /functions/vibescore-usage-hourly?day=YYYY-MM-DD`
  - Auth: `Authorization: Bearer <user_jwt>`
  - Response: `{ day, data: [{ hour: "YYYY-MM-DDTHH:00:00Z", total_tokens, input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens }] }`

- Monthly:
  - `GET /functions/vibescore-usage-monthly?months=24&to=YYYY-MM-DD`
  - Auth: `Authorization: Bearer <user_jwt>`
  - Response: `{ from, to, months, data: [{ month: "YYYY-MM", total_tokens, input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens }] }`

### Data flow & constraints

1. Dashboard 根据 period 请求对应聚合接口。
2. Edge Function 仅返回当前用户聚合；bigint 以 string 返回。
3. 前端只展示，不插值造数；缺口补 0 仅用于轴一致性。

信任边界：
- 仅允许已登录用户（`user_jwt`）。
- 不返回任何 PII 或日志内容。

### Non-negotiables

- UTC 口径统一；day=当天 UTC 24 小时。
- total 固定最近 24 个月，不支持更大范围。
- bigints 以 string 返回。

### Trend rendering rules

- The trend line SHALL render only up to the latest available UTC bucket.
- Future buckets (after current UTC hour/day/month) SHALL NOT render a line.
- Historical missing buckets are treated as zero unless the API explicitly marks them as missing.

### Test strategy

- Edge Function: 参数校验（day 格式、months 范围）。
- Edge Function: 结果数组长度（hourly=24，monthly=<=24）。
- Frontend: period 切换时趋势可用且轴标签正确。

### Milestones

1. 后端 hourly/monthly 聚合与 endpoints 完成。
2. Dashboard 接入并按 period 切换数据源。
3. 文档更新 & 验证通过。

### Plan B triggers

- hourly/monthly 查询 P95 > 500ms。
- 查询导致 DB CPU 占用异常或超时。

### Upgrade plan (disabled by default)

- 引入物化聚合表（hourly/monthly）+ 定时刷新。
- total 分页（月窗口滚动）与懒加载。

## Hard constraints list

- 不允许前端插值伪造小时数据。
- 无自定义 date filters。
- 响应必须与 `usage-daily/summary` 结构一致（字段与 bigint 处理）。
