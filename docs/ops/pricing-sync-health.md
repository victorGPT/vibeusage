# Pricing Sync Health Check

## 环境变量（InsForge 后台）
- `OPENROUTER_API_KEY`
- `VIBESCORE_PRICING_SOURCE=openrouter`
- `VIBESCORE_PRICING_MODEL=gpt-5.2-codex`
- Optional: `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE`

## 手动触发
- GitHub Actions: **Sync Pricing Profiles**（默认 `retention_days=90`）
- 或 curl：

```bash
BASE_URL="https://5tmappuk.us-east.insforge.app"
curl -s -X POST "$BASE_URL/functions/vibescore-pricing-sync" \
  -H "Authorization: Bearer <service_role_or_project_admin_key>" \
  -H "Content-Type: application/json" \
  --data '{"retention_days":90}'
```

## 健康检查 SQL
在 InsForge SQL 控制台执行：

```sql
-- scripts/ops/pricing-sync-health.sql
```

期望信号：
- `is_fresh = true`（允许 12 小时内更新）
- 最新 `effective_from` 有大量 `active_rows`
- 默认模型 `gpt-5.2-codex` 存在（精确或带前缀）
- `Unmatched usage models` 查询为空（或数量可解释）

## 常见错误
- `Unauthorized`：key 权限不足或环境不匹配
- `permission denied for sequence`：缺少序列权限（需 grant）
- `OPENROUTER_API_KEY missing`：InsForge 环境变量未配置
