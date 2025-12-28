# Verification Report

Date: 2025-12-28

## Regression Commands

1) Edge functions test suite
```
node --test test/edge-functions.test.js
```
Result: pass (32 tests).

2) Usage model breakdown acceptance
```
node scripts/acceptance/usage-model-breakdown.cjs
```
Result: pass (`ok: true`).

3) OpenRouter pricing sync acceptance
```
node scripts/acceptance/openrouter-pricing-sync.cjs
```
Result: pass (`ok: true`).
