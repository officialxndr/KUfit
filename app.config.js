// Dynamic Expo config layered on top of app.json.
//
// HealthKit requires a *paid* Apple Developer account: its entitlement (added by the
// @kingstinct/react-native-healthkit config plugin) blocks signing under a free Apple ID
// ("Personal Team"). To test e.g. Bluetooth on a free account, build a HealthKit-free
// variant by setting HEALTHKIT=0 — this strips the plugin (and its entitlement) plus the
// HealthKit Info.plist strings. health.ts already no-ops gracefully when the native
// module isn't authorized, so nothing else needs to change.
//
//   HealthKit-free (free Apple ID) iOS build, from your Mac:
//     HEALTHKIT=0 npx expo prebuild -p ios --clean
//     HEALTHKIT=0 npx expo run:ios --device
//
//   Full build (paid account) — the default, HealthKit included:
//     npx expo run:ios            (or run:android / EAS build)
//
// Android is unaffected (Health Connect is a separate module and the flag is iOS-only
// in practice, but we keep the config identical so the default build behaves as before).

module.exports = ({ config }) => {
  const healthKitEnabled = process.env.HEALTHKIT !== '0';

  // On-device AI build switch. `AI=0` strips the llama.rn config plugin here (no C++20 /
  // entitlement injection) and `react-native.config.js` drops its autolinking (no llama.cpp
  // in the binary). The JS reads `extra.aiEnabled` (lib/aiConfig) to hide all AI UI. Default on.
  const aiEnabled = process.env.AI !== '0';
  if (!aiEnabled) {
    config.plugins = (config.plugins || []).filter((p) => {
      const name = Array.isArray(p) ? p[0] : p;
      return name !== 'llama.rn';
    });
  }

  if (!healthKitEnabled) {
    config.plugins = (config.plugins || []).filter((p) => {
      const name = Array.isArray(p) ? p[0] : p;
      return name !== '@kingstinct/react-native-healthkit';
    });
    if (config.ios && config.ios.infoPlist) {
      delete config.ios.infoPlist.NSHealthShareUsageDescription;
      delete config.ios.infoPlist.NSHealthUpdateUsageDescription;
    }
  }

  // App variant — keep the production build byte-for-byte the same identity as TestFlight,
  // but give local dev / preview builds a distinct name + bundle id so they install
  // *alongside* the App Store app and are obvious to tell apart on the home screen. The
  // production EAS profile sets APP_VARIANT=production (see eas.json); a plain
  // `expo run:ios` leaves it unset → treated as a dev build ("Hale Dev").
  const variant = process.env.APP_VARIANT ?? 'development';
  if (variant !== 'production') {
    const isPreview = variant === 'preview';
    const tag = isPreview ? 'preview' : 'dev';
    const label = isPreview ? 'Preview' : 'Dev';
    config.name = `${config.name} ${label}`;
    if (config.ios) config.ios.bundleIdentifier = `${config.ios.bundleIdentifier}.${tag}`;
    if (config.android) config.android.package = `${config.android.package}.${tag}`;
  }

  // On-device AI (llama.rn) needs the increased-memory-limit + extended-virtual-addressing
  // entitlements to load the multi-GB Gemma vision model without an iOS jetsam kill. These are
  // OPT-IN, because (unlike most capabilities) Xcode's automatic signing can't self-provision
  // them — the App ID must have "Increased Memory Limit" + "Extended Virtual Addressing" enabled
  // in the Apple Developer portal first, or signing fails. So:
  //   • normal dev builds (no flag) ship WITHOUT them → `expo run:ios` signs with the plain team
  //     profile (the AI model just won't have the headroom to load — fine for everything else);
  //   • set AI_MEM=1 once you've enabled the two capabilities on the .dev App ID to test the model;
  //   • production (TestFlight) always gets them — enable the capabilities on the prod App ID too.
  // Free Apple IDs can't sign these at all, so they're gated on the paid-team build (healthKitEnabled).
  const aiMem = aiEnabled && healthKitEnabled && (process.env.AI_MEM === '1' || variant === 'production');
  if (aiMem && config.ios) {
    config.ios.entitlements = {
      ...(config.ios.entitlements || {}),
      'com.apple.developer.kernel.increased-memory-limit': true,
      'com.apple.developer.kernel.extended-virtual-addressing': true,
    };
  }

  // Surface the flags to JS (Constants.expoConfig.extra.*) in case a screen wants to
  // hide Health UI in the stripped build or show a "Dev"/"Preview" badge.
  config.extra = { ...(config.extra || {}), healthKitEnabled, appVariant: variant, aiMem, aiEnabled };

  return config;
};
