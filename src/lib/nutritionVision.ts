import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { recognizeNutritionLabel, type ParsedNutrition } from '@/lib/nutritionOcr';
import { describeImageJson } from '@/lib/llm/gemma';
import { SCHEMA_HINT } from '@/lib/llm/nutritionSchema';
import { getModel, type ModelDef } from '@/lib/llm/models';
import { isModelReady, modelPaths } from '@/lib/llm/modelManager';
import { AI_ENABLED } from '@/lib/aiConfig';
import type { AiProvider } from '@/stores/settingsStore';

/**
 * Direct image → on-device Gemma 4 E2B vision label scanning (no OCR in the path).
 * The model reads the photo and returns nutrition JSON; we resize first to cut the
 * vision-encode memory + latency, then defensively validate the JSON (small models
 * honor structured output unevenly even with a grammar). On any failure — model not
 * ready, low-RAM device, native error, garbage JSON — we fall back to the existing
 * OCR + regex parser so scanning still works everywhere.
 */

const SYSTEM_PROMPT = [
  'You read a packaged-food nutrition label from a photo and extract it into structured JSON.',
  `Return ONLY a JSON object matching: ${SCHEMA_HINT}`,
  '',
  'Label wording varies by country and brand — map whatever the label says to these fields:',
  '• calories ← "Calories", "Cal", or "Energy". Use the kcal/Cal value; if only kJ is shown, divide kJ by 4.184.',
  '• protein ← "Protein".',
  '• carbs ← "Total Carbohydrate", "Carbohydrate", "Total Carb.", or "Carbs".',
  '• sugar ← "Total Sugars", "Sugars", or "of which sugars". Use the TOTAL — never the "Added Sugars" / "Includes Xg Added Sugars" number.',
  '• fat ← "Total Fat" or "Fat".',
  '• saturatedFat ← "Saturated Fat", "Sat. Fat", or "of which saturates".',
  '• fiber ← "Dietary Fiber", "Fiber", or "Fibre".',
  '• sodium ← "Sodium", in MILLIGRAMS. If the label instead lists "Salt" in grams, set sodium = salt_grams × 400.',
  '• servingSize / servingUnit ← the amount in ONE serving. ALWAYS prefer the WEIGHT IN GRAMS (or volume in ml) whenever the label prints one — even when the serving is also described as a household measure, return the weight, not the household count. Examples: "Serving size 2/3 cup (55g)" → 55 + "g"; "3 crackers (30g)" → 30 + "g"; "1 bar (40 g)" → 40 + "g"; "Per 250 ml" → 250 + "ml". Only fall back to a household count/measure (e.g. "2 cookies", "1 cup") when NO gram or ml weight appears anywhere for the serving.',
  '',
  'Serving size — read carefully, this is the most common mistake:',
  '- The label shows TWO numbers. "Serving size" / "Serv. size" is the amount per serving — that is what you want.',
  '- "Servings per container" / "Servings Per Package" / "About 14 servings" is how many servings are in the WHOLE package. NEVER put that number in servingSize.',
  '- If serving size is "1 package" / "1 container" but a gram or ml weight is also shown, use that weight (e.g. "1 container (245g)" → 245 + "g"), not 1.',
  '',
  'Rules:',
  '- Use the values PER SERVING as printed. If only per-100g/100ml is shown, use those (servingSize 100, servingUnit "g" or "ml").',
  '- Units: sodium in milligrams; every other nutrient in grams. Convert if the label uses different units (e.g. mg→g).',
  '- Ignore "% Daily Value"/%DV percentages, Trans Fat, Cholesterol, and "Calories from Fat".',
  '- Omit any field you cannot read with confidence. Never guess or invent numbers.',
].join('\n');

const INSTRUCTION = 'Read this nutrition label and return the JSON, mapping its wording to the fields above.';

// Plausible per-serving ranges — anything outside is a misread and gets dropped.
const RANGES: Record<keyof Omit<ParsedNutrition, 'servingUnit'>, [number, number]> = {
  servingSize: [0, 5000],
  calories: [0, 2000],
  protein: [0, 300],
  carbs: [0, 300],
  fat: [0, 300],
  saturatedFat: [0, 300],
  fiber: [0, 300],
  sugar: [0, 300],
  sodium: [0, 10000],
};

