# VibeUsage Design System v1 — Operations Deck

**Status**: v1 · hard cut · **no backward compat**
**Last updated**: 2026-04-23

---

## 0. SSOT (Single Source of Truth)

This document is the **only** authoritative reference for visual tokens and
component contracts. Everything else (tailwind config, css variables,
component implementations) **derives from it**.

- **All** color / font-size / letter-spacing / spacing / shadow values MUST
  resolve to a token defined below — via `tailwind.config.cjs` or a CSS
  variable in `src/styles.css`.
- **Forbidden** inline patterns (hard fail in review):
  - `[#hex]` / `[#00FF41]/N` / `rgba(...)` in className
  - `text-[Npx]` / `text-[NNN]`
  - `tracking-[Xem]` outside the 4 canonical values
  - `p-[Npx]` / `gap-[Npx]` / `mt-[Nrem]`
  - `shadow-[...]` / `drop-shadow-[...]`
  - `opacity-30|40|50|60|70|80|90` (use ink-\* alpha tokens)
  - Any class beginning with `matrix-` (legacy namespace, deleted)
- **Adding a token** requires editing this file + `tailwind.config.cjs`.
  Never hard-code a new value inside a component.

---

## 1. Visual Thesis

**Direction**: Operations Deck — Bloomberg terminal × The Matrix.
**Material**: zero radius (except `dot`), thin lines, low-noise surfaces,
numbers as the hero.
**Energy**: restrained neon green + density + a single scanline layer.

**Signature**: ASCII-frame panel + corner-cross marks (`<Panel variant="ascii">`).
**Pocket color**: Matrix Green `#00FF41` — appears only on data, active
state, hover-lines, and single-glow text. Never as a filled surface larger
than a button.

**Signature micro-interaction**: `decoding-reveal` — scramble characters
converging to final string. Reserved for: first-paint hero title, display-2
primary number, identity handle. **Not** for label / button / caption.

---

## 2. Color Tokens

Two tracks only: green ink (data) and neutral surface (ground). No third
hue except the arbitrary-use `gold` accent.

### 2.1 `ink.*` — green data ink

| Token        | Tailwind                              | Value                        | Usage                                     |
| ------------ | ------------------------------------- | ---------------------------- | ----------------------------------------- |
| `ink`        | `text-ink` `border-ink` `bg-ink`      | `#00FF41`                    | primary data, active state, primary btn   |
| `ink-bright` | `text-ink-bright`                     | `#E8FFE9`                    | display emphasis, selection foreground    |
| `ink-text`   | `text-ink-text`                       | `rgba(0, 255, 65, 0.60)`     | body text, value label                    |
| `ink-muted`  | `text-ink-muted` `border-ink-muted`   | `rgba(0, 255, 65, 0.35)`     | secondary text, hover line                |
| `ink-line`   | `border-ink-line`                     | `rgba(0, 255, 65, 0.18)`     | default separator, panel border           |
| `ink-faint`  | `border-ink-faint` `bg-ink-faint`     | `rgba(0, 255, 65, 0.08)`     | weakest rule, subtle hover background     |

**6 alpha stops. That's it.** No `/5`, `/12`, `/25`, `/45`. Pick one.

### 2.2 `surface.*` — background ground

| Token             | Value                 | Usage                                 |
| ----------------- | --------------------- | ------------------------------------- |
| `surface`         | `#050505`             | page background                       |
| `surface-raised`  | `rgba(0, 10, 0, 0.70)` | panel background (+ backdrop-blur-panel) |
| `surface-strong`  | `rgba(0, 10, 0, 0.82)` | chip, sticky header, modal            |

### 2.3 Accent

| Token  | Value       | Usage                                |
| ------ | ----------- | ------------------------------------ |
| `gold` | `#FFD700`   | leaderboard #1 only                  |

---

## 3. Typography Tokens

`Geist Mono` is the only font-family. 7 size stops. No `text-[Npx]`.

| Token       | Size / LineHt / Tracking / Weight / Case    | Usage                                       |
| ----------- | ------------------------------------------- | ------------------------------------------- |
| `display-1` | 60 / 1.00 / -0.02em / 900 / none            | landing hero title                          |
| `display-2` | 40 / 1.05 / -0.02em / 900 / none            | big number, screenshot title                |
| `display-3` | 28 / 1.10 / -0.02em / 900 / none            | mid-size hero (leaderboard title, identity) |
| `heading`   | 14 / 1.25 /  0.12em / 700 / UPPERCASE       | panel title, nav primary                    |
| `body`      | 13 / 1.50 /  0     / 500 / none             | body paragraph                              |
| `data`      | 12 / 1.40 /  0     / 500 tabular-nums       | numbers, table cells                        |
| `caption`   | 11 / 1.30 /  0.12em / 600 / UPPERCASE       | label, sub-title                            |
| `micro`     | 10 / 1.20 /  0.22em / 700 / UPPERCASE       | tag, status, pagination                     |

