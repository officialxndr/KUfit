import * as WebBrowser from 'expo-web-browser';

/**
 * External "Buy the dev a coffee" link (Ko-fi) — the support path on **Android**.
 *
 * On iOS, support goes through the native StoreKit tip jar instead (`lib/iap.ts`), because
 * Apple disallows external payment links for developer tips outside the US storefront. On
 * Android the reverse holds — Google Play bars Play Billing for pure tips, so the external
 * browser link is the compliant, 0%-fee path. Call sites branch on `tipJarSupported`.
 */
export const SUPPORT_URL = 'https://ko-fi.com/haleapp';

export const openSupport = () => {
  WebBrowser.openBrowserAsync(SUPPORT_URL).catch(() => {});
};
