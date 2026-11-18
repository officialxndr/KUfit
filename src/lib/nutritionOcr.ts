import TextRecognition from '@react-native-ml-kit/text-recognition';
import { normalizeUnit, parseAmount } from '@/lib/servingUnits';

/**
 * On-device Nutrition Facts label OCR. Uses Google ML Kit text recognition
 * (`@react-native-ml-kit/text-recognition`) — runs entirely on the device, no
 * cloud/LLM cost. Needs a dev build (native module; not available in Expo Go).
 *
 * The recognizer returns raw text; `parseNutritionText` is a pure best-effort
 * heuristic that pulls the standard U.S. label fields out of it. OCR + label
 * layouts are noisy, so every field is optional and the caller prefills an
 * editable form rather than auto-saving. Sodium is returned in mg (the app's
 * stored unit); all other macros in grams.
 */

export interface ParsedNutrition {
  servingSize?: number;
  servingUnit?: string;
  /** Household serving descriptor, e.g. "2 cookies" / "3 crackers". */
  servingText?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  saturatedFat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number; // mg
}

type NumericField = Exclude<keyof ParsedNutrition, 'servingUnit' | 'servingText'>;
type Unit = 'mg' | 'mcg' | 'g' | 'kcal' | 'cal' | '%' | null;
interface NumTok { value: number; unit: Unit; }

/**
 * Every number(+unit) token in a string — `8g`, `160mg`, `2mcg`, `12.5g`, `230`,
 * `10%`. Decimal commas are normalized. Keeping the `%` ones lets the picker skip
 * "% Daily Value" numbers (the #1 source of wrong reads on packed label lines).
 */
function numTokens(s: string): NumTok[] {
  const toks: NumTok[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|kcal|cal|g|%)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[0].trim() === '') { re.lastIndex++; continue; } // avoid zero-width loop
    const value = parseFloat(m[1].replace(',', '.'));
    if (Number.isFinite(value)) toks.push({ value, unit: (m[2]?.toLowerCase() as Unit) ?? null });
  }
  return toks;
}

/** Choose a field's value from a line's tokens — ignore %DV, normalize units. */
function pickValue(tokens: NumTok[], field: NumericField): number | null {
  const nums = tokens.filter((t) => t.unit !== '%');
  if (!nums.length) return null;
  if (field === 'calories') {
    // Calories usually have no unit; if a kJ/kcal pair is present, take kcal.
    return (nums.find((t) => t.unit === 'kcal' || t.unit === 'cal') ?? nums[0]).value;
  }
  if (field === 'sodium') {
    // Stored in mg — prefer mg, convert g→mg / mcg→mg.
    const t = nums.find((t) => t.unit === 'mg') ?? nums.find((t) => t.unit === 'mcg')
      ?? nums.find((t) => t.unit === 'g') ?? nums[0];
    if (t.unit === 'g') return Math.round(t.value * 1000);
    if (t.unit === 'mcg') return Math.round(t.value / 1000);
    return Math.round(t.value);
  }
  // Gram macros — prefer the token explicitly tagged `g`, else the first non-%.
  return (nums.find((t) => t.unit === 'g') ?? nums[0]).value;
}

interface FieldSpec {
  key: NumericField;
  include: RegExp;
  exclude?: RegExp;
}

// Order matters: specific labels (Saturated/Trans) are excluded from the generic
// ones (Fat) so "Total Fat 8g" doesn't get captured as saturated, etc.
const FIELDS: FieldSpec[] = [
  { key: 'calories', include: /calorie/i, exclude: /from\s*fat/i },
  { key: 'saturatedFat', include: /satur/i },
  { key: 'fat', include: /fat/i, exclude: /satur|trans|from\s*fat|calorie/i },
  { key: 'carbs', include: /carb/i },
  { key: 'fiber', include: /fib(er|re)/i },
  { key: 'sugar', include: /sugar/i },
  { key: 'protein', include: /protein/i },
  { key: 'sodium', include: /sodium/i },
];

const isFieldLine = (l: string) => FIELDS.some((f) => f.include.test(l));

/** Pull the gram serving weight + unit from a "Serving size …" line, if present. */
export function parseServing(lines: string[]): { servingSize?: number; servingUnit?: string; servingText?: string } {
  const line = lines.find((l) => /serving\s*size/i.test(l));
  if (!line) return {};
  // Everything after "Serving size", e.g. "2/3 cup (55g)" / "1 bar (40 g)" / "8 fl oz (240mL)".
  const rest = line.replace(/^.*?serving\s*size\s*[:.]?\s*/i, '').trim();
  // Household measure before the parens ("2/3 cup", "1 bar") — kept as the serving description.
  const household = rest.split('(')[0].trim().replace(/[,;]$/, '');
  // Prefer an explicit gram/ml weight, usually in parens. Decimal commas ("27,5 g") count.
  const grams = rest.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  if (grams) {
    const size = parseFloat(grams[1].replace(',', '.'));
    const text = household && !/^\d+(?:[.,]\d+)?\s*(g|ml)$/i.test(household) ? household : undefined;
    return { servingSize: size, servingUnit: grams[2].toLowerCase(), ...(text ? { servingText: text } : {}) };
  }
  // No metric weight: a household measure with a real unit. Fractions/mixed numbers read whole —
  // "2/3 cup" is 0.67 cup, "1 1/2 tbsp" 1.5 tbsp (the old parse read "2/3 cup" as 2 g).
  const m = rest.match(/^((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾])\s*(fl\.?\s*oz|oz|cups?|tbsp|tsp|pieces?|slices?|servings?)?/i);
  if (!m) return {};
  const qty = parseAmount(m[1]);
  if (qty == null) return {};
  const unit = normalizeUnit(m[2]);
  // A measurable unit is stored canonically; a count ("1 slice") or a bare number becomes a
  // 1-serving item described by the household text, never a guessed gram weight.
  if (unit && unit !== 'serving') return { servingSize: Math.round(qty * 100) / 100, servingUnit: unit, ...(household ? { servingText: household } : {}) };
  return { servingSize: 1, servingUnit: 'serving', ...(household ? { servingText: household } : {}) };
}

/**
 * Best-effort parse of recognized label text into nutrition fields. Pure — safe
 * to unit-test without the native recognizer.
 */
export function parseNutritionText(text: string): ParsedNutrition {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result: ParsedNutrition = { ...parseServing(lines) };

  for (const spec of FIELDS) {
    if (result[spec.key] != null) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!spec.include.test(line) || spec.exclude?.test(line)) continue;

      // Read the value *after* the label word — handles "Total Fat 8g 10%" and
      // labels merged onto one OCR line. For sugars, drop any "Includes …/Added"
      // clause so "Total Sugars 12g Incl. 10g Added" reads 12, not 10.
      const m = line.match(spec.include);
      let region = m ? line.slice(m.index! + m[0].length) : line;
      if (spec.key === 'sugar') region = region.split(/includes|incl\.?|added/i)[0];

      let n = pickValue(numTokens(region), spec.key);
      // Vertical label/value split: value sits on the next (non-label) line.
      if (n == null && i + 1 < lines.length && !isFieldLine(lines[i + 1])) {
        n = pickValue(numTokens(lines[i + 1]), spec.key);
      }
      if (n != null) { result[spec.key] = n; break; }
    }
  }
  return result;
}

/** Capture → recognize → parse. Rejects only if the native recognizer throws. */
export async function recognizeNutritionLabel(uri: string): Promise<ParsedNutrition> {
  const res = await TextRecognition.recognize(uri);
  return parseNutritionText(res.text ?? '');
}
