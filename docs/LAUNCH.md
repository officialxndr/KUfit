# Hale — Launch & Go-to-Market Reference

Everything for shipping Hale to the App Store / Play Store: deployment steps,
pre-submission checklist, marketing, store-listing copy, what analytics the stores give
you, and the donation setup. See also **[PRIVACY.md](./PRIVACY.md)**.

> Positioning in one line: **a free, private, no-account, no-subscription fitness
> tracker — your data never leaves your phone.** That's the whole pitch; lead with it
> everywhere.

---

## 1. Deployment

**Accounts**
- Apple Developer Program — **$99/year** (the recurring cost tips offset). Required to sign the
  Paid Apps Agreement for the IAP tip jar (a personal team can't).
- Google Play Developer — **$25 one-time**.

**Pipeline** (the repo already has `eas.json`)
- iOS (what we ship): `eas build -p ios --profile production --local` → `eas submit -p ios --profile production --path hale.ipa`.
  The `--local` build compiles on your Mac and **requires `fastlane`** (`brew install fastlane` — the system
  Ruby 2.6 is too old for `gem install`). Cloud builds (drop `--local`) also work but consume EAS build credits.
- Android: `eas build -p android --profile production` → `eas submit -p android`.
- Beta first: **TestFlight** (iOS) + Play **internal testing**.
- **Tester feedback:** rely on **TestFlight's built-in feedback** — testers screenshot → send a note, and
  crashes are auto-collected, all landing in **App Store Connect → TestFlight → Feedback**. In-app
  **Settings → Feedback** (+ the What's-New sheet) adds bug + **feature-request** forms that email you, which
  also cover the public release + Android. (Community upvoting of feature requests is a future add.)
- **OTA**: `expo-updates` is wired (production channel) — ship JS-only fixes with `eas update`, no resubmit.

> **iOS status (2026-06-03): LIVE on TestFlight.** App = **Hale**, bundle `com.zanderhalverson.hale`,
> App Store Connect app **6776380902**. EAS stored an App Store Connect API key, so `eas submit` is now
> non-interactive. Build numbers auto-increment (`appVersionSource: "remote"`). Note: a first `--local`
> archive can fail with a transient "N failures" (exit 65) — just re-run, no code change needed.
> Internal testers (incl. you) install immediately via the TestFlight app; external testers need the
> one-time Beta App Review and can join through a public link.
- Screenshots: take them from a **dev build / simulator** with the hidden demo data
  loaded (Settings → tap version 7× → Load sample data) so screens look alive. The dev
  menu only exists in dev builds (see §6), so it won't ship.

**Review gotchas specific to this app**
- **HealthKit** gets extra scrutiny — needs the usage strings (present) + a hosted
  **privacy policy URL** (use `PRIVACY.md`). Be ready to say "read-only, on-device, never
  transmitted."
- **App Privacy questionnaire**: answer **"Data Not Collected"** — true and a selling
  point. (Open Food Facts calls send only the query/barcode, no PII.)
- Camera / Bluetooth / Notifications usage strings are present.

---

## 2. Pre-submission checklist
- [ ] Complete the App Store Connect IAP setup for the tip jar (see [IAP-TipJar.md](./IAP-TipJar.md)) —
      Paid Apps Agreement active, three consumables created, submitted **with** the next binary.
- [ ] Confirm the Android Ko-fi `SUPPORT_URL` in `src/lib/support.ts` points at the live page.
- [ ] Confirm the dev menu is gated behind `__DEV__` (it is) — invisible in production.
- [ ] Host `PRIVACY.md` at a public URL; add it in App Store Connect + Play Console.
- [ ] App icon + screenshots (run demo data first) for all required device sizes.
- [ ] Fill store listing (copy in §4), keywords, category (Health & Fitness), age rating.
- [ ] Bump `version` / build number in `app.json`.
- [ ] Android dev build needs JDK 17; iOS default `npm run ios` build (push entitlement is
      stripped by `plugins/withoutPushEntitlement.js` so a personal team can sign).

---

## 3. Marketing — getting the first users

The wedge: free forever, no account, no ads, no subscription, fully private. The
fitness-app store is wall-to-wall $10/month subscriptions — that contrast is the hook.

**Channels (highest ROI first)**
- **Reddit**: r/fitness, r/loseit, r/gainit, r/QuantifiedSelf, r/privacy, r/degoogle,
  r/selfhosted, r/fossandroid, r/digitalminimalism. Lead with privacy + free, not features.
- **Hacker News "Show HN"** — local-first / privacy / no-subscription does well here.
- **Product Hunt** launch (schedule it; line up early supporters).
- **Build-in-public** on X / Threads / TikTok — short screen-recordings of the nice
  moments (calorie ring fill, workout-summary wave, Reports date scrubbing).
- **Privacy directories** (privacytools.io / awesome-privacy) as a private MyFitnessPal
  alternative.
- **ASO** — title/subtitle/keywords drive organic installs more than anything.

**Tactics**: ask happy users for ratings (ratings → ranking), reply to every review,
frame everything as "the private, free alternative."

---

## 4. Store listing copy

**Name:** Hale
**Subtitle (≤30):** `Private calorie & workout log`

**Promotional text (≤170):**
> Track food, workouts, weight, and body stats — all on your phone. No account, no ads,
> no subscription. Your data never leaves your device. Free, forever.

**Description:** (see the full draft in the project notes / earlier listing — privacy-first
intro, then NUTRITION / WORKOUTS / HEALTH & PROGRESS / REPORTS / PRIVACY BY DESIGN
sections, closing with "free and always will be; optional tips, nothing paywalled.")

**Keywords (≤100, comma-sep, no spaces):**
`calorie,counter,macro,tracker,workout,log,gym,weight,fasting,food,diary,nutrition,private,offline,fitness`

**Category:** Health & Fitness.

---

## 5. What user data the stores give you

You get **aggregate, anonymized analytics only — nothing about individuals** (no names,
emails, or contact info). This matches the "we don't farm data" stance.

- **Apple — App Store Connect → App Analytics** (from users who consented to share):
  impressions, product-page views, **conversion rate**, **downloads**, installs,
  **sessions**, **active devices**, deletions, **crashes**, **retention (D1/7/28)**,
  sliced by territory / device / version / **acquisition source** (search vs browse vs
  referral). Plus ratings & reviews, and crash/perf via Xcode Organizer.
- **Google — Play Console**: installs/uninstalls, active devices, **acquisition** &
  retention reports, **Android Vitals** (crashes/ANRs), ratings — by country/device/OS.

**Tradeoff:** local-first means **no in-app behavioral analytics** (you won't know which
screens people use). If you ever want that without breaking the privacy promise, the
anonymous indie options are **TelemetryDeck** or **Aptabase** (no PII), or self-hosted
PostHog/Plausible. Recommendation: stay analytics-free to keep the cleanest privacy label.

---

## 6. Tips — "Buy the dev a coffee" (free app, optional support)

Goal: keep Hale free; let users optionally support development. Implemented **per-platform**
because Apple and Google have opposite rules for tips:

- **iOS — native StoreKit tip jar.** Three **consumable** in-app purchases ("A coffee /
  A few coffees / A week of coffee" at $1.99/$4.99/$9.99), via **`expo-iap`**. Apple
  guideline **3.1.1 explicitly permits IAP tips to the developer**; an external payment link
  is a rejection risk outside the US storefront (anti-steering), so IAP is the robust path.
  Wording is **"tip"/"support"/"coffee", never "donation"** — 3.2.2 reserves charitable
  donations for nonprofits. The tip **unlocks nothing**, so StoreKit 2 verifies on-device and
  **no server/receipt backend** is needed. Code: `src/lib/iap.ts` (`useTipJar`) + `src/app/tip.tsx`.
  **Manual App Store Connect setup is required — see [IAP-TipJar.md](./IAP-TipJar.md).**
- **Android — external Ko-fi link** (`SUPPORT_URL` in `src/lib/support.ts`, opened in the
  browser). Google Play **bars** Play Billing for pure tips (they're peer-to-peer payments),
  so the external link is the compliant, **0%-fee** path. Frame as "buy me a coffee," not a
  charitable donation.

`openSupportFlow()` (`src/lib/iap.ts`) is the single entry point used by the Dashboard nudge,
Settings → Buy the dev a coffee, and the final onboarding step; it branches on `tipJarSupported`.

> ⚠️ Apple takes ~15–30% of each IAP tip. The post-2025 US external-link allowance pays 0% but
> is **US-storefront-only** — not worth the cross-storefront rejection risk for a tip jar.

**Action:** complete the App Store Connect IAP setup in [IAP-TipJar.md](./IAP-TipJar.md), and
keep the Ko-fi page (`ko-fi.com/haleapp`) live for Android.

---

## 7. Data backup (shipped)
Settings → **Data & backup**: **Export** all data to a JSON file (share sheet), **Import** with
**Replace** (exact restore) or **Merge** (add records), and a guarded **Wipe all data** (acknowledge
toggle + slide-to-confirm). Lets users back up however they like — reinforces the privacy pitch and gives
a clean restore path on a new device. (`lib/backup.ts`; uses `expo-sharing` / `expo-document-picker`, which
need a dev build.)

## 8. Possible follow-ups (not yet built)
- Auto-follow OS light/dark theme.
- Privacy-respecting anonymous analytics (only if needed).
