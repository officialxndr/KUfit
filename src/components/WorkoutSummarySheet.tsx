import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import { X, Pencil, Plus } from 'lucide-react-native';

import { FsText, Card, Badge, Button } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { WorkoutSummaryBody } from '@/components/WorkoutSummaryBody';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { formatWeight, toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { UnitSystem, WorkoutSession, SessionExercise } from '@/types';

type EditTarget = { setId: string; weight: string; reps: string; deleteIds: string[] | null };

/**
 * Past-workout detail as a **bottom-sheet popup** (not the full-screen post-finish
 * celebration). Shares the summary stats via `WorkoutSummaryBody`, plus a per-exercise
 * breakdown. Used from Workout → History. Tapping **Edit** lets the user fix a mistyped
 * set (weight/reps), add a set, or delete one — persisted straight to the finished session
 * (volume/PRs/ghosts all recompute from the corrected sets). `onEdited` refreshes the caller.
 */
export function WorkoutSummarySheet({ session, unit, onClose, onEdited }: {
  session: WorkoutSession | null;
  unit: UnitSystem;
  onClose: () => void;
  onEdited?: () => void;
}) {
  const [live, setLive] = useState<WorkoutSession | null>(session);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const dirty = useRef(false);

  // Re-seed from the prop when a different session is opened; reset edit state.
  useEffect(() => { setLive(session); setEditing(false); dirty.current = false; }, [session]);

  const reload = () => { if (session) setLive(workoutRepo.getSession(session.id)); dirty.current = true; };
  const close = () => { if (dirty.current) onEdited?.(); onClose(); };

  const openEdit = (e: SessionExercise, st: SessionExercise['sets'][number]) => {
    // Unilateral exercises store an L+R pair sharing a setNumber; delete removes the whole round
    // (both sides) to avoid a lopsided half-round, and only when more than one round remains.
    const rounds = new Set(e.sets.map((x) => x.setNumber)).size;
    const roundIds = e.sets.filter((x) => x.setNumber === st.setNumber).map((x) => x.id);
    setTarget({
      setId: st.id,
      weight: String(Math.round(toDisplay(st.weightKg, unit) * 10) / 10),
      reps: String(st.reps),
      deleteIds: rounds > 1 ? roundIds : null,
    });
  };
  const saveEdit = () => {
    if (!target) return;
    const w = parseFloat(target.weight);
    const r = parseInt(target.reps, 10);
    workoutRepo.updateSet(target.setId, {
      weightKg: Number.isFinite(w) && w >= 0 ? toKg(w, unit) : undefined,
      reps: Number.isInteger(r) && r > 0 ? r : undefined,
    });
    reload();
    setTarget(null);
  };
  const removeSet = () => {
    if (!target?.deleteIds) return;
    target.deleteIds.forEach((id) => workoutRepo.deleteSet(id));
    reload();
    setTarget(null);
  };
  const addSet = (e: SessionExercise) => {
    const last = e.sets[e.sets.length - 1];
    workoutRepo.addSetToLoggedExercise(e.id, last?.weightKg ?? 0, last?.reps ?? 8);
    reload();
  };

  const s = live;
  return (
    <BottomSheet visible={!!session} onClose={close}>
      {s && (
        <>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <FsText variant="h2" numberOfLines={1}>{s.name}</FsText>
              <FsText variant="caption">
                {new Date(s.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </FsText>
            </View>
            <Pressable onPress={() => setEditing((v) => !v)} hitSlop={10} style={{ marginRight: space[3] }}>
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>{editing ? 'Done' : 'Edit'}</FsText>
            </Pressable>
            <Pressable onPress={close} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
          </View>

          {/* One scroll region for the whole body: flexShrink lets it fill the sheet's capped
              height and scroll, so the summary + every exercise stay reachable (the head stays put). */}
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[2] }}>
            <WorkoutSummaryBody session={s} />

            <FsText variant="overline" style={{ marginTop: space[4], marginBottom: space[2] }}>Exercises</FsText>
            {s.exercises.map((e) => (
              <Card key={e.id} style={{ marginBottom: space[2] }}>
                <FsText variant="bodyMedium" style={{ marginBottom: space[1] }}>{e.exercise.name}</FsText>
                {e.sets.map((st, i) => (
                  editing ? (
                    <Pressable key={st.id} style={styles.setRow} onPress={() => openEdit(e, st)}>
                      <FsText variant="caption" style={{ width: 44 }}>Set {st.setNumber}{st.side ? ` ${st.side}` : ''}</FsText>
                      <FsText variant="caption" style={{ flex: 1 }}>{formatWeight(st.weightKg, unit)} × {st.reps}</FsText>
                      <Pencil color={colors.muted} size={14} />
                    </Pressable>
                  ) : (
                    <View key={st.id} style={styles.setRow}>
                      <FsText variant="caption" style={{ width: 44 }}>Set {st.setNumber}{st.side ? ` ${st.side}` : ''}</FsText>
                      <FsText variant="caption" style={{ flex: 1 }}>{formatWeight(st.weightKg, unit)} × {st.reps}</FsText>
                      {st.isPersonalBest && <Badge label="PR" tone="warning" />}
                    </View>
                  )
                ))}
                {editing && (
                  <Pressable style={styles.addRow} onPress={() => addSet(e)} hitSlop={6}>
                    <Plus color={colors.primary} size={14} />
                    <FsText variant="caption" style={{ color: colors.primary }}>Add set</FsText>
                  </Pressable>
                )}
              </Card>
            ))}
          </ScrollView>
        </>
      )}

      {/* Edit-set editor */}
      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTarget(null)}>
          <Pressable style={styles.editCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Edit set</FsText>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1, gap: 6 }}>
                <FsText variant="caption">Weight ({UNIT_LABELS[unit].weight})</FsText>
                <TextInput value={target?.weight ?? ''} onChangeText={(t) => setTarget((n) => (n ? { ...n, weight: t } : n))} keyboardType="decimal-pad" style={styles.numInput} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <FsText variant="caption">Reps</FsText>
                <TextInput value={target?.reps ?? ''} onChangeText={(t) => setTarget((n) => (n ? { ...n, reps: t } : n))} keyboardType="number-pad" style={styles.numInput} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              {target?.deleteIds && <View style={{ flex: 1 }}><Button title={target.deleteIds.length > 1 ? 'Delete round' : 'Delete'} variant="ghost" onPress={removeSet} /></View>}
              <View style={{ flex: 1 }}><Button title="Save" onPress={saveEdit} /></View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </BottomSheet>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[6] },
  editCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  numInput: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 16, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
}));
