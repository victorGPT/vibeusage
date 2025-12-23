# Tasks

- [x] 明确 data-source 枚举与优先级（`mock > cache > edge`），并记录在变更说明中。
- [x] 在 `useUsageData` 中输出标准化来源（`edge|cache|mock`），并在读取缓存与 mock 模式时正确设置。
- [x] 在 `useActivityHeatmap` 中输出标准化来源（`edge|cache|mock`），并在 mock 模式与缓存兜底时正确设置。
- [x] 在 `DashboardPage` 的 UsagePanel 显示 `DATA_SOURCE: <EDGE|CACHE|MOCK>`。
- [x] 在 `Activity_Matrix` 区域显示 `DATA_SOURCE: <EDGE|CACHE|MOCK>`（heatmap 来源）。
- [x] 验证：
  - `?mock=1` 时显示 `DATA_SOURCE: MOCK`。
  - 后端不可达但有缓存时显示 `DATA_SOURCE: CACHE`。
  - 正常在线且有登录态时显示 `DATA_SOURCE: EDGE`。
