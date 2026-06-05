# Hale Mobile — Docs

Hale is a **local-first** health & fitness app built with Expo + React Native (SDK 56).
It's a fresh rebuild of the original React web PWA (`../../apps/web`), designed so that **all
data lives on the device** (SQLite) and **no server is required to use the app**. An optional
self-hosted server can be added later for backup and Home Assistant automations.

## Docs in this folder
- **README.md** (this file) — overview, setup, running, seeding, building.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — how the app is wired: data layer, stores, routing, theming, the two ported features (Open Food Facts search, ExerciseDB media).
- **[ROADMAP.md](./ROADMAP.md)** — what's built vs. what's still planned. Keep this current.
- **[LAUNCH.md](./LAUNCH.md)** — go-to-market reference: App Store/Play deployment, pre-submission checklist, marketing, listing copy, store analytics, and the donation setup.
- **[PRIVACY.md](./PRIVACY.md)** — the privacy policy (host this at a public URL for App Store / Play review).

> **Keeping docs current:** after a change is made and reviewed/accepted, update the relevant
> doc here (and `../CLAUDE.md` if conventions change) before moving on. This is also stated in
> `../CLAUDE.md` so future sessions follow it.

## What's built today
- **Navigation shell**: top section switcher + contextual bottom nav with a center "+" multi-action
  FAB; sections have sub-tabs. A first-run **onboarding wizard** sets up the profile (units, height in ft/in
  or cm, a year → month → day birthday picker, and a **Preferences** step: confetti preview, U.S. Navy
  body-fat, active-calorie source). Haptics throughout.
- **Local-first data layer**: SQLite (`src/lib/db.ts`) + repositories. Schema mirrors the server's
  Prisma models (`localId`/`serverId`/`syncStatus`) so a future sync stays 1:1.
- **Food**: per-day log (date nav) with calorie ring + macro bars; Open Food Facts search; barcode
  scanning; **on-device nutrition-label OCR** (snap a label to auto-fill a food); custom foods;
  tap-to-edit servings; a bundled **base-ingredient database** (~95 common whole foods with full
  OFF-style detail, offline); **recipes** (builder + log serving); a date-range **Stats** tab
  (calorie/macro/nutrient trends over Week/Month/3 Mo/Year or any custom range); nutrition **goals**.
- **Exercises**: open-source ExerciseDB catalog (~1,500 with GIFs) bundled + imported on first launch;
  grouped/searchable library; **create + delete your own exercises** (a "My exercises" group); detail with
  animated GIF demos cached for offline, and per-exercise **logging defaults** (per-arm, load counting).
- **Workouts**: routines (create/edit/default + auto-rotation), templates (reorderable builder with
  **drag-to-superset** via a chain handle), redesigned **active set logger** (ghost values, a **"Use
  previous"** key, **per-set** rest timers with a countdown bar, set-complete animation + auto-scroll,
  per-exercise notes, custom numpad), **supersets** (≥2-member integrity rule), **cable attachments** and
  **per-arm (L/R) sets** (each tracked separately), **post-workout summary** (liquid-wave animation),
  history + calendar, and a **Stats** page (volume — two-arm **dumbbell work ×2** — PRs, per-exercise
  reports + compare, muscle heatmap) — driven by the shared **date-range** selector.
- **Health**: weight logging + trend chart + pace guidance with **MET activity suggestions**; body
  composition (BF%/lean/fat/BMI/FFMI) with **body-fat estimation** (lean-mass-from-DEXA-baseline **and**
  the **U.S. Navy tape method**); measurements — incl. a **Renpho smart tape measure (Bluetooth)** flow
  with a body-diagram guide; weight **goals** (by scale weight **or target body-fat %**) + **goal
  phases/cycles**; **TDEE / maintenance** is built into the Goals editor (Nutrition group).
- **Settings**: units, full profile, **profile picture**; **appearance themes** (charcoal/slate/mocha/
  light + custom accent); **reminders** (per-reminder schedules → local notifications + dashboard banners);
  **motion** toggles; **Help → replay the guided tour**; offline-demo download; **server backup**
  (connection test); **Health integration** (Apple Health / Health Connect seam). A hidden **dev menu**
  (tap the version footer 7×) seeds realistic demo data for screenshots.
