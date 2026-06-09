export type UnitSystem = 'METRIC' | 'IMPERIAL'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type Sex = 'MALE' | 'FEMALE' | 'OTHER'
export type GoalType = 'LOSE' | 'GAIN' | 'MAINTAIN'
/** Whether the user's goal is expressed as a scale weight or a body-fat %. */
export type GoalMode = 'weight' | 'bodyfat'
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
export type MacroTargetMode = 'GRAMS' | 'PERCENT'
/** Source for eating active calories back into the daily budget. */
export type ActiveCalorieSource = 'off' | 'auto' | 'watch' | 'inapp'
export type FoodSource = 'MANUAL' | 'OPEN_FOOD_FACTS' | 'USDA' | 'BASE'
export type DataSource = 'MANUAL' | 'APPLE_HEALTH' | 'SHORTCUT' | 'DEXA'

export interface UserProfile {
  id: string
  userId: string
  birthDate?: string | null
  heightCm?: number | null
  goalWeightKg?: number | null
  goalBodyFat?: number | null
  goalMode?: GoalMode
  goalDate?: string | null
  activityLevel: ActivityLevel
  sex?: Sex | null
  goalType: GoalType
  unitSystem: UnitSystem
  calorieGoal?: number | null
  proteinTarget?: number | null
  carbsTarget?: number | null
  fatTarget?: number | null
  macroTargetMode: MacroTargetMode
  activeCalorieSource: ActiveCalorieSource
  showCoachingNudges: boolean
  avatarUrl?: string | null
  updatedAt: string
}

export interface User {
  id: string
  email: string
  name?: string | null
  createdAt: string
  profile?: UserProfile | null
}

export interface FoodItem {
  id: string
  barcode?: string | null
  name: string
  brand?: string | null
  servingSize: number
  servingUnit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number | null
  sugar?: number | null
  sodium?: number | null
  saturatedFat?: number | null
  source: FoodSource
  isCustom: boolean
  isFavorite?: boolean
  createdAt: string
  /** Rich Open Food Facts data (extended nutriments, scores, ingredients…). */
  details?: FoodDetails | null
  /** Last amount + unit logged for this item (prefills the quantity sheet). */
  lastAmount?: number | null
  lastUnit?: string | null
}

/** A single extended nutriment, value expressed per serving in grams (OFF base unit). */
export interface NutrimentEntry {
  key: string
  value: number
}

/** A named household serving (e.g. "Medium" apple = 182 g) for quick-fill chips. */
export interface FoodPortion {
  label: string
  grams: number
}

/** Rich product data captured from Open Food Facts beyond the core macros. */
export interface FoodDetails {
  /** Extended nutriments (everything beyond the core 8), per serving, in grams. */
  nutriments: NutrimentEntry[]
  nutriScore?: string | null   // a–e
  novaGroup?: number | null    // 1–4 processing level
  ecoScore?: string | null     // a–e
  /** Traffic-light levels for fat / saturated-fat / sugars / salt. */
  nutrientLevels?: Record<string, 'low' | 'moderate' | 'high'> | null
  ingredientsText?: string | null
  /** Raw allergen tags (e.g. "en:gluten"). */
  allergens?: string[] | null
  /** Raw additive tags / E-numbers (e.g. "en:e330"). */
  additives?: string[] | null
  /** Raw label + ingredient-analysis tags for diet badges (vegan, gluten-free…). */
  labels?: string[] | null
  /** USDA household portions (discrete base foods only) — tap-to-fill in the quantity sheet. */
  portions?: FoodPortion[] | null
}

export interface RecipeIngredient {
  id: string
  foodItem: FoodItem
  quantity: number
}

export interface Recipe {
  id: string
  userId: string
  name: string
  description?: string | null
  servings: number
  /** Optional weight (g) of one serving, enabling gram-based logging/scaling. */
  servingWeightG?: number | null
  isFavorite?: boolean
  ingredients: RecipeIngredient[]
  nutrition?: {
    perServingCalories: number
    perServingProtein: number
    perServingCarbs: number
    perServingFat: number
    totalCalories: number
    totalProtein: number
    totalCarbs: number
    totalFat: number
  }
  createdAt: string
  updatedAt: string
}

