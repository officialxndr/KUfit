# FitSelf — App UI Kit

A high-fidelity, **interactive** recreation of the FitSelf mobile app, built from the source codebase (`officialxndr/health-app`, `apps/web/src`). It is a click-through prototype, not production code — the visuals and interactions are faithful; the data is mocked.

Open **`index.html`** to use it. It renders inside an iOS device frame (dark theme — the product default).

## Flow
1. **Login** → tap *Sign In*
2. **Dashboard** — calorie ring + macros, weekly bars + streak, weight card, pace banner, recent workouts, quick links. Tap cards to jump to sections.
3. **Section switching** — use the **header dropdown** (top-left) to move between Dashboard / Food / Workout / Health / Settings. The **bottom nav** shows the active section's sub-tabs (or the launcher on Dashboard/Settings), split around the center **FAB**.
4. **Food** — date header with ring + macros, collapsible meal sections (tap to expand), `+` opens the quick-action sheet.
5. **Workout** — template grid + *Quick Start* → launches the **Active Session** logger: tap a weight/reps cell to bring up the numpad, fill values, tap the ✓ to complete a set (green wash). *Finish* returns to history.
6. **Health** — weight trend chart with goal line + period toggle, stat cards, pace-adjustment banner with actionable suggestions.
7. **FAB** — opens a section-specific quick-action sheet.

## Files
| File | Contents |
|---|---|
| `index.html` | App shell + state machine (auth, sections, sub-tabs, FAB sheet, active session) |
| `ui-components.jsx` | Tokens (`FS`), `Icon` (lucide), `Button`, `Card`, `Badge`, `CalorieRing`, `MacroBar`, `AppHeader`, `BottomNav`, `Sheet` |
| `screens-core.jsx` | `LoginScreen`, `DashboardScreen`, `FoodScreen`, `SettingsScreen` |
| `screens-fitness.jsx` | `WorkoutScreen`, `ActiveSession` (+ `Numpad`), `HealthScreen` |
| `ios-frame.jsx` | iOS device bezel (starter component) |

## Notes
- **Icons:** lucide via CDN (`unpkg.com/lucide`) — matches the app's `lucide-react` exactly. Use the `<Icon name="..." />` helper (kebab-case names).
- **Theme:** dark-first. All tokens live in the `FS` object in `ui-components.jsx`, mirroring `colors_and_type.css` at the project root.
- **Reuse:** components export to `window`, so any screen file can use them. Give imported component style objects unique names if you extend this kit.
- This kit covers the core surfaces and components. Sub-tabs without dedicated screens (e.g. Recipes, Body Measurements) highlight in the nav but render their section's primary screen — extend `screens-*.jsx` to flesh them out.
