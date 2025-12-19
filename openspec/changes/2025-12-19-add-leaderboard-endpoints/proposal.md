# Change: Add token-usage leaderboard (day/week/month/total)

## 结论

新增“排行榜（Leaderboard）”后端能力：按 **UTC** 的 `day / week / month / total`（自然日/周/月 + 总榜）窗口，基于 `total_tokens` 对用户做排名，并提供统一接口 `GET /functions/vibescore-leaderboard` 给 Dashboard 使用。

该能力属于 **跨用户聚合读取**，因此必须显式处理隐私与权限边界：用户自动加入排行榜，但默认以 **匿名身份**展示；只有用户显式选择公开时，才展示其公开 profile（例如 `users.nickname` / `users.avatar_url`）。无论如何都不返回 email、设备信息或任何日志内容。

## Why

我们需要一个“可对比”的激励机制：用户可以在日/周/月维度看到自己在全体用户中的 token 消耗排名，从而形成目标感与持续使用的反馈回路。

## What Changes

- 新增 Edge Function：
  - `GET /functions/vibescore-leaderboard?period=day|week|month|total`
  - Auth：`Authorization: Bearer <user_jwt>`
  - 输出：按 `total_tokens` 降序的前 N 名（默认 N=20，上限=100）
- 新增 Edge Function（用户设置）：
  - `POST /functions/vibescore-leaderboard-settings`
  - Body：`{ "leaderboard_public": boolean }`
  - Auth：`Authorization: Bearer <user_jwt>`
  - 行为：写入/更新当前用户的 `vibescore_user_settings.leaderboard_public`
- 新增 DB 层聚合能力（推荐方案，不依赖 service role key）：
  - `SECURITY DEFINER` SQL function 负责跨用户聚合与排名（只输出安全字段）
  - 对外暴露为 “当前日/周/月/总榜” 的只读 view（Edge Function 通过 `.from(view)` 获取结果）
- 新增用户设置（用于“匿名/公开”切换）：
  - 默认匿名（自动加入）
  - 公开后才显示昵称/头像

## Impact

- Affected specs：`vibescore-tracker`
- Affected code：
  - `insforge-functions/`：新增 leaderboard edge function
  - 数据库：新增 leaderboard SQL function / views（以及可能的索引）
  - Dashboard：后续可接入展示（本提案先聚焦后端）
- 风险：
  - **隐私**：跨用户数据必须只输出公开字段，避免间接识别（email/device/细粒度时间戳）
  - **性能**：后续用户规模上来后，需要避免对 `vibescore_tracker_events` 的全表扫描

## 需要确认的问题（欢迎直接拍板）

已确认：

1. 加入策略：自动加入，默认匿名；用户可选择公开
2. 时间基准：UTC；周起始：Sunday（致敬 GitHub，全球一致）
3. 窗口口径：自然日/周/月（Calendar）；并提供总榜；不支持自定义日期筛选
4. 匿名显示名：统一显示 `Anonymous`（不做编号）
5. 返回包含 `me`：当用户不在 Top N 时，仍返回自己的 `rank/total_tokens`
6. `limit`：默认 `20`，上限 `100`
7. `period=total` 的 `from/to`：固定返回 `from=system_earliest_day`，`to=today_utc`

仍需确认（实现细节）：

（暂无）
