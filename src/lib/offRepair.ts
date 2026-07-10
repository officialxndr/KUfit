import { getMeta, setMeta } from '@/lib/db';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { fetchOffByBarcode } from '@/lib/foodSearch';

/**
 * One-time repair of Open Food Facts items imported before the serving-size fix, where
 * `calories`/`servingSize` sat on mismatched bases (a 30 g entry reading thousands of kcal —
 * see `offNutrition` in `lib/foodSearch.ts`). We re-fetch each corrupt item by barcode, rewrite
 * its nutrition with the fixed parser, and **rescale its existing logs' `servingQty`** so the
 * grams the user actually logged stay the same (only the shown calories are corrected).
 *
 * Runs in the background on launch. Idempotent + gated: it marks itself done once it has
 * cleared everything it could, and an all-failed pass (e.g. offline) leaves the flag unset so
 * the next launch retries. Bounded per run so it can't storm the OFF API.
 */
const REPAIR_KEY = 'off-serving-repair';
const ATTEMPT_KEY = 'off-serving-repair-attempts';
const REPAIR_VERSION = 'v1';
const MAX_PER_RUN = 40;
const MAX_ATTEMPTS = 3; // give up (some items may be unfetchable / removed from OFF)

export async function repairOffFoodItems(): Promise<void> {
  if (getMeta(REPAIR_KEY) === REPAIR_VERSION) return;
  const broken = foodRepo.getBrokenOffFoodItems();
  if (broken.length === 0) { setMeta(REPAIR_KEY, REPAIR_VERSION); return; }

  let reachedNetwork = false;
  for (const item of broken.slice(0, MAX_PER_RUN)) {
    try {
      // fetchOffByBarcode bypasses the local cache (barcodeLookup would return the broken row
      // itself) and throws on a network failure, which we treat as "offline, retry later".
      const fresh = await fetchOffByBarcode(item.barcode);
      reachedNetwork = true;
      // Apply only a clean, gram/ml-based, plausible re-fetch — else leave the item as-is.
      const per = fresh && fresh.servingSize > 0 ? fresh.calories / fresh.servingSize : Infinity;
      if (!fresh || (fresh.servingUnit !== 'g' && fresh.servingUnit !== 'ml') || per > 9) continue;
      // Keep the represented grams constant: gramsOld = qty·sizeOld, newQty = gramsOld / sizeNew.
      foodRepo.rescaleItemReferences(item.localId, item.servingSize / fresh.servingSize);
      foodRepo.updateFoodItemNutrition(item.localId, fresh);
    } catch {
      /* network error → offline; don't burn an attempt (handled below) */
    }
  }

  if (foodRepo.getBrokenOffFoodItems().length === 0) {
    setMeta(REPAIR_KEY, REPAIR_VERSION); // fixed everything
    return;
  }
  // Only "spend" an attempt when the network was actually reachable (so a string of offline
  // launches can't permanently disable the repair); give up once the remaining items have had
  // a few real chances (they're likely delisted from OFF).
  if (reachedNetwork) {
    const attempts = Number(getMeta(ATTEMPT_KEY) ?? '0') + 1;
    setMeta(ATTEMPT_KEY, String(attempts));
    if (attempts >= MAX_ATTEMPTS) setMeta(REPAIR_KEY, REPAIR_VERSION);
  }
}
