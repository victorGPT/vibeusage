# PR Gate: 2025 Annual Summary Poster

## Goal
Add a static 2025 annual summary poster view and export a shareable image.

## Verification
- `node scripts/copy-sync.cjs pull --dry-run` => diff shows local `dashboard.poster.title` + `dashboard.screenshot.*` vs origin/main (expected)
- `node scripts/validate-copy-registry.cjs` => warnings only (unused keys: landing.meta.*, identity_card.operator_label, identity_panel.access_label, usage.summary.since, dashboard.session.label)
- `npm --prefix dashboard run build` => PASS (vite build, re-run after adding X share button)

## Poster Export
- Dev server: `npm --prefix dashboard run dev -- --host 127.0.0.1 --port 4173`
  - Port 4173 in use, Vite served at `http://127.0.0.1:4174/`
- Export path: `docs/posters/2025-annual-summary.png`
- Capture URL: `http://127.0.0.1:4174/?poster=2025&mock=1`
- Note: poster image generated with mock data.
