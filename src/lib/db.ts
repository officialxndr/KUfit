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
      sortOrder INTEGER NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(date);
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
  // Heart-rate summary + downsampled series (from Health) for the workout window.
  ensureColumn('workout_sessions', 'avgHeartRate', 'REAL');
  ensureColumn('workout_sessions', 'minHeartRate', 'REAL');
  ensureColumn('workout_sessions', 'maxHeartRate', 'REAL');
  ensureColumn('workout_sessions', 'heartRateSamplesJson', 'TEXT');
}

function ensureColumn(table: string, column: string, decl: string) {
  const cols = db.getAllSync(`PRAGMA table_info(${table})`) as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}
