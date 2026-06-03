const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Hale's reminders use **local** notifications only, which do not need the APNs
 * push entitlement. `expo prebuild` auto-applies the bundled `expo-notifications`
 * config plugin, which adds `aps-environment` unconditionally — and a *free /
 * personal* Apple team can't sign the Push Notifications capability ("Personal
 * development teams ... do not support the Push Notifications capability"). This
 * strips that entitlement so the app signs on any account; local notification
 * scheduling is unaffected. (It also spares paid-account builds from having to
 * enable Push Notifications on the App ID.)
 *
 * Ordering: this plugin is registered (via `app.json` plugins) *before* the
 * auto-applied notifications plugin, so in the entitlements mod chain it runs
 * *after* it (the last-registered mod runs first, then chains to earlier ones) —
 * removing the key the notifications plugin just set.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
