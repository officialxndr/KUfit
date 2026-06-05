# AI-powered food scanning (design proposal)

> **Status: proposed, not yet built.** This is a design reference captured from a planning
> discussion. No code exists for it yet. See `docs/ROADMAP.md` for tracking.

## Context
Hale's current label scanning (`src/lib/nutritionOcr.ts`) uses **on-device ML Kit OCR** + a
heuristic parser (`parseNutritionText`). It's free and private but brittle on noisy real-world
labels. This proposes an **opt-in AI option** that: (a) costs *the user* nothing (they bring
their own free LLM access), (b) needs **no Hale server**, and (c) ideally offers a
**login/sign-up** experience rather than pasting an API key. The payoff is both better label
accuracy **and** a new capability OCR can't do — estimate nutrition from a **photo of an actual
meal**.

## Provider research findings (verified against OpenRouter live docs, Jun 2026)
**Free vision models exist and the feature works end-to-end for free.** Image-capable free models
currently include `google/gemma-4-31b-it` (text+image, 256K), `google/gemma-4-26b-a4b-it`
(text+image+video, MoE, **native function calling** → best structured-output candidate of the free
set), `nvidia/nemotron-nano-12b-v2-vl` (multi-image **document intelligence** — label reads are
essentially this), and `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.

Caveats that shape the design:
- **Accuracy:** these open models are a notch below Gemini Flash / GPT-4o-class on *dense numeric
  label reads* and *portion estimation*. Free-via-OpenRouter = the "try it / casual" tier; Gemini
  paste-key = the accuracy tier. (Validates the two-provider decision.)
- **Rate limits are NOT a practical blocker:** ~20 req/min, with a low daily cap that a small
  (~$10) credit balance raises substantially — plenty for occasional food logging, all on the
  user's account at zero dev cost. (Exact daily numbers are templated in their docs and shift —
  don't hardcode.)
- **Model churn:** free model IDs get deprecated/renamed often → make the default model id
  **overridable in settings** and **fail gracefully** (model 404 → "pick another / fall back to
  OCR"), don't hardcode-and-pray.
- **Structured output is uneven on free models:** some honor `response_format`, some ignore it →
  defensive JSON parse + range validation is mandatory on the free path.

### OpenRouter OAuth PKCE flow (verified)
1. Generate `code_verifier` + `code_challenge` (SHA256, method `S256`).
2. Open browser → `https://openrouter.ai/auth?callback_url=hale://airouter-callback&code_challenge=<hash>&code_challenge_method=S256`
3. User logs in / signs up / authorizes → redirect to `hale://airouter-callback?code=<CODE>`.
4. `POST https://openrouter.ai/api/v1/auth/keys` with body
   `{ "code": "<CODE>", "code_verifier": "<verifier>", "code_challenge_method": "S256" }`
   → returns `{ "key": "<user_api_key>" }`.
5. Store the returned key in `expo-secure-store`.

`expo-auth-session` (+ `expo-web-browser`) provide PKCE helpers + the deep-link redirect; register
the `hale://` scheme (already used by the app) with an `airouter-callback` path.

## Decisions
- **Scope:** both **label scan** and **photo-of-meal estimate**.
- **Providers (two, from the start):**
  - **OpenRouter** = the front door. The *only* free option with a real **OAuth PKCE login/sign-up**
    flow ("Connect with OpenRouter" → browser login/signup → app receives a user-scoped key, no
    paste). Usage bills to the user's own OpenRouter account; free vision models or their own
    credit. Zero cost to the dev, photo goes device → OpenRouter directly.
  - **Gemini** = optional power-user accuracy upgrade via **paste-a-key** (Gemini Flash is the most
    accurate free vision model; no consumer OAuth exists, so it's copy/paste, softened by a
    deep-link to the AI Studio "Get API key" page).
  - Groq considered and dropped (paste-only, redundant with OpenRouter).
- **Architecture:** **device → provider directly. No server, no proxy.** Fits Hale's local-first
  design. Rate limits are the provider's, enforced on the user's own account — so **no quota system
  to build**; just surface 429s gracefully.
- **Privacy:** strictly opt-in; **on-device OCR stays the default**. First-use consent disclosing
  "this sends a photo to <provider>, subject to their terms" (free tiers may train on inputs).

## Approach

### 1. AI scan module — new `src/lib/aiScan.ts`
- **One public fn** `aiScanFood(uri, mode): Promise<ParsedNutrition>` returning the **existing
  `ParsedNutrition` shape** from `src/lib/nutritionOcr.ts` so the form-fill path (`applyParsed` in
  `src/app/custom-food.tsx`) is reused unchanged. `mode: 'label' | 'meal'`.
