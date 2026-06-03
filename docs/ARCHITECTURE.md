# Architecture

## Principles
- **Local-first.** The app is fully usable with no network and no server. Every write goes to
  on-device SQLite and is marked `syncStatus='pending'`.
- **Server-optional & server-compatible.** The SQLite schema mirrors the server's Prisma models
  (each table carries `localId`, `serverId`, `syncStatus`, `updatedAt`). When a user later points
  the app at their own FitSelf server, the sync layer can push/pull with no schema translation.
- **Stored metric, displayed either.** Weights are kg, lengths cm in the DB; conversion happens at
  the display edge via `src/lib/units.ts`.

## Layers
```
Screens (src/app/**, expo-router)
   │  read on focus via useFocusEffect(refresh)
   ▼
Zustand stores (src/stores/*)          ← UI/session/profile state
   │
   ▼
Repositories (src/lib/repositories/*)  ← the ONLY code that touches SQLite
   │
   ▼
SQLite (src/lib/db.ts)  →  fitself.db
```
External network (Open Food Facts, ExerciseDB CDN) is called directly from the device by
`src/lib/foodSearch.ts` and `src/lib/exerciseMedia.ts` — never required for core use.

## Data layer
- **`src/lib/db.ts`** — `openDatabaseSync('fitself.db', { useNewConnection: true })`, `initDb()` creates
  all tables + indexes, then runs `runMigrations()`. Run once in `src/app/_layout.tsx` on startup.
  **`useNewConnection: true` is deliberate**: the default connection is shared with the dev-tools
  registration (`registerDatabaseForDevToolsAsync`), which in development tears the native connection
  down out from under us and surfaces as `NativeDatabase.prepareSync … NullPointerException` mid-render
  → a black screen until reload. A dedicated connection has a lifecycle we control and skips that
  registration. Columns added after a DB already exists go through `ensureColumn(table, col, decl)`
  (forward-only, no-op once present) since `CREATE TABLE IF NOT EXISTS` never alters an existing table —
  e.g. `food_items.saturatedFat`, `food_items.detailsJson`, `food_items.isFavorite`, `recipes.isFavorite`,
  `recipes.servingWeightG` (optional grams-per-serving), and **`exercises.perSide`** (per-side volume
  override — see *Per-side load* below). An `app_meta` key/value table (`getMeta`/`setMeta`) tracks seed
  versions (e.g. `baseFoodsVersion`) so bundled data can re-seed in place when bumped.
  **New columns need a fresh app launch** to run `runMigrations()`.
- **Repositories** (`FoodRepo`, `HealthRepo`, `WorkoutRepo`) — synchronous SQLite access, mapping
  rows ↔ domain types from `src/types`. Mutations set `syncStatus='pending'`; soft-deletes set
  `deleted=1`. Dedup on `barcode` / `serverId` / `exerciseDbId`.
- **Why repos**: keeps SQL in one place and gives the future sync engine a clean seam.

## Stores (`src/stores`)
- `settingsStore` — the local user **Profile** (units, sex, height, activity, goal, targets, plus
  training goals `weeklySessionTarget`/`trainingFocus`, the maintain-buffer `goalRangeKg`, and custom
  `nutrientGoals[]`). Persisted via AsyncStorage with a `merge` that backfills new profile fields onto
  older stored data. Source of truth in no-server mode; mirrors the server `UserProfile`.
