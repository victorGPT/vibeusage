# Design: Dashboard data source indicator

## Goal
让用户一眼识别当前数据来自 `edge` / `cache` / `mock`，避免将缓存或 mock 误认为实时数据。

## Source mapping
- `mock`：当 `isMockEnabled()` 为 true 时，强制标记为 `mock`。
- `cache`：当读到本地缓存兜底时标记为 `cache`。
- `edge`：其余情况统一标记为 `edge`（包括 client-side heatmap derivation）。

## UI placement
- **UsagePanel**：沿用已有 `statusLabel`，显示 `DATA_SOURCE: <EDGE|CACHE|MOCK>`。
- **Activity_Matrix**：在 heatmap 下方或 subtitle 增加一行 `DATA_SOURCE: <EDGE|CACHE|MOCK>`。

## Non-goals
- 不改变数据获取流程与缓存策略。
- 不新增后端字段或接口。

## Risks & mitigations
- **风险**：多来源合并时状态不一致（usage 与 heatmap）
- **缓解**：分别显示 usage 与 heatmap 的来源，避免误导。
