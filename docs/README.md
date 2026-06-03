# FitSelf Mobile — Docs

FitSelf is a **local-first** health & fitness app built with Expo + React Native (SDK 56).
It's a fresh rebuild of the original React web PWA (`../../apps/web`), designed so that **all
data lives on the device** (SQLite) and **no server is required to use the app**. An optional
self-hosted server can be added later for backup and Home Assistant automations.

## Docs in this folder
- **README.md** (this file) — overview, setup, running, seeding, building.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — how the app is wired: data layer, stores, routing, theming, the two ported features (Open Food Facts search, ExerciseDB media).
- **[ROADMAP.md](./ROADMAP.md)** — what's built vs. what's still planned. Keep this current.

> **Keeping docs current:** after a change is made and reviewed/accepted, update the relevant
> doc here (and `../CLAUDE.md` if conventions change) before moving on. This is also stated in
> `../CLAUDE.md` so future sessions follow it.

## What's built today
- **Navigation shell**: top section switcher + contextual bottom nav with a center "+" multi-action
  FAB; sections have sub-tabs. A first-run **onboarding wizard** sets up the profile. Haptics throughout.
- **Local-first data layer**: SQLite (`src/lib/db.ts`) + repositories. Schema mirrors the server's
  Prisma models (`localId`/`serverId`/`syncStatus`) so a future sync stays 1:1.
- **Food**: per-day log (date nav) with calorie ring + macro bars; Open Food Facts search; barcode
  scanning; custom foods; tap-to-edit servings; a bundled **base-ingredient database** (~95 common
  whole foods, offline); **recipes** (builder + log serving); calorie **trends** (7/30/90d); nutrition **goals**.
- **Exercises**: open-source ExerciseDB catalog (~440 unique) bundled + imported on first launch;
  grouped/searchable library; **create custom exercises**; detail with animated GIF demos cached for offline.
- **Workouts**: routines (create/edit/default + auto-rotation), templates (reorderable builder with
  **drag-to-superset** via a chain handle), redesigned **active set logger** (ghost values, **per-set**
  rest timers, set-complete animation + auto-scroll to the active set, per-exercise notes, custom numpad),
  **supersets** (with a ≥2-member integrity rule), **post-workout summary** (liquid-wave animation),
  history + calendar, and a **Stats** page (volume — counting two-arm **dumbbell work ×2** — PRs,
  per-exercise reports + compare, muscle heatmap).
- **Health**: weight logging + trend chart + pace guidance with **MET activity suggestions**; body
  composition (BF%/lean/fat/BMI/FFMI) with **body-fat estimation** (lean-mass-from-DEXA-baseline **and**
  the **U.S. Navy tape method**); measurements — incl. a **Renpho smart tape measure (Bluetooth)** flow
  with a body-diagram guide; weight **goals** + **goal phases/cycles**; TDEE.
- **Settings**: units, full profile, **profile picture** (photo library), offline-demo download,
  **server backup** (connection test), **Health integration** (Apple Health / Health Connect seam).
- **Consistent UX**: swipe-left-to-delete with confirmation on user logs; haptics throughout.
- **Dashboard**: Overview (ring, macros, weekly chart, weight + ETA, pace alert, recent workouts) +
  a **Goals** master list grouped by section.

See **[ROADMAP.md](./ROADMAP.md)** for what's intentionally not built yet (runtime dark/light theme,
the full server-sync engine, native Health activation, Home Assistant add-on).

## Prerequisites
- Node 20+ (developed on Node 26), npm.
- For iOS device builds: macOS + Xcode, and an Apple ID (free is fine for sideloading).
- **For Android builds: JDK 17** (set `JAVA_HOME` to it). The native build fails on JDK 24/25 — see
  *Building & deploying*. Android Studio SDK with `ANDROID_HOME` set; `android/local.properties` holds `sdk.dir`.
- Bluetooth features (Renpho tape) need a **dev build on a physical device** — no emulator/simulator has Bluetooth.
- Nutrition-label OCR (`@react-native-ml-kit/text-recognition`) and local notifications
  (`expo-notifications`) are native modules — they link via `expo prebuild` and need a **dev build** (not
  Expo Go); both no-op gracefully in Expo Go. The reminder **banner** still works everywhere.
- We only use **local** notifications, so `plugins/withoutPushEntitlement.js` strips the `aps-environment`
  push entitlement that prebuild's bundled `expo-notifications` plugin adds. **Push Notifications is the one
  capability a personal/free Apple team can never sign** (paid or not), so stripping it lets the normal
  `npm run ios` build sign on a personal team. Android gets `POST_NOTIFICATIONS` from the module's manifest.
  (HealthKit signing is a separate concern — see the `HEALTHKIT=0` notes below.)

## Running in development
```bash
cd mobile
npm install
npx expo start            # then open in Expo Go, or press i for a simulator
```
For features that need native modules beyond Expo Go (camera, file system), use a dev build:
```bash
npx expo run:ios          # builds + installs a dev client on a simulator/device
```

