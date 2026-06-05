# Roadmap & Status

Honest status of the rebuild. **Update this when features land or plans change.**

## Done
- [x] **Full exercise catalog (1,500 + GIFs)** — fixed the seed to walk the source's `after`
      cursor (the working param; `cursor`/`offset`/`page` are ignored), pulling all ~1500 with GIFs
      (was ~440). Cleanup pass normalizes names, infers categories (Strength/Stretching/Cardio),
      tidies equipment facets, and **de-bakes** attachment names ("Cable Pushdown (V-Bar)" →
      "Cable Pushdown", collision-safe). Reseed is `SEED_VERSION`-gated and upserts **in place** by
      `exerciseDbId`, preserving localIds (so templates/history survive) and user overrides
      (perSide/unilateral/leadSide). `scripts/lib-debake.mjs` is shared by the seed script.
- [x] **Pre-set templates** — a curated set of starter workouts (Full Body, Push/Pull/Legs,
      Upper/Lower, Dumbbell-only, Bodyweight) on the Workout library, above the Exercise Library card.
      Each "Add to my templates" saves a real, fully-editable `WorkoutTemplate` the user owns.
      `lib/presetTemplates.ts` references the catalog by stable `exerciseDbId` (resolved at add time via
      `WorkoutRepo.getExerciseByDbId`); screen at `app/preset-templates.tsx`.
- [x] **Cable attachments** — pick Rope/Bar/V-Bar/… per cable exercise; history/PRs/ghosts are keyed
      on (exercise + attachment), so each attachment is its own progress line. Stored per performance
      (`session_exercises.attachment`) with a template default (`lib/attachments.ts`).
- [x] **Per-arm (unilateral) sets** — a per-exercise toggle splits each set into L/R rows with a
      configurable lead side; volume sums both arms (load factor forced to 1) and rest fires after the
      second arm. Schema: `exercises.unilateral`/`leadSide`, `exercise_sets.side`; pure list transforms
      in `lib/unilateral.ts`.
