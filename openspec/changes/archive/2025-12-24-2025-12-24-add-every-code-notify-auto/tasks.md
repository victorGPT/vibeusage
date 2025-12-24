## 1. Implementation
- [x] 1.1 Add notify config support for Every Code (`CODE_HOME`/`~/.code`) with non-creation guard
- [x] 1.2 Update `init` to install Every Code notify and persist original notify for uninstall/chain
- [x] 1.3 Update `uninstall` to restore Every Code notify (or remove if none existed)
- [x] 1.4 Update notify handler to accept `--source=every-code` and chain correct original notify safely

## 2. Tests
- [x] 2.1 Regression: init/uninstall preserves and restores Every Code notify when config exists
- [x] 2.2 Regression: init skips Every Code notify when config is missing

## 3. Docs
- [x] 3.1 Update `README.md` / `README.zh-CN.md` to mention auto Every Code notify when config exists