### Letter-spacing (4 canonical values only)

| Token      | Value     | Usage                   |
| ---------- | --------- | ----------------------- |
| `tight`    | `-0.02em` | display-1, display-2    |
| `data`     | `0`       | body, data              |
| `label`    | `0.12em`  | heading, caption        |
| `caps`     | `0.22em`  | micro, section divider  |

**Nothing in between.** If you want `0.16em`, you want `0.12em` or `0.22em`.

---

## 4. Spacing Tokens

Tailwind default 4px grid, restricted to the following stops:

`0 · 1 (4) · 2 (8) · 3 (12) · 4 (16) · 6 (24) · 8 (32) · 12 (48) · 16 (64)`

Forbidden: `p-5`, `p-7`, `gap-5`, `mt-7`, `[Npx]` bracket values.

If you need a mid-point between two stops, you probably want to change
the surrounding layout instead.

---

## 5. Borders, Shadows, Motion

### Border

| Usage          | Class                   |
| -------------- | ----------------------- |
| weak rule      | `border border-ink-faint` |
| panel, table   | `border border-ink-line`  |
| hover          | `border-ink-muted`      |
| active, selected | `border-ink`          |

All borders are **1px solid**. No dashed / dotted. No `border-[Npx]`.

### Shadow (box-shadow)

| Token                 | Definition                                                                   | Usage                                 |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| `shadow-panel`        | `0 0 0 1px rgba(0,255,65,0.08), 0 18px 40px rgba(0,0,0,0.45)`               | every Panel variant                   |
| `shadow-glow-xs`      | `0 0 6px rgba(0,255,65,0.35)`                                               | data points, scrubber thumb           |
| `shadow-glow-sm`      | `0 0 10px rgba(0,255,65,0.35)`                                              | panel accents, bar highlights         |
| `shadow-glow`         | `0 0 24px rgba(0,255,65,0.35)`                                              | primary button, header logo           |
| `shadow-glow-faint`   | `0 0 15px rgba(0,255,65,0.1)`                                               | subtle ambient badge                  |
| `shadow-gold`         | `0 0 18px rgba(255,215,0,0.35)`                                             | gold default                          |
| `shadow-gold-sm`      | `0 0 10px rgba(255,215,0,0.3)`                                              | gold small badge                      |
| `shadow-gold-faint`   | `0 0 20px rgba(255,215,0,0.1)`                                              | gold alert bar                        |

### Shadow (drop-shadow, for SVG / filter)

| Token                     | Definition                                              | Usage                        |
| ------------------------- | ------------------------------------------------------- | ---------------------------- |
| `drop-shadow-glow`        | `0 0 8px rgba(0,255,65,0.8)`                            | hover icon, svg star         |
| `drop-shadow-glow-sm`     | `0 0 5px rgba(0,255,65,0.6)`                            | small SVG glow               |
| `drop-shadow-glow-faint`  | `0 0 10px rgba(0,255,65,0.22)`                          | sparkline                    |
| `drop-shadow-gold`        | `0 0 10px rgba(255,215,0,0.5)`                          | gold small text              |
| `drop-shadow-crown`       | two-layer gold + white                                  | leaderboard #1 avatar        |

### Glow text

Two utilities only:
- `glow-text` — `text-shadow: 0 0 16px var(--ink-glow)`
- `glow-text-gold` — `text-shadow: 0 0 20px rgba(255,215,0,0.4)`

No `glow-text-strong`. No ad-hoc `drop-shadow-[...]` / `shadow-[...]` in className.

### Motion

| Layer             | Rule                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| default transition | `transition duration-200 ease`                                      |
| button press      | `active:scale-[0.98]` (only allowed bracket value; semantic)         |
| signature reveal  | `decoding-reveal` (Scramble) — hero title, display-2, identity handle |
| ambient overlay   | `.fx-scanline` — **single** fixed 4px scan overlay, app root only     |
| pointer on link   | inherit from `<a>`, no custom hover underline                         |

**Deleted** (were duplicates / noise):
- `.matrix-scanlines` `.matrix-scan-sweep` `.matrix-scanline-overlay` — replaced by `.fx-scanline`
- `.matrix-header-action::after` sweep
- `.glow-text-strong` `.shadow-glow` (css class variant)
- `.matrix-header-chip` corner-cross — absorbed into `<Panel>` / chip button

