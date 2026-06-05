import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Switches the iOS app icon to match the chosen **accent** (Settings → Appearance). Each preset
 * accent has a pre-generated icon (white logo on the accent background — `scripts/gen-accent-icons.mjs`,
 * registered as an alternate icon by the `expo-alternate-app-icons` config plugin). The default
 * "indigo" accent and any custom hex keep the polished brand icon (`null`).
 *
 * Switching goes through our own native module (`HaleLiveActivity.setAppIcon`), which uses the private
 * `_setAlternateIconName:` to **skip iOS's "you changed the icon" alert** — Apple's public API always
 * shows it. We read the current icon first and only switch when it actually differs. No-op off iOS.
 */
const Native = requireOptionalNativeModule<{
  getAppIcon(): string | null;
  setAppIcon(name: string | null): void;
}>('HaleLiveActivity');

// Preset accent key → alternate icon name (PascalCase, matching the app.json plugin config).
const ACCENT_ICON: Record<string, string> = {
  violet: 'Violet',
  sky: 'Sky',
  emerald: 'Emerald',
  amber: 'Amber',
  rose: 'Rose',
};

export function applyAccentIcon(accent: string): void {
  if (Platform.OS !== 'ios' || !Native) return;
  const target = ACCENT_ICON[accent] ?? null; // indigo / custom hex → default brand icon
  try {
    if ((Native.getAppIcon() ?? null) === target) return;
    Native.setAppIcon(target);
  } catch {
    /* best-effort — never let an icon swap break theme changes */
  }
}

/** Whether the app icon already matches the given accent (so the "Match icon" button can reflect state). */
export function iconMatchesAccent(accent: string): boolean {
  if (Platform.OS !== 'ios' || !Native) return false;
  try {
    return (Native.getAppIcon() ?? null) === (ACCENT_ICON[accent] ?? null);
  } catch {
    return false;
  }
}
