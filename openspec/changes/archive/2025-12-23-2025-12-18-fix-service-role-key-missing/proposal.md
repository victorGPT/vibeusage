# 2025-12-18-fix-service-role-key-missing 提案

## 结论

移除 `vibescore-device-token-issue` / `vibescore-ingest` 对云端 `SERVICE_ROLE_KEY`（或 `INSFORGE_SERVICE_ROLE_KEY`）环境变量的硬依赖，改为：

- **device-token-issue**：使用 `user_jwt`（edgeFunctionToken）+ RLS 插入（新增 `device_tokens` 的 insert policy）
- **ingest**：使用 `anonKey` 调用数据库 records API（`Prefer: return=minimal`），并通过 RLS + DB helper（`device_token_id` + SECURITY DEFINER 校验）完成“设备 token → user_id/device_id”绑定与写入授权（无需 service role key）

目标是让初始化与同步在“无需任何手动配置云端密钥”的情况下可跑通，并把关键路径做成可自动化回归测试。

## 现象（Doctor）

用户执行 `npx --yes /tracker init` 完成网页登录后，CLI 调用 `POST /functions/vibescore-device-token-issue` 返回：

- `Device token issue failed: Service role key missing`

导致 `init` 无法完成，后续 `sync` 也无法进入上传路径验证。

## 本质（Detective）

当前 edge functions 代码把 **service role key 视为必备 env**，但 InsForge 项目并未为函数运行时提供该环境变量（或命名不同），从而在函数入口直接失败。

这属于“运行时配置假设不成立”的系统性问题，应该通过：

1) 降低对运行时 secret 注入的依赖（优先）  
2) 将必要的权限边界落在 DB 的 RLS 上（可审计、可自动化）  

来避免再次回归。

## 方案选型

### 方案 A：在 InsForge 后台手动配置 `SERVICE_ROLE_KEY`

- 优点：改代码最少
- 缺点：流程不可自动化、容易跨环境错配；与“终端用户无感安装”的目标冲突

### 方案 B：去掉 service role key，靠 RLS + user_jwt / anonKey

- 优点：无需额外云端配置；可自动化；权限边界可在 SQL 里审计
- 缺点：需要补齐若干 RLS policy（安全要求更高，需要测试兜底）

**选择：方案 B。**

## 里程碑（Milestones）

1. **M1：Auth + init 可完成**
   - `vibescore-device-token-issue` 在无 `SERVICE_ROLE_KEY` 时仍可成功签发 device token
2. **M2：ingest 可写入（幂等）**
   - `vibescore-ingest` 在无 `SERVICE_ROLE_KEY` 时可用 device token 写入事件，重复上传不报错
3. **M3：查询闭环**
   - `vibescore-usage-daily/summary` 能查询到聚合结果（view 实时计算）
4. **M4：自动化回归**
   - 单测覆盖：函数不再依赖 `SERVICE_ROLE_KEY` 的关键路径；SQL/RLS 改动有可重复的验证步骤
