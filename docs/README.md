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
- **Local-first data layer**: SQLite (`src/lib/db.ts`) + repositories. Schema mirrors the server's
  Prisma models (`localId`/`serverId`/`syncStatus`) so a future sync stays 1:1.
- **Food**: daily log with calorie ring + macro bars; Open Food Facts search (popularity-sorted,
  junk-filtered); barcode scanning (expo-camera); custom foods.
- **Exercises**: the full open-source ExerciseDB catalog (~1500 exercises) bundled and imported on
  first launch; library search/filter; detail screen with animated GIF demos that cache to the
  device for offline use.
- **Workouts**: start empty or from a template; active session with set logging, previous-session
  "ghost" values, and a timer; finish → volume + Epley 1RM personal-best detection; history.
- **Health**: weight logging + 7/30/90-day trend stats and pace guidance; body measurements;
  standalone TDEE calculator.
- **Settings**: metric/imperial toggle, full profile (drives the calorie/macro engine), and a
  "download all exercise demos for offline" action.
- **Dashboard**: calorie ring, macro bars, weight + weekly change, quick actions.

See **[ROADMAP.md](./ROADMAP.md)** for what's intentionally not built yet (recipes UI, goal-phase
UI, charts, server sync wiring, Apple Health).

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
The bundled catalog (`assets/exercises/catalog.json`, ~1500 exercises) was generated from the free,
no-key open-source ExerciseDB (https://oss.exercisedb.dev). To refresh it or bundle GIFs offline:
```bash
node scripts/seed-exercises.mjs              # refresh catalog.json (GIFs stay as CDN URLs, cached on first view)
node scripts/seed-exercises.mjs --download   # also download every GIF + generate gifMap.ts (full offline, bigger app)
```
GIF URLs are public CDN links (`static.exercisedb.dev`), so even without `--download` the app caches
each GIF to the device the first time it's viewed, and Settings → "Download exercise demos" caches
them all in bulk.

## Building for iOS + sideloading with AltStore
Native folders (`ios/`, `android/`) are git-ignored and generated on demand.

**Local (Xcode):**
```bash
npx expo prebuild --platform ios     # generates ios/
npx expo run:ios                     # or open ios/FitSelf.xcworkspace in Xcode
```
In Xcode: sign with your free Apple ID, set bundle id `com.zanderhalverson.fitself`, Archive →
export an ad-hoc `.ipa`.

**Cloud (EAS):**
```bash
npm i -g eas-cli && eas login
eas build --platform ios --profile preview   # configure a non-store/ad-hoc profile to get an .ipa
```

**Sideload:** install AltServer (altstore.io) on your Mac, install AltStore on the iPhone over USB,
then add the `.ipa` in AltStore. It re-signs every 7 days automatically while on the same Wi-Fi.
