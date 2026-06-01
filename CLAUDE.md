# FitSelf Mobile (Expo / React Native)

Local-first health & fitness app. Fresh Expo SDK 56 rebuild of the original React web PWA
(`../apps/web`). **All data lives on-device in SQLite** — no server is required. An optional
self-hosted server (the existing `../apps/api`) can later be wired in for backup + Home
Assistant automations via the sync layer (`serverStore` is null by default).

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
  section/sub-tab; `routineStore` = workout routines; `serverStore` = optional server).
- **Data**: `src/lib/db.ts` (SQLite schema, mirrors the server Prisma models with
  `localId`/`serverId`/`syncStatus` for future sync) + `src/lib/repositories/{Food,Health,Workout}Repo.ts`.
  Repos are the only thing that touches the DB. Mutations mark rows `syncStatus='pending'`.
- **Calc libs** (pure TS, ported from web): `tdee.ts`, `epley.ts`, `activities.ts`, `units.ts`, `targets.ts`.
- **Design**: `src/theme/tokens.ts` + `src/theme/text.ts` (ported from `../FitSelf Design System/colors_and_type.css`).
  Dark-first, one indigo accent (`#6366f1`), flat, lucide icons, no emoji in UI chrome.
- **UI kit**: `src/components/ui/index.tsx` (Screen, Card, Button, Badge, Chip, FsText, SectionHeader).

## Conventions
- Stored units are **metric** (kg, cm). Convert at the display edge with `lib/units.ts`.
- Screens read from repos in a `useFocusEffect(refresh)` callback so data refreshes on tab focus.
- Calorie/macro targets resolve via `resolveTargets(profile)` (active GoalPhase → profile → TDEE).
- Native dirs (`ios/`, `android/`) are git-ignored and regenerated via `expo prebuild` / EAS.

## Verify
- Typecheck: `npx tsc --noEmit`
- Headless bundle (catches import/resolution errors, no device needed):
  `npx expo export --platform ios --output-dir /tmp/x`
- On device: `npx expo start` (Expo Go) then a dev build for camera/SQLite-heavy testing.

## Keep docs current (required)
After a change is made and the user has reviewed/accepted it, **update the docs before moving on**:
- `docs/ROADMAP.md` — move the item from "Not built yet" to "Done", or adjust plans.
- `docs/ARCHITECTURE.md` — if you changed how something is wired (new store, route, data flow, a
  ported-feature detail).
- `docs/README.md` — if setup/running/seeding/building steps changed.
- This file (`CLAUDE.md`) — if a convention changed.
Treat the docs as part of "done", not an afterthought.