- **Both providers speak the OpenAI-compatible chat-completions shape**, so one request builder
  serves both — only base URL + auth + model id differ:
  - OpenRouter: `POST https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer
    <user key>` (+ `HTTP-Referer`/`X-Title` headers identifying Hale).
  - Gemini: its **OpenAI-compat** endpoint
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    `Authorization: Bearer <pasted key>`.
  - Image sent as an `image_url` content part with a `data:image/jpeg;base64,…` URI.
- **Model selection:** a small `provider → defaultModel` map, **overridable in settings**, with a
  graceful "model unavailable" path (free IDs churn). Sensible starting defaults: OpenRouter →
  a free vision model (e.g. `google/gemma-4-26b-a4b-it`, the function-calling one); Gemini →
  `gemini-2.x-flash`.
- **Structured output:** request JSON (`response_format: { type: 'json_object' }` / `json_schema`
  mirroring `ParsedNutrition`). Then **always parse defensively** (strip ```json fences,
  `JSON.parse`, coerce numbers) since free models honor it unevenly, and **range-validate** each
  field (e.g. calories 0–2000/serving, macros 0–300 g, sodium 0–10000 mg) — drop out-of-range
  values rather than filling them. Fall back to `parseNutritionText` (label mode) or manual entry
  on parse failure / timeout / 429 / offline.
- **Prompt design** (two system prompts, same JSON target):
  - `label`: "You are reading a packaged-food Nutrition Facts panel. Return ONLY JSON matching
    {schema}. Use the values *per serving* as printed. Sodium in mg, everything else in grams.
    Omit any field you can't read with confidence — never guess."
  - `meal`: "Estimate the nutrition of the food in this photo for one typical serving. Return ONLY
    JSON matching {schema}. These are rough estimates." (Pair with the in-app "estimate, not
    medical advice" disclaimer.)
- Base64 the captured photo; **resize/compress** before upload (e.g. `expo-image-manipulator`,
  longest edge ~1024 px, JPEG q~0.7) to cut latency + payload (~2–8 s round-trip fits the "5–10 s"
  expectation).

### 2. Auth + secrets
- **OpenRouter OAuth PKCE** via `expo-auth-session` + `expo-web-browser` (+ a Linking redirect deep
  link): start auth → exchange the returned code for a user key → store it.
- **Gemini key:** guided paste, deep-link to the key page.
- Store both secrets in **`expo-secure-store`** (NOT Zustand-persist / AsyncStorage — they're
  secrets). A small non-secret config (active provider, model id) can live in `settingsStore`.
- Likely new deps: `expo-secure-store`, `expo-auth-session`, `expo-web-browser` (all Expo modules;
  need a dev build — which AI scanning requires anyway, like the existing OCR/camera).

### 3. UI
- **Settings:** new "AI food scanning (advanced)" section — Connect with OpenRouter button,
  optional Gemini key field + "Get a key" link, active-provider/model picker, "Test connection",
  and the opt-in/consent copy. (Mirror the existing settings-screen patterns, e.g.
  `src/app/reminders.tsx`.)
- **`src/app/custom-food.tsx`:** the existing "Scan nutrition label" button branches — when AI is
  configured, offer **Scan label (AI)** and **Photo of meal (AI)**; on-device OCR remains available
  as the default/fallback. Reuse the existing `CameraView` capture and `applyParsed()` — the AI
  path just feeds it a `ParsedNutrition`. Meal mode shows the existing "estimate, not medical
  advice" disclaimer tone from onboarding.

### 4. Disclosure / compliance
- Add a line to the onboarding **privacy promise** noting AI scanning is optional and sends a photo
  off-device only when used.
- App Store privacy labels: disclose third-party data transmission.

## Verification (when built)
- `npx tsc --noEmit` and headless bundle `npx expo export --platform ios --output-dir /tmp/x`.
- Unit-test the AI response parser/validator the same way `parseNutritionText` is testable (pure
  function, feed sample JSON incl. malformed / fenced / out-of-range cases).
- On a **dev build / physical device** (AI scan needs camera + network, no Expo Go):
  - OpenRouter OAuth round-trip (login → key stored → test connection).
  - Gemini paste-key path.
  - Label scan accuracy vs the on-device OCR baseline.
  - Meal-photo estimate sanity.
  - Failure paths: airplane mode, revoked/invalid key, 429 → graceful fallback to OCR/manual.

## Risks / open questions
- **Meal-photo accuracy** is the soft spot on free models — portion size from one 2D photo is
  genuinely hard (expect ±20–40% on calories). The "rough estimate" framing carries it.
- **Free-model churn** means the default model id *will* break eventually — graceful fallback +
  settings override is load-bearing, not optional.
- **Privacy posture** — first data to leave the device; opt-in + first-use consent matters for the
  trust Hale sells on.

## Docs to update when built (per CLAUDE.md)
`docs/ROADMAP.md` (move to Done), `docs/ARCHITECTURE.md` (new `aiScan.ts` + auth/secret flow), and
a note in `CLAUDE.md` next to the existing nutrition-OCR convention.
