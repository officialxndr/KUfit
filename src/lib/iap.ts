import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useIAP, ErrorCode } from 'expo-iap';

import { openSupport } from './support';
import { useDonationStore } from '@/stores/donationStore';

/**
 * "Buy the dev a coffee" — native StoreKit tip jar (iOS only).
 *
 * Replaces the external Ko-fi link on iOS with consumable in-app purchases, the only
 * App-Store-compliant way to collect optional support there (Apple guideline 3.1.1 permits
 * IAP *tips to the developer*; an external payment link is a review-rejection risk outside the
 * US storefront). Android keeps the Ko-fi link (`lib/support.ts`) — Google Play actually bars
 * Play Billing for pure tips, so the external link is the compliant path there.
 *
 * Important framing: these are **tips that unlock nothing**, never "donations" (Apple reserves
 * that word for approved nonprofits — 3.2.2). A consumable unlocks nothing, is repurchasable, and
 * never appears in restore/entitlements — exactly right for a tip. Because nothing is unlocked,
 * StoreKit 2's on-device verification is sufficient and **no server / receipt backend is needed**,
 * which preserves Hale's no-server design. The only hard requirement is calling `finishTransaction`
 * (with `isConsumable: true`) or the purchase replays on every launch and can't be tipped again.
 */

// Consumable product IDs — must match the products created in App Store Connect + Hale.storekit.
export const TIP_SKUS = {
  small: 'com.zanderhalverson.hale.tip.small',
  medium: 'com.zanderhalverson.hale.tip.medium',
  large: 'com.zanderhalverson.hale.tip.large',
} as const;

export interface TipTier {
  sku: string;
  /** Coffee-themed label shown in the UI. */
  label: string;
  /** How many cup glyphs to show. */
  cups: number;
  /** Localized, store-formatted price (e.g. "$1.99"). Undefined until products load. */
  price?: string;
}

// Coffee copy keyed by SKU. Price is ALWAYS read from the store (localized per storefront),
// never hard-coded — the $1.99/$4.99/$9.99 anchors live only in App Store Connect.
const TIER_COPY: Omit<TipTier, 'price'>[] = [
  { sku: TIP_SKUS.small, label: 'A coffee', cups: 1 },
  { sku: TIP_SKUS.medium, label: 'A few coffees', cups: 2 },
  { sku: TIP_SKUS.large, label: 'A week of coffee', cups: 3 },
];

const TIP_SKU_LIST = TIER_COPY.map((t) => t.sku);

// Expo Go has no native StoreKit module — guard so the tip screen degrades to a friendly
// "needs a full build" state instead of crashing the JS when it tries to connect.
export const tipJarSupported =
  Platform.OS === 'ios' && Constants.executionEnvironment !== 'storeClient';

/**
 * Single entry point for "support Hale" taps (Dashboard nudge, Settings). Snoozes the nudge,
 * then opens the native tip jar on iOS or the external Ko-fi link everywhere else.
 */
export function openSupportFlow() {
  if (tipJarSupported) {
    // iOS: open the native tip jar. Don't snooze the nudge just for opening — only an actual tip
    // (markDonated in app/tip.tsx) or the explicit Remind/Dismiss controls should snooze it.
    router.push('/tip');
  } else {
    // Android / Expo Go: we can't observe whether the external Ko-fi tip completed, so snooze on
    // open (matches the original external-link behavior).
    useDonationStore.getState().markDonated();
    openSupport();
  }
}

