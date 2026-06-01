import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';
import type {
  Exercise, ExerciseSet, LocalExercise, LocalSet,
  SessionExercise, WorkoutSession, WorkoutTemplate,
} from '@/types';

const DEFAULT_REST_SECONDS = 120;

export interface TemplateInput {
  name: string;
  description?: string;
  label?: string | null;
  exercises: Array<{ exerciseId: string; defaultSets: number; defaultReps?: number; defaultWeightKg?: number; restSeconds?: number; order: number }>;
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
  return {
    id: row.localId,
    name: row.name,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    notes: row.notes ?? null,
    totalVolume: row.totalVolume ?? null,
    exercises,
    template: row.templateName ? { name: row.templateName } : null,
    createdAt: row.updatedAt ?? row.startedAt,
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

export class WorkoutRepo {

  // ── Exercises ───────────────────────────────────────────────────────────────

  searchExercises(q: string, muscle?: string, equipment?: string): Exercise[] {
    let sql = `SELECT * FROM exercises WHERE 1=1`;
    const params: any[] = [];
    if (q) { sql += ` AND name LIKE ?`; params.push(`%${q}%`); }
    if (muscle) { sql += ` AND muscleGroup = ?`; params.push(muscle); }
    if (equipment) { sql += ` AND equipment = ?`; params.push(equipment); }
    sql += ` ORDER BY name LIMIT 50`;
    return (db.getAllSync(sql, params) as any[]).map(mapExercise);
  }

  getExerciseById(localId: string): Exercise | null {
    const row = db.getFirstSync(`SELECT * FROM exercises WHERE localId = ?`, [localId]);
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

  /** Remove all bundled (non-custom) exercises — used to rebuild a stale/duplicated catalog. */
  deleteSeededExercises(): void {
    db.runSync(`DELETE FROM exercises WHERE isCustom = 0`);
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
    const localId = existing?.localId ?? Crypto.randomUUID();
    db.runSync(
      `INSERT OR REPLACE INTO exercises
         (localId, serverId, exerciseDbId, name, nameAlternative, muscleGroup, musclesPrimary, musclesSecondary,
          equipment, category, description, instructions, tips, imageUrl, videoUrl, gifUrl, localMediaPath,
          isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
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
        ex.isCustom ? 1 : 0,
        new Date().toISOString(),
      ]
    );
    return localId;
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
                e.category AS e_category, e.isCustom AS e_isCustom
         FROM template_exercises te
         JOIN exercises e ON te.exerciseLocalId = e.localId
         WHERE te.templateLocalId = ?
         ORDER BY te.sortOrder`,
        [row.localId]
      ) as any[];
      const exercises = exRows.map((er) => ({
        id: er.localId,
        exercise: mapExercise({ localId: er.e_localId, name: er.e_name, muscleGroup: er.e_muscleGroup, equipment: er.e_equipment, description: er.e_description, instructions: er.e_instructions, tips: er.e_tips, imageUrl: er.e_imageUrl, videoUrl: er.e_videoUrl, gifUrl: er.e_gifUrl, musclesPrimary: er.e_musclesPrimary, musclesSecondary: er.e_musclesSecondary, category: er.e_category, isCustom: er.e_isCustom }),
        defaultSets: er.defaultSets ?? 3,
        defaultReps: er.defaultReps ?? null,
        defaultWeightKg: er.defaultWeightKg ?? null,
        restSeconds: er.restSeconds ?? null,
        order: er.sortOrder,
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
           (localId, templateLocalId, exerciseLocalId, defaultSets, defaultReps, defaultWeightKg, restSeconds, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [Crypto.randomUUID(), templateLocalId, ex.exerciseId, ex.defaultSets, ex.defaultReps ?? null, ex.defaultWeightKg ?? null, ex.restSeconds ?? null, ex.order]
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
      sets: Array<{ setNumber: number; weightKg: number; reps: number; rpe?: number; isPersonalBest?: boolean }>;
    }>,
    finishedAt: string
  ): void {
    // Calculate total volume
    const totalVolume = exercises.reduce(
      (total, ex) => total + ex.sets.reduce((s, set) => s + set.weightKg * set.reps, 0),
      0
    );

    db.runSync(
      `UPDATE workout_sessions SET finishedAt = ?, totalVolume = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [finishedAt, totalVolume, new Date().toISOString(), localId]
    );

    // Delete old session exercises if re-finishing
    db.runSync(`DELETE FROM session_exercises WHERE sessionLocalId = ?`, [localId]);

    for (const ex of exercises) {
      const seLocalId = Crypto.randomUUID();
      db.runSync(
        `INSERT INTO session_exercises (localId, sessionLocalId, exerciseLocalId, notes, sortOrder)
         VALUES (?, ?, ?, ?, ?)`,
        [seLocalId, localId, ex.exerciseLocalId, ex.notes ?? null, ex.order]
      );
      for (const set of ex.sets) {
        db.runSync(
          `INSERT INTO exercise_sets (localId, sessionExerciseLocalId, setNumber, weightKg, reps, rpe, isPersonalBest)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [Crypto.randomUUID(), seLocalId, set.setNumber, set.weightKg, set.reps, set.rpe ?? null, set.isPersonalBest ? 1 : 0]
        );
      }
    }
  }

  discardSession(localId: string): void {
    db.runSync(`DELETE FROM workout_sessions WHERE localId = ?`, [localId]);
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
                e.description AS e_description, e.category AS e_category, e.isCustom AS e_isCustom
         FROM session_exercises se
         JOIN exercises e ON se.exerciseLocalId = e.localId
         WHERE se.sessionLocalId = ?
         ORDER BY se.sortOrder`,
        [row.localId]
      ) as any[];

      const exercises: SessionExercise[] = seRows.map((ser) => {
        const sets = db.getAllSync(
          `SELECT * FROM exercise_sets WHERE sessionExerciseLocalId = ? ORDER BY setNumber`,
          [ser.localId]
        ) as any[];
        return {
          id: ser.localId,
          exercise: mapExercise({ localId: ser.e_localId, name: ser.e_name, muscleGroup: ser.e_muscleGroup, equipment: ser.e_equipment, description: ser.e_description, instructions: ser.e_instructions, tips: ser.e_tips, imageUrl: ser.e_imageUrl, videoUrl: ser.e_videoUrl, gifUrl: ser.e_gifUrl, musclesPrimary: ser.e_musclesPrimary, musclesSecondary: ser.e_musclesSecondary, category: ser.e_category, isCustom: ser.e_isCustom }),
          notes: ser.notes ?? null,
          order: ser.sortOrder,
          sets: sets.map((s) => ({
            id: s.localId,
            setNumber: s.setNumber,
            weightKg: s.weightKg,
            reps: s.reps,
            rpe: s.rpe ?? null,
            isPersonalBest: !!s.isPersonalBest,
          })),
        };
      });

      return mapSession(row, exercises);
    });
  }

  // Last sets for an exercise (for ghost values in session screen)
  getLastSetsForExercise(exerciseLocalId: string): ExerciseSet[] {
    const lastSession = db.getFirstSync(
      `SELECT se.localId FROM session_exercises se
       JOIN workout_sessions ws ON se.sessionLocalId = ws.localId
       WHERE se.exerciseLocalId = ? AND ws.finishedAt IS NOT NULL
       ORDER BY ws.startedAt DESC LIMIT 1`,
      [exerciseLocalId]
    ) as any;
    if (!lastSession) return [];
    const sets = db.getAllSync(
      `SELECT * FROM exercise_sets WHERE sessionExerciseLocalId = ? ORDER BY setNumber`,
      [lastSession.localId]
    ) as any[];
    return sets.map((s) => ({
      id: s.localId,
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      rpe: s.rpe ?? null,
      isPersonalBest: !!s.isPersonalBest,
    }));
  }

  // Best historical Epley 1RM for an exercise (for PR detection)
  getBestEpleyForExercise(exerciseLocalId: string): number {
    const row = db.getFirstSync(
      `SELECT MAX(es.weightKg * (1 + es.reps / 30.0)) AS best
       FROM exercise_sets es
       JOIN session_exercises se ON es.sessionExerciseLocalId = se.localId
       WHERE se.exerciseLocalId = ?`,
      [exerciseLocalId]
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
  getExerciseSessionHistory(exerciseLocalId: string): { date: string; est1RM: number; volume: number; topWeight: number; reps: number }[] {
    return (db.getAllSync(
      `SELECT ws.startedAt AS date,
              MAX(es.weightKg * (1 + es.reps / 30.0)) AS est1RM,
              SUM(es.weightKg * es.reps) AS volume,
              MAX(es.weightKg) AS topWeight,
              SUM(es.reps) AS reps
       FROM exercise_sets es
       JOIN session_exercises se ON es.sessionExerciseLocalId = se.localId
       JOIN workout_sessions ws ON se.sessionLocalId = ws.localId
       WHERE se.exerciseLocalId = ? AND ws.finishedAt IS NOT NULL AND ws.deleted = 0
       GROUP BY ws.localId
       ORDER BY ws.startedAt ASC`,
      [exerciseLocalId]
    ) as any[]).map((r) => ({
      date: r.date,
      est1RM: r.est1RM ?? 0,
      volume: r.volume ?? 0,
      topWeight: r.topWeight ?? 0,
      reps: r.reps ?? 0,
    }));
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
      const lastSets = this.getLastSetsForExercise(te.exercise.id);
      const numSets = te.defaultSets ?? (lastSets.length > 0 ? lastSets.length : 3);
      const sets: LocalSet[] = Array.from({ length: numSets }, (_, i) => ({
        localId: nextId(),
        setNumber: i + 1,
        weightKg: lastSets[i]?.weightKg ?? te.defaultWeightKg ?? 0,
        reps: lastSets[i]?.reps ?? te.defaultReps ?? 8,
        done: false,
        isPersonalBest: false,
      }));
      return {
        localId: nextId(),
        exerciseId: te.exercise.id,
        exercise: te.exercise,
        notes: '',
        order: te.order,
        sets,
        lastSets,
        restSeconds: te.restSeconds ?? DEFAULT_REST_SECONDS,
      };
    });
  }

  buildEmptyLocalExercise(exercise: Exercise, counter: { n: number }): LocalExercise {
    const nextId = () => String(++counter.n);
    const lastSets = this.getLastSetsForExercise(exercise.id);
    const sets: LocalSet[] = lastSets.length > 0
      ? lastSets.map((s, i) => ({
          localId: nextId(),
          setNumber: i + 1,
          weightKg: s.weightKg,
          reps: s.reps,
          done: false,
          isPersonalBest: false,
        }))
      : [{ localId: nextId(), setNumber: 1, weightKg: 0, reps: 8, done: false, isPersonalBest: false }];
    return {
      localId: nextId(),
      exerciseId: exercise.id,
      exercise,
      notes: '',
      order: 0,
      sets,
      lastSets,
      restSeconds: DEFAULT_REST_SECONDS,
    };
  }

  // Volume data for stats/charts
  getVolumeBySession(from: string, to: string): { date: string; volume: number }[] {
    return db.getAllSync(
      `SELECT startedAt AS date, COALESCE(totalVolume, 0) AS volume
       FROM workout_sessions
       WHERE finishedAt IS NOT NULL AND deleted = 0 AND startedAt >= ? AND startedAt <= ?
       ORDER BY startedAt`,
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
