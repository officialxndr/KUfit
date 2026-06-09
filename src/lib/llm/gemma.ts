import { initLlama, type LlamaContext } from 'llama.rn';
import { NUTRITION_SCHEMA } from './nutritionSchema';

/**
 * Thin wrapper over llama.rn for one job: hand Gemma 4 E2B a label photo and get
 * schema-constrained nutrition JSON back. Vision needs the main GGUF plus the mmproj
 * projector (`initMultimodal`).
 *
 * Memory is the hard constraint on iOS (~2.5–4 GB resident with the projector), so the
 * context is loaded per scan and released immediately after — we never hold it between
 * scans. The UI already serialises scans (one "Reading…" at a time); `busy` guards a
 * second concurrent load that would OOM.
 */

let busy = false;

const stripScheme = (uri: string) => uri.replace(/^file:\/\//, '');

export interface VisionScanArgs {
  /** System prompt (role/instructions + schema). */
  system: string;
  /** User instruction paired with the image. */
  instruction: string;
  /** Local image path (already resized). */
  imageUri: string;
  /** Loaded model file paths. */
  modelPath: string;
  mmprojPath: string;
  /** Reason before answering (slower, more accurate) vs answer directly (fast). */
  thinking: boolean;
}

/**
 * Run one vision completion and return the raw model text (expected to be JSON, since
 * `response_format` constrains decoding to NUTRITION_SCHEMA). Throws on any native /
 * load failure so the caller can fall back to OCR.
 */
export async function describeImageJson(args: VisionScanArgs): Promise<string> {
  if (busy) throw new Error('A scan is already running');
  busy = true;
  let ctx: LlamaContext | null = null;
  try {
    ctx = await initLlama({
      model: stripScheme(args.modelPath),
      n_ctx: 4096,
      n_gpu_layers: 99, // offload to Metal; llama.rn falls back to CPU where unsupported
      ctx_shift: false, // required for multimodal contexts
      use_mlock: false, // don't pin multi-GB weights in RAM
    });

    const ok = await ctx.initMultimodal({ path: stripScheme(args.mmprojPath), use_gpu: true });
    const support = ok ? await ctx.getMultimodalSupport() : { vision: false, audio: false };
    if (!support.vision) throw new Error('Model has no vision support');

    // Gemma's chat template has no `system` role — fold the instructions into the
    // single user turn alongside the image, or the prompt gets dropped and the model
    // returns an empty object.
    const result = await ctx.completion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${args.system}\n\n${args.instruction}` },
            { type: 'image_url', image_url: { url: stripScheme(args.imageUri) } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: NUTRITION_SCHEMA } },
      temperature: 0.1,
      jinja: true,
      // Thinking ON: `reasoning_format:'auto'` makes llama.rn parse the reasoning into
      // `reasoning_content` and apply the JSON grammar to the post-think answer (`content`);
      // budget caps the think block so the JSON always lands. Thinking OFF: the grammar binds
      // from the first token, so it's much faster (no reasoning preamble to generate).
      ...(args.thinking
        ? { enable_thinking: true, reasoning_format: 'auto' as const, thinking_budget_tokens: 512, n_predict: 1024 }
        : { enable_thinking: false, n_predict: 512 }),
    });
    // `content` = answer with the reasoning stripped; fall back to raw text.
    return result.content || result.text || '';
  } finally {
    try {
      await ctx?.release();
    } catch {
      /* ignore */
    }
    busy = false;
  }
}

export const isScanning = () => busy;
