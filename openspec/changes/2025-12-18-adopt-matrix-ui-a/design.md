# Design: Matrix UI A migration (based on `copy.jsx`)

## 1. Current State (Audit)

Dashboard 当前已经具备“数据/状态/视图”分层的雏形（后续实现阶段需再次确认并补齐）：

- **Pure lib**：`dashboard/src/lib/**`（URL、format、date-range、daily sort、http、auth storage…）
- **Hooks**：`dashboard/src/hooks/**`（`use-auth`、`use-usage-data`）
- **View layer**：
  - `dashboard/src/components/**`（现有基础组件）
  - `dashboard/src/pages/**`（页面：Dashboard、Connect）
  - `dashboard/src/App.jsx`（极薄路由分发）
- **Styles**：`dashboard/src/styles/**`（base + theme 分层）

本变更的第一步是确认上述边界是否足够稳定；若发现 UI 直接依赖 fetch/localStorage 等副作用，则必须继续解耦。

## 2. Target Architecture

目标是引入“Matrix UI A”作为一个**可替换的 UI 套件**：

- `copy.jsx` 仅作为“视觉蓝图与组件草稿”，不直接作为最终页面实现的单文件大组件。
- 产物应是可复用组件库 + 页面组装层，数据逻辑继续由 hooks/lib 提供。

建议的目录形态（实现阶段落地）：

- `dashboard/src/ui/matrix-a/components/*`
- `dashboard/src/ui/matrix-a/layout/*`
- `dashboard/src/ui/matrix-a/styles/*`

并在 `dashboard/src/pages/*` 内只做“业务模块组装”，不引入 UI 细节耦合。

## 3. Component Inventory (from `copy.jsx`)

`copy.jsx` 里明确可抽取的组件（按优先级）：

### 3.1 Core primitives (必选)
- `MatrixRain`：背景雨（需支持 `prefers-reduced-motion`）
- `AsciiBox`：终端边框/标题容器（支持 `title/subtitle/slots`）
- `DataRow`：紧凑数据行（label/value/subValue）
- `TrendChart`：小型柱状趋势（用于 token 趋势/占比等）

### 3.2 Layout blocks (可选/需确认)
这些在 `copy.jsx` 里是“页面块”，但建议抽成可组合的布局组件：

- `BootScreen`（ASCII 开机屏）
- `StatusHeader`（顶部状态栏：标题/状态/时间）
- `FooterBar`（底部快捷键提示/版本信息）
- `ScanlineOverlay`（扫描线叠层）

### 3.3 Feature panels (可选/需映射数据接口)
`copy.jsx` 的示例面板大多是“虚拟数据”。如果要纳入，需要定义真实数据来源/接口：

- Identity panel（用户身份/等级/排行/streak）
- Telemetry panel（Lifetime tokens + 分项进度条）
- Logs panel（系统日志流）
- Heatmap panel（密度热力图）
- Network stat / Export card 等

## 4. Mapping: Existing Dashboard vs Matrix UI A

### 4.1 官网已有（必须保留的业务能力）
- Auth：sign-in / sign-up / sign-out
- Query：date range（UTC）+ refresh
- Summary metrics：total/input/output/cached/reasoning
- Daily：表格（排序、横向滚动）
- `/connect`：CLI 引导页面与 redirect 校验

### 4.2 `copy.jsx` 提供（可能替代/增强的视觉模块）
- `AsciiBox` 可替代现有窗口容器
- `TrendChart` 可替代现有 sparkline（或并存）
- Header/Footer/Scanline 等可统一整体氛围

### 4.3 缺口处理策略
- **官网有、copy 没有**：优先用 core primitives（AsciiBox/DataRow/TrendChart）组合出等价 UI；必要时新增同风格组件（例如 DateRangeForm、MetricsGrid、DailyTable）。
- **copy 有、官网没有**：先列为可选模块；由用户确认要不要做；每个模块必须明确：
  - 数据来源（来自现有接口？派生计算？还是纯装饰？）
  - 交互（是否仅展示？是否可点击？）

## 5. UI Contract (Props-first)

为避免未来再次换皮时引发紊乱，Matrix UI A 组件应只接收“展示所需最小数据”：

- `AsciiBox({ title, subtitle, rightSlot, children })`
- `DataRow({ label, value, subValue, tone })`
- `TrendChart({ series, labels?, max? })`
- `StatusHeader({ title, statusItems, rightSlot })`

页面层只接触 hooks 输出，不让组件自行 fetch。

## 6. Styling Strategy

这里有两条可行路线，需要先由你确认取舍（会显著影响实现速度与工程成本）：

### Option A（更快）：引入 Tailwind，最大化复用 `copy.jsx` 的 utility class

**优点**
- 迁移速度快：`copy.jsx` 的 class 基本可直接沿用
- 视觉还原度高：改动更贴近原稿

**缺点**
- 引入依赖与构建配置（Tailwind/PostCSS），工程复杂度上升
- 未来若要“完全抛弃 Tailwind”，会有二次迁移成本

### Option B（更稳）：翻译为语义化 class + theme CSS（延续现有 base/theme 分层）

**优点**
- 依赖最小：不引入 Tailwind
- 与现有 `styles/base.css` + `styles/themes/*` 体系一致，更利于长期维护与换皮

**缺点**
- 初期改动更“手工”，迁移速度慢一些
- 需要把 `copy.jsx` 中的视觉细节逐条映射到 CSS（尤其是 grid/spacing/typography）

共同约束（两条路线都必须满足）：
- `copy.jsx` 的 inline `<style dangerouslySetInnerHTML>` 最终应迁移到可维护的 CSS（theme 或组件样式），避免运行时注入。
  - 若选择 Option A，也应尽量避免继续新增 runtime 注入。

## 7. Risks & Mitigations

- **大改 UI 影响现有功能**：采用“先组件库、后页面迁移”的顺序；保持 data/hooks 不动。
- **动效引发不适**：所有持续动效必须可降级；默认强度要克制（稀疏/优雅）。
- **模块范围失控**：将 `copy.jsx` 模块分级（必选/可选），可选模块必须经用户确认后才做。

## 8. Questions for User (Required to Proceed)

0) 你选择哪条样式路线？
- A：引入 Tailwind（更快、更贴近 `copy.jsx`）
- B：语义化 class + theme CSS（依赖最小、维护更稳）

请你从下列 `copy.jsx` “可选模块”里勾选要做的（可以只选 0 个）：

1) BootScreen（开机屏）
2) Logs panel（系统日志流）
3) Heatmap panel（热力图）
4) Network stat / Export card
5) Identity panel（用户名/等级/排行/streak）

并确认以下接口期望：

- Identity panel 需要展示哪些字段？（email/name/自定义昵称/等级/排行/streak 是否来自真实数据还是先做装饰？）
- TrendChart 你希望展示“按天 total tokens”还是“24h 近似趋势”（我们目前只有按天聚合接口）？
