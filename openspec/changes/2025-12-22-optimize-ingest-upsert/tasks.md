## 1. Implementation
- [x] 1.1 service-role ingest 采用 upsert fast path（on_conflict + ignore-duplicates）。
- [x] 1.2 失败时回退到原有 select+insert。

## 2. Verification
- [x] 2.1 新增 service-role ingest acceptance 脚本（验证无预查询）。
- [x] 2.2 运行 acceptance 脚本。
