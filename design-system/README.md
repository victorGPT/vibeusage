# VibeUsage Design System

> **Bloomberg terminal × The Matrix.** A retro-cyberpunk operations deck for tracking AI coding-agent token usage. The product is the screenshot — every panel must survive cropping and read as earned, not corporate.

This system is a near-direct port of the upstream `dashboard/DESIGN.md` v3 (2026-04-25), heritage v1 Operations Deck. SSOT: tokens defined in `colors_and_type.css` derive verbatim from the upstream Tailwind + CSS-variable contracts.

---

## Sources

| Source | Path / URL |
| --- | --- |
| GitHub repo | `victorGPT/vibeusage@main` |
| Live dashboard | https://www.vibeusage.cc |
| Upstream design SSOT | `dashboard/DESIGN.md` (v3) |
| Upstream product brief | `dashboard/PRODUCT.md` |
| Tailwind tokens | `dashboard/tailwind.config.cjs` |
| Foundation components | `dashboard/src/ui/foundation/` (Panel, Text, MatrixButton, MatrixShell, MatrixAvatar, ScrambleText, DecodingText) |
| Matrix-A components | `dashboard/src/ui/matrix-a/components/` (UsagePanel, IdentityCard, ActivityHeatmap, MatrixRain, etc.) |
| Visual artefact | upstream `dashboard/public/wrapped-2025.png` (canonical "yearly debrief" — not duplicated in this kit) |

The reader is **not** assumed to have access to the repo — every value used in this system is restated locally.

---

## Product context

**VibeUsage** is a token-usage tracker for AI coding-agent CLIs (Codex, Claude Code, Gemini CLI, OpenCode, Hermes, OpenClaw, Every Code). It installs lightweight local hooks, parses local logs and SQLite databases, aggregates into 30-minute UTC buckets, and uploads only the metadata needed to power a dashboard, leaderboard, and yearly Wrapped page.

There is **one product surface**:

- **Dashboard** (`vibeusage.cc`) — a single-page operations deck. Identity card, period switcher, hero total, model breakdown, project usage, activity heatmap, trend monitor, leaderboard, yearly Wrapped. Built with React + Tailwind + Vite.

The CLI is plumbing; the dashboard is the artifact users post to X.

### Audience

Developers active on X / Twitter who already screenshot their dev tools and yearly recaps. They run multiple AI CLIs in parallel and want a brag-worthy artifact of consumption. Not enterprise ops, not a billing console, not a wellness "digital detox" reflection.

### Three-word brand

**hacker · 复古 (retro) · cyberpunk**

---

## Visual thesis

Operations Deck. **Material**: zero radius on every data surface (the only `border-radius: 999px` exceptions are the status dot, identity / project avatars, and floating action buttons — see §Visual foundations / Corner radii), thin 1px lines, low-noise surfaces, numbers as the hero. **Energy**: restrained neon green + density + a single scanline layer. **Pocket color**: Matrix Green `#00FF41` — appears only on data, active state, hover-lines, and single-glow text. Never as a filled surface larger than a button.

**Signature**: ASCII-frame panel + corner-cross marks (`<Panel variant="ascii">`).
**Signature micro-interaction**: `decoding-reveal` / scramble — characters converge on the final string. Reserved for first-paint hero title, display-2 primary number, and identity handle. Not for labels.

---

## CONTENT FUNDAMENTALS

### Voice

**Hacker honest, not corporate kind.** Every label fits in 12 caps-locked monospaced characters. Captions are technical and sometimes self-deprecating. Numbers are loud, prose is quiet. The user is a developer who can read a number — the product respects that literacy.

### Tone in concrete patterns

