# VibeUsage — Dashboard UI kit

High-fidelity recreation of the **Operations Deck** dashboard at vibeusage.cc — the only product surface.

## Files

| File | What |
| --- | --- |
| `index.html` | Mounts the dashboard. The kit's screenshot. |
| `Dashboard.jsx` | All components: `Header`, `Panel`, `Btn`, `IdentityCard`, `Identicon`, `PeriodTabs`, `HeroTotal`, `ModelBreakdown`, `ActivityHeatmap`, `TrendChart`, `Leaderboard`, `InstallBlock`, `FooterBar`, `MatrixRain`, `ScrambleText`, `Toast`. |
| `styles.css` | Kit-scoped CSS. Imports `../../colors_and_type.css` for tokens. |

## Components recreated from upstream

Mapping to the source repo (`victorGPT/vibeusage@main`) for grounding:

| Kit component | Upstream source |
| --- | --- |
| `Panel` (ascii / primary / secondary) | `dashboard/src/ui/foundation/Panel.jsx` |
| `Btn` | `dashboard/src/ui/foundation/MatrixButton.jsx` |
| `Identicon` | `dashboard/src/ui/foundation/MatrixAvatar.jsx` |
| `MatrixRain` (canvas, landing-only) | `dashboard/src/ui/matrix-a/components/MatrixRain.jsx` |
| `ScrambleText` (decoding-reveal) | `dashboard/src/ui/foundation/ScrambleText.jsx` |
| `Header` shell | `dashboard/src/ui/foundation/MatrixShell.jsx` |
| `HeroTotal` · `ModelBreakdown` · `TrendChart` · `Leaderboard` · `ActivityHeatmap` | `dashboard/src/ui/matrix-a/components/UsagePanel.jsx` and siblings |

## Interactive bits

- **Period tabs** (`DAY / WEEK / MONTH / TOTAL`) — swap the hero number + cost.
- **Keyboard layer** (`d / w / m / t / r`) — single-key, suppressed in inputs. Per `DESIGN.md §11`.
- **Refresh button** — fires a stderr-style toast (`SYNCING_NEURAL_WEIGHTS... OK`) for 1.8s.
- **Sign-in toggle** — handle ↔ `SIGN IN` in the header.
- **Decoding-reveal** — runs on first paint of the identity handle and the install command.

## What's faithful

- Token palette / type / spacing — all from `colors_and_type.css` (which mirrors `dashboard/DESIGN.md §2–§5` verbatim).
- ASCII frame structure (`╔ ═ ╗ │ └ ─ ┘`), corner-cross title chip, weight ladder primary→tertiary.
- Hero `display-0` number + gold cost callout + `[ KEY ]` micro tag.
- Per-CLI breakdown bars, sub-model chiclets at `caption` weight.
- Scanline + CRT vignette + Matrix-rain at the documented 20% canvas opacity.
- Single-color SVG identicon, 5×5 mirror-symmetric, hash-seeded.

## Cuts / disclaimers

- **Backend**: none. Numbers are a static `SAMPLE_*` table that swaps by period.
- **OAuth + GitHub repo meta**: omitted; "SIGN IN" toggles a local boolean.
- **`prefers-reduced-motion`**: matrix rain runs anyway in this kit. Upstream kills it.
- **Screenshot-capture mode**: not wired (would freeze rain, hide chrome).
- **Wrapped 2025 page**: not in this kit; pull `dashboard/public/wrapped-2025.png` upstream for the brand artefact reference.
- **Sub-model labels** in `ModelBreakdown` are truncated where the live data has long strings — the design system just doesn't break them differently from upstream.

If you need any of these wired up, point at the upstream component path in the table above and I'll port one in.
