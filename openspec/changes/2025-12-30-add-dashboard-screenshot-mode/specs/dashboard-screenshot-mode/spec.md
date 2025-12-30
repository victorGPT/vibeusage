# Dashboard screenshot mode

## ADDED Requirements

### Requirement: Screenshot mode trigger
系统 SHALL 支持通过查询参数 `screenshot=1|true` 启用截图模式，未启用时行为不变。

#### Scenario: Enable screenshot mode
- **WHEN** 用户访问带参数 `?screenshot=1` 的 Dashboard
- **THEN** Dashboard 进入截图模式

### Requirement: Narrow layout in screenshot mode
系统 SHALL 在截图模式下将 Dashboard 主内容区域收窄为单列纵向布局。

#### Scenario: Narrow content
- **WHEN** 截图模式启用
- **THEN** Dashboard 内容区域为窄屏布局并居中显示

### Requirement: Hide install section
系统 SHALL 在截图模式下隐藏安装区模块。

#### Scenario: Install section removed
- **WHEN** 截图模式启用
- **THEN** 安装区模块不显示

### Requirement: Hide details section
系统 SHALL 在截图模式下隐藏明细表区域。

#### Scenario: Details removed
- **WHEN** 截图模式启用
- **THEN** 明细表区域不显示

### Requirement: Hide Core Index breakdown modules
系统 SHALL 在截图模式下隐藏 Core Index 区域的输入/输出/缓存输入/推理输出四项明细模块。

#### Scenario: Core Index simplified
- **WHEN** 截图模式启用
- **THEN** Core Index 仅保留总量摘要，四项明细模块不显示

### Requirement: Simplify usage header in screenshot mode
系统 SHALL 在截图模式下隐藏 Usage 区域的 `day` 选项与范围区间展示。

#### Scenario: Usage header simplified
- **WHEN** 截图模式启用
- **THEN** Usage 区域不显示 `day` 选项与范围区间

### Requirement: Force total period in screenshot mode
系统 SHALL 在截图模式下统一使用 `total` 周期视角，并隐藏周期切换入口。

#### Scenario: Total-only view
- **WHEN** 截图模式启用
- **THEN** Usage 与趋势相关区域以 `total` 视角计算与展示，周期切换入口不显示

### Requirement: Hide range captions in screenshot mode
系统 SHALL 在截图模式下隐藏范围说明文字（包括活动热力图范围与页脚范围）。

#### Scenario: Range captions removed
- **WHEN** 截图模式启用
- **THEN** 页面不显示范围说明文字

### Requirement: Hide trend module
系统 SHALL 在截图模式下隐藏趋势模块。

#### Scenario: Trend module removed
- **WHEN** 截图模式启用
- **THEN** 趋势模块不显示

### Requirement: Hide refresh controls
系统 SHALL 在截图模式下隐藏 Usage 区域的刷新与状态栏。

#### Scenario: Refresh controls removed
- **WHEN** 截图模式启用
- **THEN** Usage 区域不显示刷新按钮与状态信息

### Requirement: Swap usage and heatmap order
系统 SHALL 在截图模式下将 Usage 区域置于活动热力图之上。

#### Scenario: Usage above heatmap
- **WHEN** 截图模式启用
- **THEN** Usage 模块位于活动热力图之前

### Requirement: Hide heatmap legend
系统 SHALL 在截图模式下隐藏热力图的 less/more 图例行。

#### Scenario: Legend removed
- **WHEN** 截图模式启用
- **THEN** 热力图不显示 less/more 图例行

### Requirement: Replace header with screenshot title
系统 SHALL 在截图模式下隐藏顶部栏，并显示截图标题 “Coding Agent Wrapped 2025”。

#### Scenario: Header replaced
- **WHEN** 截图模式启用
- **THEN** 顶部栏不显示，页面顶部展示截图标题

### Requirement: X share button
系统 SHALL 在截图模式标题右侧提供 X 分享按钮，并跳转到 X Web Intent 页面以分享当前页面链接。

#### Scenario: Share to X
- **WHEN** 用户点击 X 分享按钮
- **THEN** 页面跳转到 X Web Intent 分享窗口，并带上当前页面 URL