- **Person**: implicit second-person ("Track token usage…"), never "we" / "our team", never "you're amazing!"
- **Numbers are loud**: hero numbers at 60–96px display weight; supporting labels at 10–12px caps.
- **No emoji.** Period.
- **No exclamation marks.** Empty states read like terminal stderr, not friendly mascot text.
- **Casing**: section titles, panel headings, labels, button text → **UPPERCASE** with `0.12em–0.22em` tracking. Body prose → sentence case. Never title case.
- **Underscores over spaces** in label-like UI text (status, log lines): `LINK_ACTIVE`, `SESSION_TIME`, `SCRAPING_CODEX_ENDPOINT`, `BOOTING_VIBE_OS`. Spaces are allowed in body prose.
- **Honest rounding**: never `~1M`. Show `1,042,318`. Never round for comfort.
- **Empty / error states**: `// no data yet`, `error: opencode.db not found`. Stderr style.

### Specific examples (lifted verbatim)

- Tagline (footer of upstream README): **"More tokens. More vibe."**
- Dashboard total label: `LIFETIME_TOKEN_WEIGHT`
- Boot state: `BOOTING_VIBE_OS`
- Background log lines (live in `copy.jsx`): `SCRAPING_CODEX_ENDPOINT_0x2A1F`, `SYNCING_NEURAL_WEIGHTS... OK`, `TOKEN_BUFFER_OVERFLOW_DETECTED`, `PUSHING_VIBE_METRICS_TO_UPLINK`, `RECALIBRATING_RANK_COORDINATES`, `DEEP_WORK_STATE_ESTABLISHED`, `UPLOADING_LOCAL_RECEPTOR_LOGS`
- Identity stamp: `LVL_05`, `RANK #0042`, `STREAK 12_DAYS`, `NEO.SYST_3M`
- Cost callout (upstream copy.csv): "you've spent more on Sonnet than on coffee this month"
- Footer commands: `[F1] HELP`, `[F2] SNAPSHOT`, `[F3] CONFIGURE`
- Sign-off: `Neural_Index: 0.942.A1 · © 2026 VibeScore_Corp`

### Vibe in one paragraph

The user feels **seen and slightly called out** — like an old terminal friend that knows exactly how much money they burned today. The dashboard does not look like Datadog, Grafana, GitHub Wrapped, or Spotify Wrapped. It looks like a 1995 trading floor someone re-skinned with phosphor green at 3 a.m.

---

## VISUAL FOUNDATIONS

### Colors

- **Two tracks for prose / surfaces / accents**: green ink (data) and neutral surface (ground). One accent (`gold #FFD700`) reserved for **leaderboard #1** and total-cost callouts.
- **Green ink** has exactly **5 alpha stops**: `#00FF41` (ink), `#E8FFE9` (ink-bright), `60%` (ink-text), `35%` (ink-muted), `18%` (ink-line). No `/5`, `/8`, `/12`, `/25`, `/45` — pick one.
- **Surfaces** are near-black: `#050505` (page), `rgba(0,10,0,0.70)` (panel), `rgba(0,10,0,0.82)` (chip / modal). Always paired with `backdrop-filter: blur(10px)` on raised surfaces.
- **Status escape hatch**: `warn #FFB300` and `err #FF3344` (with matching `--warn-glow` / `--err-glow`) are reserved for status indicators **only** — connection state, error banners. Never as prose / accent / surface. They are the only hue extension allowed beyond the green-ink + gold palette.
- **No fourth hue**, no purple-pink-cyan dapp gradient, no SaaS navy/slate. Information layering does **not** depend on color discrimination — alpha-stop ladder carries hierarchy.

### Type

- **Geist Mono only**, monospace everywhere — body, data, label, tag. The katakana band uses `Hiragino Sans → Yu Gothic → MS Gothic → Geist Mono` and is decorative chrome only.
- **9 size stops**, no `text-[Npx]`: `display-0` 96px, `display-1` 60px, `display-2` 40px, `display-3` 28px, `heading` 14px, `body` 13px, `data` 12px tabular, `caption` 11px, `micro` 10px.
- **Letter-spacing canonicals** — `-0.03em` (display-0 only), `-0.02em` (display-1/2/3 tight), `0` (body, data), `0.12em` (heading, caption), `0.22em` (micro, divider). Five values; nothing in between (no `0.16em`, no `0.04em` ad-hoc).
- **Hierarchy ratio ≥ 1.25 is non-negotiable.** Display tokens carry the weight; captions and headings exist to label numbers, never to compete.
- **Tabular numerals** on every datum (`font-variant-numeric: tabular-nums`) — columns of numbers must align.

