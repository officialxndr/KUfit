import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';
import { loadFactor } from '@/lib/load';
import type {
  Exercise, ExerciseSet, LocalExercise, LocalSet,
  SessionExercise, WorkoutSession, WorkoutTemplate,
} from '@/types';

const DEFAULT_REST_SECONDS = 120;

export interface TemplateInput {
  name: string;
  description?: string;
  label?: string | null;
  exercises: Array<{ exerciseId: string; defaultSets: number; defaultReps?: number; defaultWeightKg?: number; restSeconds?: number; order: number; supersetGroup?: string | null; attachment?: string | null }>;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function parseJsonArray(val: any): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function mapExercise(row: any): Exercise {
  return {
    id: row.localId,
    exerciseDbId: row.exerciseDbId ?? null,
    name: row.name,
    nameAlternative: row.nameAlternative ?? null,
    description: row.description ?? null,
    instructions: parseJsonArray(row.instructions),
    tips: parseJsonArray(row.tips),
    muscleGroup: row.muscleGroup ?? null,
    musclesPrimary: parseJsonArray(row.musclesPrimary),
    musclesSecondary: parseJsonArray(row.musclesSecondary),
    equipment: row.equipment ?? null,
    category: row.category ?? null,
    imageUrl: row.imageUrl ?? null,
    videoUrl: row.videoUrl ?? null,
    gifUrl: row.gifUrl ?? null,
    isCustom: !!row.isCustom,
    perSide: row.perSide == null ? null : !!row.perSide,
    unilateral: row.unilateral == null ? null : !!row.unilateral,
    leadSide: (row.leadSide as Exercise['leadSide']) ?? null,
  };
}

function mapTemplate(row: any, exercises: WorkoutTemplate['exercises']): WorkoutTemplate {
  return {
    id: row.localId,
    name: row.name,
    description: row.description ?? null,
    label: row.label ?? null,
    exercises,
    lastPerformedAt: row.lastPerformedAt ?? null,
    createdAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function mapSession(row: any, exercises: SessionExercise[]): WorkoutSession {
  // Recompute volume from sets × per-side factor so it's correct for past sessions too
  // (a dumbbell two-arm set counts both hands), not just whatever was stored on finish.
  const totalVolume = exercises.reduce(
    (sum, se) => sum + loadFactor(se.exercise) * se.sets.reduce((a, st) => a + st.weightKg * st.reps, 0),
    0
  );
  return {
    id: row.localId,
    name: row.name,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    notes: row.notes ?? null,
    totalVolume,
    caloriesBurned: row.caloriesBurned ?? null,
    avgHeartRate: row.avgHeartRate ?? null,
    minHeartRate: row.minHeartRate ?? null,
    maxHeartRate: row.maxHeartRate ?? null,
    heartRateSamples: parseHrSamples(row.heartRateSamplesJson),
    exercises,
    template: row.templateName ? { name: row.templateName } : null,
    createdAt: row.updatedAt ?? row.startedAt,
  };
}

function parseHrSamples(json: unknown): number[] | null {
  if (typeof json !== 'string') return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) && arr.length ? arr.filter((n) => typeof n === 'number') : null;
  } catch {
    return null;
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

export class WorkoutRepo {

  // ── Exercises ───────────────────────────────────────────────────────────────

  searchExercises(q: string, muscle?: string, equipment?: string, onlyCustom?: boolean): Exercise[] {
    let sql = `SELECT * FROM exercises WHERE 1=1`;
    const params: any[] = [];
    if (q) { sql += ` AND name LIKE ?`; params.push(`%${q}%`); }
    if (muscle) { sql += ` AND muscleGroup = ?`; params.push(muscle); }
    if (equipment) { sql += ` AND equipment = ?`; params.push(equipment); }
    if (onlyCustom) sql += ` AND isCustom = 1`;
    // No tight cap — the library browses the whole catalog (~1500); FlatList virtualizes it.
    sql += ` ORDER BY name LIMIT 2000`;
    return (db.getAllSync(sql, params) as any[]).map(mapExercise);
  }

  /** How many templates / logged sessions reference an exercise (for delete confirmation). */
  getExerciseUsage(localId: string): { templates: number; sessions: number } {
    const t = db.getFirstSync(`SELECT COUNT(DISTINCT templateLocalId) AS n FROM template_exercises WHERE exerciseLocalId = ?`, [localId]) as any;
    const s = db.getFirstSync(`SELECT COUNT(DISTINCT sessionLocalId) AS n FROM session_exercises WHERE exerciseLocalId = ?`, [localId]) as any;
    return { templates: t?.n ?? 0, sessions: s?.n ?? 0 };
  }

  /**
   * Delete a user-created exercise and everything that references it (template entries,
   * logged session entries + their sets). Refuses to delete a seeded/app-provided exercise
   * (returns false), so only the user's own exercises can be removed.
   */
  deleteCustomExercise(localId: string): boolean {
    const row = db.getFirstSync(`SELECT isCustom FROM exercises WHERE localId = ?`, [localId]) as any;
    if (!row || !row.isCustom) return false;
    db.runSync(`DELETE FROM template_exercises WHERE exerciseLocalId = ?`, [localId]);
    const ses = db.getAllSync(`SELECT localId FROM session_exercises WHERE exerciseLocalId = ?`, [localId]) as any[];
    for (const se of ses) db.runSync(`DELETE FROM exercise_sets WHERE sessionExerciseLocalId = ?`, [se.localId]);
    db.runSync(`DELETE FROM session_exercises WHERE exerciseLocalId = ?`, [localId]);
    db.runSync(`DELETE FROM exercises WHERE localId = ?`, [localId]);
    return true;
  }

  getExerciseById(localId: string): Exercise | null {
    const row = db.getFirstSync(`SELECT * FROM exercises WHERE localId = ?`, [localId]);
    return row ? mapExercise(row as any) : null;
  }

  /** Resolve a bundled exercise by its stable ExerciseDB id (used by preset templates). */
  getExerciseByDbId(exerciseDbId: string): Exercise | null {
    const row = db.getFirstSync(`SELECT * FROM exercises WHERE exerciseDbId = ? LIMIT 1`, [exerciseDbId]);
    return row ? mapExercise(row as any) : null;
  }

  getAllExercises(): Exercise[] {
    return (db.getAllSync(`SELECT * FROM exercises ORDER BY name`) as any[]).map(mapExercise);
  }

  countExercises(): number {
    const row = db.getFirstSync(`SELECT COUNT(*) AS n FROM exercises`) as any;
    return row?.n ?? 0;
  }

  /** Distinct seeded exercises (by exerciseDbId). Used to detect a duplicate-bloated catalog. */
  countDistinctSeededExercises(): number {
    const row = db.getFirstSync(
      `SELECT COUNT(DISTINCT exerciseDbId) AS n FROM exercises WHERE isCustom = 0 AND exerciseDbId IS NOT NULL`
    ) as any;
    return row?.n ?? 0;
  }

  countSeededExercises(): number {
    const row = db.getFirstSync(`SELECT COUNT(*) AS n FROM exercises WHERE isCustom = 0`) as any;
    return row?.n ?? 0;
  }

  /** Remove all bundled (non-custom) exercises — used to rebuild a duplicate-bloated catalog. */
  deleteSeededExercises(): void {
    db.runSync(`DELETE FROM exercises WHERE isCustom = 0`);
  }

  /**
   * Delete seeded (non-custom) exercises whose exerciseDbId is no longer in the
   * shipped catalog. Used by the in-place reseed (upsert keeps localIds so existing
   * templates/sessions survive); this only prunes entries the catalog dropped.
   */
  pruneSeededExercisesNotIn(keepDbIds: string[]): number {
    if (!keepDbIds.length) return 0;
    const placeholders = keepDbIds.map(() => '?').join(',');
    const res = db.runSync(
      `DELETE FROM exercises
       WHERE isCustom = 0 AND (exerciseDbId IS NULL OR exerciseDbId NOT IN (${placeholders}))`,
      keepDbIds
    );
    return res.changes ?? 0;
  }

  createCustomExercise(input: {
    name: string;
    muscleGroup?: string | null;
    equipment?: string | null;
    description?: string | null;
  }): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO exercises
         (localId, name, muscleGroup, equipment, description, musclesPrimary, musclesSecondary,
          instructions, tips, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, '[]', '[]', '[]', '[]', 1, 'pending', ?)`,
      [localId, input.name, input.muscleGroup ?? null, input.equipment ?? null, input.description ?? null, new Date().toISOString()]
    );
    return localId;
  }

  upsertExercise(ex: Exercise & { serverId?: string; exerciseDbId?: string | null; localMediaPath?: string | null }): string {
    const existing = ex.serverId
      ? (db.getFirstSync(`SELECT localId FROM exercises WHERE serverId = ?`, [ex.serverId]) as any)
      : ex.exerciseDbId
        ? (db.getFirstSync(`SELECT localId FROM exercises WHERE exerciseDbId = ?`, [ex.exerciseDbId]) as any)
        : (db.getFirstSync(`SELECT localId FROM exercises WHERE localId = ?`, [ex.id]) as any);
    const now = new Date().toISOString();
    // Catalog-owned columns. Note we deliberately do NOT touch perSide/unilateral/leadSide:
    // those are user overrides, and an INSERT OR REPLACE here (used by the catalog reseed)
    // would otherwise wipe them on every refresh.
    const catalogCols = [
      ex.serverId ?? null,
      ex.exerciseDbId ?? null,
      ex.name,
      ex.nameAlternative ?? null,
      ex.muscleGroup ?? null,
      JSON.stringify(ex.musclesPrimary ?? []),
      JSON.stringify(ex.musclesSecondary ?? []),
      ex.equipment ?? null,
      ex.category ?? null,
      ex.description ?? null,
      JSON.stringify(ex.instructions ?? []),
      JSON.stringify(ex.tips ?? []),
      ex.imageUrl ?? null,
      ex.videoUrl ?? null,
      ex.gifUrl ?? null,
      ex.localMediaPath ?? null,
      ex.isCustom ? 1 : 0,
      now,
    ];

    if (existing?.localId) {
      db.runSync(
        `UPDATE exercises SET
           serverId = ?, exerciseDbId = ?, name = ?, nameAlternative = ?, muscleGroup = ?,
           musclesPrimary = ?, musclesSecondary = ?, equipment = ?, category = ?, description = ?,
           instructions = ?, tips = ?, imageUrl = ?, videoUrl = ?, gifUrl = ?, localMediaPath = ?,
           isCustom = ?, syncStatus = 'synced', updatedAt = ?
         WHERE localId = ?`,
        [...catalogCols, existing.localId]
      );
      return existing.localId;
    }

    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO exercises
         (localId, serverId, exerciseDbId, name, nameAlternative, muscleGroup, musclesPrimary, musclesSecondary,
          equipment, category, description, instructions, tips, imageUrl, videoUrl, gifUrl, localMediaPath,
          perSide, unilateral, leadSide, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        localId,
        ex.serverId ?? null,
        ex.exerciseDbId ?? null,
        ex.name,
        ex.nameAlternative ?? null,
        ex.muscleGroup ?? null,
        JSON.stringify(ex.musclesPrimary ?? []),
        JSON.stringify(ex.musclesSecondary ?? []),
        ex.equipment ?? null,
        ex.category ?? null,
        ex.description ?? null,
        JSON.stringify(ex.instructions ?? []),
        JSON.stringify(ex.tips ?? []),
        ex.imageUrl ?? null,
        ex.videoUrl ?? null,
        ex.gifUrl ?? null,
        ex.localMediaPath ?? null,
        ex.perSide == null ? null : ex.perSide ? 1 : 0,
        ex.unilateral == null ? null : ex.unilateral ? 1 : 0,
        ex.leadSide ?? null,
        ex.isCustom ? 1 : 0,
        now,
      ]
    );
    return localId;
  }

  /** Override the per-side (×2 volume) flag; null reverts to the equipment default. */
  setExercisePerSide(localId: string, perSide: boolean | null): void {
    db.runSync(
      `UPDATE exercises SET perSide = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [perSide == null ? null : perSide ? 1 : 0, new Date().toISOString(), localId]
    );
  }

  /** Toggle per-arm (unilateral) logging for an exercise — each set splits into L/R rows. */
  setExerciseUnilateral(localId: string, unilateral: boolean): void {
    db.runSync(
      `UPDATE exercises SET unilateral = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [unilateral ? 1 : 0, new Date().toISOString(), localId]
    );
  }

  /** Set which side is logged first for a unilateral exercise ('L' or 'R'). */
  setExerciseLeadSide(localId: string, leadSide: 'L' | 'R'): void {
    db.runSync(
      `UPDATE exercises SET leadSide = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [leadSide, new Date().toISOString(), localId]
    );
  }

  getDistinctMuscleGroups(): string[] {
    const rows = db.getAllSync(
      `SELECT DISTINCT muscleGroup FROM exercises WHERE muscleGroup IS NOT NULL ORDER BY muscleGroup`
    ) as any[];
    return rows.map((r) => r.muscleGroup);
  }

  // ── Templates ───────────────────────────────────────────────────────────────

  getTemplates(): WorkoutTemplate[] {
    const rows = db.getAllSync(
      `SELECT * FROM workout_templates WHERE deleted = 0 ORDER BY name`
    ) as any[];
    return rows.map((row) => {
      const exRows = db.getAllSync(
        `SELECT te.*, e.localId AS e_localId, e.name AS e_name,
                e.muscleGroup AS e_muscleGroup, e.equipment AS e_equipment,
                e.description AS e_description, e.instructions AS e_instructions,
                e.tips AS e_tips, e.imageUrl AS e_imageUrl, e.videoUrl AS e_videoUrl,
                e.gifUrl AS e_gifUrl,
                e.musclesPrimary AS e_musclesPrimary, e.musclesSecondary AS e_musclesSecondary,
                e.category AS e_category, e.isCustom AS e_isCustom,
                e.perSide AS e_perSide, e.unilateral AS e_unilateral, e.leadSide AS e_leadSide
         FROM template_exercises te
         JOIN exercises e ON te.exerciseLocalId = e.localId
         WHERE te.templateLocalId = ?
         ORDER BY te.sortOrder`,
        [row.localId]
      ) as any[];
      const exercises = exRows.map((er) => ({
        id: er.localId,
        exercise: mapExercise({ localId: er.e_localId, name: er.e_name, muscleGroup: er.e_muscleGroup, equipment: er.e_equipment, description: er.e_description, instructions: er.e_instructions, tips: er.e_tips, imageUrl: er.e_imageUrl, videoUrl: er.e_videoUrl, gifUrl: er.e_gifUrl, musclesPrimary: er.e_musclesPrimary, musclesSecondary: er.e_musclesSecondary, category: er.e_category, isCustom: er.e_isCustom, perSide: er.e_perSide, unilateral: er.e_unilateral, leadSide: er.e_leadSide }),
        defaultSets: er.defaultSets ?? 3,
        defaultReps: er.defaultReps ?? null,
        defaultWeightKg: er.defaultWeightKg ?? null,
        restSeconds: er.restSeconds ?? null,
        order: er.sortOrder,
        supersetGroup: er.supersetGroup ?? null,
        attachment: er.attachment ?? null,
      }));
      return mapTemplate(row, exercises);
    });
  }

  saveTemplate(template: TemplateInput): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO workout_templates (localId, name, description, label, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [localId, template.name, template.description ?? null, template.label ?? null, new Date().toISOString()]
    );
    this.replaceTemplateExercises(localId, template.exercises);
    return localId;
  }

