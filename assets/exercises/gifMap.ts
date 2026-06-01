/**
 * Maps an ExerciseDB id → a bundled GIF asset module (require(...)).
 * STUB — populated by `node scripts/seed-exercises.mjs --download` when GIFs
 * are downloaded at seed time and bundled into the app. Until then it's empty
 * and the media resolver falls back to runtime caching of the remote gifUrl.
 */
export const GIF_MAP: Record<string, number> = {};
