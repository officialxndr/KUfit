# FitSelf — Design System

A design system for **FitSelf**, a self-hosted, full-stack health & fitness Progressive Web App (PWA) for personal tracking. It is built mobile-first and ships as both a Dockerized self-hosted web app and a native-feeling iOS app (via Capacitor + free sideloading). This folder lets a design agent generate well-branded FitSelf interfaces, mocks, and assets.

> **Source repository:** [github.com/officialxndr/health-app](https://github.com/officialxndr/health-app)
> The design language here is reverse-engineered directly from that codebase (React + Vite + Tailwind + shadcn/ui). The reader is encouraged to explore the repo for deeper context — especially `apps/web/src/` (components, pages), `apps/web/tailwind.config.js`, and the 64KB `CLAUDE.md` blueprint at the repo root, which fully specifies every feature.

---

## Product context

FitSelf is a private, household-scale (invite-only, multi-user) tracker. It is **not** a social or commercial fitness app — there is no feed, no gamified store, no ads. The whole point is calm, self-owned data. It runs on your own hardware and talks to your own database.

It is organized into **five sections**, switched from a header dropdown and surfaced contextually in the bottom navigation:

| Section | What it does |
|---|---|
| **Dashboard** | Glanceable daily summary — calorie ring, macro bars, weight card, streak, recent workouts, pace status |
| **Food** | Daily food log (4 meals), barcode scanning, custom foods & recipes, macro targets, trends, goals |
| **Workout** | Template builder, active session logging (set-by-set with previous-value ghosts + rest timers), exercise library w/ video, history, volume stats, PR detection |
| **Health** | Weight trend chart, body-fat & lean-mass trends, goal phases/cycles (cut/bulk/maintain), pace-adjustment engine, body measurements |
| **Settings** | Units (metric/imperial toggle), goals, profile, Apple Health import |

The signature features are the **pace-adjustment engine** (compares your actual weekly rate to the rate required to hit your goal and translates the gap into a concrete daily calorie delta) and **goal phases** (dated cut/bulk/maintain blocks the calorie engine automatically follows).

### Surfaces represented
- **The mobile app** (the only product surface). PWA + Capacitor iOS wrapper. There is no separate marketing site or docs site in the repo — FitSelf is self-hosted and distributed as code, so the app *is* the brand. The UI kit in `ui_kits/app/` recreates it.

---

## Content fundamentals — how FitSelf writes

The voice is a **calm, competent training partner**: direct, encouraging, never preachy or hype-y. It respects the user's intelligence and avoids fitness-industry shouting.

- **Person:** Second person, addressed to "you." First person only for the user's own data ("my goal weight"). Example: *"You're 0.4 lb/week behind pace."*, *"You're ahead of schedule."*
- **Casing:** **Title Case** for screen titles, section headers, and buttons (`Start Workout`, `Quick Start`, `Log Weight`, `Add Set`). **Sentence case** for body copy, helper text, and inline messages (`Tap to log food →`, `Your progress won't be saved.`).
- **Tone:** Supportive and non-judgmental, especially around weight. Guidance always frames the **rolling trend over single weigh-ins**, and offers *options* rather than prescriptions ("you could…" not "you must…"). When a goal pace is unsafe it suggests extending the date rather than crash-dieting. The "you're already on track, no action needed" state is always available.
- **Numbers:** Honest and humble. Calorie/TDEE outputs are shown as **ranges, not false-precision single numbers**. Units always respect the user's metric/imperial preference. Stats use tabular figures so they don't jitter.
- **Brevity:** Microcopy is terse. Stat captions are 1–3 words (`Goal ETA`, `kg volume`, `7 day streak`). Affordance hints use a trailing arrow (`Continue →`, `See all →`, `View all`).
- **Emoji:** **None in the UI chrome.** `icons.ts` states it plainly: *"no emoji anywhere in the UI."* Emoji appear **only** inside long-form explanatory copy in the spec (e.g. activity suggestions like 🚶 Walk briskly), never as interface elements. Default to **no emoji**; lucide icons carry all iconographic meaning.
- **Vibe:** Quietly precise, data-literate, self-reliant. Think a well-built personal tool, not a consumer growth app.

**Representative strings (verbatim from the product):**
> "Good morning" · "Tap to log food →" · "Session in progress" · "Continue →" · "On Pace" / "Slightly Behind" / "Off Track" · "Cut ~200 cal/day to stay on track" · "Quick Start" · "Workout Complete!" · "1 Personal Best!" · "Discard this workout?" · "Your progress won't be saved." · "No templates yet." · "Create your first template →"

---

## Visual foundations

The aesthetic is **dark, dense, and utilitarian** — an iOS-native feel with a single confident accent. It reads like a precision instrument: near-black surfaces, hairline dividers, one indigo highlight, and color reserved almost entirely for *meaning* (status, macros).

### Color
- **Dark-first.** The app ships `<html class="dark">`; dark is the canonical theme (a light Zinc-based theme exists as a secondary). The dark stack steps: `#0a0a0a` background → `#141414` surface → `#1e1e1e` surface-high → `#2a2a2a` borders.
- **One brand accent: indigo `#6366f1`** (hover `#818cf8`). Used for active nav, primary buttons, the FAB, links, focus rings, exercise names, and chart lines. Used with restraint — most of the screen is greyscale.
- **Semantic trio:** success `#22c55e`, warning `#f59e0b`, danger `#ef4444`. These appear as solid fills on status moments and as **10%-opacity tinted washes** behind badges/banners (`bg-success/10`, etc.).
- **Macro palette:** protein indigo `#6366f1`, carbs amber `#f59e0b`, fat pink `#ec4899` — consistent everywhere macros appear.
- **Imagery color vibe:** the only photographic/video imagery is exercise demos from the ExerciseDB CDN — neutral, evenly-lit studio clips on plain backgrounds. There is no warm/cool grade, no grain, no brand photography. The UI itself carries the look.

### Type
- **System font stack only** (`-apple-system` → SF Pro on the target Apple platform). No webfonts are bundled; do not introduce one. The native stack is intentional — it makes the sideloaded iOS app feel native.
- Tight, mobile-native scale: 30/24/20/18/16/14/12/11/10px. Bold (700) for stats & titles, semibold (600) for card titles & buttons, medium (500) for emphasis & nav, regular (400) for body. Numbers and timers use **tabular-nums**. Tiny table headers are **uppercase with letter-spacing**. See `colors_and_type.css` for the full scale.

### Spacing & layout
- 4px base scale. Page padding is **16px (`p-4`)**; cards stack with **12–16px gaps**. Content clears the bottom nav via a `pb-nav` utility (`4rem + safe-area`).
- **Fixed app shell:** a sticky header (`bg-surface` + bottom border + `safe-top`), a flex-1 scrolling content column, and a sticky bottom nav (`bg-surface` + top border + `safe-bottom`). `html, body { overflow: hidden }` — only the middle column scrolls. Respects iOS safe-area insets everywhere.
- **Bottom nav** is contextual: it shows the active section's sub-pages (or a section launcher on Dashboard/Settings), split into two halves around a centered **elevated FAB** (`-top-6`, 56px, `rounded-full bg-primary`, `ring-4 ring-background`, `shadow-fab`). The FAB opens a quick-action sheet.

### Backgrounds
- **Flat near-black.** No gradients, no full-bleed photography, no illustrations, no repeating patterns or textures. Depth comes entirely from the surface-luminance stack and hairline borders. Sheets/modals dim the page with `bg-black/60–70`.

### Cards, borders, radii, shadows
- **Cards:** `bg-surface`, `rounded-2xl` (16px), `p-4`. Mostly **borderless** — separation comes from surface contrast. Some status cards add a `border border-border` hairline. Rows inside cards divide with `divide-y divide-border`.
- **Radii:** chips/fields `rounded-lg` (8px), buttons/inputs `rounded-xl` (12px), cards/sheets-targets `rounded-2xl` (16px), bottom sheets `rounded-t-3xl` (24px), pills/avatars/FAB/badges `rounded-full`.
- **Shadows are rare.** The UI is deliberately flat. The two exceptions: the FAB (`shadow-lg shadow-primary/30`) and pop-over menus (`shadow-xl`). No inner shadows. No glow except the FAB's colored shadow.

### Borders & dividers
- Hairline `1px solid #2a2a2a` everywhere — header/nav edges, card outlines, list dividers. No heavy rules, no colored left-border accent cards.

### Animation, hover & press
- **Subtle and functional.** Transitions are short (`transition-colors`, `transition-transform`, `transition-all` at default ~150ms). One custom keyframe: `ping-once` (a 0.7s scale+fade pop) for confirmations.
- **Press states** are the primary feedback on this touch-first UI: buttons `active:scale-95/0.97`, links/icons `active:opacity-70`, list items `active:bg-surfaceHigh`. Hover (desktop) mirrors with `hover:bg-surfaceHigh` / `hover:text-white` / `hover:text-primary`.
- **Active/selected** states use the **10% indigo wash** (`bg-primary/10 text-primary`) or a solid indigo pill for segmented toggles. Completed states use a **green wash** (`bg-success/10`).
- Charts (Recharts) animate stroke/dasharray transitions; the calorie ring eases its arc over 0.5s. No bounces, no parallax, no decorative motion.

### Transparency & blur
- Used only for **opacity-tinted status washes** (the `/10` accents) and **modal scrims** (`bg-black/60–70`). No backdrop-blur/glassmorphism in the core UI. Disabled = `opacity-60`.

### Signature components
- **Calorie ring** — SVG progress arc whose color shifts green → amber → red as you approach goal (track `#2a2a2a`, rounded cap, center shows eaten/goal).
- **Macro bars** — slim (`h-1.5`) `surface-high` tracks filled with the macro color, label + `value/target` above.
- **Swipe-to-reveal rows** — drag a food/session row left to expose a full-height `bg-danger` Delete zone.
- **Active-session set logger** — table rows (`Set · Previous · weight · Reps · ✓`) with grey "ghost" previous values, a tap-to-fill custom **numpad**, inline **rest-timer bars**, and `bg-success/10` on completed sets.
- **Tinted status banners** — pace/streak/PR callouts using the `/10` semantic washes.

---

## Iconography

- **Single icon system: [lucide-react](https://lucide.dev).** Every icon in the app is re-exported from one file (`apps/web/src/components/icons.ts`) so usage is centralized. Stroke-based, rounded, even weight. Default `strokeWidth={2}`; emphasized/active states bump to `2.4–2.5` (e.g. active nav tab, the FAB plus).
- **No emoji** as UI elements (explicitly stated in source). **No unicode glyphs** used as icons. **No custom/brand SVG icon set** — lucide is used wholesale. The only non-lucide imagery is exercise demo media from the ExerciseDB CDN.
- **Logo:** FitSelf has **no logo mark** — the brand is a plain bold **"FitSelf" wordmark** set in the system font (see the Login screen and PWA title). A PWA app-icon (`icon-192.png`) exists but is not a distinct illustrated logo.
- **Recreating FitSelf?** Pull lucide from CDN (e.g. `https://unpkg.com/lucide@latest`) — it matches exactly, so **no substitution is needed**. The specific icons in use are listed in `icons.ts`; common ones: `LayoutDashboard, UtensilsCrossed, Dumbbell, HeartPulse, Settings, Flame, Trophy, Ruler, Scale, Timer, Check, Plus, ScanLine, Target, TrendingDown/Up, BarChart2`.

> See `assets/ICON-REFERENCE.html` for the exact lucide icons used, grouped by area.

---

## Index — what's in this folder

| Path | What it is |
|---|---|
| `README.md` | This file — product context, content & visual foundations, iconography |
| `colors_and_type.css` | All design tokens (CSS vars) + semantic type & component classes |
| `SKILL.md` | Agent-Skill manifest so this system works in Claude Code |
| `preview/` | Small HTML cards rendered in the Design System tab (color, type, spacing, components, brand) |
| `assets/` | Icon reference + imported reference screenshots |
| `ui_kits/app/` | High-fidelity, interactive recreation of the FitSelf mobile app — `index.html` (clickable prototype) + JSX components + its own README |
| `reference/` | Source screenshots the developer collected (3rd-party inspiration — not FitSelf's own UI; treat as directional only) |

> **Note on the reference screenshots:** The repo's `Example Pages & Components/` folder contains screenshots of *other* apps (Strong, MacroFactor-style trackers) the developer used as inspiration. They are **not** FitSelf's own design — the codebase is the source of truth. They live in `reference/` for context only; the indigo-on-near-black FitSelf look comes from the code.

---

## Caveats for builders

- **Dark mode is the default and primary theme.** Build dark unless explicitly asked for light.
- **Don't add gradients, glassmorphism, photography, or illustration** — they are not part of this brand. Depth is surface-stack + hairlines only.
- **Use the system font stack.** No Inter/Roboto webfont swaps.
- **Color = meaning.** Keep most of the screen greyscale; spend indigo and the semantic trio deliberately.
