/**
 * Serving-unit math for food logging — pure, so it's unit-tested.
 *
 * Every logged food stores a single `servingQty` **multiplier** against the food's own
 * serving (`servingSize` + `servingUnit`, e.g. 100 g or 240 ml). The quantity sheet lets
 * the user type an amount in any compatible unit; these helpers convert that to/from the
 * multiplier. Mass and volume never cross (no density data), so a gram-based food offers
 * mass units and an ml-based food offers volume units. Anything else (a "slice", "bar",
 * recipe serving) is serving-only.
 */

/** Canonical unit keys the app understands. */
export type MassUnit = 'g' | 'kg' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'fl oz';
export type FoodUnit = 'serving' | MassUnit | VolumeUnit;

/** Conversions to a canonical base (grams for mass, ml for volume). US customary volumes. */
export const UNIT_TO_CANONICAL: Record<MassUnit | VolumeUnit, number> = {
  g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
  ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, 'fl oz': 29.5735,
};

const MASS: readonly MassUnit[] = ['g', 'kg', 'oz', 'lb'];
const VOLUME: readonly VolumeUnit[] = ['ml', 'l', 'tsp', 'tbsp', 'cup', 'fl oz'];

/** Units offered in the picker, in display order. kg/l are accepted but not offered (clutter). */
const MASS_PICKER: FoodUnit[] = ['serving', 'g', 'oz', 'lb'];
const VOLUME_PICKER: FoodUnit[] = ['serving', 'ml', 'fl oz', 'cup', 'tbsp', 'tsp'];

// Free-text spellings (custom-food form, label scans, OFF, old rows) → canonical key.
// Matched case-insensitively after trimming + dropping trailing periods. Capital-T "T"
// (tablespoon) vs "t" (teaspoon) is the one case-sensitive cooking convention, handled below.
const ALIASES: Record<string, MassUnit | VolumeUnit | 'serving'> = {
  g: 'g', gr: 'g', grm: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ozs: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', mls: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', cc: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l', ltr: 'l',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  'fl oz': 'fl oz', floz: 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl ounce': 'fl oz',
  serving: 'serving', servings: 'serving', srv: 'serving',
};

/**
 * Normalize a free-text unit to a canonical key, or null if it isn't a measurable unit
 * (e.g. "slice", "bar", "cookie" — those stay serving-only). `"fl. oz."`, `"Grams"`,
 * `"Tbsp"`, `"mL"` all resolve.
 */
export function normalizeUnit(raw: string | null | undefined): FoodUnit | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === 'T') return 'tbsp'; // cooking shorthand: capital T = tablespoon
  if (trimmed === 't') return 'tsp';
  const key = trimmed.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return ALIASES[key] ?? null;
}

export type UnitKind = 'mass' | 'volume' | 'serving';
export function unitKind(unit: string | null | undefined): UnitKind {
  const u = normalizeUnit(unit);
  if (u && (MASS as readonly string[]).includes(u)) return 'mass';
  if (u && (VOLUME as readonly string[]).includes(u)) return 'volume';
  return 'serving';
}

/** Units the quantity sheet offers for a food, based on whether its serving is a mass or volume. */
export function unitsFor(servingUnit: string | null | undefined): FoodUnit[] {
  const k = unitKind(servingUnit);
  return k === 'mass' ? MASS_PICKER : k === 'volume' ? VOLUME_PICKER : ['serving'];
}

export interface ServingBasis {
  servingSize: number;
  servingUnit: string;
  /** Household serving descriptor ("3 cookies", "2/3 cup", "1 bar") — enables a per-piece unit. */
  servingText?: string | null;
}

/**
 * A household unit derived from the serving description: "3 cookies" → unit `cookie`, where
 * one serving = 3 of them, so the user can log "1 cookie" instead of "0.33 servings". Works for
 * counts ("2 slices", "1 bar", "12 chips") and for a household measure on a food that can't
 * otherwise convert to it — "2/3 cup (55 g)" on cereal gives a `cup` unit (82.5 g each).
 */