- **Dashboard**: Overview (ring, macros, weekly chart, weight + ETA, pace alert, recent workouts) + a
  cross-domain **Reports** digest (Nutrition / Training / Weight & body / Goals over any date range). The
  goal editor opens from the header gear on every section.
- **iOS widgets**: **four** WidgetKit/SwiftUI widgets users can pick — **Food** (calorie ring + macros +
  weight/body-fat), **Workout** (next/last workout + this-week sessions/sets/volume + sparkline), **Health**
  (weight, body-fat %/lean/fat, trend), and a combined **Overview** (all three; Medium + Large). Food/
  Workout/Health support Small + Medium home screen + Circular/Rectangular/Inline lock-screen. Home
  widgets are **themed by the in-app appearance** (accent + colors). Built with `@bacons/apple-targets`
  (`targets/widget/`); the app pushes a snapshot to a shared App Group via `src/lib/widget.ts`. Native —
  ships with a dev/prod build, not Expo Go / EAS Update.
- **Workout Live Activity**: a **Lock Screen + Dynamic Island** activity while a workout is in progress —
  current exercise, sets done/total, a self-ticking elapsed/rest timer, and volume, themed to match the app.
  ActivityKit lifecycle in a local Expo native module (`modules/hale-live-activity/`) driven by
  `src/lib/liveActivity.ts` + `sessionStore`. iOS 16.2+; native (dev/prod build).
- **Motion & onboarding**: app-wide animation (screen transitions, count-up numbers, animated rings/charts,
  press feedback, confetti on PRs/goal-weight) — all behind the OS Reduce-Motion setting + a Settings
  toggle. First-run **onboarding wizard** plus a **guided feature tour** — pick a **Basic** or **Advanced**
  walkthrough (or replay just one section) that walks the real screens.
