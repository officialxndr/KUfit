# Monday Features

Working checklist for the compiled feature backlog. Batched to avoid backtracking
(shared work — unified Goals, recipe nutrition, volume units, date-nav headers — is
built once and reused). Full plan rationale lives in the planning notes.

## Batch A — Unified Goals system ✅
- [x] Profile fields: `goalRangeKg`, `nutrientGoals[]` (`settingsStore.ts`)
- [x] Shared `GoalsEditor` component (Nutrition / Health / Training groups)
- [x] MAINTAIN → range stepper + hide Goal Date; active phase → cycle card
- [x] Nutrition group: "+ Track other nutrient" picker → `nutrientGoals`
- [x] Header gear button (`AppHeader`) opens `GoalsEditor` modal on Food & Health
- [x] Food "Goals" tab → Search view (`FoodSearch.tsx`)
- [x] Health "Goals" tab → Trends (`HealthTrends.tsx`)
- [x] Nutrient goals drive Food → Today "Other nutrients" (core 4; extended in Batch C)

## Batch B — Food add/edit + search + recipes ✅
- [x] Safe-area top padding on `FoodQuantitySheet` (no notch clip)
- [x] Recipe full-nutrition aggregation (`FoodRepo.getRecipeBreakdown`)
- [x] Recipes list parity → open rich `FoodQuantitySheet`
- [x] Recipes appear in add-food results
- [x] Local-first ordering + favorites + Search/Recent/Favorites tabs

## Batch C — Food Trends ✅
- [x] Date-moving window header (7/30/90 with arrows + range label)
- [x] Other-nutriments summary across the window (daily avg vs target)

## Batch D — Workout ✅
- [x] Stats: fix weekly-volume bucket (today excluded) + best-week 0
- [x] `formatVolume(kg, system)` unit-aware volumes (Stats, History, Summary)
- [x] History → summary detail (reuse `workout-summary?id=&from=history`, no wipe)
- [x] History year selector (‹‹ ›› jump 12 months)
- [x] Template delete + edit (wired `deleteTemplate` + new `updateTemplate`)
- [x] Template labels/folders + search (grouped grid)
- [x] Template creation wizard (blank vs setup wizard, 2 steps)
- [ ] (deferred) Edit a past workout's sets from the summary — viewing is linked; in-place editing is a follow-up

## Batch E — Health ✅
- [x] Weight: log via button → `/log-weight` popup
- [x] Weight chart x-axis ticks + drag-to-scrub tooltip
- [x] Measure: snapshot delete (SwipeToDelete) + per-site edit
- [x] Measure: tap snapshot → change-over-time deltas + milestones
- [x] Health Trends screen (weight + body-fat + measurement deltas)

## Batch F — Dashboard + Roadmap ✅
- [x] Dashboard streak/week bars min height (logged days visible)
- [x] Apple Widgets documented in `docs/ROADMAP.md`