- [x] **Inline logging selectors** — Per-arm, Cable attachment, and **Load counting** are anchored
      dropdowns under the exercise name (and in the template builder + exercise detail "Logging
      defaults"). Reusable `components/Dropdown.tsx` + `PerArmDropdown`/`AttachmentDropdown`/`LoadDropdown`.
- [x] **Faster set entry** — a "Use previous" key on the numpad fills the focused field from the
      previous set (or last workout for set 1), and the rest timer is bigger with a horizontal
      depleting bar (numpad + floating banner).
- [x] **Custom exercises** — create, a "My exercises" group in the library (+ a filter chip in the
      add picker, refreshes on focus), and delete (only your own; the seeded catalog is protected,
      with a usage-aware confirm). `searchExercises(onlyCustom)`, `deleteCustomExercise`, `getExerciseUsage`.
- [x] **Searchable in-app Feature guide** (Settings → Help → Feature guide) — detailed hand-written
      docs (`lib/guideContent.ts`, ~12 sections) filtered live; plus **data-source attribution**
      (ExerciseDB/AscendAPI, Open Food Facts/ODbL) in Settings → About & credits and on the
      exercise/food list footers.
- [x] **Navigation fix** — modal routes over `(tabs)` (session, workout-summary, template/new) now exit
      via `router.back()` instead of `router.replace('/(tabs)')`, removing the "land then wipe again"
      double transition. Also fixed the exercise picker cap (50 → full catalog) and a dropdown/kebab
      close-flash.
- [x] Fresh Expo SDK 56 app (expo-router, TypeScript), dark-first theme from the design system.
- [x] Local-first SQLite data layer + repositories; `initDb` + exercise seed on launch.
- [x] Settings: metric/imperial, full profile, offline-demos download.
- [x] Food: daily log (calorie ring + macro bars), OFF search, barcode scan, custom foods.
- [x] Exercises: bundled catalog (~440 unique, deduped by `exerciseDbId`), grouped/searchable
      library, detail with GIF demos, on-device GIF caching (per-view + bulk). Seed self-heals
      duplicate-bloated or stale databases on launch.
- [x] Workouts: empty/template start, active session (sets, ghost values, timer, **rest-timer
      vibration**), finish → volume + Epley PR detection, history with PR badges, template builder with
      **drag-to-reorder** (`react-native-sortables`; supersets drag as one locked block).
- [x] **Workout heart rate** (native build + watch): live BPM readout during a session, and on finish
      a Health window-read stores avg/min/max + a series — shown on the summary/history as stats, an
      HR-over-time line, and time-in-zone bars (`lib/heartRate.ts` + `components/HeartRatePanel.tsx`).
- [x] Health: weight logging, 7/30/90-day stats + **direction-aware pace guidance** (correct for both
      lose and gain goals, with unrealistic-pace wording), body measurements, TDEE calculator.
- [x] Dashboard: Overview (calorie ring, macros, weekly calorie chart, weight + ETA, pace alert,
      recent workouts, quick actions) and a **Goals** master list grouped by section.
- [x] **Navigation shell** (`src/navigation`): top section switcher, contextual bottom nav with a
      center "+" multi-action FAB + quick-actions sheet; Settings hides the bottom nav. Replaces the
      flat tab bar to match the design mock.
- [x] **Sub-tabbed sections**: Food (Today w/ date nav · Recipes · Trends · Goals),
      Workout (Library · History · Exercises · Stats), Health (Weight · Goals · Body · Measure).
- [x] **Workout routines** (`routineStore`): group templates into a rotation; "Start" auto-picks
      the least-recently-done template.
- [x] **Charts**: weight-trend line chart (react-native-svg), food calorie-intake trends (7/30/90d),
      workout weekly-volume bars + recent PRs.
- [x] **Goal editors**: nutrition (calories/macros), weight (goal + rate → ETA), training (weekly
      sessions + focus) — all persist live to the profile.
- [x] **Body composition** view: body-fat %, lean/fat mass, BMI, FFMI from the latest weigh-in.
- [x] **Recipe building/logging** — builder (`recipe/new`) + "Log Serving → food log"; recipe
      nutrition flows into day totals and the Today view.
- [x] **Local base-ingredient database** — ~95 bundled whole foods (fruits/veg/meats incl.
      ground-beef %s/fish/grains/legumes/dairy/fats), seeded with synthetic `base:<slug>` barcodes,
      searchable offline (`baseFoodsSeed.ts`, `assets/foods/base-ingredients.json`). Now **fully
      enriched** to OFF parity: fiber/sugar/sat-fat/sodium, a curated micronutrient breakdown
      (vitamins/minerals per 100 g), NOVA group, a **computed 2023 Nutri-Score**, and allergen badges
      — so base foods open the same rich sheet as scanned products. Data generated by
      `scripts/enrich-base-ingredients.py`; re-seeds in place via `app_meta` `baseFoodsVersion` +
      `foodRepo.upsertBaseFood`.
- [x] **Quick-add / recent foods + inline edit-serving** — tap a logged item to adjust servings/delete.
- [x] **Remembered quantity per food** — the add-food sheet prefills the last amount + unit you logged
      an item at (`food_items.lastAmount`/`lastUnit`, set on log via `foodRepo.setFoodItemLastEntry`);
      editing an existing log doesn't overwrite it. The unit dropdown opens **downward** below the field.
- [x] **Goal Phases & cycles UI** — `goal-phases` create/list with active-phase detection feeding
      `resolveTargets`.
- [x] **MET "how to hit it" suggestions** — `ActivitySuggestions` when behind pace.
- [x] **Workout Data/Reports** — per-exercise progress (`exercise-reports`/`exercise-progress`):
      labelled 1RM line chart (`LineChart`), volume bars with values, and **compare** mode.
- [x] **Muscle heatmap** — anatomical front/back body (`react-native-body-highlighter`) shaded by
      weekly sets vs a 12-set target (`MuscleMap`).
- [x] **Post-workout summary** — full-screen summary with a layered, scrolling **liquid-wave** wipe
      (RN `Animated` + SVG), stats, PRs, weekly-goal progress + success haptic (`workout-summary`).
- [x] **Active set-logger redesign** — per-set rows, ghost/previous values, ✓ + between-set rest
      timers, per-exercise notes + rest config (30/60/90/120/180 + custom), swipe-to-delete with
      confirms, tap exercise → detail, and a **custom numpad** (Next: lbs → reps → complete + rest → next).
- [x] **Supersets** — group adjacent exercises (in-session via the **Superset** button on an exercise,
      or baked into templates), labelled A1/A2 with an accent band. Sets run **alternating rounds**
      (A1→B1→rest→A2→B2…); rest only fires after the last exercise in a round. Logic in `lib/supersets.ts`;
      `supersetGroup` column on `template_exercises`/`session_exercises`.
- [x] **Numpad overwrite-on-focus** — a freshly focused weight/reps cell is overwritten by the first
      digit typed (then appends), instead of appending to the existing value. **Next** now also carries
      focus into the following exercise's first set instead of dismissing the keypad.
- [x] **Workout calories burned** — measured from Apple Health / Health Connect active energy for the
      session window (`health.getActiveEnergyBurned`), falling back to a **MET time estimate**
      (`caloriesBurnedFromDuration`, ~5.0 MET). Live estimate in the session header, final value on the
      summary, stored on `workout_sessions.caloriesBurned`.
- [x] **Active-calorie eat-back source** — Settings picker (`activeCalorieSource`: Off / Automatic /
      Watch only / In-app only). **Automatic** adds the watch's whole-day active energy plus the app's
      MET estimate for any workout window the watch didn't cover (no double counting). Computed async in
      `lib/activeCalories.ts`, cached in `stores/activeCaloriesStore.ts`, added to the budget in
      `resolveTargets`. Migrated from the old `countActiveCalories` boolean.
- [x] **Goal-coaching toggle** — `showCoachingNudges` (Settings) hides the pace alerts, "cut X cal/day",
      "how to hit it" activity suggestions and weekly-workout shortfall (harm-reduction for disordered
      eating). Safety warnings stay visible regardless.
- [x] **Goal safety warnings** — non-blocking cautions when a goal is unsafe: faster than the ~2 lb/week
      doctor-recommended max (`safeRateWarning`), a target below BMR, or under a ~1200 kcal floor. Shown
      via the shared `GoalWarning` card on every goal surface (Health goals + **weight trend**, Goals
      editor, Goal phases, Food goals, dashboard). Never blocks saving. `calcGoalCalories` also **caps the
      calorie target** at the safe rate so an aggressive goal date can't yield an absurd number (the
      warning still flags the real pace).
- [x] **Calendar date picker** (`components/DateField.tsx`) — tappable field → calendar popup with month
      arrows and a tap-the-title **year jump** list (good for far goal dates and decades-back birth dates).
      JS-only (works in Expo Go). Replaces the `YYYY-MM-DD` text inputs in onboarding (birth date),
      Settings (birth date), the Goals editor (goal date), and Goal Phases (start/end).
