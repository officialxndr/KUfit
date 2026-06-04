# KUfit / Hale — App Store Review Audit

_Reviewed: June 3, 2026 · Expo / React Native + TypeScript_

## Overall

The app is in good shape for App Store review. It's local-first with no accounts, no tracking, and a clear privacy policy — which removes most of the things that get fitness apps rejected. The architecture decisions (donations via external browser, push entitlement stripped, HealthKit usage strings present) show the rules were already considered. A few must-fix items and a few worth tightening remain before submission.

## Must fix before submitting

### 1. Placeholder donation URL (Guideline 2.3.10 / broken functionality)
`SUPPORT_URL = 'https://github.com/sponsors/your-handle'` is still a placeholder. A "Donate" button leading to a dead/your-handle page will likely be flagged as broken or incomplete. Set the real GitHub Sponsors / Ko-fi / Stripe link, or hide the button for v1.

### 2. Confirm the donation is a true "free" donation, not unlocking anything
Current copy ("never required," nothing locked) is exactly right — keep it. Apple allows external donation links *only* if the donation gives the user nothing in return inside the app. Gating any feature behind it would force In-App Purchase. Compliant now; don't drift.

### 3. RECORD_AUDIO permission on Android with no apparent use
`app.json` requests `android.permission.RECORD_AUDIO` (pulled in by expo-camera defaults), but nothing records audio. More of a Google Play concern than Apple, but unused sensitive permissions trigger scrutiny on both stores. If not needed, strip it via the camera plugin config.

## Should address

### 4. Health-data App Privacy "nutrition label"
The code collects nothing and usage strings are good, but App Store Connect still requires filling out the **App Privacy** questionnaire — explicitly declare Health & Fitness data as "not collected" / "stays on device." Apple also requires that HealthKit data not be used for advertising or shared with third parties, and that a privacy policy exists. Both are satisfied, but the policy URL must be reachable from App Store Connect — host `docs/PRIVACY.md` publicly and put that URL in the listing.

### 5. Add a brief health disclaimer
The app computes body-fat (Navy method) and calorie targets. Not required by Apple, but health apps presenting numeric targets without a "this is an estimate, not medical advice, consult a professional" line occasionally draw a reviewer question — and it offers legal protection. A partial disclaimer exists in `HealthMeasure.tsx`; consider a visible disclaimer near body-fat / calorie outputs and in onboarding.

### 6. Bluetooth usage string names a specific brand
"connects to your Renpho smart tape measure" is fine functionally, but absent a relationship with Renpho, consider generic wording ("compatible Bluetooth smart tape measure") to avoid trademark questions. Minor.

### 7. `hale.ipa` (52 MB) committed to the repo
Not an App Store issue, but a built binary is checked into git. Worth removing / `.gitignore`-ing — it bloats the repo and could expose build artifacts you don't want public.

## Looks good (no action)

- Push entitlement correctly stripped since only local notifications are used — clean.
- All iOS `infoPlist` usage descriptions present and specifically worded (camera, photos, HealthKit read/write). This is the #1 rejection cause, done right.
- `ITSAppUsesNonExemptEncryption: false` is set — avoids export-compliance back-and-forth.
- No tracking SDKs, analytics, or ad networks — no AppTrackingTransparency requirement and a trivially clean privacy label.
- No hardcoded secrets (USDA key is null; Open Food Facts needs none).
- External links open via `WebBrowser` / `mailto:` rather than faking native payment — correct.

## Not yet verified

Not every screen was read. If any screen mentions "premium," "unlock," subscriptions, or shows partially-implemented features, clean those up — reviewers reject visible placeholder / incomplete UI under Guideline 2.1.