  /** Update an existing template's name/label/description and replace its exercises. */
  updateTemplate(localId: string, template: TemplateInput): void {
    db.runSync(
      `UPDATE workout_templates SET name = ?, description = ?, label = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [template.name, template.description ?? null, template.label ?? null, new Date().toISOString(), localId]
    );
    db.runSync(`DELETE FROM template_exercises WHERE templateLocalId = ?`, [localId]);
    this.replaceTemplateExercises(localId, template.exercises);
  }

  private replaceTemplateExercises(templateLocalId: string, exercises: TemplateInput['exercises']): void {
    for (const ex of exercises) {
      db.runSync(
        `INSERT INTO template_exercises
           (localId, templateLocalId, exerciseLocalId, defaultSets, defaultReps, defaultWeightKg, restSeconds, sortOrder, supersetGroup, attachment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [Crypto.randomUUID(), templateLocalId, ex.exerciseId, ex.defaultSets, ex.defaultReps ?? null, ex.defaultWeightKg ?? null, ex.restSeconds ?? null, ex.order, ex.supersetGroup ?? null, ex.attachment ?? null]
      );
    }
  }

  deleteTemplate(localId: string): void {
    db.runSync(
      `UPDATE workout_templates SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  // ── Sessions ────────────────────────────────────────────────────────────────

  startSession(name: string, templateLocalId?: string): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO workout_sessions (localId, name, templateLocalId, startedAt, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [localId, name, templateLocalId ?? null, new Date().toISOString(), new Date().toISOString()]
    );
    if (templateLocalId) {
      db.runSync(
        `UPDATE workout_templates SET lastPerformedAt = ? WHERE localId = ?`,
        [new Date().toISOString(), templateLocalId]
      );
    }
    return localId;
  }

  finishSession(
    localId: string,
    exercises: Array<{
      exerciseLocalId: string;
      notes?: string;
      order: number;
      supersetGroup?: string | null;
      attachment?: string | null;
      sets: Array<{ setNumber: number; weightKg: number; reps: number; rpe?: number; isPersonalBest?: boolean; side?: 'L' | 'R' | null }>;
    }>,
    finishedAt: string,
    caloriesBurned?: number | null
  ): void {
    // Total volume: per-side (dumbbell/kettlebell two-arm) work counts ×2, but a unilateral
    // exercise already logs both arms as separate sets, so its factor stays 1 (sum L+R rows).
    const totalVolume = exercises.reduce((total, ex) => {
      const e = db.getFirstSync(`SELECT equipment, perSide, unilateral FROM exercises WHERE localId = ?`, [ex.exerciseLocalId]) as any;
      const factor = loadFactor({ equipment: e?.equipment, perSide: e?.perSide == null ? null : !!e.perSide, unilateral: !!e?.unilateral });
      return total + factor * ex.sets.reduce((s, set) => s + set.weightKg * set.reps, 0);
    }, 0);

    db.runSync(
      `UPDATE workout_sessions SET finishedAt = ?, totalVolume = ?, caloriesBurned = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [finishedAt, totalVolume, caloriesBurned ?? null, new Date().toISOString(), localId]
    );

    // Delete old session exercises if re-finishing
    db.runSync(`DELETE FROM session_exercises WHERE sessionLocalId = ?`, [localId]);

    for (const ex of exercises) {
      const seLocalId = Crypto.randomUUID();
      db.runSync(
        `INSERT INTO session_exercises (localId, sessionLocalId, exerciseLocalId, notes, sortOrder, supersetGroup, attachment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [seLocalId, localId, ex.exerciseLocalId, ex.notes ?? null, ex.order, ex.supersetGroup ?? null, ex.attachment ?? null]
      );
      for (const set of ex.sets) {
        db.runSync(
          `INSERT INTO exercise_sets (localId, sessionExerciseLocalId, setNumber, weightKg, reps, rpe, isPersonalBest, side)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [Crypto.randomUUID(), seLocalId, set.setNumber, set.weightKg, set.reps, set.rpe ?? null, set.isPersonalBest ? 1 : 0, set.side ?? null]
        );
      }
    }
  }

  discardSession(localId: string): void {
    db.runSync(`DELETE FROM workout_sessions WHERE localId = ?`, [localId]);
  }

  /** Seed a fully-formed past session (demo data). Inserts with an explicit
   *  `startedAt`, then reuses `finishSession` for the exercises/sets + volume. */
  seedFinishedSession(opts: {
    name: string;
    startedAt: string;
    finishedAt: string;
    caloriesBurned?: number | null;
    exercises: Parameters<WorkoutRepo['finishSession']>[1];
  }): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO workout_sessions (localId, name, startedAt, syncStatus, updatedAt)
       VALUES (?, ?, ?, 'pending', ?)`,
      [localId, opts.name, opts.startedAt, new Date().toISOString()]
    );
    this.finishSession(localId, opts.exercises, opts.finishedAt, opts.caloriesBurned ?? null);
    return localId;
  }

  /** Wipe every logged session (+ its exercises/sets). Used by the demo-data tool. */
  clearAllSessions(): void {
    db.runSync(`DELETE FROM exercise_sets`);
    db.runSync(`DELETE FROM session_exercises`);
    db.runSync(`DELETE FROM workout_sessions`);
  }

  /** Delete a session and all of its exercises/sets (used from history). */
  deleteSession(localId: string): void {
    const ses = db.getAllSync(
      `SELECT localId FROM session_exercises WHERE sessionLocalId = ?`, [localId]
    ) as any[];
    for (const se of ses) {
      db.runSync(`DELETE FROM exercise_sets WHERE sessionExerciseLocalId = ?`, [se.localId]);
    }
    db.runSync(`DELETE FROM session_exercises WHERE sessionLocalId = ?`, [localId]);
    db.runSync(`DELETE FROM workout_sessions WHERE localId = ?`, [localId]);
  }

  getSessions(limit = 30, finishedOnly = true): WorkoutSession[] {
    let sql = `SELECT ws.*, wt.name AS templateName
               FROM workout_sessions ws
               LEFT JOIN workout_templates wt ON ws.templateLocalId = wt.localId
               WHERE ws.deleted = 0`;
    if (finishedOnly) sql += ` AND ws.finishedAt IS NOT NULL`;
    sql += ` ORDER BY ws.startedAt DESC LIMIT ?`;
    const rows = db.getAllSync(sql, [limit]) as any[];

    return rows.map((row) => {
      const seRows = db.getAllSync(
        `SELECT se.*, e.localId AS e_localId, e.name AS e_name,
                e.muscleGroup AS e_muscleGroup, e.equipment AS e_equipment,
                e.instructions AS e_instructions, e.tips AS e_tips,
                e.imageUrl AS e_imageUrl, e.videoUrl AS e_videoUrl, e.gifUrl AS e_gifUrl,
                e.musclesPrimary AS e_musclesPrimary, e.musclesSecondary AS e_musclesSecondary,
                e.description AS e_description, e.category AS e_category, e.isCustom AS e_isCustom,
                e.perSide AS e_perSide, e.unilateral AS e_unilateral, e.leadSide AS e_leadSide
         FROM session_exercises se
         JOIN exercises e ON se.exerciseLocalId = e.localId
         WHERE se.sessionLocalId = ?
         ORDER BY se.sortOrder`,
        [row.localId]
      ) as any[];

      const exercises: SessionExercise[] = seRows.map((ser) => {
        const sets = db.getAllSync(
          `SELECT * FROM exercise_sets WHERE sessionExerciseLocalId = ? ORDER BY setNumber, side`,
          [ser.localId]
        ) as any[];
        return {
          id: ser.localId,
          exercise: mapExercise({ localId: ser.e_localId, name: ser.e_name, muscleGroup: ser.e_muscleGroup, equipment: ser.e_equipment, description: ser.e_description, instructions: ser.e_instructions, tips: ser.e_tips, imageUrl: ser.e_imageUrl, videoUrl: ser.e_videoUrl, gifUrl: ser.e_gifUrl, musclesPrimary: ser.e_musclesPrimary, musclesSecondary: ser.e_musclesSecondary, category: ser.e_category, isCustom: ser.e_isCustom, perSide: ser.e_perSide, unilateral: ser.e_unilateral, leadSide: ser.e_leadSide }),
          notes: ser.notes ?? null,
          order: ser.sortOrder,
          attachment: ser.attachment ?? null,
          sets: sets.map((s) => ({
            id: s.localId,
            setNumber: s.setNumber,
            weightKg: s.weightKg,
            reps: s.reps,
            rpe: s.rpe ?? null,
            isPersonalBest: !!s.isPersonalBest,
            side: (s.side as 'L' | 'R' | null) ?? null,
          })),
        };
      });

      return mapSession(row, exercises);
    });
  }

  // Last sets for an exercise (for ghost values in session screen). When an attachment is
  // given, ghosts come from the last performance *with that attachment* — each attachment
  // is its own progress line.
  getLastSetsForExercise(exerciseLocalId: string, attachment?: string | null): ExerciseSet[] {
    const attClause = attachment ? `AND se.attachment = ?` : ``;
    const params = attachment ? [exerciseLocalId, attachment] : [exerciseLocalId];
    const lastSession = db.getFirstSync(
      `SELECT se.localId FROM session_exercises se
       JOIN workout_sessions ws ON se.sessionLocalId = ws.localId
       WHERE se.exerciseLocalId = ? ${attClause} AND ws.finishedAt IS NOT NULL
       ORDER BY ws.startedAt DESC LIMIT 1`,
      params
    ) as any;
    if (!lastSession) return [];
    const sets = db.getAllSync(
      `SELECT * FROM exercise_sets WHERE sessionExerciseLocalId = ? ORDER BY setNumber, side`,
      [lastSession.localId]
    ) as any[];
    return sets.map((s) => ({
      id: s.localId,
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      rpe: s.rpe ?? null,
      isPersonalBest: !!s.isPersonalBest,
      side: (s.side as 'L' | 'R' | null) ?? null,
    }));
  }

  // Best historical Epley 1RM for an exercise (for PR detection), optionally per attachment.
  getBestEpleyForExercise(exerciseLocalId: string, attachment?: string | null): number {
    const attClause = attachment ? `AND se.attachment = ?` : ``;
    const params = attachment ? [exerciseLocalId, attachment] : [exerciseLocalId];
    const row = db.getFirstSync(
      `SELECT MAX(es.weightKg * (1 + es.reps / 30.0)) AS best
       FROM exercise_sets es
       JOIN session_exercises se ON es.sessionExerciseLocalId = se.localId
       WHERE se.exerciseLocalId = ? ${attClause}`,
      params
    ) as any;
    return row?.best ?? 0;
  }

  /** Exercises that have at least one set logged in a finished session. */
  getExercisesWithHistory(): { id: string; name: string; muscleGroup: string | null; sessions: number; lastAt: string }[] {
    return (db.getAllSync(
      `SELECT ex.localId AS id, ex.name AS name, ex.muscleGroup AS muscleGroup,
              COUNT(DISTINCT ws.localId) AS sessions, MAX(ws.startedAt) AS lastAt
       FROM exercise_sets es
       JOIN session_exercises se ON es.sessionExerciseLocalId = se.localId
       JOIN workout_sessions ws ON se.sessionLocalId = ws.localId
       JOIN exercises ex ON se.exerciseLocalId = ex.localId
       WHERE ws.finishedAt IS NOT NULL AND ws.deleted = 0
       GROUP BY ex.localId
       ORDER BY lastAt DESC`
    ) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      muscleGroup: r.muscleGroup ?? null,
      sessions: r.sessions ?? 0,
      lastAt: r.lastAt,
    }));
  }

  /** Per-session progress for one exercise (oldest → newest): est 1RM, volume, top weight, reps. */
  getExerciseSessionHistory(exerciseLocalId: string, attachment?: string | null): { date: string; est1RM: number; volume: number; topWeight: number; reps: number }[] {
    // Volume counts both hands for a per-side exercise; 1RM / top weight stay per-hand.
    // A unilateral exercise's factor is 1 (L+R already summed). Optional attachment filter.
    const ex = this.getExerciseById(exerciseLocalId);
    const factor = ex ? loadFactor(ex) : 1;
    const attClause = attachment ? `AND se.attachment = ?` : ``;
    const params = attachment ? [exerciseLocalId, attachment] : [exerciseLocalId];
    return (db.getAllSync(
      `SELECT ws.startedAt AS date,
              MAX(es.weightKg * (1 + es.reps / 30.0)) AS est1RM,
              SUM(es.weightKg * es.reps) AS volume,
              MAX(es.weightKg) AS topWeight,
              SUM(es.reps) AS reps
       FROM exercise_sets es
       JOIN session_exercises se ON es.sessionExerciseLocalId = se.localId
       JOIN workout_sessions ws ON se.sessionLocalId = ws.localId
       WHERE se.exerciseLocalId = ? ${attClause} AND ws.finishedAt IS NOT NULL AND ws.deleted = 0
       GROUP BY ws.localId
       ORDER BY ws.startedAt ASC`,
      params
    ) as any[]).map((r) => ({
      date: r.date,
      est1RM: r.est1RM ?? 0,
      volume: (r.volume ?? 0) * factor,
      topWeight: r.topWeight ?? 0,
      reps: r.reps ?? 0,
    }));
  }

  /**
   * Build the editable set rows for a session exercise. A unilateral exercise expands each
   * logical set into an L/R pair (lead side first); ghost prefills match by setNumber + side.
   */
  private makeLocalSets(
    exercise: Exercise,
    lastSets: ExerciseSet[],
    opts: { count?: number; reps?: number; weightKg?: number },
    nextId: () => string
  ): LocalSet[] {
    const uni = !!exercise.unilateral;
    const lead: 'L' | 'R' = exercise.leadSide ?? 'L';
    const sides: ('L' | 'R' | null)[] = uni ? (lead === 'R' ? ['R', 'L'] : ['L', 'R']) : [null];
    const lastRounds = uni ? new Set(lastSets.map((s) => s.setNumber)).size : lastSets.length;
    const rounds = opts.count ?? (lastRounds > 0 ? lastRounds : 1);
    const out: LocalSet[] = [];
    for (let r = 0; r < rounds; r++) {
      for (const side of sides) {
        const ghost = uni
          ? lastSets.find((s) => s.setNumber === r + 1 && (s.side ?? null) === side)
          : lastSets[r];
        out.push({
          localId: nextId(),
          setNumber: r + 1,
          side,
          weightKg: ghost?.weightKg ?? opts.weightKg ?? 0,
          reps: ghost?.reps ?? opts.reps ?? 8,
          done: false,
          isPersonalBest: false,
        });
      }
    }
    return out;
  }

  // Build LocalExercise list from a template for a new session
  buildLocalExercisesFromTemplate(
    templateLocalId: string
  ): LocalExercise[] {
    const tmpl = this.getTemplates().find((t) => t.id === templateLocalId);
    if (!tmpl) return [];
    let counter = 0;
    const nextId = () => String(++counter);

    return tmpl.exercises.map((te) => {
      const lastSets = this.getLastSetsForExercise(te.exercise.id, te.attachment ?? null);
      const sets = this.makeLocalSets(
        te.exercise,
        lastSets,
        { count: te.defaultSets, reps: te.defaultReps ?? undefined, weightKg: te.defaultWeightKg ?? undefined },
        nextId
      );
      return {
        localId: nextId(),
        exerciseId: te.exercise.id,
        exercise: te.exercise,
        notes: '',
        order: te.order,
        sets,
        lastSets,
        restSeconds: te.restSeconds ?? DEFAULT_REST_SECONDS,
        supersetGroup: te.supersetGroup ?? null,
        attachment: te.attachment ?? null,
      };
    });
  }

  buildEmptyLocalExercise(exercise: Exercise, counter: { n: number }): LocalExercise {
    const nextId = () => String(++counter.n);
    const lastSets = this.getLastSetsForExercise(exercise.id);
    const sets = this.makeLocalSets(exercise, lastSets, {}, nextId);
    return {
      localId: nextId(),
      exerciseId: exercise.id,
      exercise,
      notes: '',
      order: 0,
      sets,
      lastSets,
      restSeconds: DEFAULT_REST_SECONDS,
      attachment: null,
    };
  }

  /** Overwrite a session's caloriesBurned (used when a measured Health value arrives after finish). */
  setSessionCalories(localId: string, caloriesBurned: number): void {
    db.runSync(
      `UPDATE workout_sessions SET caloriesBurned = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [caloriesBurned, new Date().toISOString(), localId]
    );
  }

  /** Store a session's heart-rate summary + series (arrives from Health after finish). */
  setSessionHeartRate(
    localId: string,
    hr: { avg: number; min: number; max: number; samples: number[] }
  ): void {
    db.runSync(
      `UPDATE workout_sessions SET avgHeartRate = ?, minHeartRate = ?, maxHeartRate = ?, heartRateSamplesJson = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [hr.avg, hr.min, hr.max, JSON.stringify(hr.samples), new Date().toISOString(), localId]
    );
  }

  /**
   * Sum of caloriesBurned across sessions finished today (local day), with each
   * session clamped to a sane ceiling so a corrupt/oversized row (e.g. a workout
   * left running across days) can't blow up the daily eat-back. For opt-in eat-back.
   */
  getCaloriesBurnedToday(): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const row = db.getFirstSync(
      `SELECT COALESCE(SUM(MIN(COALESCE(caloriesBurned, 0), 2500)), 0) AS total
       FROM workout_sessions
       WHERE finishedAt IS NOT NULL AND deleted = 0 AND finishedAt >= ?`,
      [start.toISOString()]
    ) as any;
    return Math.round(row?.total ?? 0);
  }

  // Volume data for stats/charts. Computed from sets × per-side factor (so dumbbell
  // two-arm work counts both hands) rather than the stored totalVolume, which keeps
  // historical sessions consistent with the per-side rules.
  getVolumeBySession(from: string, to: string): { date: string; volume: number }[] {
    return db.getAllSync(
      `SELECT ws.startedAt AS date,
              COALESCE(SUM(es.weightKg * es.reps *
                (CASE WHEN e.unilateral = 1 THEN 1
                      WHEN COALESCE(e.perSide,
                       CASE WHEN LOWER(e.equipment) IN ('dumbbell','kettlebell') THEN 1 ELSE 0 END) = 1
                      THEN 2 ELSE 1 END)
              ), 0) AS volume
       FROM workout_sessions ws
       JOIN session_exercises se ON se.sessionLocalId = ws.localId
       JOIN exercises e ON se.exerciseLocalId = e.localId
       JOIN exercise_sets es ON es.sessionExerciseLocalId = se.localId
       WHERE ws.finishedAt IS NOT NULL AND ws.deleted = 0 AND ws.startedAt >= ? AND ws.startedAt <= ?
       GROUP BY ws.localId
       ORDER BY ws.startedAt`,
      [from, to]
    ) as any[];
  }

  // Upsert template from server response
  upsertTemplateFromServer(tmpl: WorkoutTemplate): string {
    const existing = tmpl.id
      ? (db.getFirstSync(`SELECT localId FROM workout_templates WHERE serverId = ?`, [tmpl.id]) as any)
      : null;
    const localId = existing?.localId ?? Crypto.randomUUID();
    db.runSync(
      `INSERT OR REPLACE INTO workout_templates
         (localId, serverId, name, description, label, lastPerformedAt, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [localId, tmpl.id, tmpl.name, tmpl.description ?? null, tmpl.label ?? null, tmpl.lastPerformedAt ?? null, tmpl.createdAt]
    );
    // Re-insert exercises
    db.runSync(`DELETE FROM template_exercises WHERE templateLocalId = ?`, [localId]);
    for (const te of tmpl.exercises) {
      const exLocalId = this.upsertExercise(te.exercise);
      db.runSync(
        `INSERT INTO template_exercises
           (localId, templateLocalId, exerciseLocalId, defaultSets, defaultReps, defaultWeightKg, restSeconds, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [Crypto.randomUUID(), localId, exLocalId, te.defaultSets, te.defaultReps ?? null, te.defaultWeightKg ?? null, te.restSeconds ?? null, te.order]
      );
    }
    return localId;
  }
}

export const workoutRepo = new WorkoutRepo();
