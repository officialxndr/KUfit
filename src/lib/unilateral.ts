import type { LocalSet, Side } from '@/types';

/**
 * Helpers for unilateral (per-arm) set rows in an active workout.
 *
 * A unilateral exercise stores its sets *flat*, two rows per logical set — one per arm,
 * sharing a `setNumber` and tagged with `side` ('L'/'R'). The lead side comes first. These
 * pure transforms keep that invariant as the user adds/removes sets or flips the mode, so
 * the session store stays small and the rules are unit-testable.
 */

/** Side order for a round, lead side first. */
export function orderedSides(leadSide?: Side | null): Side[] {
  return leadSide === 'R' ? ['R', 'L'] : ['L', 'R'];
}

/** Group flat sets into rounds keyed by setNumber, preserving order. */
function toRounds(sets: LocalSet[]): LocalSet[][] {
  const map = new Map<number, LocalSet[]>();
  for (const s of sets) {
    const arr = map.get(s.setNumber);
    if (arr) arr.push(s);
    else map.set(s.setNumber, [s]);
  }
  return [...map.values()];
}

/** Re-sequence setNumber as 1..N across rounds (keeps within-round side order). */
export function renumberRounds(sets: LocalSet[]): LocalSet[] {
  return toRounds(sets).flatMap((round, i) => round.map((s) => ({ ...s, setNumber: i + 1 })));
}

/** Expand single (bilateral) sets into L/R pairs, lead side first, copying weight/reps to both. */
export function expandToPairs(sets: LocalSet[], leadSide: Side | null | undefined, nextId: () => string): LocalSet[] {
  const sides = orderedSides(leadSide);
  return renumberRounds(
    sets.flatMap((s) =>
      sides.map((side, i) => ({
        ...s,
        localId: i === 0 ? s.localId : nextId(), // reuse id for the lead row, new id for the other
        side,
        done: false,
      }))
    )
  );
}

/** Collapse L/R pairs back to one set per round (keep the lead side's values), dropping side. */
export function collapseToSingles(sets: LocalSet[], leadSide: Side | null | undefined): LocalSet[] {
  const lead = leadSide === 'R' ? 'R' : 'L';
  const kept = toRounds(sets).map((round) => {
    const pick = round.find((s) => s.side === lead) ?? round[0];
    return { ...pick, side: null as Side | null, done: false };
  });
  return renumberRounds(kept);
}

/** Reorder each round's rows so the lead side comes first (after a lead-side change). */
export function reorderLead(sets: LocalSet[], leadSide: Side | null | undefined): LocalSet[] {
  const sides = orderedSides(leadSide);
  return toRounds(sets).flatMap((round) =>
    [...round].sort((a, b) => sides.indexOf(a.side as Side) - sides.indexOf(b.side as Side))
  );
}

/** Append one new round (a pair for unilateral, a single otherwise), prefilled from the last round. */
export function appendRound(
  sets: LocalSet[],
  unilateral: boolean,
  leadSide: Side | null | undefined,
  nextId: () => string
): LocalSet[] {
  const nextNumber = sets.length ? Math.max(...sets.map((s) => s.setNumber)) + 1 : 1;
  if (!unilateral) {
    const last = sets[sets.length - 1];
    return [
      ...sets,
      { localId: nextId(), setNumber: nextNumber, side: null, weightKg: last?.weightKg ?? 0, reps: last?.reps ?? 8, done: false, isPersonalBest: false },
    ];
  }
  const sides = orderedSides(leadSide);
  const newRows = sides.map((side) => {
    const prev = [...sets].reverse().find((s) => s.side === side);
    return { localId: nextId(), setNumber: nextNumber, side, weightKg: prev?.weightKg ?? 0, reps: prev?.reps ?? 8, done: false, isPersonalBest: false };
  });
  return [...sets, ...newRows];
}

/** Remove a set. Unilateral removes the whole round (both arms); otherwise just the one row. Renumbers. */
export function removeSetOrRound(sets: LocalSet[], setLocalId: string, unilateral: boolean): LocalSet[] {
  const target = sets.find((s) => s.localId === setLocalId);
  if (!target) return sets;
  const remaining = unilateral
    ? sets.filter((s) => s.setNumber !== target.setNumber)
    : sets.filter((s) => s.localId !== setLocalId);
  return renumberRounds(remaining);
}
