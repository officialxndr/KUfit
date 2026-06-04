# Hale Mobile (Expo / React Native)

Local-first health & fitness app. Fresh Expo SDK 56 rebuild of the original React web PWA
(`../apps/web`). **All data lives on-device in SQLite** — no server is required. An optional
self-hosted server (the existing `../apps/api`) can later be wired in for backup + Home
Assistant automations via the sync layer (`serverStore` is null by default).

> Display name is **Hale** (`com.zanderhalverson.hale`), renamed from "FitSelf". The codebase keeps the
> original `fitself` internally — SQLite file `fitself.db` and Zustand persist keys `fitself-*` — to preserve
> existing on-device data, so **don't rename those**. (`backup.ts` import still accepts the old `app:'FitSelf'`
> marker.) The `FitSelf Design System/` folder is the original web app kept as design reference — leave its name.

> Before using any Expo module, check the versioned docs: https://docs.expo.dev/versions/v56.0.0/
> Expo APIs change between versions (e.g. `expo-file-system` split out a `/legacy` API).

## Architecture
- **Navigation shell**: `src/navigation/` — the main app area is one custom screen (`AppShell`),
  not a tab bar: a top section switcher (`AppHeader`) + contextual bottom bar (`BottomNav`) with a
  center "+" multi-action FAB (`QuickActionsSheet`), all driven by `config.ts`. `(tabs)/index.tsx`
  just renders `AppShell`.
- **Screens**: section bodies are content fragments in `src/screens/*` (no `Screen` wrapper — the
  shell owns the scroll/header/bottom bar). Standalone routes/modals stay in `src/app/**`
  (expo-router, file-based).
- **State**: Zustand in `src/stores/` (`settingsStore` = local user profile; `navStore` = shell
  section/sub-tab; `sessionStore`/`templateDraftStore` = active workout / template builder;
  `routineStore` = workout routines; `serverStore` = optional server; `remindersStore` = per-reminder
  schedules; `themeStore` = appearance; `refreshStore` = pull-to-refresh signal; `tourStore` = guided
  feature tour; `devStore` = hidden developer mode; `donationStore` = optional-donation prompt state).
- **Data**: `src/lib/db.ts` (SQLite schema, mirrors the server Prisma models with
  `localId`/`serverId`/`syncStatus` for future sync) + `src/lib/repositories/{Food,Health,Workout}Repo.ts`.
  Repos are the only thing that touches the DB. Mutations mark rows `syncStatus='pending'`.
- **Calc libs** (pure TS): `tdee.ts`, `epley.ts`, `activities.ts`, `units.ts`, `targets.ts`,
  `supersets.ts` (superset ordering + `normalizeSupersets`), `bodyComposition.ts` (body-fat estimate +
  U.S. Navy method), `load.ts` (per-side dumbbell volume factor).
- **Bluetooth**: `src/lib/renphoTape.ts` — Renpho RF-BMF01 tape (`react-native-ble-plx`); the
  `useRenphoTape()` hook drives `components/TapeMeasureView.tsx` (opened from `measurements.tsx`).
- **Nutrition-label OCR**: `src/lib/nutritionOcr.ts` — on-device ML Kit text recognition
  (`@react-native-ml-kit/text-recognition`); `parseNutritionText` is the pure parser. Drives the
  "Scan nutrition label" action in `custom-food.tsx`. Needs a dev build (native; no Expo Go).
- **Reminders/notifications**: `remindersStore` + `src/lib/reminders.ts` (schedules `expo-notifications`)
  + pure `src/lib/reminderStatus.ts` (Dashboard banner due-logic). Managed in `src/app/reminders.tsx`
  (Settings → Notifications & reminders). Notifications need a dev build; banners work in Expo Go.
- **Stats / date windows**: Dashboard → Reports and each section's far-right **Stats** tab
  (`FoodTrends` / `WorkoutStats` / `HealthTrends`) share `src/lib/useDateRange.ts` +
  `components/DateRangeBar.tsx` (segmented Week/Month/3 Mo/Year + ‹ › paging + custom range + Today) and
  recompute every metric for the selected window. `FoodRepo.getRangeNutrition` is the shared nutrition aggregate.
