import { File, Directory, Paths } from 'expo-file-system';
import { GIF_MAP } from '@/assets/exercises/gifMap';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import type { Exercise } from '@/types';

/**
 * Exercise demo media resolution, in priority order:
 *   1. A GIF cached on the device filesystem (offline-ready)
 *   2. A GIF bundled into the app at seed time (GIF_MAP)
 *   3. The remote gifUrl (online only) — kicks off a background cache
 *
 * This is what lets exercise demos work with no internet once downloaded,
 * per the local-first goal.
 */

const MEDIA_DIR = new Directory(Paths.document, 'exercise-media');

function ensureDir() {
  try {
    if (!MEDIA_DIR.exists) MEDIA_DIR.create({ intermediates: true });
  } catch {
    /* already exists */
  }
}

function gifFile(ex: Exercise): File | null {
  if (!ex.exerciseDbId) return null;
  return new File(MEDIA_DIR, `${ex.exerciseDbId}.gif`);
}

export function cachedUri(ex: Exercise): string | null {
  const f = gifFile(ex);
  try {
    return f && f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

export function bundledGif(ex: Exercise): number | null {
  if (!ex.exerciseDbId) return null;
  return GIF_MAP[ex.exerciseDbId] ?? null;
}

/** Source suitable for <Image source={...}> (expo-image). */
export type MediaSource = number | { uri: string } | null;

export function resolveMediaSource(ex: Exercise): MediaSource {
  const cached = cachedUri(ex);
  if (cached) return { uri: cached };
  const bundled = bundledGif(ex);
  if (bundled != null) return bundled;
  if (ex.gifUrl) return { uri: ex.gifUrl };
  if (ex.videoUrl) return { uri: ex.videoUrl };
  if (ex.imageUrl) return { uri: ex.imageUrl };
  return null;
}

/** Download a single exercise's GIF to the filesystem cache. */
export async function cacheGif(ex: Exercise): Promise<string | null> {
  if (!ex.gifUrl || !ex.exerciseDbId) return null;
  const f = gifFile(ex);
  if (!f) return null;
  if (f.exists) return f.uri;
  ensureDir();
  try {
    await File.downloadFileAsync(ex.gifUrl, f);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

/** Bulk-cache every exercise GIF for offline use (Settings → "Download demos"). */
export async function downloadAllMedia(
  onProgress?: (done: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  ensureDir();
  const exercises = workoutRepo.getAllExercises();
  let done = 0;
  for (const ex of exercises) {
    if (ex.gifUrl && ex.exerciseDbId) {
      await cacheGif(ex);
    }
    done += 1;
    onProgress?.(done, exercises.length);
  }
  return { cached: done, total: exercises.length };
}