export interface HouseholdUnit {
  /** Unit key stored in entries ("cookie", "cup"). */
  key: string;
  /** How many of this unit make one serving (3 cookies → 3). */
  perServing: number;
  singular: string;
  plural: string;
}

// Words that describe a serving but aren't a unit you'd count out.
const NOT_A_PIECE = new Set(['serving', 'servings', 'portion', 'portions', 'package', 'packages', 'pack', 'container', 'containers', 'g', 'grams']);

// "-ie" nouns whose plural is "-ies" but whose singular isn't "-y" (cookies ≠ cooky).
const IE_NOUNS = new Set(['cookie', 'brownie', 'smoothie', 'pie', 'veggie', 'hoagie', 'goodie', 'rookie', 'pierogie', 'wheatie', 'sweetie', 'scrunchie', 'tie']);

function singularize(w: string): string {
  if (/ies$/i.test(w) && IE_NOUNS.has(w.slice(0, -1).toLowerCase())) return w.slice(0, -1); // cookies → cookie
  if (/ies$/i.test(w) && w.length > 4) return w.replace(/ies$/i, 'y'); // patties → patty
  if (/(ches|shes|xes|sses|oes)$/i.test(w)) return w.replace(/es$/i, ''); // sandwiches → sandwich, tomatoes → tomato
  if (/[^s]s$/i.test(w)) return w.slice(0, -1); // cookies → cookie
  return w;
}
function pluralize(w: string): string {
  if (/[^aeiou]y$/i.test(w)) return w.replace(/y$/i, 'ies');
  if (/(ch|sh|x|ss|s)$/i.test(w)) return `${w}es`;
  return `${w}s`;
}