- [x] **Calorie-anchored macros** (`lib/macros.ts`) — Daily Calories is the anchor; protein/carbs/fat
      are always a split of it and can never disagree with the goal. Editing calories rescales the
      macros (keeping the ratio, `rescaleToCalories`); editing one macro re-weights the other two
      (`rebalanceMacro`); **preset chips** (Moderate / Lower / Higher Carb + a Custom state via
      `activePresetKey`) split the goal. **Per-macro lock** (`profile.lockedMacro`) pins one macro
      (e.g. 150 g protein) so the other two flex to fill the calories on any calorie/macro/preset
      change (`presetMacros` + the `locked` arg). Wired into Food → Goals and the Goals editor.
- [x] **Workout history** — month navigator (‹ ›), calendar day picker (`MonthCalendar`),
      swipe-to-delete sessions.
- [x] **Routines** — create/**edit**/delete, **default** toggle, and a "Start {routine}" FAB action.
- [x] **Custom exercises** — `exercise/new` create form; joins the library grouped by muscle.
- [x] **Onboarding wizard** (`onboarding`, gated on `settingsStore.onboarded`).
- [x] **Haptics** (`lib/haptics.ts`) on set-complete, nav taps, FAB, finish.
- [x] **Reorder template exercises** (move up/down in the builder).
- [x] **EAS build config** (`eas.json`: development / preview / production for iOS **and Android**).
- [x] **Rebranded FitSelf → Hale** (2026-06-03) — display name + all user-facing copy + bundle id/scheme now
      `Hale` / `com.zanderhalverson.hale`. Internal DB filename + Zustand storage keys intentionally kept
      (`fitself.db`, `fitself-*`) so existing on-device data survives the rename; backup import still accepts
      the old `app:'FitSelf'` marker.
- [x] **Shipped to TestFlight (iOS)** (2026-06-03) — `eas build -p ios --profile production --local` (needs
      `fastlane`, installed via `brew install fastlane`) → signed `.ipa` → `eas submit` → App Store Connect
      app **6776380902**. EAS stored an ASC API key, so subsequent submits are non-interactive; build numbers
      auto-increment (`appVersionSource: "remote"`). A first `--local` archive can fail transiently — re-run.
- [x] **EAS Update (OTA)** — `expo-updates` wired (production channel, `runtimeVersion: appVersion`); ship
      JS-only changes with `eas update` without an App Store resubmit.
- [x] **Imperial height entry (ft + in)** — `components/HeightField.tsx` shows ft/in for imperial, cm for
      metric, always storing metric cm (`cmToFeetInches`/`feetInchesToCm` in `lib/units.ts`); used in
      onboarding, Settings → Profile, and the TDEE calc. (Body measurements were already unit-aware.)
- [x] **Calorie ring default** — `resolveTargets` falls back to `DEFAULT_CALORIE_TARGET` (2000) when there's
      no logged weight and no manual goal, so the ring shows a target (with a "personalize" hint) instead of
      "No goal set".
- [x] **Birthday cascade picker** — `DateField` gained `mode="cascade"` (year → month → day) for birth dates;
      goal dates keep the `calendar` mode.
- [x] **Onboarding Preferences step** — confetti **preview + toggle**, **U.S. Navy body-fat** toggle (new
      `profile.navyBodyFatEnabled`, gated in HealthBody/HealthTrends/DashboardReports, with a matching Settings
      toggle), and the **active-calorie source** selector.
- [x] **Build variants** — `app.config.js` suffixes name + bundle id for non-production builds
      (`Hale Dev` / `com.zanderhalverson.hale.dev`) via `APP_VARIANT` (set per profile in `eas.json`), so a
      local `expo run:ios` dev build installs **alongside** the TestFlight release and is easy to tell apart.
- [x] **In-app feedback (bug + feature)** — `app/feedback.tsx` + `lib/feedback.ts` + `FeedbackRepo` /
      `feedback` table. Forms **email** the report to the dev (mailto, no server) with auto diagnostics
      (app version, variant, device, OS) and keep a local "Mine" history; `serverId`/`syncStatus` columns
      leave room for a future **community-voting board**. Reachable from Settings → Feedback and the
      What's-New sheet. Beta bug reports also lean on **TestFlight's native screenshot/crash feedback**.
- [x] **What's-New / beta sheet** — `components/WhatsNew.tsx` shows once per `WHATS_NEW_VERSION` (tracked in
      `app_meta`): lists what to test, nudges feedback, adds a "test build" note on non-prod variants, and
      points testers at the TestFlight screenshot flow. Bump `WHATS_NEW_VERSION` in `lib/feedback.ts` per beta.
- [x] **Body-fat / DEXA entry from the Body screen** — `HealthBody` links to the dedicated **Log DEXA scan**
      flow (`app/log-dexa.tsx`) so a fresh Body tab is no longer a dead end (full DEXA handling documented below).
      *(Merge note: this session's inline DEXA modal was superseded by beta's dedicated screen.)*
- [x] **Onboarding privacy + Apple Health** — a "Private by design" step (no account/servers, never sold or
      tracked, free forever, only Open Food Facts lookups leave the device) and a "Connect {Apple Health /
      Health Connect}" action in Preferences (no-ops gracefully without the native module).
- [x] **Multi-select exercise picker** — `app/exercises.tsx` `pick=template`/`pick=session` modes let you
      check off several exercises (numbered in pick order) and add them all at once via "Add N exercises",
      instead of one-tap-then-close. Browsing (no `pick`) still opens the exercise detail page.
- [x] **Long-press exercise preview** — `components/ExerciseInfoSheet.tsx`: press-and-hold a row in the picker
      to peek at an exercise (demo GIF, muscles, equipment, instructions) without losing your selection; a hint
      above the list announces the gesture.