### Spacing

4px grid, restricted to: `0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. No `p-5`, no `gap-7`, no bracket values. If a mid-stop feels needed, the layout itself is wrong.

### Backgrounds

- **Page**: solid `#050505`, never gradient.
- **Imagery**: there is essentially no photography in the brand. The hero "image" is a **canvas-rendered Matrix rain** (`MatrixRain.jsx`) — characters `01XYZA@#$%`, base font 16px scaled to 0.5×, 8 fps, 12% trail alpha, rendered at 20% canvas opacity. **Production rule: landing page only — never in dashboard routes.** (The `ui_kits/dashboard/` demo here intentionally renders rain so the kit can be opened standalone and still feel "in-brand"; production must not.)
- **Patterns**: thin scanlines (4px stripe at 6% black), CRT vignette (`inset 0 0 200px rgba(0,0,0,0.6)` + phosphor warmth), occasional dotted/striped fills built from `repeating-linear-gradient` at 33-alpha green. No textures. No noise SVGs.
- **Color vibe of imagery**: the only "imagery" is product screenshots and the icon set (the hourglass + bracket logo). All single-hue green-on-black. No grain. No film tints. No warm/cool variation.

### Borders

All borders are **1px solid**. No dashed / dotted / `border-[Npx]`. Ladder: `border-ink-line` (default panel + weak rule), `border-ink-muted` (hover), `border-ink` (active / selected).

### Cards

There is no rounded SaaS card here. Cards are:

- ASCII-framed `<Panel variant="ascii">` — top/bottom rule built from `┌ ─ ┐ │ └ ┘`, with the panel title sitting **inside** a small chip on the top rule. Three weight ladders: `primary` uses double-line `╔ ═ ╚`, `secondary` is the default single-line, `tertiary` is dotted `·`. Use **at most one primary** per visible viewport.
- Plain `<Panel variant="plain">` — `1px solid var(--ink-line)` on `bg-surface-raised` + `backdrop-filter: blur(10px)` + `box-shadow: var(--shadow-panel)`.
- Bare `<Panel variant="bare">` — `bg-surface-raised` only, no border (for stacked sub-sections).

`box-shadow` always carries a 1px `0 0 0 1px rgba(0,255,65,0.08)` outline plus a deep `0 18px 40px rgba(0,0,0,0.45)` lift. Never a soft fintech shadow.

### Corner radii

**Zero on every data surface.** The narrow exceptions, all using `border-radius: 999px`:

- **Status dot** (the one signature use) — pulses on "live".
- **Avatar** thumbnails inside project / leaderboard cards — circles read as user/repo identity, not as data.
- **Floating action buttons** (cheatsheet trigger, settings) — circle is the conventional FAB shape; chrome only, never carries data.

Nothing else gets a radius. No `rounded-md` cards, no `rounded-full` data chips, no soft corners on inputs.

### Inner / outer shadows

- **Outer**: `--shadow-panel` (every panel), `--shadow-glow-xs/sm/—` for data points, button highlights, header logo.
- **Inner**: only the CRT vignette layer (`fx-crt`) — a single fixed full-bleed `inset` shadow that gives the page its phosphor depth. Never on individual cards.

### Animation

