# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design), imported
into the repo so any agent or designer can pick it up offline.

A user mocked up the v3 design iterations in HTML/CSS/JS using an AI design
tool, then exported the bundle so a coding agent can implement the designs
for real. This directory is the slimmed, in-repo copy.

## What you should do — IMPORTANT

**Read the chat transcripts first.** Two transcripts in `chats/`:
- `chats/chat1.md` — initial system build, dashboard rewrite, font + brand asset import
- `chats/chat2.md` — per-CLI breakdown, status states, type scale, dashboard mojibake fix, single-hairline panel border

The transcripts show the full back-and-forth between the user and the design
assistant — they tell you **what the user actually wants** and **where they
landed** after iterating. The HTML / CSS files are the output, but the chats
are where the intent lives.

**Then read `README.md`** (top-to-bottom — visual thesis, color tokens,
type, spacing, components) and **`SKILL.md`** (skill manifest).

**For pixel-perfect recreation**: open `ui_kits/dashboard/index.html`
through a static HTTP server (e.g. `python3 -m http.server` from the
`design-system/` directory) — `file://` blocks the inline-Babel
`<script type="text/babel" src="…">` loader.

**If anything is ambiguous, ask the user to confirm before you start
implementing.** It's much cheaper to clarify scope up front than to build
the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production
code. Your job is to **recreate them pixel-perfectly** in whatever
technology makes sense for the target codebase (React, Vue, native,
whatever fits). Match the visual output; don't copy the prototype's
internal structure unless it happens to fit.

## Bundle contents

```
design-system/
├── HANDOFF.md           — this file
├── README.md            — design-system reference (read after chats)
├── SKILL.md             — Agent Skills entry point (vibeusage-design)
├── colors_and_type.css  — drop-in CSS variables + element styles
├── chats/               — conversation transcripts (read these first!)
├── fonts/               — Geist Mono woff2 (4 weights, self-hosted)
├── assets/
│   ├── icon.svg         — brand mark (hourglass + bracket frame)
│   └── brand/           — Codex / Claude / Gemini / GitHub SVGs
├── preview/             — 19 design-system preview cards (HTML) + `_card.css`
└── ui_kits/
    └── dashboard/       — full Operations Deck recreation
```

## What's NOT in this bundle (and why)

- **Favicons / og-image / wrapped-2025.png / landing-dashboard.jpg** —
  duplicates of `dashboard/public/`; pull upstream rather than fork.
- **uploads/ + screenshots/** — Claude Design tool source captures; no
  agent value, dropped to keep the diff lean.
