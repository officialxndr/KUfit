# KUfit / Hale — App Store Review Audit

_Reviewed: June 3, 2026 · Re-checked & partially fixed: June 4, 2026 · Expo / React Native + TypeScript_

## Status (June 4)
- **Done:** #1 donation URL (real Ko-fi link), #2 donation compliance (nothing gated),
  #3 RECORD_AUDIO stripped, #5 health disclaimer (light line on the onboarding privacy step),
  #6 generic Bluetooth wording, #7 `hale.ipa` untracked + `*.ipa/.apk/.aab` ignored.
- **Remaining:** #4 App Privacy questionnaire + hosting the privacy policy (manual, in App Store Connect).

## Overall

The app is in good shape for App Store review. It's local-first with no accounts, no tracking, and a clear privacy policy — which removes most of the things that get fitness apps rejected. The architecture decisions (donations via external browser, push entitlement stripped, HealthKit usage strings present) show the rules were already considered. A few must-fix items and a few worth tightening remain before submission.

## Must fix before submitting

### 1. Placeholder donation URL (Guideline 2.3.10 / broken functionality) — ✅ FIXED
Now `SUPPORT_URL = 'https://ko-fi.com/haleapp'` (`src/lib/support.ts`), opened via `WebBrowser`. Real link, no longer a placeholder.

### 2. Confirm the donation is a true "free" donation, not unlocking anything — ✅ COMPLIANT
Current copy ("free forever, nothing paywalled, optional donations only") is exactly right — keep it. Apple allows external donation links *only* if the donation gives the user nothing in return inside the app. Gating any feature behind it would force In-App Purchase. Compliant now; don't drift.

### 3. RECORD_AUDIO permission on Android with no apparent use — ✅ FIXED
Removed `android.permission.RECORD_AUDIO` from `app.json` and set `recordAudioAndroid: false` on the expo-camera plugin so prebuild won't re-add it. Android permissions are now CAMERA + the three BLUETOOTH ones only.

## Should address

### 4. Health-data App Privacy "nutrition label"
The code collects nothing and usage strings are good, but App Store Connect still requires filling out the **App Privacy** questionnaire — explicitly declare Health & Fitness data as "not collected" / "stays on device." Apple also requires that HealthKit data not be used for advertising or shared with third parties, and that a privacy policy exists. Both are satisfied, but the policy URL must be reachable from App Store Connect — host `docs/PRIVACY.md` publicly and put that URL in the listing.

### 5. Add a brief health disclaimer — ✅ ADDED (onboarding)
A light, non-clinical line sits on the **onboarding privacy step** (`onboarding.tsx`, step 1): *"One note: the numbers Hale shows — body fat, calories, goals — are estimates to guide you, not medical advice."* Deliberately onboarding-only (seen once, framed as honesty) rather than repeated near every output, to stay unobtrusive and on-brand.

### 6. Bluetooth usage string names a specific brand — ✅ FIXED
Reworded to "Hale connects to a compatible Bluetooth smart tape measure to log body measurements." (`app.json`, ble-plx plugin).

### 7. `hale.ipa` (52 MB) committed to the repo — ✅ FIXED (going forward)
`git rm --cached hale.ipa` (local file kept) and `.gitignore` now ignores `*.ipa`/`*.apk`/`*.aab`. Note the binary still exists in **past commits**; a full history purge (BFG / `filter-repo`) is a separate, heavier step and likely unnecessary.

## Looks good (no action)

- Push entitlement correctly stripped since only local notifications are used — clean.
- All iOS `infoPlist` usage descriptions present and specifically worded (camera, photos, HealthKit read/write). This is the #1 rejection cause, done right.
- `ITSAppUsesNonExemptEncryption: false` is set — avoids export-compliance back-and-forth.
- No tracking SDKs, analytics, or ad networks — no AppTrackingTransparency requirement and a trivially clean privacy label.
- No hardcoded secrets (USDA key is null; Open Food Facts needs none).
- External links open via `WebBrowser` / `mailto:` rather than faking native payment — correct.

## Not yet verified

Not every screen was read. If any screen mentions "premium," "unlock," subscriptions, or shows partially-implemented features, clean those up — reviewers reject visible placeholder / incomplete UI under Guideline 2.1.
