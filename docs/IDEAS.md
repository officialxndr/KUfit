# Ideas & Improvement Proposals

Proposed (not yet built) product work, captured from a deep-dive of the codebase. These are the
genuine gaps that remain after the large "Done" list in [ROADMAP.md](ROADMAP.md) — the roadmap's
own "Not built yet" items are mostly native-verification/infra chores, so these focus on new
product value. Each reuses existing repos, calc-lib patterns, and components.

Conventions to honor when any of these are built: stored units stay metric (convert at the display
edge via `lib/units.ts`); DB access stays inside repos; schema changes use the forward-only
`ensureColumn` pattern in `db.ts`; new UI gates animation on `useMotion()`; move landed items to
[ROADMAP.md](ROADMAP.md) → Done and update [ARCHITECTURE.md](ARCHITECTURE.md) + `CLAUDE.md`.

---

## Theme A — Faster daily logging

Reduce friction on the two most frequent actions: logging food and loading a barbell.

> **A1 Copy meal/day, A3 Quick-add calories, and A5 Saved meals shipped** — see ROADMAP → Done.

### A2. Plate & warmup calculator  *(pure lib; ships via `eas update`)*
Given a target working weight, show the per-side plate breakdown and an optional warmup ramp.
- New pure `src/lib/plates.ts`: `platesForWeight(targetKg, barKg, availablePlatesKg[], perSide)`
  (greedy breakdown + remainder) and `warmupRamp(targetKg, bar)`. Unit-agnostic.
- UI: a `BottomSheet` from a set row's weight cell in `src/app/session.tsx` and the exercise detail
  page. Available plates + default bar on `settingsStore` (`profile.barbellKg`,
  `profile.availablePlatesKg`), defaulted by unit system.
- Reuse: `components/BottomSheet.tsx`, `lib/units.ts`.

### A4. Water / hydration tracking  *(new table + small UI)*
Tap-to-add water with a daily goal ring; absent entirely today.
- New `water_logs` table (`localId, date, amountMl, time, syncStatus, deleted` — sync-ready
  convention). New `src/lib/repositories/WaterRepo.ts` (`addWater`, `getDayMl`, `getRangeMl`,
  `deleteWater`). Goal + unit on `settingsStore` (`profile.waterGoalMl`, reuse `unitSystem`).
- UI: a compact water card on `src/screens/FoodToday.tsx` with quick +250 ml / +1 cup; "Log water"
  in the Food FAB. Add a **hydration reminder type** to the existing `remindersStore` /
  `lib/reminders.ts` (same shape as food/weight/workout/measure).
- Reuse: `remindersStore`, `lib/reminders.ts`, `lib/units.ts`, the `CalorieRing` ring style.

---

## Theme B — Smarter training

Turn the data the app already stores into guidance.

### B1. Progressive-overload suggestions  *(pure lib; highest training payoff)*
An active recommendation ("last time 3×8 @ 100 lb — try 102.5, or 4×8") instead of only showing
previous numbers. The data is already queryable.
- New pure `src/lib/progression.ts`: a **double-progression** model — last session's sets
  (`getLastSetsForExercise`) + the template's rep target/range → all sets at top of range ⇒ +1
  weight increment & reset reps to bottom; else repeat/add a rep. Optional %-of-1RM mode via
  `getBestEpleyForExercise` + `lib/epley.ts`.
- UI: a dismissible suggestion chip on the exercise card in `src/app/session.tsx` (next to ghost
  values); prefill the suggested weight in `WorkoutRepo.buildLocalExercisesFromTemplate`
  (`WorkoutRepo.ts:694`). Keep dismissible (mirror the `showCoachingNudges` philosophy).
- Reuse: `getLastSetsForExercise`, `getBestEpleyForExercise`, `lib/epley.ts`, `lib/load.ts`.

### B2. Optional RPE / RIR logging + autoregulation  *(activate a dead column)*
Make the persisted-but-unused `rpe` column real, and feed it into B1. **No schema change** —
`exercise_sets.rpe` already exists (`db.ts:183`) and is written by `WorkoutRepo.finishSession`
from `sessionStore` (currently always null; see `sessionStore.ts:248`, `WorkoutRepo.ts:462`/`:587`).
- Add an optional RPE/RIR input to set entry in `src/app/session.tsx` (a chip on the set row or an
  extra numpad step), gated behind a new `settingsStore` toggle (`profile.logRpe`, default off, so
  nothing changes for current users). Show logged RPE on the summary/history.
- Then let `lib/progression.ts` size the jump from RPE (e.g. last top set ≤ RPE 7 ⇒ bigger increment).

### B3. Exercise substitution ("Swap")  *(picker reuse)*
Swap an exercise mid-session/template for a similar one without losing your place.
- "Swap" on the exercise kebab opens `src/app/exercises.tsx` in pick mode **pre-filtered to the
  same primary muscle** (optionally equipment) via `searchExercises(q, muscle, equipment)`; on pick,
  replace in `sessionStore` / `templateDraftStore` preserving set rows + superset position (route
  through `normalizeSupersets`).
- Reuse: `WorkoutRepo.searchExercises`, the picker pick-mode, `exercises.musclesPrimary`,
  `lib/supersets.ts`.

---

## Recommended build order (quick wins → heavier)

*(A1 copy meal/day, A3 quick-add calories, A5 saved meals — shipped.)*

1. **A2 plate/warmup calc** + **B1 progression** — pure libs, unit-testable, ship via `eas update`.
2. **B2 RPE logging** (session UI) → upgrades B1 to autoregulation.
3. **B3 exercise swap** — picker reuse.
4. **A4 water tracking** — new table; small UI.

Each is independent and individually shippable; A2/B1 carry no native-build cost.

---

## Other confirmed gaps (deep-dive notes, not yet scoped)

Captured so the research isn't lost; not part of the chosen themes above.

- **Apple Health / Health Connect write-back** — `lib/health.ts` only *reads*; logged weight and
  workouts never flow back to Apple Health. The seam is already structured to extend with writes.
- **Progress-photo timeline** — absent. `lib/avatar.ts` already has the exact pick → copy-to-
  document-dir → persist-URI pattern to reuse (+ a small table).
- **Siri Shortcuts / App Intents** — none. Quick "log weight" / "start workout" voice/Shortcuts
  actions (native; relates to the planned quick-log widgets in ROADMAP).
- **Unified streaks/consistency** — only Food has a streak; Workout & Health have no equivalent.
- **Steps / sleep / resting-HR display** — `health.ts` even requests StepCount read permission but
  exposes no getter; could surface as activity context.