/** Pull a JSON object out of model text (tolerates ```json fences / stray prose). */
function extractJson(raw: string): unknown {
  const fenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  const slice = start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced;
  return JSON.parse(slice);
}

/**
 * Pure, testable: validate raw model text into `ParsedNutrition`. Coerces numbers,
 * drops anything out of range or non-finite, keeps a sane servingUnit string.
 */
export function parseVisionJson(raw: string): ParsedNutrition {
  let obj: Record<string, unknown>;
  try {
    const parsed = extractJson(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    obj = parsed as Record<string, unknown>;
  } catch {
    return {};
  }

  const out: ParsedNutrition = {};
  for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
    const v = obj[key];
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
    const [lo, hi] = RANGES[key];
    if (Number.isFinite(n) && n >= lo && n <= hi) out[key] = n;
  }
  if (typeof obj.servingUnit === 'string' && obj.servingUnit.trim()) {
    out.servingUnit = obj.servingUnit.trim().slice(0, 12).toLowerCase();
  }
  return out;
}

/** Resolve the user's chosen model if AI is in this build AND it's downloaded + ready. */
export function readyVisionModel(modelId: string | null | undefined): ModelDef | null {
  if (!AI_ENABLED) return null;
  const def = getModel(modelId);
  return def && isModelReady(def) ? def : null;
}

export interface ScanConfig {
  /** profile.aiProvider — which engine reads the label. */
  provider: AiProvider;
  /** on-device provider: profile.aiModelId */
  modelId: string | null;
  /** on-device provider: profile.aiThinking — reason before answering (slower, more accurate). */
  thinking: boolean;
  // Future API providers (gemini / self-hosted server) would add: apiKey?, baseUrl?, apiModel?.
}

export interface ScanResult {
  parsed: ParsedNutrition;
  /** true = read by an AI engine, false = built-in OCR. */
  usedAi: boolean;
  /** When an AI provider was attempted but failed (so we fell back to OCR), the reason —
   *  surfaced in the UI so a silent fallback is visible while testing. */
  aiError?: string;
}

/** Vision-only path against a known-ready model. Throws on failure. Returns the
 *  parsed fields plus the raw model text (surfaced for on-device debugging). */
async function scanWithVision(imageUri: string, def: ModelDef, thinking: boolean): Promise<{ parsed: ParsedNutrition; raw: string }> {
  const paths = modelPaths(def);
  if (!paths) throw new Error('Model files missing');
  const shrunk = await manipulateAsync(imageUri, [{ resize: { width: 1024 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  const raw = await describeImageJson({
    system: SYSTEM_PROMPT,
    instruction: INSTRUCTION,
    imageUri: shrunk.uri,
    modelPath: paths.model,
    mmprojPath: paths.mmproj,
    thinking,
  });
  return { parsed: parseVisionJson(raw), raw };
}

/**
 * Scan a label photo. Dispatches on the chosen provider; falls back to built-in OCR when
 * the provider is off / not in this build / not ready / fails. Never throws.
 *
 * Adding an API provider later = a new `else if` here (e.g. `cfg.provider === 'gemini'`)
 * that returns the same `ScanResult` shape — the UI and form-fill don't change.
 */
export async function scanLabel(imageUri: string, cfg: ScanConfig): Promise<ScanResult> {
  // On-device Gemma vision (only when this build includes AI + a model is downloaded).
  if (cfg.provider === 'device' && AI_ENABLED) {
    const def = readyVisionModel(cfg.modelId);
    if (def) {
      let aiError: string;
      try {
        const { parsed, raw } = await scanWithVision(imageUri, def, cfg.thinking);
        if (Object.keys(parsed).length) return { parsed, usedAi: true };
        // Loaded + ran but produced nothing usable — surface the raw text so we can see
        // whether the model emitted `{}`, prose, or values the parser dropped.
        aiError = `Model returned no usable fields.\nRaw output: ${raw.trim().slice(0, 240) || '(empty)'}`;
      } catch (e) {
        aiError = String((e as Error)?.message ?? e);
      }
      const parsed = await recognizeNutritionLabel(imageUri);
      return { parsed, usedAi: false, aiError };
    }
  }
  // FUTURE: else if (cfg.provider === 'gemini' | 'server') → call the API, same ScanResult.
  // 'off', AI stripped from this build, or model not ready → built-in OCR.
  const parsed = await recognizeNutritionLabel(imageUri);
  return { parsed, usedAi: false };
}
