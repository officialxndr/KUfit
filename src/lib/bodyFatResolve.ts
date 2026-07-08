/**
 * Single source of truth for "what body-fat % do we show / use, and from where".
 *
 * Both the Body view (`HealthBody`) and the body-fat-goal → goal-weight bridge
 * (`goalWeight.currentLeanMassKg`) call this, so the number on screen and the number that
 * drives the derived goal weight can never disagree. Two knobs shape it:
 *   • `profile.bodyFatSource` ('dexa' | 'navy') — which of the two available sources wins
 *     when both exist (the user's toggle on the Body card).
 *   • `profile.bodyFatEstimateBasis` ('anyMeasured' | 'dexaOnly') — what anchors the
 *     non-Navy ("measured/estimate") source: any logged body-fat % (default), or strictly
 *     DEXA scans (so a scale/manually-typed % never pollutes the estimate).
 */
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { navyBodyFat, estimateBodyFat } from '@/lib/bodyComposition';
import type { Profile } from '@/stores/settingsStore';
import type { WeightEntry, BodyMeasurement } from '@/types';

export type BodyFatSourceKind = 'measured' | 'baseline' | 'navy';

export interface BodyFatView {
  latest: WeightEntry | null;
  measurement: BodyMeasurement | null;
  /** Latest DEXA weigh-in (carries bone mass etc.), regardless of the estimate basis. */
  dexa: WeightEntry | null;
  /** The baseline actually used for a `'baseline'` estimate (basis-appropriate), else null. */
  baseline: WeightEntry | null;
  navyBf: number | null;
  /** The non-Navy value (a measured % or a lean-mass estimate), or null. */
  dexaBf: number | null;
  dexaSource: 'measured' | 'baseline';
  /** The resolved %, honoring `bodyFatSource`. Null when nothing is available. */
  bf: number | null;
  source: BodyFatSourceKind;
  /** True when both the non-Navy and Navy sources exist (so the toggle is meaningful). */
  canChooseSource: boolean;
}

/** A weigh-in that carries DEXA data (source flag or any DEXA-only compartment). */
export function isDexaEntry(e: Pick<WeightEntry, 'source' | 'boneMassKg' | 'visceralFatKg' | 'boneTScore'>): boolean {
  return e.source === 'DEXA' || e.boneMassKg != null || e.visceralFatKg != null || e.boneTScore != null;
}

export function computeBodyFatView(profile: Profile): BodyFatView {
  const latest = healthRepo.getLatestWeightEntry();
  const measurement = healthRepo.getLatestMeasurementBySite();
  const dexa = healthRepo.getLatestDexa();

  const dexaOnly = profile.bodyFatEstimateBasis === 'dexaOnly';
  // In DEXA-only mode the non-Navy source is anchored strictly on DEXA scans; otherwise any
  // logged body-fat % can anchor it.
  const baseline = dexaOnly ? dexa : healthRepo.getLatestBodyFatBaseline();
  // A measured % on the latest weigh-in only counts for the non-Navy source when it qualifies
  // under the basis (always in anyMeasured; only for a DEXA entry in dexaOnly).
  const latestQualifies = latest?.bodyFat != null && (!dexaOnly || isDexaEntry(latest));

  const navyBf =
    profile.navyBodyFatEnabled && measurement && profile.heightCm && (profile.sex === 'MALE' || profile.sex === 'FEMALE')
      ? navyBodyFat({
          sex: profile.sex,
          heightCm: profile.heightCm,
          neckCm: measurement.neck ?? 0,
          waistCm: measurement.waist ?? 0,
          hipCm: measurement.hips,
        })
      : null;

  let dexaBf: number | null = null;
  let dexaSource: 'measured' | 'baseline' = 'measured';
  let usedBaseline: WeightEntry | null = null;
  if (latestQualifies && latest) {
    dexaBf = latest.bodyFat!;
    dexaSource = 'measured';
  } else if (baseline?.bodyFat != null) {
    dexaBf = latest ? estimateBodyFat(baseline.weightKg, baseline.bodyFat, latest.weightKg) : baseline.bodyFat;
    dexaSource = latest ? 'baseline' : 'measured';
    usedBaseline = dexaSource === 'baseline' ? baseline : null;
  }

  const preferNavy = profile.bodyFatSource === 'navy';
  let bf: number | null = null;
  let source: BodyFatSourceKind = 'measured';
  if (preferNavy && navyBf != null) {
    bf = navyBf;
    source = 'navy';
  } else if (dexaBf != null) {
    bf = dexaBf;
    source = dexaSource;
  } else if (navyBf != null) {
    bf = navyBf;
    source = 'navy';
  }

  return {
    latest,
    measurement,
    dexa,
    baseline: usedBaseline,
    navyBf,
    dexaBf,
    dexaSource,
    bf,
    source,
    canChooseSource: dexaBf != null && navyBf != null,
  };
}
