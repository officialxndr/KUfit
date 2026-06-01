---
name: fitself-design
description: Use this skill to generate well-branded interfaces and assets for FitSelf, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping. FitSelf is a dark-first, self-hosted health & fitness PWA.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files:
- `README.md` — product context, content fundamentals, visual foundations, iconography, and a full index of this folder
- `colors_and_type.css` — all design tokens (CSS vars) + semantic type & component classes. Drop it in, or read off the values.
- `assets/ICON-REFERENCE.html` — the exact lucide icons FitSelf uses, grouped by area
- `ui_kits/app/` — a high-fidelity, interactive recreation of the FitSelf mobile app (open `index.html`); reusable JSX components in `ui-components.jsx`, `screens-core.jsx`, `screens-fitness.jsx`
- `preview/` — small specimen cards (color, type, spacing, components, brand)
- `reference/` — source inspiration screenshots (3rd-party; directional only, NOT FitSelf's own UI)

Essentials to internalize before designing:
- **Dark-first.** Default theme is dark (`#0a0a0a` bg → `#141414` surface → `#1e1e1e` → `#2a2a2a` border). A light Zinc theme exists but is secondary.
- **One accent: indigo `#6366f1`.** Spend it sparingly — most of the screen is greyscale. Semantic trio: success `#22c55e`, warning `#f59e0b`, danger `#ef4444`. Macros: protein indigo, carbs amber `#f59e0b`, fat pink `#ec4899`.
- **System font stack only** (SF Pro on Apple). No webfonts.
- **lucide icons, no emoji.** Pull lucide from CDN — it matches exactly.
- **Flat & utilitarian.** Cards are `bg-surface`, `rounded-2xl` (16px), mostly borderless. No gradients, no glassmorphism, no photography/illustration. Shadows only on the FAB and pop-over menus. Press states (`active:scale-95`, opacity, `bg-surfaceHigh`) carry the feedback.
- **Voice:** calm, second-person training partner. Title Case for titles/buttons, sentence case for body. Numbers as ranges, non-judgmental around weight, options not prescriptions.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
