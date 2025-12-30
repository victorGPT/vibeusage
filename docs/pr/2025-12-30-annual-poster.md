# PR Gate: 2025 Annual Summary Poster

## Goal
Add a static 2025 annual summary poster view and export a shareable image.

## Verification
- `node scripts/copy-sync.cjs pull --dry-run` => diff shows local `dashboard.poster.title` + `dashboard.screenshot.*` + `share.meta.*` vs origin/main (expected)
- `node scripts/validate-copy-registry.cjs` => warnings only (unused keys: landing.meta.*, share.meta.*, identity_card.operator_label, identity_panel.access_label, usage.summary.since, dashboard.session.label)
- `npm --prefix dashboard run build` => PASS (vite build, re-run after adding share page + X card)
- `npm --prefix dashboard run build` => PASS (vite build, after adding Wrapped 2025 entry + screenshot)
- `npm --prefix dashboard run build` => PASS (vite build, after adding wrapped static page)
- `npm --prefix dashboard run build` => PASS (vite build, after updating screenshot layout to 2-column mode)
- `npm --prefix dashboard run build` => PASS (vite build, after adding screenshot title block)
- `npm --prefix dashboard run build` => PASS (vite build, after adding screenshot download + X buttons)

## Poster Export
- Dev server: `npm --prefix dashboard run dev -- --host 127.0.0.1 --port 4173`
  - Port 4173 in use, Vite served at `http://127.0.0.1:4174/`
- Export path: `docs/posters/2025-annual-summary.png`
- Capture URL: `http://127.0.0.1:4174/?poster=2025&mock=1`
- Note: poster image generated with mock data.

## Dashboard Screenshot
- Dev server: `npm --prefix dashboard run dev -- --host 127.0.0.1 --port 4173`
- Capture URL: `http://127.0.0.1:4173/?screenshot=1&mock=1`
- Export path: `docs/screenshots/wrapped-2025.png`
- Capture command: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --disable-gpu --window-size=1200,6000 --hide-scrollbars --virtual-time-budget=8000 --run-all-compositor-stages-before-draw --screenshot=docs/screenshots/wrapped-2025.png "http://127.0.0.1:4173/?screenshot=1&mock=1"`

## Wrapped Static Page
- Entry URL: `/wrapped-2025.html` (non-production only)
- Static image: `dashboard/public/wrapped-2025.png`
- Image source: `http://127.0.0.1:4173/?screenshot=1&mock=1`
- Capture command: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless --disable-gpu --window-size=1400,2200 --hide-scrollbars --virtual-time-budget=8000 --run-all-compositor-stages-before-draw --screenshot=docs/screenshots/wrapped-2025.png "http://127.0.0.1:4173/?screenshot=1&mock=1"`

## Screenshot Layout
- Mode URL: `/?screenshot=1` (non-production only)
- Layout: left = Identity + Heatmap, right = Core + Model
