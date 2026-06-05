import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import type { Exercise } from '@/types';

/**
 * Curated starter workouts users can pull into their own templates with one tap.
 *
 * Exercises reference the bundled catalog by **stable `exerciseDbId`** (not localId,
 * which is assigned per-device at seed time). `addPresetTemplate` resolves each id to
 * the local exercise row and saves a real, fully-editable WorkoutTemplate — the preset
 * itself is just a seed, never linked, so the user owns their copy afterwards.
 */
export interface PresetExercise {
  exerciseDbId: string;
  sets: number;
  reps?: number;
  restSeconds?: number;
}

export interface PresetTemplate {
  /** Stable slug (not used as the saved template id — that's generated on add). */
  id: string;
  name: string;
  /** Folder/label the saved template lands under in the user's library. */
  label: string;
  description: string;
  exercises: PresetExercise[];
}

const R_HEAVY = 150;
const R_MED = 90;
const R_LIGHT = 60;

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'full-body-beginner',
    name: 'Full Body',
    label: 'Full Body',
    description: 'A balanced full-body session that hits every major muscle — a great 3×/week starting point.',
    exercises: [
      { exerciseDbId: 'qXTaZnJ', sets: 3, reps: 8, restSeconds: R_HEAVY }, // Barbell Full Squat
      { exerciseDbId: 'EIeI8Vf', sets: 3, reps: 8, restSeconds: R_HEAVY }, // Barbell Bench Press
      { exerciseDbId: 'eZyBC3j', sets: 3, reps: 10, restSeconds: R_MED }, // Barbell Bent Over Row
      { exerciseDbId: 'A6wtbuL', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Standing Overhead Press
      { exerciseDbId: 'I3tsCnC', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Hanging Leg Raise
    ],
  },
  {
    id: 'ppl-push',
    name: 'Push Day',
    label: 'Push / Pull / Legs',
    description: 'Chest, shoulders and triceps — the push half of a classic PPL split.',
    exercises: [
      { exerciseDbId: 'EIeI8Vf', sets: 4, reps: 6, restSeconds: R_HEAVY }, // Barbell Bench Press
      { exerciseDbId: 'ns0SIbU', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Incline Bench Press
      { exerciseDbId: 'znQUdHY', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Seated Shoulder Press
      { exerciseDbId: 'DsgkuIt', sets: 3, reps: 15, restSeconds: R_LIGHT }, // Dumbbell Lateral Raise
      { exerciseDbId: 'gAwDzB3', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Cable Triceps Pushdown
    ],
  },
  {
    id: 'ppl-pull',
    name: 'Pull Day',
    label: 'Push / Pull / Legs',
    description: 'Back and biceps — the pull half of a classic PPL split.',
    exercises: [
      { exerciseDbId: 'ila4NZS', sets: 3, reps: 5, restSeconds: 180 }, // Barbell Deadlift
      { exerciseDbId: 'LEprlgG', sets: 3, reps: 10, restSeconds: R_MED }, // Cable Lat Pulldown
      { exerciseDbId: 'fUBheHs', sets: 3, reps: 10, restSeconds: R_MED }, // Cable Seated Row
      { exerciseDbId: 'EAs3xL9', sets: 3, reps: 15, restSeconds: R_LIGHT }, // Dumbbell Reverse Fly
      { exerciseDbId: 'NbVPDMW', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Dumbbell Biceps Curl
    ],
  },
  {
    id: 'ppl-legs',
    name: 'Leg Day',
    label: 'Push / Pull / Legs',
    description: 'Quads, hamstrings and calves — the leg day of a classic PPL split.',
    exercises: [
      { exerciseDbId: 'qXTaZnJ', sets: 4, reps: 8, restSeconds: R_HEAVY }, // Barbell Full Squat
      { exerciseDbId: 'wQ2c4XD', sets: 3, reps: 10, restSeconds: R_MED }, // Barbell Romanian Deadlift
      { exerciseDbId: 'my33uHU', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Lever Leg Extension
      { exerciseDbId: '17lJ1kr', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Lever Lying Leg Curl
      { exerciseDbId: 'dPmaUaU', sets: 4, reps: 15, restSeconds: 45 }, // Dumbbell Standing Calf Raise
    ],
  },
  {
    id: 'upper',
    name: 'Upper Body',
    label: 'Upper / Lower',
    description: 'Chest, back, shoulders and arms — the upper day of an upper/lower split.',
    exercises: [
      { exerciseDbId: 'EIeI8Vf', sets: 4, reps: 8, restSeconds: R_HEAVY }, // Barbell Bench Press
      { exerciseDbId: 'eZyBC3j', sets: 4, reps: 8, restSeconds: R_HEAVY }, // Barbell Bent Over Row
      { exerciseDbId: 'znQUdHY', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Seated Shoulder Press
      { exerciseDbId: 'LEprlgG', sets: 3, reps: 10, restSeconds: R_MED }, // Cable Lat Pulldown
      { exerciseDbId: 'NbVPDMW', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Dumbbell Biceps Curl
      { exerciseDbId: 'gAwDzB3', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Cable Triceps Pushdown
    ],
  },
  {
    id: 'lower',
    name: 'Lower Body',
    label: 'Upper / Lower',
    description: 'Quads, hamstrings, glutes and calves — the lower day of an upper/lower split.',
    exercises: [
      { exerciseDbId: 'qXTaZnJ', sets: 4, reps: 8, restSeconds: R_HEAVY }, // Barbell Full Squat
      { exerciseDbId: 'wQ2c4XD', sets: 3, reps: 10, restSeconds: R_MED }, // Barbell Romanian Deadlift
      { exerciseDbId: 'RRWFUcw', sets: 3, reps: 12, restSeconds: R_MED }, // Dumbbell Lunge
      { exerciseDbId: '17lJ1kr', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Lever Lying Leg Curl
      { exerciseDbId: 'dPmaUaU', sets: 4, reps: 15, restSeconds: 45 }, // Dumbbell Standing Calf Raise
    ],
  },
  {
    id: 'dumbbell-home',
    name: 'Dumbbell Only',
    label: 'Home / Minimal',
    description: 'A full-body workout you can run with just a pair of dumbbells — perfect for home.',
    exercises: [
      { exerciseDbId: 'SpYC0Kp', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Bench Press
      { exerciseDbId: 'BJ0Hz5L', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Bent Over Row
      { exerciseDbId: 'yn8yg1r', sets: 3, reps: 12, restSeconds: R_MED }, // Dumbbell Goblet Squat
      { exerciseDbId: 'A6wtbuL', sets: 3, reps: 10, restSeconds: R_MED }, // Dumbbell Standing Overhead Press
      { exerciseDbId: 'rR0LJzx', sets: 3, reps: 12, restSeconds: R_MED }, // Dumbbell Romanian Deadlift
      { exerciseDbId: 'NbVPDMW', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Dumbbell Biceps Curl
    ],
  },
  {
    id: 'bodyweight',
    name: 'Bodyweight',
    label: 'Home / Minimal',
    description: 'No equipment needed — train anywhere using just your bodyweight.',
    exercises: [
      { exerciseDbId: 'I4hDWkc', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Push-Up
      { exerciseDbId: 'lBDjFxJ', sets: 3, reps: 8, restSeconds: R_MED }, // Pull-Up
      { exerciseDbId: 'IZVHb27', sets: 3, reps: 20, restSeconds: R_LIGHT }, // Walking Lunge
      { exerciseDbId: '9RT8oQW', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Bench Dip on Floor
      { exerciseDbId: 'I3tsCnC', sets: 3, reps: 12, restSeconds: R_LIGHT }, // Hanging Leg Raise
      { exerciseDbId: 'RJgzwny', sets: 3, reps: 30, restSeconds: 45 }, // Mountain Climber
    ],
  },
];

/** Resolve a preset's exercises against the seeded catalog (skipping any not found). */
export function resolvePresetExercises(preset: PresetTemplate): { exercise: Exercise; preset: PresetExercise }[] {
  const out: { exercise: Exercise; preset: PresetExercise }[] = [];
  for (const pe of preset.exercises) {
    const exercise = workoutRepo.getExerciseByDbId(pe.exerciseDbId);
    if (exercise) out.push({ exercise, preset: pe });
  }
  return out;
}

/**
 * Save a preset as a brand-new, fully-editable WorkoutTemplate the user owns.
 * Returns the new template's localId, or null if no exercises could be resolved.
 */
export function addPresetTemplate(preset: PresetTemplate): string | null {
  const resolved = resolvePresetExercises(preset);
  if (resolved.length === 0) return null;
  return workoutRepo.saveTemplate({
    name: preset.name,
    description: preset.description,
    label: preset.label,
    exercises: resolved.map(({ exercise, preset: pe }, i) => ({
      exerciseId: exercise.id,
      defaultSets: pe.sets,
      defaultReps: pe.reps,
      restSeconds: pe.restSeconds,
      order: i,
    })),
  });
}