- `sessionStore` — in-memory active workout; persisted to SQLite only on `finish()` (which also takes
  the workout's `caloriesBurned`). Holds `pendingSuperset` so the next exercise added from the picker
  joins a superset (`startSuperset`/`ungroup` toggle `supersetGroup` on exercises). Mutations that can
  orphan a superset (`removeExercise`, `ungroup`) run **`normalizeSupersets`** (see `lib/supersets.ts`).
  Per-set rest lives on `LocalSet.restSeconds` (in-memory only — not persisted/columned); the rest after
  a set is `set.restSeconds ?? exercise.restSeconds ?? 90`.
- `templateDraftStore` — in-progress template being built; supports **editing** an existing template
  (`loadTemplate` + `editingId` → `WorkoutRepo.updateTemplate`), a `label`, and supersets (same
  `pendingSuperset`/`startSuperset`/`ungroup` pattern, persisted as `supersetGroup`). Order is set by
  drag-to-reorder: the editor groups adjacent superset members into one draggable block, and `setExercises`
  writes the flattened result back (array index → `sortOrder` on save). **`linkExerciseInto(draggedId,
  targetId)`** powers drag-to-superset (the chain handle): it groups the two and places the dragged one
  right after the target. Every membership/order mutation (`removeExercise`/`ungroup`/`setExercises`/
  `moveExercise`/`loadTemplate`) runs **`normalizeSupersets`** so a superset never has <2 adjacent members.
- `navStore` — shell navigation state: active `section` + `subTab` (local-only).
- `routineStore` — workout **routines** (named template rotations, auto-pick least-recently-done,
  a **default** routine for the FAB quick-action); local-only, persisted via AsyncStorage.
- `serverStore` — optional server URL + token; **null by default** (sync inactive until set).

## First-run & onboarding
`settingsStore` carries `onboarded`/`hydrated`. `(tabs)/index.tsx` redirects to `onboarding` once
the profile has hydrated and `onboarded` is false; the wizard (`src/app/onboarding.tsx`) collects
name/units/sex/height/activity/goal, writes the profile, calls `completeOnboarding()`, and returns
to the shell.

## Helper libs added
- `lib/haptics.ts` — crash-safe expo-haptics wrappers (`tap`/`light`/`medium`/`success`/`warning`),
  used on set-complete, nav taps, the FAB, and finishing a workout.
- `lib/baseFoodsSeed.ts` (+ `assets/foods/base-ingredients.json`) — seeds ~95 common whole foods
  (source `'BASE'`, synthetic `base:<slug>` barcode) so staples are searchable offline via
  `foodSearch`. Seeded in `_layout.tsx` startup alongside the exercise seed. The JSON is enriched to
  OFF parity (extended micronutrients, NOVA, computed Nutri-Score, allergens) by
  `scripts/enrich-base-ingredients.py`; the seed converts micros → `FoodDetails` and **upserts in
  place** (`foodRepo.upsertBaseFood`) gated by `BASE_FOODS_VERSION` vs `app_meta`, so bumping the
  data refreshes existing rows without orphaning logged references.
- `lib/sync.ts` — optional server backup **seam**: `testServerConnection(url)` pings `/health`;
  `syncNow()` is a documented stub (full push/pull pending the `apps/api` contract).
- `lib/health.ts` — **cross-platform health seam** (`HealthService` interface + `healthPlatformLabel`).
  Default impl reports unavailable; a native/dev build wires Apple HealthKit (iOS) / Health Connect
  (Android). Surfaced in Settings → "Health". Reads weight history, `getActiveEnergyBurned(start,
  end)` (active calories for a workout window; `null` when unavailable → MET fallback), and heart
  rate: `getHeartRateSamples(start, end)` (BPM series for a finished workout) + `getLatestHeartRate()`
  (most recent BPM in the last ~2 min, polled for the live session readout). All return `null` in
  Expo Go / without a watch, so HR UI just hides.
- `lib/supersets.ts` — pure superset ordering for the active session: `supersetRuns` (maximal runs of
  adjacent same-`supersetGroup` exercises), `buildSetSequence`/`nextSetCell` (round-interleaved set
  order — A1→B1→A2→B2…, which also gives "Next carries into the next exercise" for solo runs),
  `restAfterSet` (rest only after the last exercise in a round), and `supersetLabels` (A1/A2…). Plus
  **`normalizeSupersets(items)`** — a generic invariant enforcer used by both workout stores: a superset
  needs **≥2 adjacent members**, so it clears `supersetGroup` on any exercise with no adjacent same-group
  peer (e.g. removing one half of a pair reverts the other to solo). Returns the same array ref when
  unchanged.
- `lib/bodyComposition.ts` — body-fat math. `leanMassKg(weight, bf%)`; **`estimateBodyFat(baselineWeight,
  baselineBf, currentWeight)`** holds the measured baseline's lean mass constant to estimate current
  BF% as weight changes (accurate on a cut; re-baseline after muscle gain); **`navyBodyFat({sex, heightCm,
  neckCm, waistCm, hipCm})`** is the U.S. Navy (Hodgdon–Beckett) tape estimate, metric form. Consumed by
  `screens/HealthBody.tsx` (source priority: measured % on the latest weigh-in → lean-mass estimate from
  a DEXA baseline → Navy tape estimate), with `HealthRepo.getLatestBodyFatBaseline()` supplying the baseline.
- `lib/load.ts` — **per-side load** for volume. `defaultPerSide(equipment)` (true for Dumbbell/Kettlebell),
  `isPerSide(ex)` (explicit `exercise.perSide` override else the equipment default), `loadFactor(ex)` (×2
  for per-side, else ×1). A two-arm dumbbell logs per-hand weight, so volume = `weight·reps·loadFactor`.
  Applied in `WorkoutRepo` everywhere volume is computed (`finishSession`, `getVolumeBySession`,
  `getExerciseSessionHistory`, `mapSession`) so **past sessions recompute correctly** too; 1RM/top-weight
  stay per-hand. Overridable per exercise on the detail screen (`WorkoutRepo.setExercisePerSide`).
- `lib/renphoTape.ts` — **Renpho RF-BMF01 smart tape measure** (BLE) integration via `react-native-ble-plx`.
  `useRenphoTape()` hook: requests permissions → scans for `ES_TAPE` → connects → subscribes to the notify
  characteristic, exposing `{ status, reading, error, start, stop }`. `parseTapePacket` decodes the
  reverse-engineered ASCII frame (service `0783B03E-…-CB7`, char `…CB8`: `x[1..4]` low-nibble digits ÷10 =
  cm, `x[17]&1` = tape's confirm button, `x[18]` = unit). Needs a **dev build + a physical device**
  (no Bluetooth on emulators/simulators).
- `lib/activities.ts` — MET table plus `caloriesBurnedFromDuration(min, kg, met=STRENGTH_MET)`, the
  no-watch fallback estimate for workout calories.

## Components added
- `components/MuscleMap.tsx` — anatomical front/back body (`react-native-body-highlighter`) shaded by
  weekly sets vs target (Stats tab).
- `components/MonthCalendar.tsx` — month grid with marked/selected days (Workout history).
- `components/LineChart.tsx` — multi-series SVG line chart with a labelled y-axis (exercise reports).
- `components/ActivitySuggestions.tsx` — MET-based "how to hit it" options (`lib/activities.ts`).
- `components/SwipeToDelete.tsx` — standard swipe-left → red Delete + confirm for user logs
  (food items, weight entries, measurements, history). Built on gesture-handler `ReanimatedSwipeable`;
  the button tracks the finger via `useAnimatedStyle`. `lib/avatar.ts` picks a profile picture
  (`expo-image-picker`) and persists it to the document dir; shown in `AppHeader` + Settings.
- `components/BottomSheet.tsx` — **shared draggable bottom sheet** (the one place that owns sheet
  behavior). Slides up on `visible`, a full-screen dim backdrop whose **opacity is driven by the
  sheet's `translateY`** (fades in/out and lightens as you drag), a generous **grab strip**
  (`PanResponder`, `onStartShouldSetPanResponder`) you drag down to dismiss, an absolute tap layer to
  dismiss, and a `maxHeight` cap that keeps the top edge below the notch. Stays mounted through the
  slide-out (internal `mounted` state) so closing always animates — whether from the grab gesture,
  the backdrop, a child button calling `onClose`, or the parent flipping `visible`. Built on RN's
  built-in `Animated`/`PanResponder` (no reanimated worklets). Used by `QuickActionsSheet`,
  `WorkoutSummarySheet`, `HealthMeasure` (the SiteDetail + MeasurementDetail pop-ups), and the
  `exercise-progress` "Compare" picker. Content scrolls via a child `ScrollView` with its own
  `maxHeight`, independent of the drag gesture.
- `components/FoodQuantitySheet.tsx` — shared quantity editor (unit conversion + live nutrition +
  day-progress projection), used by both `add-food` (logging) and `FoodToday` (editing a logged
  item). Edit mode passes `baselineQty` to strip the existing entry from the projection. Implements
  the **same draggable-sheet pattern as `BottomSheet`** directly (it predates the shared component and
  adds keyboard-avoidance + a derived scroll `maxHeight`); embeds `FoodDetails` for OFF rich data. For
  a recipe with a `servingWeightG`, the sheet offers a `g` unit so recipes log by weight.
- `components/FoodDetails.tsx` — `FoodBadgeRow` (diet/allergen badges + Nutri/NOVA/Eco score chips)
  and `FoodDetailSections` (expandable per-serving nutrient list + ingredients/additives), driven by
  a `FoodDetails` blob and scaled by the chosen servings.
- `components/TapeMeasureView.tsx` — the **Renpho tape** measuring UI (swapped in from `measurements.tsx`
  via a mode toggle). Back button, a live **connection indicator** (dot/label from `useRenphoTape().status`),
  a big bold **live reading** in the user's unit, body-part selector chips (selected = indigo; measured =
  green ✓), the `BodyDiagram` guide, a **Save** button (persists via `HealthRepo.upsertMeasurementSite`
  into one daily snapshot, then auto-advances to the next unmeasured site), and a "This session" list with
  green dots for measured parts.
- `components/BodyDiagram.tsx` — a stylised front-facing SVG figure (`react-native-svg`) that draws a
  **dashed indicator around the body part being measured** (so waist vs. hips is unambiguous), driven by
  a `site` prop.

## Navigation shell (`src/navigation`)
The main app area is **not** an expo-router tab bar — it's a single custom shell
(`AppShell.tsx`) recreated from the design mock (`FitSelf Design System/ui_kits/app`):
- **`AppHeader`** — top section switcher (dropdown over Dashboard/Food/Workout/Health/Settings) +
  profile shortcut.
- **`BottomNav`** — contextual bottom bar: a section's sub-tabs (or the launcher on Settings) split
  around a center "+" FAB. **Hidden on Settings** (reached/left via the header).
- **`QuickActionsSheet`** — section-specific quick actions opened by the FAB.
- **`config.ts`** — `SECTIONS`, per-section `SECTION_TABS`, `LAUNCHER`, `FAB_ACTIONS`.
Section bodies live in **`src/screens/*`** as plain content fragments (no `Screen` wrapper); the
shell provides the scroll area, header, and bottom bar. Each still reads on focus via
`useFocusEffect`. Sub-tabs: Dashboard (Overview/Goals), Food (Today/Recipes/Trends/**Search**),
Workout (Library/History/Exercises/Stats), Health (Weight/**Trends**/Body/Measure). Goals editing was
unified: `components/GoalsEditor.tsx` is the single editor (rendered inline on Dashboard → Goals, and
opened as `GoalsEditorModal` from a **gear `rightAction`** on `AppHeader` for Food/Workout/Health), so
the old Food/Health Goals tabs were repurposed to Search/Trends. The editor floats the **current
section's group to the top** (`focusSection`). **Goal Phases & Cycles renders as a sub-page *inside*
the goals modal** via `components/GoalPhasesPanel.tsx` (an internal `view` state swaps the modal body;
a "‹ Goals" back arrow returns) — it is **not** a pushed route, because an RN `Modal` left mounted
over a pushed route renders above it and swallows all touches (which previously locked the header). The
standalone `app/goal-phases.tsx` route is now a thin wrapper around the same panel, used only by the
Dashboard inline editor (no modal there to conflict with).

## Routing (`src/app`, expo-router, file-based)
- `(tabs)/` — a single `index` route rendering `AppShell`; `_layout.tsx` is a plain Stack (the
  old per-section tab screens were removed). Cross-section navigation goes through `navStore`.
- Modals: `add-food`, `custom-food`, `exercises` (also a picker via `?pick=session|template`),
  `tdee`, `measurements`, `template/new`, `recipe/new`, `exercise/new` (custom exercise),
  `goal-phases`, `exercise-reports`, `exercise-progress`.
- `session` — full-screen active workout → on finish routes to `workout-summary` (a `finishing` ref
  guards the inactive-redirect so the summary shows); both return to the shell via `navStore`.
- `workout-summary` — full-screen post-workout summary with the liquid-wave animation. The stats body
  (duration/calories/volume/sets/exercises grid + PR callout + heart-rate panel) lives in the shared
  `components/WorkoutSummaryBody.tsx`, reused by the History detail sheet (`WorkoutSummarySheet`) so the
  two stay in sync — add a stat once and it shows in both. The full screen adds the weekly-goal nudge;
  the sheet adds a per-exercise breakdown.
- `onboarding` — first-run wizard (gestureless).
- `exercise/[id]` — exercise detail with GIF.
Routes and their presentation are declared in `src/app/_layout.tsx`.

## Animation note
`react-native-reanimated` 4 + `react-native-worklets` are installed and the worklets babel plugin is
active (auto-enabled by `babel-preset-expo` in SDK 56) — worklets work without extra config. Existing
screens still use React Native's built-in `Animated` where it was simplest: `workout-summary.tsx`
(SVG wave layers + rising body) and `components/BottomSheet.tsx` (slide + drag-to-dismiss + backdrop
fade via `Animated`/`PanResponder`). Reanimated is used where the gesture must track the finger:
`components/SwipeToDelete.tsx` (gesture-handler `ReanimatedSwipeable` + `useAnimatedStyle` so the
Delete button is revealed in lockstep with the swipe) and the template editor's drag-to-reorder
(`react-native-sortables`, peer-deps gesture-handler + reanimated only — no native rebuild).

**Drag-to-superset (template editor, `template/new.tsx`).** Because the sortable grid reorders the list
live, "drop one card onto another" can't be the *reorder* drag. Instead each solo card has a separate
**chain handle** with its **own `Gesture.Pan`** (not the sortable's): on drag it hit-tests the finger
against cards' measured rects (stable, since nothing is reordering) and highlights the target via a
shared-value `useAnimatedStyle` overlay (`DropOverlay`); on release it confirms → `linkExerciseInto`.
The reorder grip is unchanged. **Gesture gotcha:** `template/new.tsx` is a native-stack **modal**, and
gesture-handler pan gestures don't register in a modal subtree unless it has its **own
`GestureHandlerRootView`** (taps still work without it — which is why the handle was un-grabbable until
wrapped).

**Active session (`session.tsx`).** When a set is focused, the screen **auto-scrolls** it above the
numpad (`row.measureLayout(contentRef, …)` → `scrollTo`; on the New Arch `measureLayout` takes the
relative **ref**, not a node handle). Marking a set done **pops the checkmark in** (`Animated.View
entering={ZoomIn}`) and turns the whole row green (the weight/reps cells go transparent so the values sit
on the fill). Rest dividers are tappable to set a **per-set** rest override.

**Bottom sheets:** any bottom-anchored pop-up should use `components/BottomSheet.tsx` (or, for the
food/recipe editor, `FoodQuantitySheet`) rather than a raw `Modal` + `flex-end` view, so drag-to-
dismiss and the fade backdrop stay consistent. Centered dialogs/popovers (rest-timer & notes in
`session.tsx`, the `AppHeader` section dropdown, the calendar pickers, the nutrient picker) are
intentionally **not** bottom sheets and keep their `animationType="fade"` modals.

## Theming (`src/theme`)
- `tokens.ts` — colors, radii, spacing, shadows (ported from `../../FitSelf Design System/colors_and_type.css`).
- `text.ts` — the semantic type scale (`type.display`, `type.h1`, …); colour-free, so not themed.
- `src/components/ui/index.tsx` — primitives: `Screen`, `Card`, `Button`, `Badge`, `Chip`,
  `FsText`, `SectionHeader`. Dark-first, one accent, lucide icons, no emoji in chrome.
- **Runtime themes (Settings → Appearance).** A theme is a **surface preset** (Charcoal/Slate/Mocha/
  **Light**) plus an **accent** (6 presets or a custom `#hex`). `colors`/`tintBg`/`shadow` are
  **mutable** and rebuilt in place by `applyTheme()`; the choice persists to SQLite (`app_meta` key
  `theme`) and is re-applied **synchronously at module load**, so the first paint is themed. To make
  the ~50 existing `StyleSheet.create` blocks react without per-file hooks, each is wrapped in
  **`themedStyles(() => StyleSheet.create({…}))`** — a transparent `Proxy` that re-runs the factory
  after a theme bump, so `styles.x` access is unchanged. `stores/themeStore.ts` holds the selection +
  a `version`; `AppShell` **keys a remount** off that version so the whole UI re-renders with the new
  palette (inline `colors.x` reads refresh too). **New screens must wrap their styles in
  `themedStyles`** (and avoid module-level `const X = colors.y`, which would snapshot) to stay
  theme-correct.

## Calc libs (pure TS, ported from web — keep parity)
- `tdee.ts` (Mifflin-St Jeor BMR/TDEE + goal-aware target; `safeRateWarning` + `MAX_SAFE_RATE_KG`
  ~2 lb/week + `MIN_SAFE_CALORIES` 1200 floor for the non-blocking safety warnings). `calcGoalCalories`
  **caps the rate used for the calorie target at `MAX_SAFE_RATE_KG`** (≈±1000 kcal/day) so an aggressive
  goal date can't produce an absurd target — the real pace is still flagged by `safeRateWarning`.
  `epley.ts` (1RM), `activities.ts` (MET table + `caloriesBurnedFromDuration`), `units.ts` (conversions),
  `targets.ts` (resolves daily calorie/macro targets from active GoalPhase → profile → TDEE; emits a
  `warning` for unsafe goals via `goalSafetyWarning`; and when `activeCalorieSource !== 'off'` adds the
  cached active-calorie eat-back from `activeCaloriesStore` — exposed separately via
  `activeCaloriesForDisplay` so the UI can show the burn). `describePace(deltaKcal, 'lose'|'gain')`
  turns `HealthStats.dailyCalorieDelta` into the pace-card copy: the **verb** (cut vs eat more) follows
  the delta's sign, while **behind vs ahead** follows goal direction (derive it from the sign of
  `requiredWeeklyRate`), and a delta beyond a sustainable daily adjustment switches to
  "Goal Pace Unrealistic" instead of quoting an absurd number. NB: in `HealthRepo.computeStats`,
  `requiredWeeklyRate` is signed `(current − goal)` and `weeklyChange` is `avg7 − avg14`, so the gap is
  `requiredWeeklyRate + weeklyChange` (a **sum** — the desired weeklyChange is `−requiredWeeklyRate`).
  `heartRate.ts` (pure HR helpers for workouts: `summarizeHeartRate` → avg/min/max, `downsample` for
  storage/charting, `maxHeartRate(age) = 220 − age`, and `zoneBreakdown` for the 5-zone time-in-zone
  bars). Consumed by `components/HeartRatePanel.tsx` (stats + `LineChart` + zone bars) on the workout
  summary + history sheet; HR is captured in `session.tsx` (live poll of `getLatestHeartRate`, and a
  `getHeartRateSamples` window read on finish → `WorkoutRepo.setSessionHeartRate`).

## Active-calorie eat-back (`lib/activeCalories.ts` + `stores/activeCaloriesStore.ts`)
`profile.activeCalorieSource` (`off | auto | watch | inapp`) decides what gets added back to the daily
budget. `computeActiveCaloriesToday(source)` is **async** (watch reads): `inapp` = in-app workout
calories; `watch` = the platform's whole-day active energy; `auto` = whole-day energy **plus** the MET
estimate for any of today's workout windows the watch didn't cover (`health.getActiveEnergyBurned` per
window), so watch-tracked workouts aren't double-counted. Because `resolveTargets` is a synchronous
render function, the result is cached in `activeCaloriesStore` (`{day, kcal, refresh()}`); `refresh` is
called on focus of Dashboard/FoodToday and after a workout finishes, and those screens subscribe to
`kcal` so the budget re-renders when it lands. Migrated from the old `countActiveCalories` boolean.

**Guards against bad data** (a wrong eat-back silently inflates the whole day's budget, so these matter):
the MET estimate caps workout duration at **6h** (a session left "running" across days can't blow up);
`WorkoutRepo.getCaloriesBurnedToday` clamps **each session to ≤2500 kcal** in SQL; and
`computeActiveCaloriesToday` clamps the daily total to **`MAX_DAILY_BURN` (4000)**. ⚠️ HealthKit gotcha:
`@kingstinct/react-native-healthkit`'s `queryQuantitySamples` filters by date via
`filter: { date: { startDate, endDate } }` — passing `from`/`to` is silently ignored and returns *all*
recent samples (summing many days). `getActiveEnergyBurned` uses the correct filter **and** re-bounds by
date in JS as a backstop.

## Calorie-anchored macros (`lib/macros.ts`)
In the goal editors, Daily Calories is the **anchor** and protein/carbs/fat are always a split of it
(stored as grams, but kept consistent on every edit). `rescaleToCalories` re-derives grams keeping
the current ratio when calories change; `rebalanceMacro` pins the edited macro and re-weights the
other two to keep the same calorie total; `macrosFromRatio`/`presetMacros` apply a `MACRO_PRESETS`
split; `activePresetKey` drives the preset chips' highlight + Custom state. Each returns whole grams
summing to the goal (carbs absorbs rounding). `FoodGoals`/`GoalsEditor` call these in the stepper
`onCommit`s and write all affected `*Target` fields together, so the macro total can never disagree
with calories. **Per-macro lock** (`profile.lockedMacro`): each of `rescaleToCalories`/`rebalanceMacro`/
`presetMacros` takes an optional `locked` macro — `distributeLocked` keeps that macro's grams fixed and
flexes only the other two, so e.g. protein can be pinned at 150 g while calories/carbs/fat change. The
preset chips render via the shared `Chip` (now accepting a `style` prop) in a 2-column grid with an
always-visible **Custom** chip.

## Goal coaching vs safety (two independent channels)
- **Coaching nudges** (pace alerts, "cut X cal/day", `ActivitySuggestions`, weekly-workout shortfall)
  are gated by `profile.showCoachingNudges` — a harm-reduction switch. Gated in `DashboardOverview`,
  `HealthWeight`, `workout-summary`.
- **Safety warnings** (`targets.warning` / `safeRateWarning`) are **always** shown via the shared
  `components/GoalWarning.tsx` card across `HealthGoals`, `GoalsEditor`, `GoalPhasesPanel`, `FoodGoals`,
  and the dashboard — independent of the coaching toggle, never blocking.

## Ported feature 1 — Open Food Facts search (`src/lib/foodSearch.ts`)
Faithful port of `../../apps/api/src/routes/food.ts`, run client-side:
- `sort_by=unique_scans_n`, descriptive `User-Agent`. `fields` requests the core nutriments +
  serving/brand **plus** the rich-data fields (`nutriscore_grade`, `nova_group`, `ecoscore_grade`,
  `nutrient_levels`, `ingredients_text`, `allergens_tags`, `additives_tags`, `labels_tags`,
  `ingredients_analysis_tags`).
- Quality filters: drop no-name, name > 120 chars (ingredient dumps), and no-calorie items;
  prefer `_serving` nutriments, fall back to `_100g`.
- Relevance `score()` (exact > startsWith > first-word > word > prefix > substring); local/custom
  results merged first.
- Results are **ephemeral candidates**; a `FoodItem` row is only written when the user logs one
  (`ensureFoodItem`) — keeps the local DB from bloating with every search.
- **Rich detail** (`src/lib/offNutrients.ts`): `extractDetails(product)` normalizes the OFF payload
  into a `FoodDetails` blob — the **extended nutriment catalog** (`NUTRIENT_DEFS`, ~45 entries stored
  as grams/serving with a per-nutrient display factor g/mg/µg), scores, nutrient levels, ingredients,
  allergens, additives, and diet labels. `foodBadges()` derives the "Contains gluten / Vegan / …"
  pills. The blob rides along as `food_items.detailsJson` and renders via `components/FoodDetails.tsx`
  inside the shared `FoodQuantitySheet`. Extended nutriments are **display-only** — day totals still
  sum only the core columns.

## Ported feature 2 — Exercise media (`src/lib/exerciseMedia.ts`, `exerciseSeed.ts`)
- Catalog from open-source ExerciseDB is bundled (`assets/exercises/catalog.json`) and imported to
  SQLite on first launch (`seedExercisesIfEmpty`).
- `resolveMediaSource(ex)` priority: **cached file → bundled GIF (`gifMap.ts`) → remote CDN URL**.
- `cacheGif` downloads a GIF to `Paths.document/exercise-media/<id>.gif` (new expo-file-system
  `File`/`Directory` API). Viewing an exercise caches it; Settings can bulk-cache all.

## Expo gotchas (SDK 56)
- Read versioned docs before using a module: https://docs.expo.dev/versions/v56.0.0/.
  `expo-file-system` uses the `File`/`Directory`/`Paths` API (legacy API is under `/legacy`).
- `expo-camera`: `CameraView` + `useCameraPermissions`, `onBarcodeScanned`, `barcodeScannerSettings`.
- HealthKit (`@kingstinct/react-native-healthkit` v14): `queryQuantitySamples(id, opts)` filters by date
  with `filter: { date: { startDate, endDate } }` — **not** `from`/`to` (those are ignored and return
  all recent samples). See `getActiveEnergyBurned` in `lib/health.ts`. JS changes to how the native
  module is *called* hot-reload; only adding/removing the native module needs a prebuild.
- Charts: built on `react-native-svg` directly (`LineChart`, weekly/volume bars, weight trend).
  `react-native-gifted-charts` is installed if richer charts are wanted later.
- Muscle map: `react-native-body-highlighter` (SVG-only, rides on `react-native-svg` — no native
  rebuild). Slugs are mapped from our `Exercise.muscleGroup` body-part values.
- **Bluetooth** (`react-native-ble-plx`, Renpho tape): native module + config plugin (adds
  `BLUETOOTH_SCAN`/`CONNECT` + `NSBluetoothAlwaysUsageDescription`). **Needs a dev build** and a
  **physical device** — neither the Android emulator nor the iOS simulator has a Bluetooth radio. Core
  Bluetooth (central) needs **no paid Apple account**.
- **Android builds require JDK 17.** The machine default may be JDK 25, which fails the native CMake
  configure for `react-native-nitro-modules`/`react-native-worklets` with
  *"A restricted method in java.lang.System has been called"* (JDK 24+ native-access restriction; RN/AGP
  support 17–21). Set `JAVA_HOME` to a JDK 17 before `expo run:android` / `prebuild`; `android/local.properties`
  carries `sdk.dir`. The `[CXX5304] SDK XML version 4` lines are harmless warnings.
- **HealthKit build toggle** (`app.config.js`): HealthKit's entitlement requires a **paid** Apple
  Developer account and otherwise blocks signing under a free Apple ID. `HEALTHKIT=0` strips the
  `@kingstinct/react-native-healthkit` plugin + its Info.plist strings (and sets
  `extra.healthKitEnabled=false`) so a HealthKit-free variant signs on a free account — `npm run ios:free`
  / `npm run prebuild:ios:free`. `lib/health.ts` already no-ops when the module isn't authorized, so no
  code changes are needed. Default build keeps HealthKit.
- Native dirs are regenerated by `expo prebuild`; never commit `ios/`, `android/`, `Pods/`.
