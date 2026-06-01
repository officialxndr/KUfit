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
- **Workouts**: routines (create/edit/default + auto-rotation), templates (reorderable builder),
  redesigned **active set logger** (ghost values, per-set rest timers, per-exercise notes & rest
  config, custom numpad), **post-workout summary** (liquid-wave animation), history with month
  navigator + calendar + delete, and a **Stats** page (volume, PRs, per-exercise reports + compare,
  and an anatomical **muscle heatmap**).
- **Health**: weight logging + trend chart + pace guidance with **MET activity suggestions**; body
  composition (BF%/lean/fat/BMI/FFMI); measurements; weight **goals** + **goal phases/cycles**; TDEE.
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
npx expo run:ios        # or: npx expo run:android   (regenerates native + installs a dev build)
```
iOS sideload: sign with a free Apple ID in Xcode, Archive → ad-hoc `.ipa`, then **AltStore** (re-signs
every 7 days on the same Wi-Fi). Android: install the `preview` `.apk` directly.

## Optional integrations
- **Server backup**: Settings → "Server backup & sync" sets a self-hosted FitSelf server URL/token
  and tests the connection (`lib/sync.ts`). The full two-way sync engine is on the roadmap.
- **Health (cross-platform)**: Settings → "Health" exposes the `lib/health.ts` seam. To activate,
  add the provider libs in a native build — `@kingstinct/react-native-healthkit` (iOS / Apple Health)
  and `react-native-health-connect` (Android / Health Connect) — wire them into the `HealthService`
  implementation, add the required config plugins + permissions, then `eas build` / `expo prebuild`.
