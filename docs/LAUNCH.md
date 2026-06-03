# FitSelf — Launch & Go-to-Market Reference

Everything for shipping FitSelf to the App Store / Play Store: deployment steps,
pre-submission checklist, marketing, store-listing copy, what analytics the stores give
you, and the donation setup. See also **[PRIVACY.md](./PRIVACY.md)**.

> Positioning in one line: **a free, private, no-account, no-subscription fitness
> tracker — your data never leaves your phone.** That's the whole pitch; lead with it
> everywhere.

---

## 1. Deployment

**Accounts**
- Apple Developer Program — **$99/year** (the recurring cost donations offset).
- Google Play Developer — **$25 one-time**.

**Pipeline** (the repo already has `eas.json`)
- iOS: `eas build -p ios --profile production` → `eas submit -p ios`
- Android: `eas build -p android --profile production` → `eas submit -p android`
- Beta first: **TestFlight** (iOS) + Play **internal testing**.
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
- [ ] Replace `SUPPORT_URL` in `src/screens/SettingsView.tsx` with the real donation link.
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

**Name:** FitSelf
**Subtitle (≤30):** `Private calorie & workout log`

**Promotional text (≤170):**
> Track food, workouts, weight, and body stats — all on your phone. No account, no ads,
> no subscription. Your data never leaves your device. Free, forever.

**Description:** (see the full draft in the project notes / earlier listing — privacy-first
intro, then NUTRITION / WORKOUTS / HEALTH & PROGRESS / REPORTS / PRIVACY BY DESIGN
sections, closing with "free and always will be; optional donations, nothing paywalled.")

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

## 6. Donations (free app, no 30% cut)

Goal: keep FitSelf free; let users optionally donate; avoid the store cut. Implemented as
a **"Support FitSelf"** card in Settings that opens an **external link in the browser**
(`SUPPORT_URL` in `SettingsView.tsx`) — no in-app payment UI.

**Why a browser link, not an in-app form:**
- **Android (Google Play):** donations are **exempt** from Play Billing — Google takes
  **0%**; any processor is fine.
- **Apple:** Apple does **not** allow an in-app third-party payment sheet for this. A
  link out to a website for **donations that unlock nothing** is the accepted pattern
  (frame as "support development," not buying features). This keeps you clear of the IAP
  rule (3.1.1). ⚠️ It's a gray area and Apple's policies shift — verify against the
  current App Review Guidelines before submitting; the only guaranteed-0% route is routing
  donations to a registered nonprofit.

**Where to collect (lowest fees):**
| Platform          | Platform fee | Notes |
|-------------------|--------------|-------|
| **GitHub Sponsors** | **0%** | Best; only card processing. GitHub-hosted page. |
| **Ko-fi**           | 0% on donations | ~3% processing; clean "buy me a coffee" page. |
| **Stripe Payment Link** | ~2.9% + 30¢ | Your own branded page, most control. |
| Buy Me a Coffee     | ~5% | Easiest, higher cut. |

**Action:** pick one, create the page, paste the URL into `SUPPORT_URL`.

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
