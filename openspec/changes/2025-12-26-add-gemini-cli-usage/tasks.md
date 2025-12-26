## 1. Spec
- [x] Add Gemini session parsing requirements to the spec delta.

## 2. Implementation
- [x] Add Gemini session file discovery under `~/.gemini/tmp/**/chats/session-*.json`.
- [x] Implement Gemini session parser with token mapping + model extraction.
- [x] Integrate Gemini parsing into `sync` with idempotent cursors.
- [x] Ensure content fields are ignored and never persisted.

## 3. Tests
- [x] Parser: Gemini tokens aggregate into half-hour buckets with `source = "gemini"`.
- [x] Parser: token mapping matches allowlist (`output + tool`, `thoughts`).
- [x] Parser: model fallback to `unknown`.
- [x] Parser: idempotent re-run yields no new buckets.

## 4. Verification
- [x] `node --test test/rollout-parser.test.js`
- [x] Local: run `node bin/tracker.js sync` and confirm Gemini buckets appear in `~/.vibescore/tracker/queue.jsonl`.