### Matrix Rain

Reserved for **landing page only**. Removed from dashboard routes. Always
hidden in `screenshot-capture` mode.

---

## 6. Component Contracts

### `<Panel>`

```jsx
<Panel variant="ascii" tone="default" title="..." subtitle="...">
  {children}
</Panel>
```

| Prop       | Values                          | Default     |
| ---------- | ------------------------------- | ----------- |
| `variant`  | `ascii` \| `plain` \| `bare`    | `plain`     |
| `tone`     | `default` \| `strong`           | `default`   |
| `title`    | string \| ReactNode             | —           |
| `subtitle` | string \| ReactNode             | —           |

- `ascii`: ASCII box drawing + corner-cross (signature).
- `plain`: 1px ink-line border + surface-raised bg + backdrop blur.
- `bare`: surface-raised bg only, no border (for stacked sections).
- `tone="strong"`: surface-strong bg + border-ink-muted (chip, modal).

### `<Text>`

```jsx
<Text size="heading" as="h2" tone="ink-text">Label</Text>
```

| Prop    | Values                                                                 | Default |
| ------- | ---------------------------------------------------------------------- | ------- |
| `size`  | `display-1` \| `display-2` \| `heading` \| `body` \| `data` \| `caption` \| `micro` | required |
| `as`    | any HTML tag                                                           | `span`  |
| `tone`  | `ink` \| `ink-bright` \| `ink-text` \| `ink-muted` \| `ink-line` \| `ink-faint` | `ink-text` |
| `glow`  | `boolean`                                                              | `false` |

Enforces typography + color tokens at the component boundary.

### `<MatrixButton>`

```jsx
<MatrixButton size="md" variant="primary">Sync</MatrixButton>
```

| Prop      | Values                              | Default    |
| --------- | ----------------------------------- | ---------- |
| `size`    | `sm` \| `md` \| `lg` \| `header`    | `md`       |
| `variant` | `primary` \| `default` \| `ghost`   | `default`  |

Size maps to: `sm = h-7 px-3 text-micro`, `md = h-9 px-4 text-caption`,
`lg = h-11 px-6 text-body`, `header = header-chip (h-10, corner-cross)`.

All buttons get `active:scale-[0.98]` and the 200ms color transition.

---

## 7. Forbidden / Blacklist

Anything below fails review:

```
text-[9px]  text-[10px]  text-[11px]  text-[12px]  text-[Npx]
[#00FF41]/5  /10  /20  /30  /40  /60  /80  /90
bg-[#00FF41] border-[#00FF41] text-[#00FF41]
tracking-[Xem] (outside tight/data/label/caps)
p-[Npx] gap-[Npx] mt-[Nrem] m-[Npx] h-[Npx] w-[Npx]
shadow-[...] drop-shadow-[...]
opacity-30  opacity-40  opacity-50  opacity-60  opacity-70  opacity-80  opacity-90
matrix-*  (entire namespace)
font-extralight (use weight via text-* token)
```

The only permitted bracket value in the entire codebase is
`active:scale-[0.98]` — because it is semantic, not magic.

---

## 8. Migration Map (legacy → SSOT)

All legacy references were migrated in one cut. Kept here as a
historical reviewer guide — do not author legacy names into new code.

### Tailwind color classes

| Deleted                         | Replacement                          |
| ------------------------------- | ------------------------------------ |
| `text-matrix-primary`           | `text-ink`                           |
| `text-matrix-bright`            | `text-ink-bright`                    |
| `text-matrix-muted`             | `text-ink-text`                      |
| `text-matrix-dim`               | `text-ink-muted`                     |
| `text-matrix-primary/80`        | `text-ink-text`                      |
| `text-matrix-primary/60`        | `text-ink-text`                      |
| `text-matrix-primary/40`        | `text-ink-muted`                     |
| `text-matrix-primary/30`        | `text-ink-muted`                     |
| `text-matrix-primary/20`        | `text-ink-line`                      |
| `border-matrix-primary`         | `border-ink`                         |
| `border-matrix-primary/30`      | `border-ink-muted`                   |
| `border-matrix-primary/20`      | `border-ink-line`                    |
| `border-matrix-primary/10`      | `border-ink-faint`                   |
| `border-matrix-ghost`           | `border-ink-faint`                   |
| `border-matrix-dim`             | `border-ink-muted`                   |
| `border-matrix-muted`           | `border-ink-muted`                   |
| `bg-matrix-dark`                | `bg-surface`                         |
| `bg-matrix-panel`               | `bg-surface-raised`                  |
| `bg-matrix-panelStrong`         | `bg-surface-strong`                  |
| `bg-matrix-primary`             | `bg-ink`                             |
| `bg-matrix-primary/10`          | `bg-ink-faint`                       |
| `bg-matrix-primary/5`           | `bg-ink-faint`                       |
| `font-matrix`                   | `font-mono` (Geist Mono is default)  |
| `shadow-matrix-glow`            | `shadow-glow`                        |
| `shadow-matrix-gold`            | `shadow-gold`                        |

