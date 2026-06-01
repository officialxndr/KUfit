import type { UnitSystem } from '@/types';

export const UNIT_LABELS = {
  METRIC: { weight: 'kg', height: 'cm', distance: 'km', smallLength: 'cm' },
  IMPERIAL: { weight: 'lbs', height: 'ft/in', distance: 'mi', smallLength: 'in' },
};

export const toDisplay = (kg: number, system: UnitSystem): number =>
  system === 'IMPERIAL' ? +(kg * 2.20462).toFixed(1) : +kg.toFixed(1);

export const toKg = (value: number, system: UnitSystem): number =>
  system === 'IMPERIAL' ? value / 2.20462 : value;

export const cmToDisplay = (cm: number, system: UnitSystem): string =>
  system === 'IMPERIAL'
    ? `${Math.floor(cm / 30.48)}'${Math.round((cm % 30.48) / 2.54)}"`
    : `${cm} cm`;

export const inchesToCm = (inches: number): number => inches * 2.54;

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
  system === 'IMPERIAL'
    ? `${Math.floor(cm / 30.48)}'${Math.round((cm % 30.48) / 2.54)}"`
    : `${cm} cm`;

// Check if a serving unit is gram-based (affects editing UX)
export const isGramUnit = (unit: string): boolean =>
  ['g', 'gram', 'grams', 'ml', 'milliliter', 'milliliters'].includes(unit.toLowerCase());