- **Default transition**: `transition: 200ms ease`. Color and opacity only — never layout.
- **Press**: `active:scale-[0.98]` (the **only** permitted bracket value in the upstream codebase).
- **Signature reveal**: `decoding-reveal` / scramble — characters from the pool `0101XYZA@#$%` converge to the final string. Used on hero title, primary number, identity handle. Reserved.
- **Ambient**: matrix rain (8 fps, landing only); scanline overlay (static); CRT vignette (static); 7-second `fx-glitch` RGB-shift tick on `display-0` only.
- **Easing**: linear / ease — no bounce, no spring, no overshoot. This is a terminal, not a toy.
- **Reduced motion**: `prefers-reduced-motion: reduce` disables matrix rain, scramble, glitch, press scale. Static scanline stays.

### Hover / press states

- **Hover**: lighten the border (`ink-line` → `ink-muted`) and raise the background (`surface-raised` → `surface-strong`). Color stays put. Never opacity changes.
- **Press**: `transform: scale(0.98)` for 100ms. Buttons only.
- **Focus-visible**: 1px `border-ink` ring, never hidden by overflow.
- **Selected / active**: full-strength `ink` border + `glow-sm` shadow + bottom-rule indicator under tab labels.

### Transparency + blur

Used **only on raised surfaces** (panels, chips, sticky headers): `bg-surface-raised` (70% black) + `backdrop-filter: blur(10px)`. The blur exists so the matrix rain dims behind panels; remove it and the layering breaks. Blur is **never** used cosmetically (no frosted-glass cards floating on a gradient).

### Layout rules

- **Fixed**: scanline overlay (`fx-scanline`), CRT vignette (`fx-crt`), matrix rain (`fx-rain`) — three full-bleed `position: fixed` z-stacked layers. `fx-rain` z=0, `fx-crt` z=40, `fx-scanline` z=50, app content z=10.
- **Grid**: 12-column at `lg`, panels span `4 / 8` or `6 / 6` or `4 / 4 / 4`. Panels are screenshot-cropable — every cell stands on its own.
- **Density signals signal.** Empty space is acceptable; padding above 64px between sections is not. Hero panel breathes; supporting panels pack.

### Protection gradients vs capsules

No protection gradients. When type sits on the matrix-rain canvas (landing only), the panel beneath is `bg-surface-raised` + blur — a hard surface, not a gradient mask. Capsules (small status pills, period tabs) are never used as backgrounds for prose; only for one-or-two-word labels in `text-micro` caps.

### Imagery vibe

There essentially is none. If a future component needs a photo, it must be **green-channel only**, monochrome, max 60% opacity, behind a `bg-surface-raised` blur. No warm tints, no skin tones, no stock photography. The brand is text and numbers.

---

## ICONOGRAPHY

### House style

VibeUsage's iconography is **almost entirely typographic**. Where most products would reach for a Lucide stroke or a Heroicon, this brand uses:

- **Box-drawing characters**: `┌ ┐ └ ┘ ─ │ ╔ ╗ ═ ║ · ■` for panel frames, separators, and density indicators (heatmap cells).
- **ASCII glyphs**: `[F1]`, `[F2]`, `<<<`, `>>>`, `_` (cursor), `0x2A1F` (hex labels), `█ ▓ ▒ ░` for inline progress bars.
- **Bracket capsules**: `[ COPY ]`, `[ DECRYPT ]`, `[ REFRESH ]` — square brackets are the brand's stand-in for buttons.
- **Status dots**: a single 6px circle (`border-radius: 999px`) — pulses when "live". One of three rounded exceptions in the system (alongside identity / project avatars and floating action buttons — see §Visual foundations / Corner radii).
- **Identicon avatars**: 5×5 mirror-symmetric grids generated from a hash of the user's handle (`MatrixAvatar.jsx`). Rendered as inline SVG `<rect>`s, no library.

### Logo

