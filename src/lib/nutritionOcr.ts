import TextRecognition from '@react-native-ml-kit/text-recognition';

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
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  saturatedFat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number; // mg
}

/** First number on a line (optionally trailed by a unit), or null. 0 is valid. */
function lineNumber(line: string): number | null {
  const m = line.match(/(\d+(?:\.\d+)?)\s*(?:mg|mcg|g|kcal|cal)?\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

type NumericField = Exclude<keyof ParsedNutrition, 'servingUnit'>;

interface FieldSpec {
  key: NumericField;
  include: RegExp;
  exclude?: RegExp;
}

// Order matters: more specific labels (Saturated/Added) are excluded from the
// generic ones (Fat/Sugars) so "Total Fat 8g" doesn't capture "Saturated Fat 1g".
const FIELDS: FieldSpec[] = [
  { key: 'calories', include: /calorie/i, exclude: /from fat/i },
  { key: 'saturatedFat', include: /satur/i },
  { key: 'fat', include: /fat/i, exclude: /satur|trans|from fat|calorie/i },
  { key: 'carbs', include: /carb/i },
  { key: 'fiber', include: /fib(er|re)/i },
  { key: 'sugar', include: /sugar/i, exclude: /added|includes/i },
  { key: 'protein', include: /protein/i },
  { key: 'sodium', include: /sodium/i },
];

/** Pull the gram serving weight + unit from a "Serving size …" line, if present. */
function parseServing(lines: string[]): { servingSize?: number; servingUnit?: string } {
  const line = lines.find((l) => /serving\s*size/i.test(l));
  if (!line) return {};
  // Prefer an explicit gram weight, usually in parens e.g. "2/3 cup (55g)".
  const grams = line.match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  if (grams) return { servingSize: parseFloat(grams[1]), servingUnit: grams[2].toLowerCase() };
  const any = line.match(/(\d+(?:\.\d+)?)\s*(oz|cup|tbsp|tsp|piece|slice|serving)?/i);
  if (any) return { servingSize: parseFloat(any[1]), servingUnit: (any[2] || 'g').toLowerCase() };
  return {};
}

/**
 * Best-effort parse of recognized label text into nutrition fields. Pure — safe
 * to unit-test without the native recognizer.
 */
export function parseNutritionText(text: string): ParsedNutrition {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result: ParsedNutrition = { ...parseServing(lines) };

  for (const spec of FIELDS) {
    if (result[spec.key] != null) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!spec.include.test(line)) continue;
      if (spec.exclude?.test(line)) continue;
      // Number on the label line, else the next line (vertical label/value split).
      let n = lineNumber(line.replace(spec.include, ''));
      if (n == null && i + 1 < lines.length && !FIELDS.some((f) => f.include.test(lines[i + 1]))) {
        n = lineNumber(lines[i + 1]);
      }
      if (n != null) {
        result[spec.key] = n;
        break;
      }
    }
  }
  return result;
}

/** Capture → recognize → parse. Rejects only if the native recognizer throws. */
export async function recognizeNutritionLabel(uri: string): Promise<ParsedNutrition> {
  const res = await TextRecognition.recognize(uri);
  return parseNutritionText(res.text ?? '');
}
