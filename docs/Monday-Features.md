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
- [x] (deferred) Edit a past workout's sets from the summary — viewing is linked; in-place editing is a follow-up

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

---

# Round 3

## Batch M — Global Goals navigation bug (the big one) ✅
- [x] **Cause:** `GoalsEditorModal` is an RN `<Modal>`; opening "Goal Phases & Cycles" as a pushed
  route left the modal mounted *above* it (RN modals render over pushed routes), so it swallowed all
  header touches and "back" couldn't return to the popup.
- [x] **Final fix:** Goal Phases renders as a **sub-page inside the goals modal**
  (`components/GoalPhasesPanel.tsx`; an internal `view` state in `GoalsEditorModal` swaps the body,
  with a "‹ Goals" back arrow). No route push from the modal → header never locks up. The standalone
  `app/goal-phases.tsx` route now just wraps the panel (used by the Dashboard inline editor).

## Batch N — Food/Recipe sheet ✅
- [x] Fix the sheet so you can scroll to the bottom-most info (bound the `KeyboardAvoidingView`,
  let the sheet + ScrollView flex-shrink within it).
- [x] Recipe edit: optional **grams per serving** (`recipes.servingWeightG`) so a recipe serving
  can be logged/scaled by weight; the quantity sheet then offers a `g` unit.

## Batch O — Workout Library filtering ✅
- [x] Always-available template search (name **or** label), not just when >3 exist.
- [x] Label **filter chips** (All + each label) above the template grid for one-tap filtering.

## Batch P — Health Weight chart zoom ✅
- [x] Toggle to fit the y-range to the **data** (zoomed-in trend) vs. zoom out to **include the
  goal weight** when it's off-screen.

## Batch Q — Dashboard greeting avatar ✅
- [x] Dashboard → Overview greeting showed a hardcoded `UserCircle` icon, never the saved photo.
  Render `profile.avatarUri` when present (fall back to the icon).

## Batch R — Shared draggable bottom sheet ✅
- [x] New `components/BottomSheet.tsx` — slide-in, **grab-strip drag-to-dismiss**, full-screen
  **fade backdrop driven by the sheet's travel** (no more dim popping/sliding with the sheet),
  notch-safe `maxHeight`, animated close on every path (grab / backdrop / child button / parent).
- [x] Rolled out to `QuickActionsSheet`, `WorkoutSummarySheet`, the Measure **site** + **snapshot**
  pop-ups, and the `exercise-progress` "Compare" picker. `FoodQuantitySheet` matches the pattern
  (+ its own keyboard-avoidance and a concrete ScrollView `maxHeight` scroll fix).
- [x] Centered dialogs/popovers (rest-timer & notes, header dropdown, calendar pickers, nutrient
  picker) intentionally left as fade modals.

---

# Round 4 (planned)

## Batch S — Custom app themes (Settings)
- [ ] Theme store + centralized theme so `colors` can change at runtime; theme picker in Settings.
- [ ] Scope TBD (preset themes / accent picker / full custom) — see the planning question.

## Batch T — De-duplicate goal settings
- [ ] Remove the redundant **Goal** (type/weight/date) and **Targets** (calories/macros) cards from
  `SettingsView` — they already live in the unified Goals editor.
- [ ] Leave a small pointer in Settings to open Goals (Dashboard → Goals).

## Batch U — Recipe grams-per-serving display
- [ ] Recipe edit already sets `servingWeightG`; also **show the grams-per-serving** in the
  per-serving nutrition preview when set.
