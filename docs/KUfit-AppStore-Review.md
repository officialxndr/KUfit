# KUfit / Hale — App Store Review Audit

_Reviewed: June 3, 2026 · Re-checked & partially fixed: June 4, 2026 · Expo / React Native + TypeScript_

## Status (June 4 · support flow updated June 21)
- **Done:** #1 donation URL (real Ko-fi link), #2 support compliance (nothing gated),
  #3 RECORD_AUDIO stripped, #5 health disclaimer (light line on the onboarding privacy step),
  #6 generic Bluetooth wording, #7 `hale.ipa` untracked + `*.ipa/.apk/.aab` ignored.
- **June 21:** the iOS support flow moved from the external Ko-fi link to a **native StoreKit
  consumable "Buy the dev a coffee" tip jar** (`expo-iap`) — see #1/#2 below. Android keeps the
  Ko-fi link.
- **Remaining:** #4 App Privacy questionnaire + hosting the privacy policy (manual, in App Store
  Connect); the manual App Store Connect IAP setup (see `docs/IAP-TipJar.md`) — the three consumables
  must ship **with the next binary** (a first IAP can't be approved standalone).

## Overall

The app is in good shape for App Store review. It's local-first with no accounts, no tracking, and a clear privacy policy — which removes most of the things that get fitness apps rejected. The architecture decisions (native StoreKit tipping on iOS, external link on Android, push entitlement stripped, HealthKit usage strings present) show the rules were already considered. A few must-fix items and a few worth tightening remain before submission.

## Must fix before submitting

### 1. Support flow — native IAP tip jar on iOS (Guideline 3.1.1) — ✅ FIXED
iOS now collects optional support through a **native StoreKit consumable tip jar** ("Buy the dev a
coffee", `src/lib/iap.ts` + `src/app/tip.tsx`, three consumables at $1.99/$4.99/$9.99), not an external
link. Guideline **3.1.1** explicitly permits *"in-app purchase … to 'tip' the developer."* The earlier
external Ko-fi link was a rejection risk on non-US storefronts (Apple's anti-steering rule); the May-2025
US external-link allowance is US-only, so the IAP tip jar is the robust cross-storefront path. **Android
keeps the Ko-fi link** — Google Play *bars* Play Billing for pure tips, so the external link is correct
there. ⚠️ The three IAPs must be submitted **with the next app binary** (a first IAP can't be approved on
its own) — see `docs/IAP-TipJar.md`.

### 2. Wording — "tip"/"coffee"/"support", never "donation" (Guideline 3.2.2) — ✅ COMPLIANT
All user-facing copy frames it as **tipping / buying the developer a coffee / supporting development**, and
states it **unlocks nothing** — exactly the permitted 3.1.1 tipping bucket. The word **"donation" is
deliberately avoided** in user-facing strings: 3.2.2(iv) reserves charitable "donations"/"fundraisers" for
approved nonprofits, and framing a for-profit IAP as a donation flips it into prohibited territory.
(Internal code keeps `donationStore`/`markDonated` — not user-visible.) The tip unlocks no features, so no
IAP rule is triggered beyond using Apple's purchase flow itself. Compliant; don't drift back to "donation".

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
