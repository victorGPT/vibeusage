# Tasks

- [x] 更新 API 文档：在 `BACKEND_API.md` 记录 hourly/monthly 接口与示例。
- [x] 后端：新增 hourly 聚合（UTC 24 小时），实现 `GET /functions/vibescore-usage-hourly`。
- [x] 后端：新增 monthly 聚合（UTC 月，最近 24 个月），实现 `GET /functions/vibescore-usage-monthly`。
- [x] 后端：补齐参数校验与范围限制（`day` 格式、`months` 1..24、UTC 对齐）。
- [x] Dashboard：扩展 API client 与 hooks，按 period 拉取 hourly/daily/monthly。
- [x] Dashboard：TREND 组件支持 hourly（月度）标签与数据格式对齐。
- [x] 缓存：按粒度拆分 cache key，避免互相污染。
- [x] 验证：
  - `period=day` 显示 24 小时曲线。
  - `period=week/month` 使用日聚合。
  - `period=total` 显示最近 24 个月曲线。
  - 断网 + 缓存情况下 TREND 仍可渲染。
