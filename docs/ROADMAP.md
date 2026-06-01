# Roadmap & Status

Honest status of the rebuild. **Update this when features land or plans change.**

## Done
- [x] Fresh Expo SDK 56 app (expo-router, TypeScript), dark-first theme from the design system.
- [x] Local-first SQLite data layer + repositories; `initDb` + exercise seed on launch.
- [x] Settings: metric/imperial, full profile, TDEE tool link, offline-demos download.
- [x] Food: daily log (calorie ring + macro bars), OFF search, barcode scan, custom foods.
- [x] Exercises: ~1500-exercise bundled catalog, library search/filter, detail with GIF demos,
      on-device GIF caching (per-view + bulk).
- [x] Workouts: empty/template start, active session (sets, ghost values, timer), finish →
      volume + Epley PR detection, history with PR badges, template builder.
- [x] Health: weight logging, 7/30/90-day stats + pace guidance, body measurements, TDEE calculator.
- [x] Dashboard: calorie ring, macros, weight + weekly change, quick actions.
- [x] Verified: `tsc --noEmit` clean; full `expo export` iOS bundle clean.

## Not built yet (planned)
- [ ] **Recipes UI** — `FoodRepo` has `createRecipe`/`getRecipes` with per-serving nutrition; no
      build/log screen yet.
- [ ] **Goal Phases & cycles UI** — `HealthRepo` supports phases and `resolveTargets` already reads
      the active phase; create/list/timeline screens are not built.
- [ ] **Charts** — weight trend, volume, per-exercise progress (use `react-native-gifted-charts`).
- [ ] **"How to hit it" suggestions** — MET-based activity options (`activities.ts` is ready).
- [ ] **Body-fat → goal-weight calculator** and body-composition trends.
- [ ] **Quick-add / recent foods polish**, edit-serving inline, per-meal quick add sheet.
- [ ] **Server sync** — wire a `sync.ts` against the existing `../../apps/api`; activate when
      `serverStore.serverUrl` is set. Schema is already sync-ready.
- [ ] **Home Assistant add-on** — package web + api; expose `/api/health/stats` for automations.
- [ ] **Apple Health** — HealthKit import (needs a config plugin + dev build).
- [ ] **Onboarding wizard**, dark/light toggle, haptics, drag-to-reorder template exercises.
- [ ] **Build pipeline** — first real EAS/Xcode `.ipa` + AltStore install (steps in README).

## Known notes
- USDA food fallback is disabled on-device by default (would require embedding an API key).
- Exercise instructions come from ExerciseDB; `description`/`tips` are often empty there.
- One weigh-in per day (upsert by date), matching the web app.
