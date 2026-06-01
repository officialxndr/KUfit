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

---

# Round 2

## Batch G — Shared calorie card (Dashboard ↔ Food parity) ✅
- [x] New `components/CalorieMacroCard.tsx` (CalorieRing + MacroBars)
- [x] Dashboard Overview food card uses it
- [x] Food → Today summary page 1 uses it (circular ring replaces the line bar)
- [x] Ring caption moved below the ring; "kcal" label added under the number

## Batch H — Global Goals ✅
- [x] Workout section header gets the goals gear (like Food/Health)
- [x] Goals editor floats the current section's group to the top
- [x] Cycle/Goal-Phases link added to the Health group in `GoalsEditor` (always available)
- [x] Auto-maintain: one-time prompt when 7-day avg reaches goal (`maintainPromptedFor`, no active phase)

## Batch I — Food/Recipe sheet ✅
- [x] Favorite button inside `FoodQuantitySheet` (foods + recipes); wired in add-food, Today, Search, Recipes
- [x] Recipe favorites (`recipes.isFavorite`) shown in add-food Favorites tab
- [x] Recipe summary shows its **ingredients** (`getRecipeBreakdown` → `details.ingredientsText`)
- [x] Fix sheet scroll/clip (sheet maxHeight + ScrollView flex-shrink + bottom safe-area)

## Batch J — Workout ✅
- [x] Template cards equal height within a row (Card `flex: 1`)
- [x] History → **popup summary card** (`WorkoutSummarySheet`), same info, per-exercise breakdown

## Batch K — Health Weight ✅
- [x] Weight Trend chart y-axis labels + gridlines
- [x] Scrub gesture uses capture handlers so the page doesn't scroll mid-drag

## Batch L — Health Measure ✅
- [x] Tap a site in the top card → site detail popup
- [x] Trends over 3/6/12 months + next landmark
- [x] Configurable per-site goals (profile `measurementGoals`)
- [x] Golden-ratio suggestions vs a chosen anchor site (labeled approximate aesthetic ideals)
