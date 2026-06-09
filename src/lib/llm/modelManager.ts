import { File, Directory, Paths } from 'expo-file-system';
import { createDownloadResumable, type DownloadResumable } from 'expo-file-system/legacy';
import { create } from 'zustand';
import { MODELS, modelTotalBytes, type ModelDef, type ModelFile } from './models';

/**
 * On-device model storage + download for the Gemma vision scanner. The GGUF + mmproj
 * files live under Documents/ai-models (never bundled). Mirrors the lazy-asset pattern
 * in `lib/exerciseMedia.ts`, but adds progress + cancel for the multi-GB download via
 * the legacy `createDownloadResumable` (the new File API has no progress callback).
 *
 * Download state is a tiny non-persisted Zustand store so both the onboarding chooser
 * and the Settings card can reflect the same in-flight download.
 */

const MODEL_DIR = new Directory(Paths.document, 'ai-models');

function ensureDir() {
  try {
    if (!MODEL_DIR.exists) MODEL_DIR.create({ intermediates: true });
  } catch {
    /* already exists */
  }
}

const fileFor = (f: ModelFile) => new File(MODEL_DIR, f.name);
const fileOnDisk = (f: ModelFile) => {
  try {
    return fileFor(f).exists;
  } catch {
    return false;
  }
};

/** Both files present → the model is usable. */
export function isModelReady(def: ModelDef): boolean {
  return def.files.every(fileOnDisk);
}

/** The first fully-downloaded model, if any (used to know vision is available at all). */
export function firstReadyModelId(): string | null {
  return MODELS.find(isModelReady)?.id ?? null;
}

/** Local filesystem paths llama.rn loads (file:// uris). */
export function modelPaths(def: ModelDef): { model: string; mmproj: string } | null {
  const model = def.files.find((f) => f.role === 'model');
  const mmproj = def.files.find((f) => f.role === 'mmproj');
  if (!model || !mmproj || !isModelReady(def)) return null;
  return { model: fileFor(model).uri, mmproj: fileFor(mmproj).uri };
}

/** Approx bytes a model occupies on disk (for the Settings disk-usage line). */
export function modelDiskBytes(def: ModelDef): number {
  return def.files.reduce((sum, f) => {
    try {
      const file = fileFor(f);
      return sum + (file.exists ? (file.size ?? f.bytes) : 0);
    } catch {
      return sum;
    }
  }, 0);
}

// ── download state (transient, shared across screens) ──────────────────────────
interface DownloadState {
  /** Model id currently downloading, or null. */
  modelId: string | null;
  /** 0..1 across the whole model (all files). */
  progress: number;
  error: string | null;
}
export const useModelDownload = create<DownloadState>(() => ({
  modelId: null,
  progress: 0,
  error: null,
}));

let currentTask: DownloadResumable | null = null;
let currentFile: ModelFile | null = null;

export const isDownloading = (modelId?: string) => {
  const s = useModelDownload.getState();
  return modelId ? s.modelId === modelId : s.modelId != null;
};

/**
 * Download every missing file for a model, reporting aggregate progress. Already-present
 * files (e.g. a projector shared with another quant) are skipped. Resolves true on success.
 * Safe to leave running in the background — the promise + task live at module scope, so the
 * onboarding step can start it and the Settings card can watch it.
 */
export async function downloadModel(def: ModelDef): Promise<boolean> {
  if (isDownloading()) return false; // one at a time — these are huge
  ensureDir();
  useModelDownload.setState({ modelId: def.id, progress: 0, error: null });
  const total = modelTotalBytes(def);
  let baseDone = 0; // bytes from files already finished this run

  try {
    for (const f of def.files) {
      if (fileOnDisk(f)) {
        baseDone += f.bytes;
        useModelDownload.setState({ progress: Math.min(baseDone / total, 1) });
        continue;
      }
      currentFile = f;
      const dest = fileFor(f);
      currentTask = createDownloadResumable(f.url, dest.uri, {}, (p) => {
        const written = p.totalBytesWritten;
        useModelDownload.setState({ progress: Math.min((baseDone + written) / total, 1) });
      });
      const res = await currentTask.downloadAsync();
      currentTask = null;
      currentFile = null;
      if (!res) return false; // cancelled
      baseDone += f.bytes;
    }
    useModelDownload.setState({ modelId: null, progress: 1, error: null });
    return true;
  } catch (e) {
    // Drop a partial file so a retry starts clean (no resume across the error).
    if (currentFile) {
      try { fileFor(currentFile).delete(); } catch { /* ignore */ }
    }
    currentTask = null;
    currentFile = null;
    useModelDownload.setState({ modelId: null, progress: 0, error: String((e as Error)?.message ?? e) });
    return false;
  }
}

/** Cancel an in-flight download and remove the partial file. */
export async function cancelDownload(): Promise<void> {
  try {
    await currentTask?.cancelAsync();
  } catch {
    /* ignore */
  }
  if (currentFile) {
    try { fileFor(currentFile).delete(); } catch { /* ignore */ }
  }
  currentTask = null;
  currentFile = null;
  useModelDownload.setState({ modelId: null, progress: 0, error: null });
}

/** Delete a model's files to reclaim disk. Skips a projector still used by another
 *  installed model (shared file). */
export function deleteModel(def: ModelDef): void {
  for (const f of def.files) {
    const sharedElsewhere = MODELS.some(
      (m) => m.id !== def.id && isModelReady(m) && m.files.some((mf) => mf.name === f.name),
    );
    if (sharedElsewhere) continue;
    try { fileFor(f).delete(); } catch { /* ignore */ }
  }
}
