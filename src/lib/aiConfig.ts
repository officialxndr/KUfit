import Constants from 'expo-constants';

/**
 * Build-time switch for the whole on-device AI feature.
 *
 * A build made with `AI=0` (see `app.config.js`) strips the `llama.rn` native module +
 * its memory entitlements from the binary — no C++ compile, smaller app, simpler signing.
 * In that build this flag is `false`, so the JS never calls the (absent) native module and
 * every AI surface (Settings card, onboarding step) hides itself. Default builds = `true`.
 *
 * This is separate from the *runtime* `profile.aiProvider` toggle (off / on-device / future
 * API providers), which the user flips inside a build that *does* include AI.
 */
export const AI_ENABLED =
  (Constants.expoConfig?.extra as { aiEnabled?: boolean } | undefined)?.aiEnabled !== false;

/** Device guidance shown wherever on-device AI is offered (onboarding + Settings). */
export const DEVICE_AI_SUPPORT =
  'On-device AI runs best on a recent iPhone with 8 GB of RAM (iPhone 15 Pro, 16, or 17). ' +
  'Older or lower-RAM devices will be slow or fall back to the built-in scanner.';
