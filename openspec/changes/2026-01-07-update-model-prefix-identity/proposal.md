# Change: Preserve model prefix identity and strict model filtering

## Why
当前 usage model 规范化会丢弃前缀，导致不同供应商的同名模型被合并统计；这违背模型身份优先原则并降低可审计性。

## What Changes
- Preserve full usage model identifiers (keep prefixes; only trim + lower-case).
- Make `model` filter strict; only explicit alias mappings expand the range.
- Pricing alias remains explicit; missing alias falls back to default profile (no implicit suffix pricing).
- Update tests and API behavior documentation.

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`.
- Affected code: `insforge-src/shared/model.js`, usage edge functions, pricing resolver behavior, tests.
- No schema changes; no historical backfill.