- **Onboarding & tour**: first run → `src/app/onboarding.tsx` (6 steps: welcome/units, a **privacy promise**,
  profile (ft/in height + cascade birthday), activity, goal, and a **Preferences** step — confetti preview,
  Navy toggle, active-calorie source, optional **Health connect**); then a **tour chooser** (`TourMenu`)
  offering a **Basic** or **Advanced** **guided feature tour** (or a single section's tour on replay) that
  drives the real screens (`components/FeatureTour.tsx` + `tourStore` + `src/lib/tourSteps.ts` — steps grouped
  into pages + `advanced` flag, resolved by `tourStepsFor(tier, pageKey?)`). Replay from
  Settings → Help. Hidden **dev tools** (tap the Settings version footer 7× → `devStore`) reveal a
  demo-data seeder (`src/lib/demoSeed.ts`: Load / Clear) that fills realistic activity for screenshots.
- **Feedback**: `src/app/feedback.tsx` (bug + feature forms) → `src/lib/feedback.ts` emails the report
  (mailto, **no server**) with auto diagnostics, and saves it via `FeedbackRepo` (`feedback` table, with
  sync-ready columns for a future community-voting board). `components/WhatsNew.tsx` shows a
  once-per-`WHATS_NEW_VERSION` "what to test" sheet (tracked in `app_meta`); **bump `WHATS_NEW_VERSION` in
  `feedback.ts` each beta**. Beta bug reports also lean on **TestFlight's native screenshot/crash feedback**.
- **Donations** (optional, never required): `lib/support.ts` (Ko-fi link, opened in the browser — no IAP) +
  `donationStore` (snooze ~30d / dismiss forever) drive a final onboarding step, the Dashboard
  `DonationBanner`, and Settings → Support Hale (donate card sits at the bottom of Settings).
- **Multi-add exercises**: the picker (`app/exercises.tsx`) multi-selects when opened with `?pick=template`
  / `?pick=session` — numbered in pick order, then "Add N"; plain `/exercises` browses (tap → detail).
- **Design**: `src/theme/tokens.ts` + `src/theme/text.ts` (ported from `../FitSelf Design System/colors_and_type.css`).
  Dark-first, one indigo accent (`#6366f1`), flat, lucide icons, no emoji in UI chrome.
- **UI kit**: `src/components/ui/index.tsx` (Screen, Card, Button, Badge, Chip, FsText, SectionHeader).

## Conventions
- Stored units are **metric** (kg, cm). Convert at the display edge with `lib/units.ts`.
- Screens read from repos in a `useFocusEffect(refresh)` callback so data refreshes on tab focus.
- Calorie/macro targets resolve via `resolveTargets(profile)` (active GoalPhase → profile → TDEE).
- Native dirs (`ios/`, `android/`) are git-ignored and regenerated via `expo prebuild` / EAS.
- **DB connection**: open with `{ useNewConnection: true }` (don't revert) — the shared connection's
  dev-tools registration tears the native handle down in dev → black-screen `prepareSync` NPEs.
- **Supersets** must always have **≥2 adjacent members**; route membership/order changes through
  `normalizeSupersets` (in both `templateDraftStore` and `sessionStore`).
- **Workout volume** counts two-arm dumbbell/kettlebell work ×2 via `loadFactor` (`exercise.perSide`,
  default by equipment). 1RM/top-weight stay per-hand. Compute volume from sets × factor, not a stored total.
- **Motion**: reuse the shared layer — `theme/motion.ts` tokens + `components/anim/*` primitives
  (`AnimatedNumber`, `PressableScale`, `ScreenTransition`, `GrowBar`, `Confetti`, `Skeleton`). **Always
  gate animation on `useMotion()`** (`{ animate, confetti }`) so the OS Reduce-Motion setting + the
  Settings → Motion toggles are honored (render the final state instantly when `animate` is false). Keep
  it subtle/snappy (150–320ms, springs not bounces); confetti is reserved for big wins + its own toggle.

## Native builds & platform gotchas
- **Android builds need JDK 17** (`JAVA_HOME` → JDK 17). The default JDK 25 fails native CMake configure
  (nitro-modules/worklets: *"restricted method in java.lang.System"*). `android/local.properties` holds `sdk.dir`.
- **Bluetooth (Renpho tape)** needs a dev build **and a physical device** — emulators/simulators have no BLE.
- **Nutrition-label OCR** (`@react-native-ml-kit/text-recognition`) links via `expo prebuild` (no Expo Go);
  best tested on a physical device with a real label. The flow alerts gracefully when the module is absent.
- **Local notifications** (`expo-notifications`) need a dev build; scheduling is a no-op in Expo Go.
  Android 13+ `POST_NOTIFICATIONS` comes from the module's own manifest (no config plugin needed). Prebuild
  auto-applies the bundled `expo-notifications` plugin, which adds the `aps-environment` **Push
  Notifications** entitlement — the one capability a **personal/free Apple team can never sign** (paid or
  not). We only use *local* notifications (no APNs), so `plugins/withoutPushEntitlement.js` strips it,
  letting a personal team sign the **normal `npm run ios`** build (HealthKit included). HealthKit signing is
  a *separate* axis (`HEALTHKIT=0` / `npm run ios:free`) — unrelated to notifications.
- **HealthKit toggle**: `app.config.js` strips HealthKit when `HEALTHKIT=0` (free Apple ID can't sign its
  entitlement). `npm run ios:free` / `prebuild:ios:free` for the stripped build; default keeps HealthKit.

## Verify
- Typecheck: `npx tsc --noEmit`
- Headless bundle (catches import/resolution errors, no device needed):
  `npx expo export --platform ios --output-dir /tmp/x`
- On device: `npx expo start` (Expo Go) then a dev build for camera/SQLite/Bluetooth testing
  (Android dev build requires JDK 17).

## Ship (iOS → TestFlight)
**Live on TestFlight** as **Hale** (`com.zanderhalverson.hale`, App Store Connect app 6776380902). Ship loop:
`eas build -p ios --profile production --local --output ./hale.ipa` → `eas submit -p ios --profile production --path ./hale.ipa`.
- `eas build --local` shells out to **`fastlane`** — install with **`brew install fastlane`** (system Ruby 2.6
  is too old for `gem install`). CocoaPods + Xcode required; cloud builds (drop `--local`) work but use credits.
- `eas submit` is **non-interactive** (an ASC API key is stored on EAS). Build numbers auto-increment
  (`appVersionSource: "remote"`).
- A first `--local` archive can fail with a transient "N failures" (exit 65) — just re-run. Don't pipe the
  build through `tail` (loses error detail); use `EAS_LOCAL_BUILD_SKIP_CLEANUP=1` + redirect to keep logs.
  (zsh: the build's exit code is `$pipestatus[1]`, not bash's `$PIPESTATUS[0]`.)
- **Build variants:** `app.config.js` reads `APP_VARIANT` (set per profile in `eas.json`). `production` →
  `Hale` / `com.zanderhalverson.hale` (matches TestFlight); anything else (e.g. a local `expo run:ios`) →
  `Hale Dev` / `…hale.dev`, so a dev build installs **alongside** the TestFlight app. Keep production = no suffix.
- JS-only changes can ship via **`eas update`** (EAS Update / `expo-updates` wired, production channel) with no
  new binary. See `docs/LAUNCH.md` for the full deploy reference.

## Keep docs current (required)
After a change is made and the user has reviewed/accepted it, **update the docs before moving on**:
- `docs/ROADMAP.md` — move the item from "Not built yet" to "Done", or adjust plans.
- `docs/ARCHITECTURE.md` — if you changed how something is wired (new store, route, data flow, a
  ported-feature detail).
- `docs/README.md` — if setup/running/seeding/building steps changed.
- This file (`CLAUDE.md`) — if a convention changed.
Treat the docs as part of "done", not an afterthought.
