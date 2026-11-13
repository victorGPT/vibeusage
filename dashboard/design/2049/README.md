# 2049 reference

These files are the comparison baseline for the 2049 redesign PRs. They come from the canvas at https://claude.ai/artifact/8BFy57cPxYfmrveRhUT6Ut (version 81).

- `source/` holds one `.dc.html` per board, copied unchanged from the canvas. Inline styles are the exact values. `Main.dc.html` is the spec board that `src/styles/2049.css` follows. `canvas.json` lists each board's title and declared size.
- Each `page-*.png` and `spec-*.png` is one board, rendered at 1280 CSS px wide with device scale 1. The height is the larger of the declared board height and the content plus 48 px. So `page-dashboard`, `page-states`, `spec-actions`, `spec-type` and `spec-data` are taller than `canvas.json` says, because their content overflows the declared size.
- The spec board (`Main.dc.html`) has no PNG. Read its source.
- One name differs from the spec board. It maps JetBrains Mono to `--font-mono`, but in code it is `--font-command`, because the leftover v1 pages (`AgentResourcePage`, `ErrorBoundary`, `SignInRedirect` and `SignUpRedirect`) still use `--font-mono` for Geist Mono. Rename it when those pages move to 2049.