function tipErrorMessage(code?: string): string {
  switch (code) {
    case ErrorCode.NetworkError:
      return 'Network issue — check your connection and try again.';
    case ErrorCode.ItemUnavailable:
      return "This option isn't available right now.";
    case ErrorCode.NotPrepared:
    case ErrorCode.BillingUnavailable:
      return 'In-app purchases aren’t available on this device.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export interface TipJar {
  /** Tiers in display order, each with the live localized price once loaded. */
  tiers: TipTier[];
  /** True once at least one tip product has loaded from the store. */
  ready: boolean;
  /** SKU currently being purchased (shows a spinner), or null. */
  purchasing: string | null;
  /** True after a successful tip — drive the thank-you / confetti off this. */
  thanked: boolean;
  /** User-facing error message (cancellation is swallowed, never surfaced). */
  error: string | null;
  /** Start a purchase for the given SKU. */
  buy: (sku: string) => void;
  /** Clear the thank-you / error state. */
  reset: () => void;
}

/**
 * Drives `app/tip.tsx`. Manages the StoreKit connection (via `useIAP`), loads the tip
 * products, and runs a consumable purchase. iOS-only in practice — only mount this when
 * `tipJarSupported` is true.
 */
export function useTipJar(): TipJar {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [thanked, setThanked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether a tip the user actually started THIS session is in flight. StoreKit replays any
  // UNFINISHED transaction to the listener when the connection opens (e.g. a prior tip whose
  // finishTransaction hiccuped) — those must be consumed silently, never celebrated as a new tip.
  const activeRef = useRef(false);
  // Safety timer for a deferred (Ask-to-Buy / SCA) or stalled purchase that never delivers a
  // success/error event — without it the spinner would spin forever and lock the tiers.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      // Always drain the queue (consume the consumable) so it can be tipped again and doesn't
      // replay on every launch — even for a leftover we didn't initiate this session. Nothing is
      // unlocked, so there's nothing to verify on a server.
      try {
        await finishTransaction({ purchase, isConsumable: true });
      } catch {
        // The user paid even if finishing hiccups — still thank them (when it was their tap).
      }
      // Only celebrate a tip the user actually started here; a replayed leftover is consumed silently.
      if (activeRef.current) {
        activeRef.current = false;
        clearTimer();
        setPurchasing(null);
        setThanked(true);
      }
    },
    onPurchaseError: (e) => {
      if (!activeRef.current) return; // not our in-flight tip — ignore (e.g. a replayed error)
      activeRef.current = false;
      clearTimer();
      setPurchasing(null);
      if (e.code === ErrorCode.UserCancelled) return; // backed out — stay silent
      setError(tipErrorMessage(e.code));
    },
    // fetchProducts / connection failures (e.g. personal-team build with no Paid Apps
    // Agreement): leave products empty so the UI shows the graceful "unavailable" state.
    onError: () => {},
  });

  useEffect(() => {
    if (connected) fetchProducts({ skus: TIP_SKU_LIST, type: 'in-app' }).catch(() => {});
  }, [connected, fetchProducts]);

  // Drop the safety timer if the screen unmounts mid-purchase.
  useEffect(() => () => clearTimer(), []);

  const tiers: TipTier[] = TIER_COPY.map((t) => ({
    ...t,
    price: products.find((p) => p.id === t.sku)?.displayPrice,
  }));
  const ready = tiers.some((t) => t.price != null);

  const buy = useCallback(
    (sku: string) => {
      setError(null);
      setThanked(false);
      setPurchasing(sku);
      activeRef.current = true;
      // If no success/error arrives in time (deferred approval / stall), re-enable the UI without
      // an error. Any real transaction resolves later and is consumed on the next visit.
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (activeRef.current) { activeRef.current = false; setPurchasing(null); }
      }, 90000);
      // Result arrives via the listeners above; the promise only rejects on a synchronous store
      // error (e.g. not-prepared). 4.3.x uses { apple, google } request keys.
      requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' }).catch(
        (e: { code?: string }) => {
          if (!activeRef.current) return; // already resolved by the error listener
          activeRef.current = false;
          clearTimer();
          setPurchasing(null);
          if (e?.code !== ErrorCode.UserCancelled) setError(tipErrorMessage(e?.code));
        }
      );
    },
    [requestPurchase]
  );

  const reset = useCallback(() => {
    setThanked(false);
    setError(null);
  }, []);

  return { tiers, ready, purchasing, thanked, error, buy, reset };
}
