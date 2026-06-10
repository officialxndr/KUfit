/**
 * On-device vision-LLM catalog for nutrition-label scanning.
 *
 * Each model is a Gemma 4 E2B vision build: a main GGUF (the language model) plus
 * a multimodal projector (`mmproj`) GGUF (the vision encoder bridge llama.cpp needs
 * to actually *read* the photo). Both files download on first use — they are never
 * bundled in the app binary (~2 GB+). The catalog is shared by the onboarding model
 * chooser and Settings → On-device AI label scanning, so there is one source of truth.
 *
 * NOTE: the HuggingFace file names below are the public `unsloth/gemma-4-E2B-it-GGUF`
 * quant + projector names; verify them against the repo before shipping (quant file
 * names occasionally get renamed). `bytes` is approximate — only used for the progress
 * denominator + the disk-usage label; the real size comes from the server's
 * Content-Length during download.
 */

const HF_BASE = 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main';

/** The vision projector is identical across quants, so both models share this file
 *  (downloaded once — the model manager skips a file that is already on disk). */
const MMPROJ: ModelFile = {
  name: 'gemma-4-E2B-mmproj-F16.gguf',
  url: `${HF_BASE}/mmproj-F16.gguf`,
  bytes: 940 * 1e6,
  role: 'mmproj',
};

// Qwen3-VL-2B GGUF (unsloth) — Thinking + Instruct, 3-bit (Q3_K_M). Runs on llama.rn's
// llama.cpp (LLM_ARCH_QWEN3VL). NOTE: the MLX-community builds are .safetensors (Apple MLX),
// which llama.cpp can't load — GGUF only. Each variant ships its own F16 vision projector
// (distinct local names so they never collide on disk / with Gemma's).
const QWEN3VL_2B_THINKING_BASE = 'https://huggingface.co/unsloth/Qwen3-VL-2B-Thinking-GGUF/resolve/main';
const QWEN3VL_2B_THINKING_MMPROJ: ModelFile = {
  name: 'Qwen3VL-2B-Thinking-mmproj-F16.gguf',
  url: `${QWEN3VL_2B_THINKING_BASE}/mmproj-F16.gguf`,
  bytes: 819 * 1e6,
  role: 'mmproj',
};
const QWEN3VL_2B_INSTRUCT_BASE = 'https://huggingface.co/unsloth/Qwen3-VL-2B-Instruct-GGUF/resolve/main';
const QWEN3VL_2B_INSTRUCT_MMPROJ: ModelFile = {
  name: 'Qwen3VL-2B-Instruct-mmproj-F16.gguf',
  url: `${QWEN3VL_2B_INSTRUCT_BASE}/mmproj-F16.gguf`,
  bytes: 819 * 1e6,
  role: 'mmproj',
};

export type ModelFileRole = 'model' | 'mmproj';

export interface ModelFile {
  /** Local filename (also used to de-dupe a shared projector across models). */
  name: string;
  /** Remote download URL. */
  url: string;
  /** Approximate size in bytes (progress denominator + disk label only). */
  bytes: number;
  role: ModelFileRole;
}

export interface ModelDef {
  /** Stable id persisted in settings (`profile.aiModelId`). */
  id: string;
  /** Short name for the chooser. */
  label: string;
  /** One-line trade-off shown under the label. */
  description: string;
  /** Human-readable total download size, e.g. "~2.6 GB". */
  sizeLabel: string;
  /** Recommended minimum device RAM (GB) — the chooser warns below this. */
  minRamGB: number;
  /** Reasoning behavior: 'always' (Thinking builds), 'never' (Instruct builds), or
   *  'optional' (the user's Deep-reasoning toggle decides). Drives `enable_thinking`
   *  and whether the Settings toggle is shown. */
  reasoning: 'always' | 'never' | 'optional';
  /** Main GGUF + projector. */
  files: ModelFile[];
}

export const MODELS: ModelDef[] = [
  {
    id: 'gemma-4-e2b-q4',
    label: 'Gemma 4 E2B · Balanced',
    description: 'Best label accuracy. Larger download, needs a recent 8 GB-RAM phone.',
    sizeLabel: '~2.6 GB',
    minRamGB: 8,
    reasoning: 'optional',
    files: [
      { name: 'gemma-4-E2B-it-Q4_K_M.gguf', url: `${HF_BASE}/gemma-4-E2B-it-Q4_K_M.gguf`, bytes: 1.7e9, role: 'model' },
      MMPROJ,
    ],
  },
  {
    id: 'gemma-4-e2b-q3',
    label: 'Gemma 4 E2B · Smaller',
    description: 'Smaller + faster, a little less accurate. Lighter on storage and RAM.',
    sizeLabel: '~2.3 GB',
    minRamGB: 6,
    reasoning: 'optional',
    files: [
      { name: 'gemma-4-E2B-it-Q3_K_M.gguf', url: `${HF_BASE}/gemma-4-E2B-it-Q3_K_M.gguf`, bytes: 1.4e9, role: 'model' },
      MMPROJ,
    ],
  },
  {
    id: 'qwen3-vl-2b-instruct-q3',
    label: 'Qwen3-VL 2B · Instruct',
    description: 'Smallest download (3-bit). No reasoning step, so faster replies — the quick Qwen pick for label scans.',
    sizeLabel: '~1.8 GB',
    minRamGB: 6,
    reasoning: 'never',
    files: [
      { name: 'Qwen3VL-2B-Instruct-Q3_K_M.gguf', url: `${QWEN3VL_2B_INSTRUCT_BASE}/Qwen3-VL-2B-Instruct-Q3_K_M.gguf`, bytes: 0.94e9, role: 'model' },
      QWEN3VL_2B_INSTRUCT_MMPROJ,
    ],
  },
  {
    id: 'qwen3-vl-2b-thinking-q3',
    label: 'Qwen3-VL 2B · Thinking',
    description: 'Same size, but reasons before answering — slower, and 3-bit can dent label accuracy.',
    sizeLabel: '~1.8 GB',
    minRamGB: 6,
    reasoning: 'always',
    files: [
      { name: 'Qwen3VL-2B-Thinking-Q3_K_M.gguf', url: `${QWEN3VL_2B_THINKING_BASE}/Qwen3-VL-2B-Thinking-Q3_K_M.gguf`, bytes: 0.94e9, role: 'model' },
      QWEN3VL_2B_THINKING_MMPROJ,
    ],
  },
];

export const getModel = (id: string | null | undefined): ModelDef | null =>
  MODELS.find((m) => m.id === id) ?? null;

export const modelTotalBytes = (def: ModelDef): number =>
  def.files.reduce((sum, f) => sum + f.bytes, 0);