- **Consistent UX**: swipe-left-to-delete with confirmation on user logs; pull-to-refresh; haptics throughout.
- **Feedback**: Settings → Feedback (and a once-per-version What's-New sheet) with **bug + feature-request**
  forms that email the developer (no server) and keep a local history; beta bug reports also use TestFlight's
  native screenshot feedback.

See **[ROADMAP.md](./ROADMAP.md)** for what's intentionally not built yet (on-device verification of
Health & the Renpho tape, the full server-sync engine, the Home Assistant add-on, native home-screen widgets).

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
The bundled catalog (`assets/exercises/catalog.json`, ~1,500 exercises) was generated from the
free, no-key open-source ExerciseDB (https://oss.exercisedb.dev). To refresh it or bundle GIFs offline:
```bash
node scripts/seed-exercises.mjs              # refresh catalog.json (GIFs stay as CDN URLs, cached on first view)
node scripts/seed-exercises.mjs --download   # also download every GIF + generate gifMap.ts (full offline, bigger app)
```
> Note: the `/exercises` list endpoint pages via **`after=<nextCursor>`** — the only working pager
> (`cursor`/`offset`/`page`/`limit` are silently ignored, which had capped an earlier fan-out version at
> ~440). The generator walks `after` to pull all ~1500 with GIFs, then a cleanup pass normalizes
> names/categories/equipment and **de-bakes** cable-attachment names (`scripts/lib-debake.mjs`, only when
> the cleaned name stays unique). The app's seed (`src/lib/exerciseSeed.ts`) reseeds when empty,
> duplicate-bloated, stale, or the `SEED_VERSION` changes — upserting **in place** by `exerciseDbId` so
> localIds (and user perSide/unilateral/leadSide overrides) survive.
GIF URLs are public CDN links (`static.exercisedb.dev`), so even without `--download` the app caches
each GIF to the device the first time it's viewed, and Settings → "Download exercise demos" caches
them all in bulk.

## App icon
The icon (a white "H" with a heartbeat/ECG crossbar on an indigo gradient) is generated from SVG, so
it's vector-crisp and easy to tweak — edit the constants/colors in `scripts/generate-icon.mjs` and re-run:
```bash
node scripts/generate-icon.mjs   # rasterizes icon + Android adaptive (fg/bg/mono) + splash + favicon (needs the `sharp` devDependency)
```
iOS uses the flat `assets/images/icon.png` (the old Expo Icon Composer `.icon` bundle was removed). Icon
changes are **native** — they only appear after an `expo prebuild` / new build, not via Fast Refresh or EAS Update.

## Building & deploying (iOS + Android)
Native folders (`ios/`, `android/`) are git-ignored and generated on demand. Build profiles live in
`eas.json` (**development** = dev client, **preview** = internal apk/ipa, **production** = store
bundle). The app targets both platforms (bundle/package id `com.zanderhalverson.hale`).

**Cloud (EAS) — recommended, cross-platform:**
```bash
npm i -g eas-cli && eas login
eas build --profile development --platform ios       # or android — installable dev client
eas build --profile preview     --platform android   # internal .apk (sideload-friendly)
eas build --profile preview     --platform ios        # ad-hoc .ipa (AltStore)
eas build --profile production  --platform android    # .aab for Play
eas build --profile production  --platform ios         # App Store build
```

> **iOS TestFlight — current ship path (live since 2026-06-03):** we build **locally** —
> `eas build -p ios --profile production --local` (needs `fastlane`: `brew install fastlane`) →
> `eas submit -p ios --profile production --path hale.ipa`. Hale is on App Store Connect (app `6776380902`);
> submit is non-interactive (stored ASC API key) and build numbers auto-increment. `expo-updates` is wired,
> so JS-only changes can ship via `eas update` (OTA) without a new build. A first `--local` archive can fail
> transiently — re-run. Full deploy reference: **[LAUNCH.md](./LAUNCH.md)**.

**Local:**
```bash
npx expo run:ios                      # regenerates native + installs a dev build (full app, incl. HealthKit)
JAVA_HOME=<jdk17> npx expo run:android # Android MUST build under JDK 17 (default JDK 25 fails native CMake)
```
> Local `expo run:*` builds are the **`Hale Dev`** variant (bundle `…hale.dev`), so they install **alongside**
> the TestFlight `Hale` and are easy to tell apart. The suffix comes from `APP_VARIANT` in `app.config.js`
> (the production EAS profile sets it via `eas.json`).

iOS sideload: sign with a free Apple ID in Xcode, Archive → ad-hoc `.ipa`, then **AltStore** (re-signs
every 7 days on the same Wi-Fi). Android: install the `preview` `.apk` directly.

**HealthKit-free iOS build (free Apple ID).** HealthKit's entitlement needs a *paid* developer account
and otherwise blocks signing. A dynamic config (`app.config.js`) strips it when `HEALTHKIT=0`, so you can
sideload to a personal device on a free account (e.g. to test the Bluetooth tape):
```bash
npm run prebuild:ios:free    # HEALTHKIT=0 expo prebuild -p ios --clean  (no HealthKit entitlement)
# first time: open ios/Hale.xcworkspace → target → Signing & Capabilities → Team = your Personal Team
npm run ios:free             # HEALTHKIT=0 expo run:ios --device
```
Free-provisioning caveats: needs a Mac + Xcode; the app expires after ~7 days (just rerun); HealthKit
features are inert in this build (`lib/health.ts` no-ops). Build the default (no flag) once you have a
paid account to get HealthKit back. **Bluetooth needs a physical device** either way.

## Optional integrations
- **iOS widget** (`@bacons/apple-targets`): the home/lock-screen widget target lives in `targets/widget/`
  (`index.swift` + `expo-target.config.js`) and is generated into the Xcode project by `expo prebuild`, so
  `ios/` stays disposable (generated `Info.plist`/`Assets.xcassets`/`generated.entitlements` are git-ignored).
  It reads a JSON snapshot the app writes to the App Group `group.com.zanderhalverson.hale` (`src/lib/widget.ts`).
  Needs **Xcode 16+ and a paid Apple team** (App Groups can't be signed by a free team) and `ios.appleTeamId`
  set in `app.json`. Test with `npx expo prebuild -p ios --clean` → `expo run:ios --device`; EAS production
  builds include it automatically.
- **Server backup**: Settings → "Server backup & sync" sets a self-hosted Hale server URL/token
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
