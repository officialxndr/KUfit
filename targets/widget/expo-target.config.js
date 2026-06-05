/**
 * Hale home-screen + lock-screen widget (WidgetKit / SwiftUI).
 *
 * Generated into the Xcode project by `@bacons/apple-targets` during `expo prebuild`,
 * so the `ios/` folder stays disposable (no hand-edited project). The widget reads a
 * small JSON snapshot the app writes to the shared App Group `UserDefaults`
 * (`group.com.zanderhalverson.hale`) — see `src/lib/widget.ts`.
 *
 * @type {import('@bacons/apple-targets').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  // Distinct from the main "Hale" app target to avoid an Xcode target-name collision.
  name: 'HaleWidget',
  displayName: 'Hale',
  // ActivityKit powers the workout Live Activity (Lock Screen + Dynamic Island).
  frameworks: ['ActivityKit'],
  // Shown in the widget gallery.
  icon: '../../assets/images/icon.png',
  // Mirror the app's App Group so both sides read/write the same UserDefaults suite.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
  // Indigo accent + near-black background, available as Color("…") in Swift.
  colors: {
    $accent: '#6366f1',
    $widgetBackground: '#0a0a0a',
  },
});
