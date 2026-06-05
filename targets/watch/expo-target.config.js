/**
 * Hale Apple Watch app (SwiftUI / watchOS).
 *
 * Generated into the Xcode project by `@bacons/apple-targets` during `expo prebuild` (like the
 * `targets/widget/` target), so `ios/` stays disposable. The watch app is a remote + display for
 * the phone's workout engine — it talks to the iOS app over **WatchConnectivity** (see the
 * `modules/hale-watch/` native bridge and `src/lib/watch.ts`), runs an **HKWorkoutSession** for
 * heart-rate-based calories, and themes itself from the snapshot the phone pushes (matching the
 * in-app accent). The Swift sources in this folder are the source of truth — don't hand-edit the
 * generated Xcode target.
 *
 * Needs a paid Apple team (App Groups + HealthKit can't be signed by a free team) and a physical
 * watch (watchOS workout features don't run in the simulator). The HealthKit entitlement here
 * means the watch app ships with the default (HealthKit-enabled) build, not the HEALTHKIT=0 one.
 *
 * @type {import('@bacons/apple-targets').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'watch',
  // Distinct from the main "Hale" app + "HaleWidget" targets to avoid a name collision.
  name: 'HaleWatch',
  displayName: 'Hale',
  // watchOS 10.0 floor: apple-targets defaults to 11.0, which drops Apple Watch SE (1st gen) /
  // Series 4-5 (their max is watchOS 10.x). 10.0 covers those and still supports everything the
  // app uses (its lowest API need is the watchOS 10 two-param `onChange`).
  deploymentTarget: '10.0',
  // Linked frameworks (SwiftUI/WatchKit auto-link from `import`).
  frameworks: ['WatchConnectivity', 'HealthKit'],
  // Shown on the watch home screen.
  icon: '../../assets/images/icon.png',
  // Same App Group as the app + widget so the bundle ids line up; HealthKit for the workout.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
    'com.apple.developer.healthkit': true,
  },
  // Indigo accent (Color("$accent")); the live theme is pushed from the app at runtime.
  colors: {
    $accent: '#6366f1',
  },
});
