## 1. Implementation
- [ ] 1.1 Add build-time HTML transform to inject rich link meta from copy registry
- [ ] 1.2 Add static OG/Twitter meta placeholders in `dashboard/index.html`
- [ ] 1.3 Remove runtime rich link injection from `dashboard/src/main.jsx`
- [ ] 1.4 Add `landing.meta.og_url` to `dashboard/src/content/copy.csv`

## 2. Verification
- [ ] 2.1 Run `node scripts/validate-copy-registry.cjs`
- [ ] 2.2 Run `npm --prefix dashboard run build` and confirm `dashboard/dist/index.html` includes OG/Twitter meta tags and the canonical `og:url`

## 3. Docs
- [ ] 3.1 Update `openspec/specs/vibescore-tracker/evidence.md` for the new requirement
