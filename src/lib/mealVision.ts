import { prepareVisionImage } from '@/lib/imagePrep';
import { MEAL_SCHEMA, MEAL_SCHEMA_HINT } from '@/lib/llm/nutritionSchema';
import { describeImageJsonAny, isVisionConfigured, type AiVisionConfig } from '@/lib/llm/visionProviders';

/**
 * On-device AI estimate of a *prepared meal* from a photo (vs. nutritionVision.ts,
 * which reads a printed label). The model identifies the food, guesses portion size,
 * and returns total calories + macros for the plate. Estimates are rough by nature —
 * this is a "see how it works" feature; the user reviews/edits before logging.
 */

const SYSTEM_PROMPT = [
  'You are a careful nutrition estimator. From a photo of prepared food, estimate the TOTAL nutrition',
  'for the ENTIRE amount of food visible — the whole pizza, the full plate — NOT a single serving.',
  `Return ONLY a JSON object matching: ${MEAL_SCHEMA_HINT}`,
  '',
  'Work it out step by step in "breakdown" BEFORE giving the totals:',
  '1. Identify every distinct food and drink in the photo.',
  "2. Estimate each one's real portion — count the pieces/slices, judge size against the plate, hand, or utensils, and note thickness. People photograph FULL portions; do not assume a small one.",
  '3. Estimate calories for each item — INCLUDE oil, butter, cheese, sauces and dressings (large and easy to miss) — then SUM them for the total.',
  '',
  'Calorie anchors to calibrate against (adjust to what you actually see):',
  '• 1 slice of regular pizza ~285 kcal; a whole 14-inch pizza (8 slices) ~2000-2400 kcal.',
  '• 1 cup of cooked rice or pasta ~200 kcal (1 cup ~ a clenched fist).',
  '• a palm-size cooked chicken breast ~200 kcal; a typical fast-food burger ~300-600 kcal.',
  '• 1 tbsp of oil, butter, or dressing ~100-120 kcal.',
  '',
  'name: a short dish name. calories: the TOTAL from your breakdown. protein/carbs/fat: grams for the whole portion.',
  'Give one best number per field, never a range. Lean toward realistic full portions rather than undercounting.',
].join('\n');

const INSTRUCTION = 'Estimate the TOTAL nutrition for ALL the food in this photo (the whole portion), show your working in "breakdown", and return the JSON.';

export interface MealEstimate {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Pure: validate raw model text into a MealEstimate (or null if unusable). */
export function parseMealJson(raw: string): MealEstimate | null {
  let obj: Record<string, unknown>;
  try {
    const fenced = raw.replace(/```(?:json)?/gi, '').trim();
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    const parsed = JSON.parse(start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced);
    if (!parsed || typeof parsed !== 'object') return null;
    obj = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const num = (v: unknown) => (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN);
  const clamp = (n: number, hi: number) => (Number.isFinite(n) && n >= 0 && n <= hi ? Math.round(n) : 0);
  const calories = clamp(num(obj.calories), 6000);
  if (!calories) return null; // no usable calorie estimate
  return {
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 80) : 'Estimated meal',
    calories,
    protein: clamp(num(obj.protein), 500),
    carbs: clamp(num(obj.carbs), 800),
    fat: clamp(num(obj.fat), 500),
  };
}

export interface MealEstimateResult {
  estimate: MealEstimate | null;
  /** Raw model text (surfaced for on-device debugging). */
  raw: string;
  error?: string;
}

/** Run the on-device vision model against a meal photo. Never throws. */
export async function estimateMeal(imageUri: string, cfg: AiVisionConfig): Promise<MealEstimateResult> {
  if (cfg.provider === 'off' || !isVisionConfigured(cfg)) {
    return { estimate: null, raw: '', error: 'No AI is set up. Choose On-device or an API endpoint in Settings → AI.' };
  }
  try {
    const shrunkUri = await prepareVisionImage(imageUri);
    const raw = await describeImageJsonAny(cfg, { system: SYSTEM_PROMPT, instruction: INSTRUCTION, imageUri: shrunkUri, schema: MEAL_SCHEMA });
    return { estimate: parseMealJson(raw), raw };
  } catch (e) {
    return { estimate: null, raw: '', error: String((e as Error)?.message ?? e) };
  }
}
