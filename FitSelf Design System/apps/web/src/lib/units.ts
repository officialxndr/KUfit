import type { UnitSystem } from '@/types'

export const UNIT_LABELS = {
  METRIC: { weight: 'kg', height: 'cm', distance: 'km', smallLength: 'cm' },
  IMPERIAL: { weight: 'lbs', height: 'ft/in', distance: 'mi', smallLength: 'in' },
}

export function toDisplayWeight(kg: number, system: UnitSystem): number {
  return system === 'IMPERIAL' ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10
}

export function toKg(value: number, system: UnitSystem): number {
  return system === 'IMPERIAL' ? value / 2.20462 : value
}

export function cmToDisplay(cm: number, system: UnitSystem): string {
  if (system === 'IMPERIAL') {
    const totalInches = cm / 2.54
    const feet = Math.floor(totalInches / 12)
    const inches = Math.round(totalInches % 12)
    return `${feet}'${inches}"`
  }
  return `${cm} cm`
}

export function inchesToCm(inches: number): number {
  return inches * 2.54
}

export function toDisplayLength(cm: number, system: UnitSystem): number {
  return system === 'IMPERIAL' ? Math.round((cm / 2.54) * 10) / 10 : Math.round(cm * 10) / 10
}

export function fromDisplayLength(value: number, system: UnitSystem): number {
  return system === 'IMPERIAL' ? inchesToCm(value) : value
}

export function formatWeight(kg: number, system: UnitSystem): string {
  return `${toDisplayWeight(kg, system)} ${UNIT_LABELS[system].weight}`
}

export function formatLength(cm: number, system: UnitSystem): string {
  return `${toDisplayLength(cm, system)} ${UNIT_LABELS[system].smallLength}`
}

// True when a food's serving unit is a mass/volume unit that can be logged by grams.
export function isGramUnit(unit: string): boolean {
  return ['g', 'ml'].includes(unit.trim().toLowerCase())
}
