import type { LocalExercise } from '@/types';

/**
 * Superset ordering for an active workout.
 *
 * A superset is a maximal run of **adjacent** exercises sharing the same
 * `supersetGroup` key. Their sets interleave by round: round 0 is the first set
 * of every exercise in the group, round 1 the second set, and so on. Solo
 * exercises (no group) behave as a group of one.
 *
 * `buildSetSequence` flattens the whole session into the order sets should be
 * completed in — which also gives us "Next carries over into the following
 * exercise" for free, since the next solo exercise's first set simply follows.
 */
export interface SetCell {
  exLocalId: string;
  setLocalId: string;
  /** Last exercise of its group for this round → rest fires after completing it. */
  isLastInRound: boolean;
}

/**
 * A superset must have ≥2 *adjacent* members sharing a group key. Removing an
 * exercise, ungrouping one, or reordering can leave a group with a single member (or
 * split it so members are no longer adjacent) — an orphan that still renders with the
 * superset mark. This clears `supersetGroup` on any exercise with no adjacent
 * same-group peer, so a 2-exercise superset that loses one member reverts to two solo
 * exercises. Returns the same array reference when nothing changed.
 */
export function normalizeSupersets<T extends { supersetGroup?: string | null }>(items: T[]): T[] {
  let changed = false;
  const next = items.map((it, i) => {
    if (!it.supersetGroup) return it;
    const prev = items[i - 1];
    const after = items[i + 1];
    const hasPeer =
      (!!prev && prev.supersetGroup === it.supersetGroup) ||
      (!!after && after.supersetGroup === it.supersetGroup);
    if (hasPeer) return it;
    changed = true;
    return { ...it, supersetGroup: null } as T;
  });
  return changed ? next : items;
}

/** Split exercises into runs of adjacent same-group exercises (solo = run of one). */
export function supersetRuns(exercises: LocalExercise[]): LocalExercise[][] {
  const runs: LocalExercise[][] = [];
  for (const ex of exercises) {
    const prev = runs[runs.length - 1];
    const prevEx = prev?.[prev.length - 1];
    if (prev && ex.supersetGroup && prevEx?.supersetGroup === ex.supersetGroup) {
      prev.push(ex);
    } else {
      runs.push([ex]);
    }
  }
  return runs;
}

/** Ordered list of set cells across the whole session, round-interleaved per group. */
export function buildSetSequence(exercises: LocalExercise[]): SetCell[] {
  const cells: SetCell[] = [];
  for (const run of supersetRuns(exercises)) {
    const rounds = Math.max(...run.map((e) => e.sets.length), 0);
    for (let r = 0; r < rounds; r++) {
      const present = run.filter((e) => e.sets[r]);
      present.forEach((e, i) => {
        cells.push({
          exLocalId: e.localId,
          setLocalId: e.sets[r].localId,
          isLastInRound: i === present.length - 1,
        });
      });
    }
  }
  return cells;
}

/** The cell after the given set in completion order, or null if it's the last. */
export function nextSetCell(
  exercises: LocalExercise[],
  exLocalId: string,
  setLocalId: string
): { exLocalId: string; setLocalId: string } | null {
  const seq = buildSetSequence(exercises);
  const i = seq.findIndex((c) => c.exLocalId === exLocalId && c.setLocalId === setLocalId);
  if (i < 0 || i + 1 >= seq.length) return null;
  const next = seq[i + 1];
  return { exLocalId: next.exLocalId, setLocalId: next.setLocalId };
}

/** Whether completing this set should start the rest timer (true unless mid-round in a superset). */
export function restAfterSet(
  exercises: LocalExercise[],
  exLocalId: string,
  setLocalId: string
): boolean {
  const seq = buildSetSequence(exercises);
  const cell = seq.find((c) => c.exLocalId === exLocalId && c.setLocalId === setLocalId);
  return cell ? cell.isLastInRound : true;
}

/**
 * Per-exercise superset display label (A1/A2…) for grouped exercises, keyed by
 * `localId`. Solo exercises are absent from the map.
 */
export function supersetLabels(exercises: LocalExercise[]): Record<string, string> {
  const labels: Record<string, string> = {};
  let groupLetterIdx = 0;
  for (const run of supersetRuns(exercises)) {
    if (run.length > 1) {
      const letter = String.fromCharCode(65 + (groupLetterIdx % 26)); // A, B, C…
      run.forEach((e, i) => { labels[e.localId] = `${letter}${i + 1}`; });
      groupLetterIdx++;
    }
  }
  return labels;
}
