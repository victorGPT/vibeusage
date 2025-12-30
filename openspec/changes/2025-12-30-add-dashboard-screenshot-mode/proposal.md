# Change: Dashboard screenshot mode

## Why
需要为 Dashboard 生成窄屏截图，用于对外展示，同时避免影响正常使用路径。

## What Changes
- 新增截图模式开关（查询参数 `screenshot=1|true`）。
- 截图模式下收窄 Dashboard 内容宽度，形成单列纵向布局。
- 截图模式下隐藏安装区与明细表。
- 截图模式下隐藏 Core Index 的四项输入明细模块。
- 在非生产环境的 Dashboard 顶部栏新增截图入口（Wrapped 2025）。
- 截图模式调整为横向两列，仅保留 Identity/热力图/Core/Model。
- 截图模式仅在非生产环境启用。
- 截图模式左上角新增两行标题（Coding Agent / 2025 Wrapped）。

## Impact
- Affected specs: `dashboard-screenshot-mode`
- Affected code: `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/ui/matrix-a/layout/MatrixShell.jsx`