- [x] **Modal top-padding fix** — sheet-style modals (`exercises`, `template/new`, …) were adding the device's
      top safe-area inset *on top of* the iOS page-sheet's own offset → wasted space. Dropped the redundant
      inset (full-screen `onboarding` keeps its real status-bar inset; its hero margin trimmed).
- [x] **Optional-donation flow** — `stores/donationStore.ts` + `components/DonationBanner.tsx` (Dashboard) +
      a final wizard step (Donate / Remind me later / No thanks). "Remind later" re-prompts after ~30 days;
      X / "No thanks" dismisses forever. Link centralised in `lib/support.ts` → Ko-fi (`ko-fi.com/haleapp`).
- [x] **Settings reorg + wizard profile photo** — Settings cards regrouped by adjacency (display prefs /
      you+body / data / reminders) with the **Donate card moved to the bottom**; the wizard's "About you"
      step gained a **profile photo** picker so the profile basics are together.
- [x] **Nutrition-OCR parser hardening** — `parseNutritionText` is now **%DV-aware** (skips "% Daily Value"
      numbers), **unit-aware** (sodium g→mg, mcg→mg), reads the value *after* the label word (handles trailing
      %DV + labels merged onto one line), drops the "Includes …/Added Sugars" clause so **Total Sugars** reads
      correctly, and handles **decimal commas** + vertical label/value splits. Pure TS (ships via `eas update`
      too); ML Kit engine unchanged — an Apple Vision swap (`expo-text-extractor`) is a possible further step.
- [x] **Standard swipe-to-delete + confirm** (`SwipeToDelete`) across user logs: food items, weight
      entries, measurements, workout history (recipes/routines/phases keep explicit delete + confirm).
- [x] **Quick-log weight** modal (`log-weight`) wired to the FAB + dashboard (the inline Health form
      remains too).
- [x] **Muscle heatmap** uses **opacity + a non-linear (eased) curve** vs the 12-set target, so one
      set reads faint and color only deepens near the goal.
- [x] **Profile picture** — pick from photos (`expo-image-picker`), persisted to the document dir;
      shown in the header + Settings (`lib/avatar.ts`).
- [x] **Shared add-food sheet for editing** — the rich quantity/nutrition sheet is extracted to
      `components/FoodQuantitySheet.tsx` and reused for both adding (add-food) and **editing a logged
      item** (Food → Today). Tapping a logged item opens the full sheet (units, live "this food adds",
      day-progress projection) instead of the old bare stepper; an optional `baselineQty` strips the
      existing entry so the projection replaces rather than stacks.
- [x] **Saturated fat + full nutrient inputs** — `saturatedFat` added to `food_items` (via a new
      forward-only `ensureColumn` migration in `db.ts`), pulled from OFF/USDA, summed into day +
      recipe totals, shown in the sheet and the Today "Other nutrients" page. The custom-food form
      now exposes fiber, sugar, saturated fat, and sodium inputs (blank = unknown/null).
- [x] **Rich Open Food Facts product data** — search/barcode now also capture the **full extended
      nutriment list** (~45 vitamins/minerals/fats/sugars via `lib/offNutrients.ts`), Nutri-Score,
      NOVA, Eco-Score, nutrient-level traffic lights, ingredients, allergens, and additives, stored as
      a `detailsJson` blob on `food_items`. The add/edit sheet (now scrollable) shows **diet/allergen
      badges** ("Contains gluten", "Vegan", "Gluten-free"…) + score chips under the name, and an
      expandable per-serving nutrient list (compact 6 → "Show all", grouped) plus ingredients/additives
      (`components/FoodDetails.tsx`). Extended nutriments are display-only (not summed into day totals).
- [x] **Unified Goals editor** — Nutrition/Health/Training collapsed into one shared
      `components/GoalsEditor.tsx`, opened as a modal (`GoalsEditorModal`) from the header **gear** on
      Dashboard/Food/Workout/Health. Adds **maintain range** (`goalRangeKg`, hides goal
      date), an **active-cycle card** (replaces weight controls when a GoalPhase is live), and custom
      **"track other nutrient"** goals (`profile.nutrientGoals`) that drive Food → Today's "Other
      nutrients" bars. Freed sub-tabs: Food **Goals → Search** (`FoodSearch.tsx`), Health
      **Goals → Trends** (`HealthTrends.tsx`).
- [x] **Food add/edit + recipes parity** — the sheet is now notch-safe (insets-bound height); recipes
      aggregate full per-serving nutrition from ingredients (`FoodRepo.getRecipeBreakdown`) and open the
      same rich `FoodQuantitySheet` (incl. extended nutriments + allergen badges); add-food gains
      **Search/Recent/Favorites** tabs, lists **recipes** inline, **local-first** ordering, and a
      **favorite** star (`food_items.isFavorite`). Core extras (fiber/sugar/sat-fat/sodium) moved into
      the sheet's "Nutrients per amount" list.
- [x] **Food Trends** — pageable 7/30/90 **date window** (‹ › + range label) and an **other-nutriments**
      daily-average summary vs target.
- [x] **Workout fixes/features** — unit-aware training volume (`units.formatVolume`) across Stats/
      History/Summary; fixed the weekly-volume bucket that dropped **today's** workouts (and the "0 kg"
      best week); History session → **summary detail** (`workout-summary?from=history`, no wipe) +
      **year jump** arrows; **template edit/delete** (`WorkoutRepo.updateTemplate`), **labels/folders +
      search**, and a **blank-vs-wizard** template builder.