export function householdUnit(food: ServingBasis): HouseholdUnit | null {
  const text = food.servingText?.split('(')[0].trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  // "<qty> <label>" — qty may be a fraction or mixed number ("1 1/2 cups", "2/3 cup", "½ cup").
  const m = text.match(/^((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|\d*\s*[½⅓⅔¼¾⅛])\s+([a-z][a-z' -]{0,23})$/);
  if (!m) return null;
  const count = parseAmount(m[1]);
  if (count == null || count > 100) return null;
  // Keep the head noun of short phrases: "cookies" / "pieces" / "slices bread" → first word.
  const word = m[2].trim().split(' ')[0];
  if (NOT_A_PIECE.has(word)) return null;
  const canon = normalizeUnit(word);
  if (canon === 'serving') return null;
  // A real unit the food already converts to (oz on a gram food, cup on an ml food) adds nothing.
  if (canon && unitKind(canon) === unitKind(food.servingUnit)) return null;
  if (canon) {
    // A measurable unit of the *other* kind ("cup" on a gram food) becomes a calibrated unit.
    return { key: canon, perServing: count, singular: canon, plural: canon };
  }
  const singular = singularize(word);
  return { key: singular, perServing: count, singular, plural: pluralize(singular) };
}

/** Every unit offered for a specific food: its mass/volume units plus any household unit. */
export function unitsForFood(food: ServingBasis): string[] {
  const base: string[] = unitsFor(food.servingUnit);
  const h = householdUnit(food);
  return h && !base.includes(h.key) ? [base[0], h.key, ...base.slice(1)] : base;
}

/** True when `unit` can be used to log this food (so a remembered unit is still valid). */
export function isUnitValidFor(food: ServingBasis | string | null | undefined, unit: string | null | undefined): boolean {
  if (!unit) return false;
  if (food && typeof food === 'object') {
    const h = householdUnit(food);
    if (h && unit === h.key) return true;
  }
  const servingUnit = typeof food === 'object' && food ? food.servingUnit : food;
  const u = normalizeUnit(unit);
  if (!u) return false;
  if (u === 'serving') return true;
  return unitKind(servingUnit) === unitKind(u);
}

/** Size of one serving in canonical units (g or ml), or null when the serving isn't measurable. */
function servingCanon(food: ServingBasis): number | null {
  const u = normalizeUnit(food.servingUnit);
  if (!u || u === 'serving') return null;
  const size = food.servingSize;
  if (!Number.isFinite(size) || size <= 0) return null;
  return size * UNIT_TO_CANONICAL[u];
}

/**
 * Convert an amount (in `unit`) to a servings multiplier for the given food. Returns 0 for an
 * unusable amount, and NaN-safe. An incompatible unit (grams for an ml food) is treated as
 * servings rather than producing a silently wrong number — callers only offer valid units.
 */
export function amountToServings(food: ServingBasis, amount: number, unit: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const h = householdUnit(food);
  if (h && unit === h.key) return amount / h.perServing;
  const u = normalizeUnit(unit);
  if (!u || u === 'serving') return amount;
  const base = servingCanon(food);
  if (base == null || unitKind(food.servingUnit) !== unitKind(u)) return amount;
  return (amount * UNIT_TO_CANONICAL[u]) / base;
}

/** Inverse of `amountToServings`: a servings multiplier → the amount in `unit`. */
export function servingsToAmount(food: ServingBasis, servings: number, unit: string): number {
  if (!Number.isFinite(servings) || servings <= 0) return 0;
  const h = householdUnit(food);
  if (h && unit === h.key) return servings * h.perServing;
  const u = normalizeUnit(unit);
  if (!u || u === 'serving') return servings;
  const base = servingCanon(food);
  if (base == null || unitKind(food.servingUnit) !== unitKind(u)) return servings;
  return (servings * base) / UNIT_TO_CANONICAL[u];
}

/**
 * Round an amount for the input field, with precision that fits the unit: whole grams/ml
 * above 10, otherwise up to 2 decimals (so 0.25 cup / 1.5 oz / 0.33 servings survive).
 */
export function roundAmount(amount: number, unit: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const u = normalizeUnit(unit);
  const fine = u === 'g' || u === 'ml';
  // Whole numbers from 100 up; below that a decimal matters (1 tbsp = 14.8 ml, not 15).
  if (fine && amount >= 100) return Math.round(amount);
  if (fine) return Math.round(amount * 10) / 10;
  // Under 1 of a coarse unit, 2 decimals lose too much (60 g → 0.13 lb is 1.7% short), so keep 3.
  if (amount < 1) return Math.round(amount * 1000) / 1000;
  return Math.round(amount * 100) / 100;
}

/** Convert an amount between two units for the same food (keeps the physical quantity). */
export function convertAmount(food: ServingBasis, amount: number, from: string, to: string): number {
  return roundAmount(servingsToAmount(food, amountToServings(food, amount, from), to), to);
}

const VULGAR: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

/**
 * Parse what a user typed into the amount field. Accepts `1.5`, `1,5` (decimal comma — the iOS
 * decimal pad shows a comma in many locales), `.5`, `1/2`, `1 1/2`, `1½`, `½`. Returns null for
 * empty / unparseable / non-positive input (never NaN), so callers can block submit.
 */
export function parseAmount(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s) return null;
  // Unicode fraction, optionally after a whole number: "1½" / "1 ½" / "½".
  const vm = s.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (vm) return pos((vm[1] ? Number(vm[1]) : 0) + VULGAR[vm[2]]);
  // Mixed number "1 1/2" or plain fraction "1/2".
  const fm = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (fm) {
    const den = Number(fm[3]);
    if (den === 0) return null;
    return pos((fm[1] ? Number(fm[1]) : 0) + Number(fm[2]) / den);
  }
  // Thousands grouping: "1,250" / "2,500" (a non-zero lead + comma + exactly 3 digits) is
  // 1250, not 1.25 — nobody types "1.250 g" meaning a gram and a quarter with a comma.
  if (/^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) return pos(Number(s.replace(/,/g, '')));
  // Decimal: one comma or dot as the separator ("1,5" / "1.5" / ".5" / "2.").
  if (/^\d*[.,]?\d+$|^\d+[.,]$/.test(s)) return pos(Number(s.replace(',', '.')));
  return null;
}
const pos = (n: number): number | null => (Number.isFinite(n) && n > 0 ? n : null);

/** Like `parseAmount` but also accepts 0 ("0 g fat" on a label). Null for empty/garbage. */
export function parseNonNegative(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = String(text).trim();
  if (/^0*([.,]0*)?$/.test(s) && /0/.test(s)) return 0;
  return parseAmount(s);
}

/** Display an amount without float noise: 150 → "150", 1.5 → "1.5", 0.3333 → "0.33". */
export function formatAmount(amount: number, unit: string): string {
  const r = roundAmount(amount, unit);
  return String(r);
}

/** Label for a unit next to an amount: pluralizes `serving` and household units ("2 cookies"). */
export function unitLabel(unit: string, amount: number, food?: ServingBasis | null): string {
  const h = food ? householdUnit(food) : null;
  if (h && unit === h.key) return amount === 1 ? h.singular : h.plural;
  const u = normalizeUnit(unit) ?? unit;
  return u === 'serving' ? (amount === 1 ? 'serving' : 'servings') : u;
}

/** The stored key for a unit on this food: its household unit, else the canonical unit (or null). */
export function resolveUnit(food: ServingBasis, unit: string | null | undefined): string | null {
  if (!unit) return null;
  const h = householdUnit(food);
  if (h && unit === h.key) return h.key;
  return isUnitValidFor(food, unit) ? normalizeUnit(unit) : null;
}

/**
 * The amount + unit the quantity sheet opens at. Edit mode reopens in the unit the entry was
 * logged in (so "150 g" edits as 150 g, not "1.5 servings"); add mode prefills the item's
 * last-logged amount + unit. Either falls back to servings when the unit no longer fits.
 */
export function initialSheetEntry(
  food: ServingBasis & { lastAmount?: number | null; lastUnit?: string | null },
  initialServings: number,
  baselineQty: number,
  entry?: { amount?: number | null; unit?: string | null } | null,
): { amount: string; unit: string } {
  const editing = baselineQty > 0;
  const entryUnit = editing ? resolveUnit(food, entry?.unit) : null;
  if (entryUnit) {
    return { amount: formatAmount(servingsToAmount(food, initialServings, entryUnit), entryUnit), unit: entryUnit };
  }
  const lastUnit = !editing && food.lastAmount != null && food.lastAmount > 0 ? resolveUnit(food, food.lastUnit) : null;
  if (lastUnit) {
    return { amount: formatAmount(food.lastAmount!, lastUnit), unit: lastUnit };
  }
  return { amount: formatAmount(initialServings, 'serving'), unit: 'serving' };
}

/** A food's serving for headers/lists: "100 g", "240 ml", "1 serving", "2 slice". */
export function describeServing(food: ServingBasis): string {
  const u = normalizeUnit(food.servingUnit);
  const size = Number.isFinite(food.servingSize) && food.servingSize > 0 ? food.servingSize : 1;
  const n = Math.round(size * 100) / 100;
  if (u === 'serving' || (!u && !food.servingUnit)) return `${n} ${unitLabel('serving', n)}`;
  return `${n} ${u ?? food.servingUnit}`;
}

/**
 * Human description of a logged amount for the Today list: the unit the user entered
 * ("150 g", "1.5 cup") when known, else the food's own unit ("176 g" for 1.76 × 100 g),
 * else servings. Never shows the raw float multiplier.
 */
export function describeLoggedAmount(
  food: ServingBasis,
  servingQty: number,
  entry?: { amount?: number | null; unit?: string | null } | null,
): string {
  const u = entry?.amount != null && entry.amount > 0 ? resolveUnit(food, entry.unit) : null;
  if (u) {
    // Recompute from servingQty so a later nutrition repair (which rescales servingQty to keep
    // the physical amount) can't leave a stale entered amount on screen.
    const amt = servingsToAmount(food, servingQty, u);
    return `${formatAmount(amt, u)} ${unitLabel(u, roundAmount(amt, u), food)}`;
  }
  const kind = unitKind(food.servingUnit);
  if (kind !== 'serving') {
    const fu = normalizeUnit(food.servingUnit)!;
    const amt = servingsToAmount(food, servingQty, fu);
    return `${formatAmount(amt, fu)} ${fu}`;
  }
  const q = roundAmount(servingQty, 'serving');
  return `${q} ${unitLabel('serving', q)}`;
}
