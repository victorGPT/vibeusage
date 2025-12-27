# Verification Report

## Scope
- link code 签发与兑换
- link code 兑换 RPC 原子化占用
- CLI `init --link-code`
- Dashboard 安装命令复制与遮罩

## Tests Run
- `node --test test/edge-functions.test.js`
- `node --test test/init-uninstall.test.js`
- `node scripts/acceptance/link-code-exchange.cjs`
- `npm test`
- `node scripts/validate-copy-registry.cjs`
- `npm run build:insforge`

## Results
- All listed commands completed successfully.
- Copy registry validation emits existing unused-key warnings (non-blocking).

## Evidence
- Edge tests include `vibescore-link-code-issue` and link-code RPC exchange cases.
- Acceptance script output includes `{ "ok": true }`.
- `npm test` reports 85 passing tests.

## Remaining Risks
- Edge runtime missing service role key will block link-code exchange (returns 500).
- Missing RPC deployment will block link-code exchange (returns 500).
