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
- **`src/lib/db.ts`** — `openDatabaseSync('fitself.db')`, `initDb()` creates all tables + indexes,
  then runs `runMigrations()`. Run once in `src/app/_layout.tsx` on startup. Columns added after a DB
  already exists go through `ensureColumn(table, col, decl)` (forward-only, no-op once present) since
  `CREATE TABLE IF NOT EXISTS` never alters an existing table — e.g. `food_items.saturatedFat`,
  `food_items.detailsJson`, `food_items.isFavorite`, `recipes.isFavorite`, and
  `recipes.servingWeightG` (optional grams-per-serving so a recipe can be logged/scaled by weight).
  An `app_meta` key/value table (`getMeta`/`setMeta`) tracks seed versions
  (e.g. `baseFoodsVersion`) so bundled data can re-seed in place when bumped.
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
- `sessionStore` — in-memory active workout; persisted to SQLite only on `finish()`.
- `templateDraftStore` — in-progress template being built; supports **editing** an existing template
  (`loadTemplate` + `editingId` → `WorkoutRepo.updateTemplate`) and a `label`.
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
  (Android). Surfaced in Settings → "Health".

## Components added
- `components/MuscleMap.tsx` — anatomical front/back body (`react-native-body-highlighter`) shaded by
  weekly sets vs target (Stats tab).
- `components/MonthCalendar.tsx` — month grid with marked/selected days (Workout history).
- `components/LineChart.tsx` — multi-series SVG line chart with a labelled y-axis (exercise reports).
- `components/ActivitySuggestions.tsx` — MET-based "how to hit it" options (`lib/activities.ts`).
- `components/SwipeToDelete.tsx` — standard swipe-left → red Delete + confirm for user logs
  (food items, weight entries, measurements, history). `lib/avatar.ts` picks a profile picture
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
- `workout-summary` — full-screen post-workout summary with the liquid-wave animation.
- `onboarding` — first-run wizard (gestureless).
- `exercise/[id]` — exercise detail with GIF.
Routes and their presentation are declared in `src/app/_layout.tsx`.

## Animation note
`react-native-reanimated` is installed but its worklets babel plugin is **not** configured, so use
React Native's built-in `Animated` (no worklets) for animations — see `workout-summary.tsx`
(SVG wave layers + rising body via `Animated`) and `components/BottomSheet.tsx` (slide + drag-to-
dismiss + backdrop fade via `Animated`/`PanResponder`). gesture-handler `Swipeable` (legacy Animated)
is used for swipe-to-delete and works without the plugin.

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
- `tdee.ts` (Mifflin-St Jeor BMR/TDEE + goal-aware target), `epley.ts` (1RM), `activities.ts`
  (MET table), `units.ts` (conversions), `targets.ts` (resolves daily calorie/macro targets from
  active GoalPhase → profile → TDEE).

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
- Charts: built on `react-native-svg` directly (`LineChart`, weekly/volume bars, weight trend).
  `react-native-gifted-charts` is installed if richer charts are wanted later.
- Muscle map: `react-native-body-highlighter` (SVG-only, rides on `react-native-svg` — no native
  rebuild). Slugs are mapped from our `Exercise.muscleGroup` body-part values.
- Native dirs are regenerated by `expo prebuild`; never commit `ios/`, `android/`, `Pods/`.
