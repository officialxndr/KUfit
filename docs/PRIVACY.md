# Hale — Privacy Policy

_Last updated: June 10, 2026_

**Short version: Hale does not collect, sell, or share your personal data, and runs
no Hale server. Everything you log stays on your device. The only data that ever leaves
your phone is for optional features you turn on yourself — and it goes straight to the
service that feature talks to, never to us.**

Hale is a local-first health & fitness app. There is no account to create and no
Hale server. We (the developer) cannot see your data. By default it never leaves your
phone; the opt-in exceptions are listed below.

## What we collect

**Nothing.** Hale has no analytics, no advertising, no tracking SDKs, and no user
accounts. We do not collect your name, email, location, device identifiers, or any of
the health, food, workout, weight, or measurement information you enter.

## Where your data is stored

All of your data — food logs, recipes, workouts, weight entries, body measurements,
goals, settings, and your profile — is stored **only in a local database on your
device**. It is included in your device's own encrypted backups (iCloud / Google) if
you have those enabled, under your control. Deleting the app removes this data.

## Information that leaves your device

Hale works fully offline. A few optional features make network or system requests,
and none of them send your personal information:

- **Food search / barcode lookup (Open Food Facts).** When you search for a food or
  scan a barcode, the search text or barcode number is sent to the Open Food Facts API
  (`openfoodfacts.org`) to fetch nutrition data. No account or personal data is included.
  See Open Food Facts' own privacy terms for how they handle requests.
- **Exercise demo media.** Exercise demonstration GIFs may be downloaded for the
  exercise library; these are plain media requests with no personal data.
- **External AI vision endpoint (opt-in — off by default).** Hale can read nutrition labels
  and estimate a meal from a photo with AI. The default is an **on-device** model, where the
  photo never leaves your phone. If you instead open **Settings → AI vision → API / cloud** and
  add an endpoint, then scanning a label or estimating a meal **sends that photo (plus a text
  prompt) to the endpoint you configured** — either a server you run yourself (e.g. Ollama, LM
  Studio, or OpenWebUI on your own network) or a third-party cloud service you choose (e.g.
  OpenAI, OpenRouter, or Google Gemini). Hale sends it directly to the address and key you
  entered; it never passes through a Hale server. Whatever provider you pick handles the image
  under **their** privacy policy. This feature is entirely optional and stays off unless you set
  it up.

## Device features Hale uses (with your permission)

- **Camera** — to scan barcodes, read nutrition labels, and estimate a meal from a photo.
  By default these images are processed **on-device** and are not uploaded or stored by us.
  The one exception is if you have set up an external AI endpoint (see above), in which case
  the label/meal photo is sent to the endpoint you chose.
- **Apple Health / Health Connect** (optional) — to read your weight/activity/heart-rate
  so your stats stay in sync. This data is read on-device and is **not transmitted** by
  Hale to anyone. You control access in your system Health settings.
- **Bluetooth** (optional) — to connect to a compatible Bluetooth smart tape measure for
  body measurements. Readings are processed on-device.
- **Notifications** (optional) — local reminders you schedule. These are generated and
  delivered on your device; no push server is involved.
- **Photo library** (optional) — if you choose a profile picture (stored locally), or pick a
  photo of a meal to estimate. A meal/label photo follows the same rule as the camera above:
  on-device by default, or sent to your configured AI endpoint if you've set one up.

## Donations

If you choose to support Hale with a donation, the donation is handled by
**Ko-fi** (a third-party payment provider) on **their** website, opened in your
browser. Hale does not process or receive your payment details. Ko-fi has its own
privacy policy that applies to the payment.

## Children's privacy

Hale does not knowingly collect any data from anyone, including children, because it
does not collect data at all.

## Changes to this policy

If this policy changes, the updated version will be posted here with a new "last
updated" date.

## Contact

Questions about privacy? Contact the developer at **haledevteam@protonmail.com**.