### Raw hex (`[#00FF41]/N`)

| Deleted alpha                   | Replacement                          |
| ------------------------------- | ------------------------------------ |
| `/5`, `/8`, `/10`, `/12`        | `bg-ink-faint` / `border-ink-faint`  |
| `/18`, `/20`, `/25`             | `border-ink-line`                    |
| `/30`, `/32`, `/40`             | `border-ink-muted`                   |
| `/60`, `/70`, `/80`, `/90`      | `text-ink-text` or `text-ink`        |

### CSS classes

| Deleted                         | Replacement                                            |
| ------------------------------- | ------------------------------------------------------ |
| `.matrix-panel`                 | `<Panel variant="plain">`                              |
| `.matrix-panel-strong`          | `<Panel variant="plain" tone="strong">`                |
| `.matrix-header-chip`           | `<Panel variant="ascii">` or `<MatrixButton size="header">` |
| `.matrix-header-action`         | inline `active:scale-[0.98]` + color transition         |
| `.matrix-scanline-overlay`      | `.fx-scanline` (single global overlay)                 |
| `.matrix-scanlines`             | `.fx-scanline`                                         |
| `.matrix-scan-sweep`            | deleted (was duplicate atmosphere)                     |
| `.glow-text-strong`             | `glow-text` (only one level)                           |

### Typography pixel hacks

| Deleted           | Replacement   |
| ----------------- | ------------- |
| `text-[9px]`      | `text-micro`  |
| `text-[10px]`     | `text-micro`  |
| `text-[11px]`     | `text-caption`|
| `text-[12px]`     | `text-data`   |
| `text-[13px]`     | `text-body`   |
| `text-xs`         | `text-caption`|
| `text-sm`         | `text-body`   |
| `text-base`       | `text-body`   |
| `text-lg`         | `text-heading`|
| `text-xl`               | `text-heading`                                 |
| `text-2xl`              | `text-display-3`                               |
| `text-3xl`              | `text-display-3`                               |
| `text-4xl`              | `text-display-2`                               |
| `text-5xl`              | `text-display-2`                               |
| `text-6xl` … `text-8xl` | `text-display-1`                               |
| `text-white`            | `text-ink-bright`                              |
| `text-black`            | `text-surface`                                 |
| `bg-white`              | `bg-ink-bright`                                |
| `bg-black` / `bg-black/N` | `bg-surface` / `bg-surface/N`                |

---

## 9. CI Guardrails (implemented)

`dashboard/scripts/check-design-ssot.mjs` enforces §7 at build-time.

- **Run manually**: `npm run guardrail:design`
- **Auto-triggered**: runs before `npm test` via `pretest` hook
- **On violation**: exits 1, lists offending `file:line` + check label, references DESIGN.md
- **Allowed bypasses** (JS-side runtime color SSOT):
  - `src/ui/matrix-a/components/MatrixConstants.ts` (hex constants module)
  - `src/ui/matrix-a/components/ClientLogos.jsx` (third-party SVG path `fill="#hex"`)

What it checks:
- `matrix-*` legacy token namespace
- `[#hex]` raw hex in className
- `text-[Npx]` / `tracking-[Xem]` brackets
- `shadow-[…]` / `drop-shadow-[…]` inline
- `text-xs` … `text-9xl` tailwind defaults
- `text-white` / `bg-black` family
- redundant `/N` alpha on rgba-backed `ink-*` tokens

Planned extensions (not in v1):
- ESLint plugin for IDE-level inline feedback (current guardrail is CLI-only).
- Husky `pre-commit` hook wiring (opt-in; project does not ship husky yet).

---

## 10. Adding a new value

1. Edit this file — add a row to the appropriate token table with a
   reason for the addition.
2. Edit `tailwind.config.cjs` to expose the token.
3. If CSS-variable backed, edit `src/styles.css`.
4. Use it.
5. Never hard-code a new value in a component, not even once.

