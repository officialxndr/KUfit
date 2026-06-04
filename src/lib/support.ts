import * as WebBrowser from 'expo-web-browser';

/**
 * Donation / "Support Hale" link. Opens in the browser — no in-app payment, which
 * keeps us clear of Apple's IAP rules (donations that unlock nothing) and takes 0%.
 */
export const SUPPORT_URL = 'https://ko-fi.com/haleapp';

export const openSupport = () => {
  WebBrowser.openBrowserAsync(SUPPORT_URL).catch(() => {});
};
