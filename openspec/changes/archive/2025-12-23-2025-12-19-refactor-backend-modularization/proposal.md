# Change: Refactor backend modularization & API decoupling

## 结论

我们**需要**做后端（Edge Functions）与“后端接口”（CLI/Dashboard 调用层）的模块化与解耦，但应当以 **“不改变外部 contract”** 为前提、以 **build-time modularization** 为落地手段。

原因很简单：InsForge2 Edge Function 的部署约束是**单文件**，运行时无法可靠 `import` 多文件；因此“模块化”只能在**代码组织层 + 构建打包层**实现，最终仍输出单文件部署物（继续落在 `insforge-functions/*.js`）。

本提案推荐分两阶段推进（都保持非破坏性）：

1. **后端实现模块化（Edge Functions）**：引入 `insforge-src/`（多文件源码）+ 打包脚本，生成 `insforge-functions/`（单文件产物）。
2. **后端接口解耦（客户端调用层）**：将 CLI / Dashboard 中散落的 endpoint 字符串与 fetch 逻辑收敛到各自的 `vibescore-api` 模块里，减少“路径/参数/错误处理”变更的扩散半径。

## Why（第一性原理）

从第一性原理看，“模块化/解耦”不是美学问题，而是为了让系统在变化中保持正确性：

- **系统要交付的是什么？**：稳定可依赖的使用统计/排行榜能力（contract），而不是某个实现细节。
- **变化一定会发生在哪里？**：新 endpoint、新参数、auth 细节、UTC 窗口口径、限流与错误语义。
- **代价最昂贵的是什么？**：在多个文件里“重复实现同一条安全/时间/错误规范”，导致某次变更遗漏 → 线上行为不一致（尤其是 auth / CORS / input validation）。

当前代码的客观现状：

- `insforge-functions/*.js` 之间存在大量重复：CORS、`json()`、Bearer 解析、`getCurrentUser()`、UTC 日期工具、bigint/number 处理等；
- 这些重复是**安全/正确性**的横切关注点，重复意味着“未来必然分叉”；
- CLI 与 Dashboard 内部也各自硬编码 endpoint 路径；一旦路径/参数变更，需要跨多处修改，容易漏。

## What Changes

> 本提案**不改变**任何对外接口（endpoint path、query/body、response shape），仅重构内部组织方式。

### 1) Edge Functions：build-time modularization

- 新增源码目录：`insforge-src/`
  - `insforge-src/shared/*`：CORS/JSON/auth/env/date/number 等共享模块
  - `insforge-src/functions/*`：各 edge function 的 entry（每个 endpoint 一个 entry）
- 新增构建脚本：`scripts/build-insforge-functions.cjs`
  - 输入：`insforge-src/functions/*.js`
  - 输出：`insforge-functions/*.js`（单文件、可部署）
- 增加 npm scripts（示例）：
  - `npm run build:insforge`：生成 `insforge-functions/`
  - `npm run build:insforge -- --check`：检查产物是否最新（可选）

### 2) 接口调用层：收敛 endpoint 与请求逻辑

- CLI：新增 `src/lib/vibescore-api.js`
  - 统一管理：`/functions/vibescore-ingest`、`/functions/vibescore-device-token-issue` 等调用
  - 统一错误解析与 `Retry-After` 处理
- Dashboard：新增 `dashboard/src/lib/vibescore-api.js`
  - 统一管理：usage/heatmap/leaderboard/settings 等请求
  - hooks 只调用 API 模块，不再拼 URL 字符串

### 3) 质量门槛（必须满足）

- `npm test` 通过
- `npm --prefix dashboard run build` 通过
- 产物约束：每个 edge function 输出仍为单文件，并继续使用 `module.exports = async function(request) {}`
- 不引入运行时 secrets（仍从 `Deno.env.get(...)` 读取）

## Impact

- Affected specs：无（行为/contract 不变）
- Affected code：
  - `insforge-functions/`（从“手写源文件”升级为“可审阅的构建产物”）
  - 新增 `insforge-src/`、`scripts/build-insforge-functions.cjs`
  - CLI/Dashboard 的 API 调用点会被收敛到新的模块
- 风险：
  - 构建链路引入新的失败模式（忘记 build / bundler 输出不兼容 Deno runtime）
  - 需要明确“source-of-truth”与 review 方式（见下方确认点）

## 需要你确认的问题（拍板即可）

1. **构建方式选择**：
   - A) `esbuild`（推荐）：标准、可靠、bundle 成单文件
   - B) 纯 Node 拼接/模板：零依赖，但更脆、可维护性略差
2. `insforge-functions/` 是否继续 **commit** 到 repo：
   - A) commit（推荐）：部署物可审阅、历史可追
   - B) 不 commit：需要 CI 生成（当前项目未建立 CI，容易漏）

已确认（2025-12-19）：

- 选择 **A + A**：`esbuild` + commit `insforge-functions/`
