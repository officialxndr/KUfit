const { withMainActivity, withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Finishes the Android wiring that `react-native-health-connect` (v3.5.3) leaves to the app.
 * Its own Expo plugin only adds the permissions-rationale intent-filter — it does NOT:
 *
 *   1. Register the permission-result delegate. The library's `requestPermission()` launches a
 *      `lateinit var` `ActivityResultLauncher` that is ONLY initialized by
 *      `HealthConnectPermissionDelegate.setPermissionDelegate(activity)`. The library never calls
 *      that itself (see its README "Android setup"), so the host `MainActivity.onCreate` must —
 *      before the activity starts. Without it, tapping "Connect" crashes the app with
 *      `UninitializedPropertyAccessException` instead of showing the Health Connect permission UI.
 *
 *   2. Declare the health read permissions we request (Weight / BodyFat / Steps /
 *      ActiveCaloriesBurned / HeartRate) and make the Health Connect provider app visible via
 *      `<queries>` (required on Android 13 and below).
 *
 *   3. Add the Android 14+ (API 34+) permissions-rationale intent-filter
 *      (`android.intent.action.VIEW_PERMISSION_USAGE` + category
 *      `android.intent.category.HEALTH_PERMISSIONS`). The library's plugin only adds the legacy
 *      `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`, which the platform Health Connect on
 *      Android 14+ ignores — without the new filter the permission screen closes itself with
 *      "App should support rationale intent, finishing!" and grants nothing.
 *
 * Keep the requested record types here in sync with `src/lib/health.ts` (androidHealth.requestPermissions).
 */

const READ_PERMISSIONS = [
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_BODY_FAT',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_HEART_RATE',
];

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';
const DELEGATE_IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function withDelegateInMainActivity(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withHealthConnect: expected a Kotlin MainActivity (got ' + cfg.modResults.language + ')');
    }
    let src = cfg.modResults.contents;

    if (!src.includes(DELEGATE_IMPORT)) {
      // Insert the import right after the package declaration.
      src = src.replace(/^(package .*\r?\n)/m, `$1\n${DELEGATE_IMPORT}\n`);
    }
    if (!src.includes(DELEGATE_CALL)) {
      // Register the delegate immediately after super.onCreate(...), before the activity starts.
      src = src.replace(/(super\.onCreate\([^\n]*\)\r?\n)/, `$1    ${DELEGATE_CALL}\n`);
      if (!src.includes(DELEGATE_CALL)) {
        throw new Error('withHealthConnect: could not find super.onCreate(...) to anchor the delegate call');
      }
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withHealthPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of READ_PERMISSIONS) {
      const exists = manifest['uses-permission'].some((p) => p.$ && p.$['android:name'] === name);
      if (!exists) manifest['uses-permission'].push({ $: { 'android:name': name } });
    }

    if (!Array.isArray(manifest.queries)) manifest.queries = manifest.queries ? [manifest.queries] : [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const q = manifest.queries[0];
    q.package = q.package || [];
    const hasPkg = q.package.some((p) => p.$ && p.$['android:name'] === HEALTH_CONNECT_PACKAGE);
    if (!hasPkg) q.package.push({ $: { 'android:name': HEALTH_CONNECT_PACKAGE } });

    // Android 14+ permissions-rationale intent-filter on the launcher activity.
    const app = manifest.application && manifest.application[0];
    const activities = (app && app.activity) || [];
    const mainActivity =
      activities.find((a) => a.$ && a.$['android:name'] === '.MainActivity') || activities[0];
    if (mainActivity) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'] || [];
      const hasRationale = mainActivity['intent-filter'].some((f) =>
        (f.action || []).some((a) => a.$ && a.$['android:name'] === 'android.intent.action.VIEW_PERMISSION_USAGE')
      );
      if (!hasRationale) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
          category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        });
      }
    }

    return cfg;
  });
}

const withHealthConnect = (config) => withHealthPermissions(withDelegateInMainActivity(config));

module.exports = createRunOncePlugin(withHealthConnect, 'hale-health-connect', '1.0.0');
