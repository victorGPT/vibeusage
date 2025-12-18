# 2025-12-18-adopt-matrix-ui-a 任务清单

> 目标：在保持现有业务链路不变的前提下，把 Dashboard UI 迁移到 Matrix UI A（基于 `copy.jsx`）并保证组件可复用、边界清晰。

## 1) Audit（接口解耦与模块化检查）

- [x] 盘点 `dashboard/src/lib/**`、`dashboard/src/hooks/**`、`dashboard/src/pages/**` 的边界是否清晰（UI 不直接 fetch / localStorage）
- [x] 若发现耦合点：补齐解耦（抽出 lib/hook），并补上最小验证脚本/步骤（本次未发现 UI 直连 fetch/storage 的耦合点）

## 2) Matrix UI A 组件库（基于 `copy.jsx` 拆分）

- [x] 抽取 core primitives：`MatrixRain`、`AsciiBox`、`DataRow`、`TrendChart`
- [x] 抽取 layout blocks：Header/Footer/ScanlineOverlay/BootScreen（✅ 已确认包含 BootScreen）
- [x] 把 `copy.jsx` 的 inline style 迁移到 theme CSS（禁止 runtime 注入）

## 3) 模块清单与用户确认（范围控制）

- [x] 确认样式路线：选择 A) 引入 Tailwind 复用 `copy.jsx` class
- [x] 确认纳入模块：BootScreen / Activity heatmap / Identity panel
- [x] 确认暂缓模块：Network stat（后续再考虑），Logs/Telemetry/Active nodes/Export card（先不做）
- [x] 输出“官网模块 vs copy 模块”对照表（含每块的数据接口需求与缺口处理）

### 对照表（官网模块 vs Matrix UI A / copy.jsx 模块）

| 官网模块（保留） | Matrix UI A 呈现（组件/容器） | 数据接口（来源/说明） |
| --- | --- | --- |
| 认证入口（sign-in / sign-up） | `AsciiBox` + `MatrixButton(as="a")` | `buildAuthUrl()`（现有） |
| 退出登录（sign-out） | `MatrixShell headerRight` + `MatrixButton` | `useAuth().signOut()`（现有） |
| 查询（From/To + Refresh） | `AsciiBox` + `MatrixInput` + `MatrixButton` | `useUsageData({ from,to })`（现有） |
| 汇总指标（Total/Input/Output/…） | `AsciiBox` + `DataRow` | `useUsageData().summary`（现有） |
| 日统计表（排序/滚动） | `AsciiBox` + table（Matrix 样式） | `useUsageData().daily` + `sortDailyRows()`（现有） |
| Sparkline | `AsciiBox` + `Sparkline` | `useUsageData().daily`（现有） |
| `/connect` 引导与 redirect 校验 | `MatrixShell` + `AsciiBox` + `MatrixButton(as="a")` | `buildAuthUrl()`（现有） + 原 redirect 校验逻辑（保留） |
| 开机屏（BootScreen） | `BootScreen` | 纯前端（无后端） |
| 活动热力图（Heatmap） | `AsciiBox` + `ActivityHeatmap` | `useActivityHeatmap()`（复用现有 daily endpoint；派生算法） |
| 身份面板（Identity） | `AsciiBox` + `IdentityPanel` | `useAuth()` 的 `name/email/userId`；Rank 先占位 |

## 4) 页面迁移（保持功能不变）

- [x] Dashboard 首页迁移到 Matrix UI A 视觉体系（Auth / Query / Metrics / Daily）
- [x] `/connect` 页面迁移到同一体系（redirect 校验/错误态可读）
- [x] `prefers-reduced-motion` 验证：动效自动降级（无持续闪烁/雨背景）

## 4.1 Tailwind 落地（实现依赖）

- [x] Dashboard 引入 Tailwind（PostCSS/Vite 配置 + `@tailwind` 入口样式）
- [x] 保留并整合现有 theme tokens（Matrix 绿/对比度/focus/selection），避免冲突与重复

## 4.2 Selected modules（本次新增/迁移）

- [x] BootScreen：开机屏组件化（不依赖后端；可在首次加载展示短暂动画或可跳过）
- [x] Activity heatmap：用 daily totals 派生 52 周热力图（UTC；阈值映射按设计文档）
- [x] Identity panel：用登录信息渲染（name/email/userId）；Rank 先占位（或按用户确认隐藏）

## 5) 验证与回归

- [x] 构建：`npm --prefix dashboard run build`
- [x] 现有测试：`npm test`
- [ ] 冷回归手工步骤：`/auth/callback`、`/connect`、date range 查询、表格排序与滚动
