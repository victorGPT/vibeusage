# Dashboard screenshot mode

## ADDED Requirements

### Requirement: Screenshot mode trigger
系统 SHALL 支持通过查询参数 `screenshot=1|true` 启用截图模式，未启用时行为不变。

#### Scenario: Enable screenshot mode
- **WHEN** 用户访问带参数 `?screenshot=1` 的 Dashboard
- **THEN** Dashboard 进入截图模式

### Requirement: Horizontal layout in screenshot mode
系统 SHALL 在截图模式下使用横向两列布局，左侧为 Identity 与活动热力图，右侧为 Core 与 Model。

#### Scenario: Two-column layout
- **WHEN** 截图模式启用
- **THEN** 页面左侧仅展示 Identity 与热力图，右侧仅展示 Core 与 Model

### Requirement: Only four modules in screenshot mode
系统 SHALL 在截图模式下仅保留 Identity、活动热力图、Core、Model 四个模块。

#### Scenario: Extra modules removed
- **WHEN** 截图模式启用
- **THEN** 安装区、趋势、明细与其他非目标模块不显示

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

### Requirement: Hide heatmap legend
系统 SHALL 在截图模式下隐藏热力图的 less/more 图例行。

#### Scenario: Legend removed
- **WHEN** 截图模式启用
- **THEN** 热力图不显示 less/more 图例行

### Requirement: Hide header in screenshot mode
系统 SHALL 在截图模式下隐藏顶部栏，仅保留截图内容区。

#### Scenario: Header hidden
- **WHEN** 截图模式启用
- **THEN** 顶部栏不显示

### Requirement: Screenshot title block
系统 SHALL 在截图模式左上角展示两行标题：“Coding Agent” 与 “2025 Wrapped”，并将内容区下移。

#### Scenario: Title shown in top-left
- **WHEN** 截图模式启用
- **THEN** 左侧顶部显示两行标题，Identity 与热力图位于其下方

### Requirement: Share page with OG image
系统 SHALL 提供用于分享的静态页面，并通过 OG/Twitter Card 指向截图图片。

#### Scenario: Share page metadata
- **WHEN** X 抓取分享页元数据
- **THEN** 返回包含截图图片的 OG/Twitter Card 元数据

### Requirement: Non-production entry for screenshot mode
系统 SHALL 在非生产环境的 Dashboard 顶部栏提供 “Wrapped 2025” 入口按钮，按钮为金色并指向截图模式 URL，生产环境不显示该入口。

#### Scenario: Entry shown only on non-production host
- **WHEN** 用户访问非生产环境的 Dashboard
- **THEN** 顶部栏显示金色 “Wrapped 2025” 入口并跳转到截图模式页面

### Requirement: Static wrapped image page
系统 SHALL 提供静态图片页面用于展示截图结果，并作为 “Wrapped 2025” 入口跳转目标。

#### Scenario: Wrapped entry opens static image
- **WHEN** 用户点击 “Wrapped 2025” 入口
- **THEN** 进入静态图片页面并展示截图图片
