import type { UnitSystem } from '@/types';

export const UNIT_LABELS = {
  METRIC: { weight: 'kg', height: 'cm', distance: 'km', smallLength: 'cm', volume: 'ml' },
  IMPERIAL: { weight: 'lbs', height: 'ft/in', distance: 'mi', smallLength: 'in', volume: 'fl oz' },
};

export const toDisplay = (kg: number, system: UnitSystem): number =>
  system === 'IMPERIAL' ? +(kg * 2.20462).toFixed(1) : +kg.toFixed(1);

export const toKg = (value: number, system: UnitSystem): number =>
  system === 'IMPERIAL' ? value / 2.20462 : value;

/** US fluid ounce in millilitres (the single shared constant; scales/food sheet dupe this locally). */
export const FL_OZ_ML = 29.5735;

/** Water/liquid volume: ml → display unit (ml for metric, US fl oz for imperial), whole number. */
export const mlToDisplay = (ml: number, system: UnitSystem): number =>
  system === 'IMPERIAL' ? Math.round(ml / FL_OZ_ML) : Math.round(ml);

/** display volume → ml (stored metric). */
export const toMl = (value: number, system: UnitSystem): number =>
  system === 'IMPERIAL' ? value * FL_OZ_ML : value;

/** e.g. "1500 ml" / "51 fl oz" (distinct from `formatVolume`, which is training tonnage in kg). */
export const formatWater = (ml: number, system: UnitSystem): string =>
  `${mlToDisplay(ml, system)} ${UNIT_LABELS[system].volume}`;

// Feet/inches come from one rounded total-inches value (via cmToFeetInches) — rounding the
// inches separately could produce 5'12" for e.g. 182.5 cm.
const feetInchesLabel = (cm: number): string => {
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
};

export const cmToDisplay = (cm: number, system: UnitSystem): string =>
  system === 'IMPERIAL' ? feetInchesLabel(cm) : `${cm} cm`;

export const inchesToCm = (inches: number): number => inches * 2.54;

/** cm → whole feet + inches (rounded), for imperial height entry/display. */
export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalIn = Math.round(cm / 2.54);
  return { feet: Math.floor(totalIn / 12), inches: totalIn % 12 };
};

/** feet + inches → cm (stored metric), rounded to 0.1 cm. */
export const feetInchesToCm = (feet: number, inches: number): number =>
  Math.round((feet * 12 + inches) * 2.54 * 10) / 10;

export const formatWeight = (kg: number, system: UnitSystem): string => {
  const val = toDisplay(kg, system);
  const label = UNIT_LABELS[system].weight;
  return `${val} ${label}`;
};

/** Total training volume (stored in kg) → display unit, compact (e.g. "12.4k lbs"). */
export const formatVolume = (kg: number, system: UnitSystem): string => {
  const val = toDisplay(kg, system);
  const label = UNIT_LABELS[system].weight;
  return `${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)} ${label}`;
};

export const formatHeight = (cm: number, system: UnitSystem): string =>
  system === 'IMPERIAL' ? feetInchesLabel(cm) : `${cm} cm`;

// Check if a serving unit is gram-based (affects editing UX)
export const isGramUnit = (unit: string): boolean =>
  ['g', 'gram', 'grams', 'ml', 'milliliter', 'milliliters'].includes(unit.toLowerCase());
