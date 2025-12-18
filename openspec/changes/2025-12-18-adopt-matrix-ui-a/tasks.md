# 2025-12-18-adopt-matrix-ui-a 任务清单

> 目标：在保持现有业务链路不变的前提下，把 Dashboard UI 迁移到 Matrix UI A（基于 `copy.jsx`）并保证组件可复用、边界清晰。

## 1) Audit（接口解耦与模块化检查）

- [ ] 盘点 `dashboard/src/lib/**`、`dashboard/src/hooks/**`、`dashboard/src/pages/**` 的边界是否清晰（UI 不直接 fetch / localStorage）
- [ ] 若发现耦合点：补齐解耦（抽出 lib/hook），并补上最小验证脚本/步骤

## 2) Matrix UI A 组件库（基于 `copy.jsx` 拆分）

- [ ] 抽取 core primitives：`MatrixRain`、`AsciiBox`、`DataRow`、`TrendChart`
- [ ] 抽取 layout blocks：Header/Footer/ScanlineOverlay（是否包含 BootScreen 由用户确认）
- [ ] 把 `copy.jsx` 的 inline style 迁移到 theme CSS（禁止 runtime 注入）

## 3) 模块清单与用户确认（范围控制）

- [ ] 确认样式路线：A) 引入 Tailwind 复用 `copy.jsx` class，或 B) 语义化 class + theme CSS
- [ ] 输出“官网模块 vs copy 模块”对照表（含每块的数据接口需求）
- [ ] 用户确认要纳入的 `copy.jsx` 可选模块与其接口字段（必要的澄清问答）

## 4) 页面迁移（保持功能不变）

- [ ] Dashboard 首页迁移到 Matrix UI A 视觉体系（Auth / Query / Metrics / Daily）
- [ ] `/connect` 页面迁移到同一体系（redirect 校验/错误态可读）
- [ ] `prefers-reduced-motion` 验证：动效自动降级（无持续闪烁/雨背景）

## 5) 验证与回归

- [ ] 构建：`npm --prefix dashboard run build`
- [ ] 现有测试：`npm test`
- [ ] 冷回归手工步骤：`/auth/callback`、`/connect`、date range 查询、表格排序与滚动