- [x] **Health** — weight logging via the `/log-weight` popup (inline form removed); weight chart gets
      **x-axis dates + drag-to-scrub** tooltip; measurements gain a **history list** (swipe-delete) and a
      **snapshot detail** modal with per-site edit, change-vs-previous, and "since first log" milestones
      (`HealthRepo.updateMeasurement`).
- [x] **Dashboard** — week/streak bars give logged days a clear minimum height so a light day no longer
      looks empty.
- [x] **Round 2 polish** — shared `components/CalorieMacroCard.tsx` (circular ring) used by both Dashboard
      Overview and Food → Today (ring caption + "kcal" label fixed); Goals gear added to **Workout** and
      the editor floats the **current section's group to the top**, with an always-available Goal Phases/
      Cycles link and a one-time **auto-maintain** prompt at goal; a **favorite star** in the food/recipe
      sheet (foods + `recipes.isFavorite`) with recipe **ingredients** in the summary and a robust
      scroll/clip fix; equal-height template cards + a **history popup** summary (`WorkoutSummarySheet`)
      instead of the full-screen view; weight chart **y-axis + scrub-capture**; and a Measure **per-site
      detail** (3/6/12-mo trends, landmarks, per-site goals, approximate golden-ratio targets).
- [x] Verified: `tsc --noEmit` clean; full `expo export` iOS bundle clean.
- [x] **Round 3 fixes** — recipe edit gains optional **grams per serving** (`recipes.servingWeightG`) for
      weight-based logging; Workout **Library label-filter chips** + always-on template search; a
      weight-chart **fit-data / show-goal zoom toggle**; and the Dashboard greeting now shows the saved
      **profile photo** instead of a generic icon.
- [x] **Goal Phases as a sub-page** — the Goals modal renders Goal Phases & Cycles **inside itself**
      (`components/GoalPhasesPanel.tsx`, an internal view swap with a "‹ Goals" back arrow) instead of
      pushing `/goal-phases`. Fixes the header lockup: an RN `Modal` left over a pushed route was
      capturing all touches. The standalone `/goal-phases` route now just wraps the panel.
- [x] **Shared draggable bottom sheet** — new `components/BottomSheet.tsx`: slide-in, **grab-strip
      drag-to-dismiss**, a **fade backdrop driven by the sheet's travel** (no more dim popping/sliding
      with the sheet), notch-safe `maxHeight`, and animated close on every path. Rolled out to
      `QuickActionsSheet`, `WorkoutSummarySheet`, the Measure site/snapshot pop-ups, and the
      `exercise-progress` "Compare" picker; `FoodQuantitySheet` matches the same pattern (incl. the
      reliable scroll fix — a concrete ScrollView `maxHeight`). Centered dialogs/popovers left as-is.
- [x] **Custom app themes** — Settings → Appearance: surface **presets** (Charcoal/Slate/Mocha/Light)
      + **accent** (presets or custom `#hex`), applied live. Implemented as runtime-mutable `colors`
      with a `themedStyles()` Proxy wrapping every `StyleSheet.create` (codemod, ~51 files), a
      `themeStore`, and a shell remount; persisted in SQLite and re-applied at module load. (Replaces
      the old "dark/light theme toggle — deferred" note below.) See ARCHITECTURE → Theming.
- [x] **Settings de-duped** — removed the redundant Goal/Targets cards (they live in the unified Goals
      editor); Settings now links out to Goals. Recipe edit shows **grams per serving** when set.
- [x] **Android dev build fixed** — builds require **JDK 17** (the default JDK 25 fails the native CMake
      configure for nitro-modules/worklets); `JAVA_HOME` → JDK 17, `android/local.properties` holds `sdk.dir`.
- [x] **SQLite black-screen fix** — `openDatabaseSync(..., { useNewConnection: true })` so the dev-tools
      registration can't tear the native connection down mid-render (`NativeDatabase.prepareSync` NPE).
- [x] **Superset integrity** — `normalizeSupersets` invariant (a superset needs ≥2 adjacent members):
      removing/ungrouping one half reverts the other to solo, in both the template editor and live session.
- [x] **Drag-to-superset** — a dedicated **chain handle** on each solo exercise in the template editor;
      drag it onto another exercise (its own pan gesture, so the list never reorders) → confirm → linked.
      Live target highlight; `linkExerciseInto`. (Also fixed: gestures in the modal needed their own
      `GestureHandlerRootView`.)
- [x] **Active-session UX** — auto-scroll the focused set above the numpad; **set-complete animation**
      (checkmark `ZoomIn` + whole row turns green); **per-set rest overrides** (tap a rest divider to set a
      custom time for that set); long exercise names truncate instead of overlapping the kebab.
- [x] **Body-fat estimation** — `lib/bodyComposition.ts`: estimate current BF% from a measured (DEXA)
      baseline holding lean mass constant, **and** the **U.S. Navy tape method** (waist/neck/+hip + height +
      sex). Body tab labels the source (Measured / Estimated / U.S. Navy) and can log a Navy reading. A
      **Settings → Body composition** toggle (`profile.navyBodyFatEnabled`, default on) disables the Navy
      fallback everywhere (Body / Stats / Reports) for users who'd rather only show a body-fat % they entered.
