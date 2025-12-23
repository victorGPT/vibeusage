# 2025-12-19-add-leaderboard-endpoints 任务清单

> 目标：提供 day/week/month/total 的 token usage leaderboard 后端能力（UTC），并确保跨用户聚合安全可控。

## 1) Contract freeze

- [x] 确认 `period` 取值与 UTC 窗口定义（day/week/month/total；week starts on Sunday）
- [x] 确认 `limit` 默认值与上限（默认 20，上限 100）
- [x] 确认返回字段：`rank/is_me/display_name/avatar_url/total_tokens`（bigint string）+ `me{rank,total_tokens}`
- [x] 确认匿名策略：自动加入，默认 `display_name=Anonymous`；公开后才展示昵称/头像
- [x] 写入一份固定样例 JSON（作为验收依据）

样例（`period=week&limit=2`）：

```json
{
  "period": "week",
  "from": "2025-12-14",
  "to": "2025-12-20",
  "generated_at": "2025-12-19T12:00:00.000Z",
  "entries": [
    {
      "rank": 1,
      "is_me": false,
      "display_name": "Anonymous",
      "avatar_url": null,
      "total_tokens": "123456"
    },
    {
      "rank": 2,
      "is_me": true,
      "display_name": "Anonymous",
      "avatar_url": null,
      "total_tokens": "456"
    }
  ],
  "me": { "rank": 2, "total_tokens": "456" }
}
```

## 2) Database

- [x] 新增 user settings 表（`vibescore_user_settings.leaderboard_public`）与 RLS
- [x] 新增 leaderboard SQL function（`SECURITY DEFINER`，跨用户聚合 + 排名 + 匿名/公开）
- [x] 新增 day/week/month/total current views（用于 `.from(view)` 查询）
- [x] 新增 me day/week/month/total current views（用于 `.from(view)` 查询）
- [x] 部署：应用 SQL 到 InsForge2 数据库（create table/functions/views/index）
- [x] 性能：新增 `token_timestamp` 相关索引（如有必要）
  - [x] 评估是否需要：`(token_timestamp desc, user_id)` 索引
  - [x] 添加 `token_timestamp desc, user_id` 索引（leaderboard range 聚合）

## 3) Backend（InsForge2 edge function）

- [x] 新增 `insforge-functions/vibescore-leaderboard.js`（GET）
- [x] Auth：`auth.getCurrentUser()` 必须成功，否则 401
- [x] 参数校验：`period`/`limit`
- [x] 查询对应 view，并返回 contract JSON（bigint 转 string）
- [x] 同时查询 `me` view，并返回 `me{rank,total_tokens}`
- [x] 部署：创建并启用 `vibescore-leaderboard`（InsForge2 edge function）
- [x] 新增 `insforge-functions/vibescore-leaderboard-settings.js`（POST）：用户切换匿名/公开
- [x] 部署：创建并启用 `vibescore-leaderboard-settings`（InsForge2 edge function）

## 4) Tests / Verification

- [x] 单测：参数归一化与 window 计算（确定性；UTC + Sunday start；含 total）
- [x] 单测：edge function（mock createClient）
- [x] smoke：扩展 `scripts/smoke/insforge-smoke.cjs`（可选）
- [x] replay：用户设置写入幂等（重复提交同一请求不破坏状态）
  - `node scripts/acceptance/leaderboard-settings-replay.cjs`

## 5) OpenSpec

- [x] 更新 `openspec/changes/<id>/specs/vibescore-tracker/spec.md`
- [x] `openspec validate 2025-12-19-add-leaderboard-endpoints --strict`
