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

  // Surface the flag to JS (Constants.expoConfig.extra.healthKitEnabled) in case a screen
  // wants to hide Health UI in the stripped build.
  config.extra = { ...(config.extra || {}), healthKitEnabled };

  return config;
};