- `assets/icon.svg` (1559×1382, transparent) — the canonical mark: a low-resolution **hourglass** in matrix green inside a square-bracket frame `[ ⧗ ]`. Pixel-style cells, deliberately reading as a low-bit terminal glyph, not a vector logo. Apply with `box-shadow: var(--shadow-glow)` on dark surfaces.
- Raster favicons (`icon-192.png`, `icon-512.png`, `favicon-16/32.png`, `apple-touch-icon.png`), social cards (`social-preview.png`, `og-image.jpg`, `landing-dashboard.jpg`), and `wrapped-2025.png` are **not duplicated** in this kit — pull them from upstream `dashboard/public/` if needed.

### Third-party icon libraries

**No Lucide. No Heroicons. No Font Awesome.** No icon font is bundled. Where the upstream codebase needs a third-party brand mark (Codex, Claude Code, Gemini, GitHub), it ships hand-authored single-color SVGs in `dashboard/src/ui/matrix-a/components/ClientLogos.jsx`, all forced to `fill="#00FF41"` so they read as green ink — iconography stays green-only even though the broader palette has gold + warn/err escape hatches (see §Visual foundations / Colors).

### Emoji

**Never.** Not in UI, not in copy, not in error states, not as decoration. Documented as a hard rule in `PRODUCT.md`.

### Unicode as icons

Yes, frequently. The full registered set:

- **Box drawing**: `┌ ┐ └ ┘ ─ │ ╔ ╗ ╚ ╝ ═ ║ ┬ ┴ ┼`
- **Density**: `· ■ ▪ ▫ █ ▓ ▒ ░`
- **Brackets / pointers**: `[ ] < > « » ‹ › ›`
- **Status / arrows**: `↑ ↓ ← → ⟶`
- **Decoration**: katakana band (`カタカナ ベンチマーク シ ス テ ム`) — chrome only, low-alpha, never carries semantic meaning.

If a new component needs a glyph not on this list, prefer adding a Unicode character before adding an SVG.

---

## Index

Files at the project root:

| File | Purpose |
| --- | --- |
| `README.md` | This file. |
| `SKILL.md` | Agent Skills entry point — invokable as `vibeusage-design`. |
| `colors_and_type.css` | Authoritative CSS variables + element styles. Drop-in. |
| `fonts/` | Geist Mono — self-hosted woff2 (400/500/700/900). Vercel official, SIL OFL-1.1. |
| `assets/` | Brand mark `icon.svg` + client logos under `assets/brand/` (Codex / Claude / Gemini / GitHub). Favicons / social cards / wrapped screenshot live upstream in `dashboard/public/`. |
| `assets/brand/` | Client provider marks: Claude / OpenAI · Codex / Gemini / GitHub (simpleicons, tinted #00FF41). |
| `preview/` | Design-system preview cards (rendered by the Design System tab). |
| `ui_kits/dashboard/` | High-fidelity recreation of the Operations Deck dashboard. |

**UI kits** (one per product surface):

- `ui_kits/dashboard/` — VibeUsage Dashboard (the only product surface). Click-thru recreation of identity card, period tabs, hero total, model breakdown, activity heatmap, trend monitor, project usage, leaderboard.

---

## Caveats + open questions

- **Geist Mono** is self-hosted from `fonts/` (4 weights, SIL OFL-1.1, Vercel official via `unpkg.com/geist@1.3.1/dist/fonts/geist-mono/`). Production runtime uses the same files via `@fontsource/geist-mono`.
- **Hiragino Sans / Yu Gothic / MS Gothic** are system fonts on macOS / Windows. We do not bundle a CJK fallback; the katakana band degrades to Geist Mono's latin glyphs on Linux without those families installed.
- **Brand client logos** (Claude / OpenAI · Codex / Gemini / GitHub) live under `assets/brand/` as single-file SVGs from [simple-icons](https://simpleicons.org/), already tinted to `#00FF41`. They are fork-of-trademark material owned by their respective companies — use them only for in-product attribution. For the live dashboard's React renderer (with avatar fallbacks etc.), see upstream `dashboard/src/ui/matrix-a/components/ClientLogos.jsx`.