/** A bare quick-add entry (no food item / recipe) — calories + optional macros. */
export interface CustomLog {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** A reusable named bundle of items that re-logs in one tap (A5). */
export interface SavedMeal {
  id: string
  name: string
  itemCount: number
  calories: number
}

/** One resolved item inside a saved meal (for the editor). `calories` is per serving. */
export interface SavedMealItem {
  id: string
  name: string
  calories: number
  servingQty: number
}

export interface FoodLog {
  id: string
  date: string
  meal: MealType
  foodItem?: FoodItem | null
  recipe?: Recipe | null
  /** Set when this is a quick-add row (no food item / recipe). */
  custom?: CustomLog | null
  servingQty: number
  createdAt: string
}

export interface WeightEntry {
  id: string
  date: string
  weightKg: number
  bodyFat?: number | null
  /** DEXA bone mineral content (kg). Sparse — only on scan days; ~constant between scans. */
  boneMassKg?: number | null
  /** DEXA-estimated visceral adipose tissue (kg). Sparse. */
  visceralFatKg?: number | null
  /** DEXA bone-density T-score (SDs vs a young-adult reference). Sparse. */
  boneTScore?: number | null
  source: DataSource
  createdAt: string
}

export interface BodyMeasurement {
  id: string
  date: string
  neck?: number | null
  shoulders?: number | null
  chest?: number | null
  leftArm?: number | null
  rightArm?: number | null
  waist?: number | null
  hips?: number | null
  leftThigh?: number | null
  rightThigh?: number | null
  leftCalf?: number | null
  rightCalf?: number | null
  notes?: string | null
  createdAt: string
}

export interface Exercise {
  id: string
  exerciseDbId?: string | null
  name: string
  nameAlternative?: string | null
  description?: string | null
  instructions: string[]
  tips: string[]
  muscleGroup?: string | null
  musclesPrimary: string[]
  musclesSecondary: string[]
  equipment?: string | null
  category?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  gifUrl?: string | null
  isCustom: boolean
  /** Override for "weight is per side" (×2 volume). null/undefined → default from equipment. */
  perSide?: boolean | null
  /** Log this exercise per arm: each set splits into L/R rows (volume sums both, no ×2). */
  unilateral?: boolean | null
  /** Which side is logged first for a unilateral exercise ('L' default). */
  leadSide?: Side | null
}

/** Side of a unilateral (per-arm) set. null = bilateral / not per-arm. */
export type Side = 'L' | 'R'

export interface ExerciseSet {
  id: string
  setNumber: number
  weightKg: number
  reps: number
  rpe?: number | null
  isPersonalBest: boolean
  /** Arm this set was logged for ('L'/'R') on a unilateral exercise; null = bilateral. */
  side?: Side | null
}

export interface SessionExercise {
  id: string
  exercise: Exercise
  notes?: string | null
  order: number
  sets: ExerciseSet[]
  /** Cable attachment used for this performance (Rope, V-Bar, …); null = none/default. */
  attachment?: string | null
}

export interface WorkoutSession {
  id: string
  name: string
  startedAt: string
  finishedAt?: string | null
  notes?: string | null
  totalVolume?: number | null
  /** kcal burned during this workout (measured from Health, else MET estimate). */
  caloriesBurned?: number | null
  /** Heart-rate summary (BPM) from Health for the workout window; null when unavailable. */
  avgHeartRate?: number | null
  minHeartRate?: number | null
  maxHeartRate?: number | null
  /** Downsampled BPM series for the HR-over-time chart. */
  heartRateSamples?: number[] | null
  exercises: SessionExercise[]
  template?: { name: string } | null
  createdAt: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  description?: string | null
  label?: string | null
  exercises: {
    id: string
    exercise: Exercise
    defaultSets: number
    defaultReps?: number | null
    defaultWeightKg?: number | null
    restSeconds?: number | null
    order: number
    /** Group key shared by adjacent exercises in a superset (null = solo). */
    supersetGroup?: string | null
    /** Default cable attachment for this exercise in the template (Rope, V-Bar, …). */
    attachment?: string | null
  }[]
  lastPerformedAt?: string | null
  createdAt: string
}

export interface GoalPhase {
  id: string
  name: string
  goalType: GoalType
  startDate: string
  endDate: string
  targetWeightKg?: number | null
  targetBodyFat?: number | null
  weeklyRateKg?: number | null
  calorieTarget?: number | null
  proteinTarget?: number | null
  carbsTarget?: number | null
  fatTarget?: number | null
  cycleId?: string | null
}

export type EtaReason = 'no-goal' | 'no-trend' | 'wrong-direction'

export interface MuscleVolume {
  muscleGroup: string
  sets: number
  volume: number
}

export interface HealthStats {
  current: WeightEntry | null
  avg7: number | null
  avg14: number | null
  weeklyChange: number | null
  goalEta: string | null
  etaReason: EtaReason | null
  requiredWeeklyRate: number | null
  dailyCalorieDelta: number | null
  onTrack: boolean
  calorieAvg7: number | null
  entries: WeightEntry[]
}

// ── Mobile-specific sync types ────────────────────────────────────────────────

export type SyncStatus = 'local' | 'pending' | 'synced'

export interface SyncMeta {
  localId: string
  serverId: string | null
  syncStatus: SyncStatus
  updatedAt: string
}

// ── Local workout session state (in-memory during active session) ─────────────

export interface LocalSet {
  localId: string
  setNumber: number
  weightKg: number
  reps: number
  rpe?: number
  done: boolean
  isPersonalBest: boolean
  /** Per-set rest override (seconds) for the rest *after* this set; falls back to the exercise default. */
  restSeconds?: number
  /** Arm this set is for ('L'/'R') on a unilateral exercise; undefined/null = bilateral. */
  side?: Side | null
}

export interface LocalExercise {
  localId: string
  exerciseId: string
  exercise: Exercise
  notes: string
  order: number
  sets: LocalSet[]
  lastSets: ExerciseSet[]
  restSeconds: number
  /** Group key shared by adjacent exercises in a superset (null/undefined = solo). */
  supersetGroup?: string | null
  /** Cable attachment chosen for this performance (Rope, V-Bar, …); null = none/default. */
  attachment?: string | null
}
