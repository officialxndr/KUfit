import * as SQLite from 'expo-sqlite';

// `useNewConnection: true` opens a dedicated connection and skips
// `registerDatabaseForDevToolsAsync` (see expo-sqlite's openDatabaseSync). That
// dev-tools registration shares/owns the connection in development and was tearing
// it down out from under us — surfacing as `NativeDatabase.prepareSync/execSync ...
// NullPointerException` mid-render and a black screen until a full reload. A single
// dedicated connection has a stable lifecycle we control.
export const db = SQLite.openDatabaseSync('fitself.db', { useNewConnection: true });

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS food_items (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      barcode TEXT,
      name TEXT NOT NULL,
      brand TEXT,
      servingSize REAL NOT NULL,
      servingUnit TEXT DEFAULT 'g',
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL,
      sugar REAL,
      sodium REAL,
      saturatedFat REAL,
      detailsJson TEXT,
      isFavorite INTEGER DEFAULT 0,
      source TEXT DEFAULT 'MANUAL',
      isCustom INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      date TEXT NOT NULL,
      meal TEXT NOT NULL,
      foodItemLocalId TEXT,
      foodItemServerId TEXT,
      recipeLocalId TEXT,
      recipeServerId TEXT,
      servingQty REAL NOT NULL,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS water_logs (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      date TEXT NOT NULL,
      amountMl REAL NOT NULL,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipes (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      name TEXT NOT NULL,
      description TEXT,
      servings REAL DEFAULT 1,
      isFavorite INTEGER DEFAULT 0,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      localId TEXT PRIMARY KEY,
      recipeLocalId TEXT NOT NULL,
      foodItemLocalId TEXT NOT NULL,
      quantity REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weight_entries (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      date TEXT NOT NULL UNIQUE,
      weightKg REAL NOT NULL,
      bodyFat REAL,
      source TEXT DEFAULT 'MANUAL',
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS body_measurements (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      date TEXT NOT NULL,
      neck REAL,
      shoulders REAL,
      chest REAL,
      leftArm REAL,
      rightArm REAL,
      waist REAL,
      hips REAL,
      leftThigh REAL,
      rightThigh REAL,
      leftCalf REAL,
      rightCalf REAL,
      notes TEXT,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercises (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      exerciseDbId TEXT,
      name TEXT NOT NULL,
      nameAlternative TEXT,
      muscleGroup TEXT,
      musclesPrimary TEXT DEFAULT '[]',
      musclesSecondary TEXT DEFAULT '[]',
      equipment TEXT,
      category TEXT,
      description TEXT,
      instructions TEXT DEFAULT '[]',
      tips TEXT DEFAULT '[]',
      imageUrl TEXT,
      videoUrl TEXT,
      gifUrl TEXT,
      localMediaPath TEXT,
      isCustom INTEGER DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      name TEXT NOT NULL,
      description TEXT,
      label TEXT,
      variants TEXT,
      variantLastDones TEXT,
      lastPerformedAt TEXT,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_exercises (
      localId TEXT PRIMARY KEY,
      templateLocalId TEXT NOT NULL,
      exerciseLocalId TEXT NOT NULL,
      defaultSets INTEGER DEFAULT 3,
      defaultReps INTEGER,
      defaultWeightKg REAL,
      restSeconds INTEGER,
      sortOrder INTEGER NOT NULL,
      variant TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      templateLocalId TEXT,
      name TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      notes TEXT,
      totalVolume REAL,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_exercises (
      localId TEXT PRIMARY KEY,
      sessionLocalId TEXT NOT NULL,
      exerciseLocalId TEXT NOT NULL,
      serverId TEXT,
      notes TEXT,
      sortOrder INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_sets (
      localId TEXT PRIMARY KEY,
      sessionExerciseLocalId TEXT NOT NULL,
      setNumber INTEGER NOT NULL,
      weightKg REAL NOT NULL,
      reps INTEGER NOT NULL,
      rpe REAL,
      isPersonalBest INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS goal_phases (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      name TEXT NOT NULL,
      goalType TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      targetWeightKg REAL,
      targetBodyFat REAL,
      weeklyRateKg REAL,
      calorieTarget INTEGER,
      proteinTarget INTEGER,
      carbsTarget INTEGER,
      fatTarget INTEGER,
      cycleId TEXT,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS feedback (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      steps TEXT,
      diagnostics TEXT,
      status TEXT DEFAULT 'draft',
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Saved meals: a named bundle of items ("My usual breakfast") that re-logs in one
    -- tap, fanning out into individual editable food_logs (unlike a recipe, which logs
    -- as one combined entry). Items mirror food_logs (food item / recipe / quick-add custom).
    CREATE TABLE IF NOT EXISTS saved_meals (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      name TEXT NOT NULL,
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS saved_meal_items (
      localId TEXT PRIMARY KEY,
      savedMealLocalId TEXT NOT NULL,
      foodItemLocalId TEXT,
      recipeLocalId TEXT,
      servingQty REAL NOT NULL,
      customName TEXT,
      customCalories REAL,
      customProtein REAL,
      customCarbs REAL,
      customFat REAL
    );

    -- Progress photos: one per (date, pose), independent of weigh-ins (a photo day needn't have a
    -- weight, and deleting a weigh-in keeps its photos). fileName is a basename under
    -- Documents/progress-photos/ (absolute paths change on iOS updates — lib/progressPhoto.ts).
    CREATE TABLE IF NOT EXISTS progress_photos (
      localId TEXT PRIMARY KEY,
      serverId TEXT,
      syncStatus TEXT DEFAULT 'local',
      updatedAt TEXT,
      deleted INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      pose TEXT NOT NULL DEFAULT 'front',
      fileName TEXT NOT NULL,
      createdAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_progress_photos_date ON progress_photos(date);

    CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(date);
    CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(date);
    CREATE INDEX IF NOT EXISTS idx_saved_meal_items ON saved_meal_items(savedMealLocalId);
    CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_entries(date);
    CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
    CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON exercises(muscleGroup);
  `);

  runMigrations();
}

/** Small key/value store for seed versions and other app-level flags. */
export function getMeta(key: string): string | null {
  const row = db.getFirstSync(`SELECT value FROM app_meta WHERE key = ?`, [key]) as { value: string } | null;
  return row?.value ?? null;
}
export function setMeta(key: string, value: string): void {
  db.runSync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [key, value]);
}

/**
 * Lightweight forward-only migrations for columns added after a DB already exists.
 * `CREATE TABLE IF NOT EXISTS` never alters an existing table, so new columns must
 * be ADDed explicitly. Each `ensureColumn` is a no-op once the column is present.
 */
function runMigrations() {
  ensureColumn('food_items', 'saturatedFat', 'REAL');
  ensureColumn('food_items', 'detailsJson', 'TEXT');
  ensureColumn('food_items', 'isFavorite', 'INTEGER DEFAULT 0');
  // Last amount + unit the user logged this item at, to prefill the quantity sheet.
  ensureColumn('food_items', 'lastAmount', 'REAL');
  ensureColumn('food_items', 'lastUnit', 'TEXT');
  // Household serving descriptor from a label scan, e.g. "2 cookies" (alongside the gram serving).
  ensureColumn('food_items', 'servingText', 'TEXT');
  ensureColumn('recipes', 'isFavorite', 'INTEGER DEFAULT 0');
  ensureColumn('recipes', 'servingWeightG', 'REAL');
  // Supersets: a group key shared by adjacent exercises (null = solo).
  ensureColumn('template_exercises', 'supersetGroup', 'TEXT');
  ensureColumn('session_exercises', 'supersetGroup', 'TEXT');
  // "Weight is per side" override for dumbbell/kettlebell volume (null = equipment default).
  ensureColumn('exercises', 'perSide', 'INTEGER');
  // Calories burned during a workout (measured from HealthKit/Health Connect, else MET estimate).
  ensureColumn('workout_sessions', 'caloriesBurned', 'REAL');
  // DEXA-scan compartments on a weigh-in (sparse; entered via the "Log DEXA scan" flow).
  // Bone mass + T-score are ~constant between scans; visceral fat is the scan's estimate.
  ensureColumn('weight_entries', 'boneMassKg', 'REAL');
  ensureColumn('weight_entries', 'visceralFatKg', 'REAL');
  ensureColumn('weight_entries', 'boneTScore', 'REAL');
  // Progress photo attached to a weigh-in — a filename under Documents/progress-photos (device-local).
  ensureColumn('weight_entries', 'photoUri', 'TEXT');
  // Skinfold-caliper session behind a computed body-fat % (source 'CALIPER'): a JSON blob of
  // { method, sex, folds } (raw mm) so a caliper reading can be reopened, edited, and trended.
  ensureColumn('weight_entries', 'skinfoldJson', 'TEXT');
  // Heart-rate summary + downsampled series (from Health) for the workout window.
  ensureColumn('workout_sessions', 'avgHeartRate', 'REAL');
  ensureColumn('workout_sessions', 'minHeartRate', 'REAL');
  ensureColumn('workout_sessions', 'maxHeartRate', 'REAL');
  ensureColumn('workout_sessions', 'heartRateSamplesJson', 'TEXT');
  // Cable attachment (Rope, V-Bar, …) chosen for a performance; history/PRs are keyed on
  // (exercise + attachment) so each attachment is its own progress line.
  ensureColumn('session_exercises', 'attachment', 'TEXT');
  ensureColumn('template_exercises', 'attachment', 'TEXT');
  // Workout variations (A/B days): a template carries a JSON list of variant names + a per-variant
  // last-performed map (for auto-alternation); each template_exercise is tagged with the variant it
  // belongs to (null = shared across all variants). Filtered at start by (variant IS NULL OR = chosen).
  ensureColumn('template_exercises', 'variant', 'TEXT');
  ensureColumn('workout_templates', 'variants', 'TEXT');
  ensureColumn('workout_templates', 'variantLastDones', 'TEXT');
  // Unilateral (per-arm) logging: each set splits into L/R rows. `leadSide` = side logged first.
  ensureColumn('exercises', 'unilateral', 'INTEGER');
  ensureColumn('exercises', 'leadSide', 'TEXT');
  // Persistent per-exercise coaching note (a technique cue shown every time you do the
  // exercise) + whether the user has hidden its banner. Both are user overrides — like
  // perSide/unilateral/leadSide they're preserved across a catalog reseed (kept out of
  // upsertExercise's catalog columns). Distinct from session_exercises.notes (per-performance).
  ensureColumn('exercises', 'coachingNote', 'TEXT');
  ensureColumn('exercises', 'coachingNoteHidden', 'INTEGER DEFAULT 0');
  // Side a logged set belongs to ('L'/'R') for unilateral exercises; null = bilateral.
  ensureColumn('exercise_sets', 'side', 'TEXT');
  // Quick-add: a bare calorie (+ optional macros) entry with no food item / recipe —
  // for restaurant meals / estimates. customName present ⇒ this is a quick-add row.
  ensureColumn('food_logs', 'customName', 'TEXT');
  ensureColumn('food_logs', 'customCalories', 'REAL');
  ensureColumn('food_logs', 'customProtein', 'REAL');
  ensureColumn('food_logs', 'customCarbs', 'REAL');
  ensureColumn('food_logs', 'customFat', 'REAL');
  // The amount + unit the user typed for this entry ("150 g", "1.5 cup"), so the Today list and
  // the edit sheet show/reopen it as entered. servingQty stays the source of truth for nutrition.
  ensureColumn('food_logs', 'entryAmount', 'REAL');
  ensureColumn('food_logs', 'entryUnit', 'TEXT');
  migrateWeighInPhotos();
}

/**
 * One-time move of the old one-photo-per-weigh-in model (`weight_entries.photoUri`) into
 * `progress_photos` as the **front** pose, then clear the old column so it can't be read twice.
 * Idempotent: rows already migrated have photoUri NULL; a (date, front) photo that already exists wins.
 */
function migrateWeighInPhotos() {
  try {
    const rows = db.getAllSync(
      `SELECT localId, date, photoUri, updatedAt FROM weight_entries WHERE photoUri IS NOT NULL AND deleted = 0`
    ) as { localId: string; date: string; photoUri: string; updatedAt: string | null }[];
    if (!rows.length) return;
    db.withTransactionSync(() => {
      for (const r of rows) {
        const exists = db.getFirstSync(
          `SELECT 1 FROM progress_photos WHERE date = ? AND pose = 'front' AND deleted = 0`, [r.date]
        );
        if (!exists) {
          const id = `mig-${r.localId}`;
          const fileName = r.photoUri.split('/').pop() || r.photoUri;
          db.runSync(
            `INSERT OR IGNORE INTO progress_photos (localId, date, pose, fileName, createdAt, updatedAt, syncStatus)
             VALUES (?, ?, 'front', ?, ?, ?, 'pending')`,
            [id, r.date, fileName, r.updatedAt ?? new Date().toISOString(), new Date().toISOString()]
          );
        }
        db.runSync(`UPDATE weight_entries SET photoUri = NULL WHERE localId = ?`, [r.localId]);
      }
    });
  } catch { /* photoUri column missing on a very old DB → nothing to migrate */ }
}

function ensureColumn(table: string, column: string, decl: string) {
  const cols = db.getAllSync(`PRAGMA table_info(${table})`) as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}