## Verifying without a device
```bash
npx tsc --noEmit                                   # types
npx expo export --platform ios --output-dir /tmp/x # full Metro bundle (catches import errors)
```

## Seeding the exercise catalog
The bundled catalog (`assets/exercises/catalog.json`, ~440 unique exercises) was generated from the
free, no-key open-source ExerciseDB (https://oss.exercisedb.dev). To refresh it or bundle GIFs offline:
```bash
node scripts/seed-exercises.mjs              # refresh catalog.json (GIFs stay as CDN URLs, cached on first view)
node scripts/seed-exercises.mjs --download   # also download every GIF + generate gifMap.ts (full offline, bigger app)
```
> Note: the public `/exercises` list endpoint is broken for pagination (offset/page/cursor are all
> ignored — it only returns the first 25, which caused an earlier duplicate-bloated catalog). The
> generator instead fans out across the `bodyParts` / `equipments` / `muscles` filters and dedups by
> `exerciseDbId`. The app's seed (`src/lib/exerciseSeed.ts`) self-heals duplicated/stale databases.
GIF URLs are public CDN links (`static.exercisedb.dev`), so even without `--download` the app caches
each GIF to the device the first time it's viewed, and Settings → "Download exercise demos" caches
them all in bulk.

## Building & deploying (iOS + Android)
Native folders (`ios/`, `android/`) are git-ignored and generated on demand. Build profiles live in
`eas.json` (**development** = dev client, **preview** = internal apk/ipa, **production** = store
bundle). The app targets both platforms (bundle/package id `com.zanderhalverson.fitself`).

**Cloud (EAS) — recommended, cross-platform:**
```bash
npm i -g eas-cli && eas login
eas build --profile development --platform ios       # or android — installable dev client
eas build --profile preview     --platform android   # internal .apk (sideload-friendly)
eas build --profile preview     --platform ios        # ad-hoc .ipa (AltStore)
eas build --profile production  --platform android    # .aab for Play
eas build --profile production  --platform ios         # App Store build
```

**Local:**
```bash
npx expo run:ios                      # regenerates native + installs a dev build (full app, incl. HealthKit)
JAVA_HOME=<jdk17> npx expo run:android # Android MUST build under JDK 17 (default JDK 25 fails native CMake)
```
iOS sideload: sign with a free Apple ID in Xcode, Archive → ad-hoc `.ipa`, then **AltStore** (re-signs
every 7 days on the same Wi-Fi). Android: install the `preview` `.apk` directly.

**HealthKit-free iOS build (free Apple ID).** HealthKit's entitlement needs a *paid* developer account
and otherwise blocks signing. A dynamic config (`app.config.js`) strips it when `HEALTHKIT=0`, so you can
sideload to a personal device on a free account (e.g. to test the Bluetooth tape):
```bash
npm run prebuild:ios:free    # HEALTHKIT=0 expo prebuild -p ios --clean  (no HealthKit entitlement)
# first time: open ios/FitSelf.xcworkspace → target → Signing & Capabilities → Team = your Personal Team
npm run ios:free             # HEALTHKIT=0 expo run:ios --device
```
Free-provisioning caveats: needs a Mac + Xcode; the app expires after ~7 days (just rerun); HealthKit
features are inert in this build (`lib/health.ts` no-ops). Build the default (no flag) once you have a
paid account to get HealthKit back. **Bluetooth needs a physical device** either way.

## Optional integrations
- **Server backup**: Settings → "Server backup & sync" sets a self-hosted FitSelf server URL/token
  and tests the connection (`lib/sync.ts`). The full two-way sync engine is on the roadmap.
- **Health (cross-platform)**: Settings → "Health" exposes the `lib/health.ts` seam. To activate,
  add the provider libs in a native build — `@kingstinct/react-native-healthkit` (iOS / Apple Health)
  and `react-native-health-connect` (Android / Health Connect) — wire them into the `HealthService`
  implementation, add the required config plugins + permissions, then `eas build` / `expo prebuild`.
- **Active calories**: Settings → "Health" → **Add active calories to budget** picks the eat-back source
  — Off / Automatic / Watch only / In-app only. Watch/Automatic read whole-day active energy from Apple
  Watch / Health Connect and only resolve in a native/dev build (same activation as above); in Expo Go
  Automatic falls back to the app's MET workout estimate. Automatic avoids double-counting by only adding
  the app estimate for workout windows the watch didn't track.
- **Renpho smart tape measure (Bluetooth)**: Health → Measurements → **"Measure with Renpho tape"** scans
  for the RF-BMF01 (`ES_TAPE`), connects, and streams live circumferences into the selected body part —
  which feed the U.S. Navy body-fat estimate. Implemented in `lib/renphoTape.ts` (`react-native-ble-plx`,
  reverse-engineered protocol). Requires a **dev build + a physical device** (no Bluetooth on
  emulators/simulators); no paid Apple account needed for Bluetooth itself.