- [x] **DEXA scans → 3-compartment body comp** — a dedicated **Log DEXA scan** flow (`app/log-dexa.tsx` →
      `HealthRepo.logDexaScan`, stored as a weigh-in with `source='DEXA'` + `boneMassKg`/`visceralFatKg`/`boneTScore`)
      unlocks a true fat + **lean soft tissue** + **bone** split in the Body view (`bodyComposition.composition()`),
      carrying ~constant bone mass / T-score forward (`getLatestDexa`) so you scan less often. Visceral fat shows
      the scan value with a **direction-only** waist-trend cue (magnitude isn't reliable from waist). Gated — nothing
      shows until a scan is logged; example scans are seeded into the demo/tour data.
- [x] **Per-side (dumbbell) volume fix** — two-arm dumbbell/kettlebell work counts **×2** (weight is
      per-hand). `lib/load.ts` + `exercises.perSide` override (toggle on the exercise detail page);
      volume recomputed from sets × factor everywhere, so **past sessions correct themselves**. 1RM/top
      weight stay per-hand.
- [x] **Renpho smart tape measure (BLE)** — `react-native-ble-plx` + `lib/renphoTape.ts` (reverse-engineered
      RF-BMF01 protocol). Measurements → **"Measure with Renpho tape"** opens a view with connection status,
      a big live reading (2 decimals) in your unit, body-part chips (green when measured), a **`BodyDiagram`
      guide** (smooth silhouette + indigo ring on the part to measure), and per-part Save. **Verified on a
      physical device** (see below). The hook scans **continuously** and **auto-reconnects** (the tape
      powers off when idle); the only error is phone Bluetooth being off, which auto-recovers. Needs a dev
      build + physical device.
- [x] **Native Health activated** — `@kingstinct/react-native-healthkit` (iOS) + `react-native-health-connect`
      (Android) are installed with config plugins/permissions and wired through `lib/health.ts` (weight,
      active energy, heart rate). HealthKit needs a paid Apple account at runtime.
- [x] **HealthKit build toggle** — `app.config.js` reads `HEALTHKIT`; `HEALTHKIT=0` strips HealthKit so a
      free Apple ID can sideload (e.g. to test Bluetooth). `npm run ios:free` / `prebuild:ios:free`.
- [x] **Nutrition-label OCR** — Custom Food gains a **"Scan nutrition label"** action: capture the panel
      with the camera and auto-fill the nutrition fields. Fully **on-device** (Google ML Kit via
      `@react-native-ml-kit/text-recognition`, no cloud/LLM cost). `lib/nutritionOcr.ts` =
      `recognizeNutritionLabel(uri)` + a pure, testable `parseNutritionText` heuristic; always lands on the
      editable form (never auto-saves). Needs a dev build + physical device.
- [x] **Reminders system** — per-reminder **schedule** (daily / weekly / custom weekdays + time) for
      **measure body, log weight, log food, workout**. Each fires a **local notification**
      (`expo-notifications`, `lib/reminders.ts`) and surfaces a **dismissible Dashboard banner**
      (`ReminderBanner` + pure `lib/reminderStatus.ts`). Opt-in (`remindersStore`, all off by default);
      managed from **Settings → Notifications & reminders** (`app/reminders.tsx`). Notifications need a dev
      build; banners work everywhere.
- [x] **Workout-summary toggle** — `showWorkoutSummary` (Settings → Coaching & reminders) skips the
      post-workout celebration screen; finishing a session then returns straight to Workout history.
- [x] **Motion & dynamism pass** — app-wide animation built on a shared layer (`theme/motion.ts` tokens +
      `lib/useMotion.ts` gate + `components/anim/*`: `AnimatedNumber`, `PressableScale`, `ScreenTransition`,
      `GrowBar`, `Confetti`, `Skeleton`). Section/sub-tab **screen transitions** (directional fade/slide),
      a sliding **bottom-nav indicator** + icon pop + FAB "+"→"×" morph + staggered quick-actions, the
      **calorie ring sweep** + count-up headline numbers, **growing** weekly bars, line-chart **draw-on**,
      animated macro bars, **press-scale** on cards/buttons, a pulsing streak flame, **confetti** on big
      wins (goal weight, new PRs), reminder-banner entrance, food-log **add/remove layout** animation,
      search **skeletons**, and **pull-to-refresh** on the shell. All gated by the OS Reduce-Motion setting
      + a Settings → Motion toggle (`animationsEnabled`); confetti has its own toggle (`confettiEnabled`).

- [x] **Dashboard Reports + consistent goal button** — the goal (target) header button now appears on
      **Dashboard** too (was only Food/Workout/Health), opening the same `GoalsEditorModal`. The freed
      Dashboard **Goals** sub-tab became **`DashboardReports`** — a cross-domain at-a-glance digest
      (Nutrition, Training, Weight & body comp, Consistency & goals) built from existing repos + a new
      `FoodRepo.getRangeNutrition` aggregate, with "see detailed" links into Food Trends / Workout Stats /
      Health. **Date navigation**: a segmented preset selector (Week/Month/3 Mo/Year) + a navigator toolbar
      (‹ › paging, tappable range → calendar jump, **custom start→end range** picker, **Today** jump). Every
      stat — including window-aware weight and a **`MuscleMap` whose target scales to the window length** —
      recomputes for the selected `[from, to]`, so you can browse any past week/month/year or custom range.

- [x] **Guided feature tour** — a skippable, replayable walkthrough that introduces the app. A **driven
      section tour** (`components/FeatureTour.tsx` + runtime `stores/tourStore.ts` + `lib/tourSteps.ts`):
      each step navigates the real screens via `navStore.setSection` with a docked explainer card
      (Skip/Back/Next + dots) and a touch-blocker. **Auto-starts once for brand-new users** from onboarding
      `finish()` (event-driven, no persisted flag, so existing users aren't prompted); replay anytime from
      **Settings → Help → "Take the app tour"**.

- [x] **Demo/sample data + richer tour** — a **hidden Developer tool** (unlock by tapping the Settings
      version footer **7×** → `devMode` in `stores/devStore.ts`) that seeds ~1 year of realistic food
      logs, weigh-ins (incl. example DEXA scans), body measurements and progressive-overload workouts (`lib/demoSeed.ts` +
      `WorkoutRepo.seedFinishedSession` + repo `clearAll…` helpers) so every screen looks alive for the
      feature tour and App Store screenshots; **Load / Clear / turn-off** buttons, never shown to normal
      users. The guided tour gained **auto-scroll + more steps** (`lib/appScroll.ts` registers the shell's
      scroll; steps carry a `scroll` offset) so it walks down each section.

- [x] **Shared date-range controls (Reports + Food Trends)** — extracted the Reports date machinery into a
      reusable `lib/useDateRange.ts` hook + `components/DateRangeBar.tsx` (segmented presets + ‹ › paging +
      custom start→end picker + Today). **Food Trends** now uses the same controls — full Week/Month/3 Mo/
      Year + custom ranges + paging (was a basic 7/30/90 pager) — and `FoodRepo.getRangeNutrition` gained
      fiber/sugar/sodium/sat-fat averages so its macro + nutrient cards come from one bounded query.

- [x] **Unified section "Stats" tabs** — each main section's stats page is now the **far-right sub-tab,
      named "Stats"** (Food: was Trends → Stats; Workout: Stats; Health: was Trends → Stats) and all three
      use the shared `DateRangeBar` + `useDateRange`. `WorkoutStats` and `HealthTrends` were made
      window-aware (workouts/volume/PRs/muscle-balance and weight/measurement deltas now reflect the
      selected Week/Month/3 Mo/Year or custom range), matching `FoodTrends` and Dashboard Reports.

- [x] **Data export / import / wipe** — user-owned backups (no server): `lib/backup.ts` exports all data
      tables + persisted stores to a JSON file (`expo-file-system` + `expo-sharing`); import
      (`expo-document-picker`) offers **Replace** (exact clone) or **Merge** (add records by `localId`).
      A guarded **Wipe all data** (acknowledge toggle + `SwipeToConfirm` drag bar) clears user data, keeps
      the seeded catalog, and returns to onboarding. Settings → Data & backup.
- [x] **Launch prep** — hidden dev tools gated behind `__DEV__`, removed the temp confetti preview, a
      "Support Hale" donation link (`expo-web-browser` → external page, to dodge store fees), plus
      `docs/PRIVACY.md` (hostable policy) and `docs/LAUNCH.md` (deployment / marketing / listing / analytics
      / donations reference).
- [x] **Settings search** — a search bar at the top of Settings filters which section cards render,
      matching a per-section keyword map (synonyms, e.g. "dark" → Appearance, "backup" → Data). Built on a
      new `Card` `hidden` prop so each section guards with one line; empty-state when nothing matches.
- [x] **Body-fat-over-time (Health → Stats)** — `HealthTrends` gains a **Body fat** card with start /
      current / change over the window + a bar **sparkline**. Per-weigh-in body fat via the shared
      `bodyFatForEntry` (measured → lean-mass estimate from the last measured baseline), falling back to a
      U.S. Navy tape series; labels the method (Measured / Estimated / U.S. Navy). Weight card's 4th cell is
      now a **weekly rate**.
- [x] **Tour preview data** — `lib/tourPreview.ts` loads the demo dataset as a **temporary preview** when
      the tour starts on an **empty** account so screens look alive, then removes it (and reverts the demo's
      profile fills) when the tour ends. Never touches a real account; a persisted marker + launch-time
      `recoverTourPreview()` undo a preview a force-quit interrupted. Also toned down the tour card's
      entrance (was an overshooting spring → a 220 ms standard-ease slide).
- [x] **Body-fat goal (mode toggle)** — the Goals editor (Health group) gains a **"Set goal by: Weight | Body
      fat %"** switch (`profile.goalMode`). The two never conflict because only one is active. In **body-fat
      mode** the user enters a target % (`profile.goalBodyFat`) and the **goal weight becomes derived &
      read-only** — `targetWeightForBodyFat` (in `bodyComposition.ts`) holds current lean mass constant to get
      the target total mass. `lib/goalWeight.ts` (`syncBodyFatGoalWeight` / `currentLeanMassKg`) recomputes and
      **persists that into `goalWeightKg`** after any weigh-in / DEXA / goal edit, so the *entire* existing
      weight + calorie + pacing + chart engine (all of which read `goalWeightKg`) drives off it with no rewiring.
      Current lean uses the Body subview's source priority (measured → DEXA/measured baseline → U.S. Navy tape).
      The Health → **Body** subview shows a goal card (target weight + fat-to-lose / room-to-gain) in body-fat
      mode. Needs a logged body-fat % to compute; messaged when absent.
- [x] **Actionable BMI/FFMI empty state** — when height is unset the Body subview's BMI/FFMI cards now read
      **"Add height"** and tap straight to Settings (via `navStore.setSection`) instead of a dead "—".
- [x] **TDEE moved into the Goals editor** — the standalone TDEE calculator screen (`app/tdee.tsx`) + its
      Settings → Tools link are gone; a profile-driven **"Maintenance & TDEE"** card now lives at the top of
      the Goals editor's Nutrition group (`TdeeCard` in `GoalsEditor.tsx`). Shows BMR + maintenance from the
      latest weigh-in & profile, an **inline activity-level selector** (the main TDEE lever), and tappable
      rate targets (moderate/mild loss · maintain · mild/moderate gain, unit-aware) that set `calorieGoal` —
      so calorie derivation sits next to the calorie/macro goals instead of behind a separate screen.
- [x] **Removed "Primary focus" training goal** — `profile.trainingFocus` (Cut/Maintain/Bulk/Recomp) was
      write-only (nothing consumed it) and overlapped the Lose/Maintain/Gain goal type; dropped the field,
      type, and the Goals-editor control.
- [x] **Basic / Advanced / per-page tour** — the guided tour now opens a **chooser** (`TourMenu`): a **Basic**
      run (essentials), an **Advanced** run (every feature across all sections), or **jump to one section's
      tour** on replay. `tourSteps.ts` groups steps into pages (Getting started / Dashboard / Food / Workout /
      Health / Settings) with an `advanced` flag; `tourStepsFor(tier, pageKey?)` resolves the run, which
      `tourStore` holds. The overlay swaps its fixed dot row for a **page label + progress bar** so long tours
      scale. First-run (onboarding) shows a clean **Basic / Advanced** choice; the per-section jump list only
      appears on **replay** (Settings → Help) via `openMenu(showPages)`. Both open the chooser instead of auto-starting.
- [x] **Swipe to switch sections** — the `AppHeader` title now takes a **vertical swipe** (up = next,
      down = previous, clamped) on top of tap → dropdown. A `PanResponder` claims only clearly-vertical drags
      so taps still open the menu; the chevron became `ChevronsUpDown` to hint the gesture.
- [x] **Real app icon** — replaced the Expo placeholder symbol with a branded mark: a white "H" whose
      crossbar is a heartbeat/ECG pulse, on an indigo gradient. Generated from SVG via
      `scripts/generate-icon.mjs` (+ `sharp` devDep) → icon, Android adaptive (fg/bg/mono), splash, favicon.
      iOS now uses the flat `icon.png` (dropped the placeholder `.icon` Composer bundle).
- [x] **Bug fixes (post-launch)** — (1) `DateField` calendar now always renders a full **6-week grid**, so the
      centered modal (and its ◀ ▶ arrows) no longer shifts up/down when a month has 4 vs 5 vs 6 weeks; (2)
      onboarding `finish()` resets the shell to **Dashboard** (`navStore.setSection`) so finishing setup after a
      data wipe no longer lands on Settings (navStore is in-memory, untouched by a wipe); (3) the onboarding
      **Health connect** step now backfills weight history immediately (matching Settings), instead of importing
      nothing until you later tapped the Settings Health button.

## Not built yet (planned)
- [ ] **Renpho tape on-device test** — built and the protocol is implemented, but the BLE connection is
      **untested against the physical tape** (emulator/simulator have no Bluetooth). Verify on a real device
      (live reading, the `S`/`P` confirm flag, and metric/imperial `x[18]` handling).
- [ ] **Server sync engine** — `lib/sync.ts` does a real **connection test** (Settings → Server
      backup); the full bidirectional push/pull must match the `apps/api` route contract and be
      validated against a running server. Schema is already sync-ready (localId/serverId/syncStatus).
- [ ] **Health on-device verification** — the providers are installed and wired (see Done → *Native Health
      activated*), but real reads (weight backfill, active energy, heart rate) still need validation on a
      physical iPhone (paid account for HealthKit auth) / Android with Health Connect. In Expo Go and the
      free-account HealthKit-stripped build, the seam returns `null` and the MET estimate is used.
- [ ] **Home Assistant add-on** — lives in the web/api repos, **not this mobile app**; expose
      `/api/health/stats` there for automations.
- [ ] **Apple home-screen widgets (native milestone)** — quick-action widgets: start the default
      routine, log weight, log a food/recipe, plus **user-configured quick-log buttons** (search a food
      in widget settings, pick it, give it a custom name — e.g. a daily protein shake). Requires a
      **WidgetKit extension** (Swift), an **App Group** to share a small read/quick-log store with the
      app, an **Expo config plugin** + dev/EAS build (no Expo Go), and **deep links** into the app for
      each action. Scoped as its own native track — keeps the JS feature work runnable in Expo Go.
- [ ] Richer trend visuals (gifted-charts), recipe edit, food Recipes "New" entry polish.
- [ ] **Better nutrition-label OCR engine** — the parser is now %DV/unit/added-sugars aware (see Done), but
      the engine is still Google ML Kit. If labels stay inconsistent, swap iOS to **Apple Vision** via
      `expo-text-extractor` (native dep + dev build; modest gain per research), and/or use ML Kit's per-line
      bounding boxes to pair labels↔values by position for multi-column labels.
- [ ] **OpenFoodFacts contribution** — let users submit/edit foods to the OFF open database. ToS allows it:
      register the app (API-usage form) + authenticate writes via the user's OFF login (session or creds;
      moving to OAuth/Keycloak); submitted data is **ODbL-licensed** (public). Add a submit/edit form + login,
      and offer it in the setup wizard. Needs a dev build to test.

## Future considerations
- [ ] **Expand the exercise catalog.** The bundled catalog is ~440 (the free `oss.exercisedb.dev`
      API's pagination is broken — filter fan-out caps reachable exercises at ~440). Options to grow it:
      (a) switch to the public-domain **free-exercise-db** (yuhonas, ~873 exercises, richer metadata,
      but **static images** instead of animated GIFs — would need the seed + `exerciseMedia.ts` remapped
      from `gifUrl` to image URLs); or (b) license the paid **ExerciseDB Pro** dataset (1500+ with GIFs).
      Decided to stay on the current 437 + GIFs for now.

## Known notes
- USDA food fallback is disabled on-device by default (would require embedding an API key).
- Exercise instructions come from ExerciseDB; `description`/`tips` are often empty there.
- One weigh-in per day (upsert by date), matching the web app.
