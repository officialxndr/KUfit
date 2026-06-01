import { useCallback, useState } from 'react';
import { View, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Play, Plus, Repeat, Trash2, ArrowRightCircle, Pencil, Star, Search } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import { Card, FsText, Button, SectionHeader, Badge } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTemplateDraftStore } from '@/stores/templateDraftStore';
import { useRoutineStore, getNextTemplateId, type Routine } from '@/stores/routineStore';
import { colors, radius, space, tintBg, themedStyles } from '@/theme/tokens';
import type { WorkoutTemplate } from '@/types';

export function WorkoutLibrary() {
  const router = useRouter();
  const session = useSessionStore();
  const { routines, defaultRoutineId, addRoutine, updateRoutine, deleteRoutine, setDefaultRoutine, markDone } = useRoutineStore();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exerciseCount, setExerciseCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [tplQuery, setTplQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | null>(null); // null = All

  const refresh = useCallback(() => {
    setTemplates(workoutRepo.getTemplates());
    setExerciseCount(workoutRepo.countExercises());
  }, []);
  useFocusEffect(refresh);

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Workout';

  const startEmpty = () => {
    session.startEmpty();
    router.push('/session');
  };
  const startTemplate = (t: WorkoutTemplate) => {
    session.startFromTemplate(t.id, t.name);
    router.push('/session');
  };
  const newTemplate = () => {
    useTemplateDraftStore.getState().reset();
    Alert.alert('New Template', 'How do you want to build it?', [
      { text: 'Setup wizard', onPress: () => router.push('/template/new?mode=wizard') },
      { text: 'Blank', onPress: () => router.push('/template/new') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const editTemplate = (t: WorkoutTemplate) => {
    useTemplateDraftStore.getState().loadTemplate(t);
    router.push({ pathname: '/template/new', params: { id: t.id } });
  };
  const confirmDeleteTemplate = (t: WorkoutTemplate) =>
    Alert.alert('Delete template?', `Remove "${t.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { workoutRepo.deleteTemplate(t.id); refresh(); } },
    ]);

  // Distinct labels for the filter chip row (alpha order).
  const labels = [...new Set(templates.map((t) => t.label?.trim()).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b));

  // Filter + group templates by label (folder).
  const filteredTemplates = templates.filter((t) => {
    const q = tplQuery.trim().toLowerCase();
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || (t.label ?? '').toLowerCase().includes(q);
    const matchesLabel = !labelFilter || (t.label?.trim() || '') === labelFilter;
    return matchesQuery && matchesLabel;
  });
  const groups = (() => {
    const map = new Map<string, WorkoutTemplate[]>();
    for (const t of filteredTemplates) {
      const k = t.label?.trim() || '';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    // Labeled groups first (alpha), then the unlabeled bucket.
    return [...map.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])));
  })();

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const cancelForm = () => { setShowCreate(false); setEditingId(null); setNewName(''); setSelected([]); };
  const openCreate = () => { setEditingId(null); setNewName(''); setSelected([]); setShowCreate(true); };
  const startEdit = (r: Routine) => { setEditingId(r.id); setNewName(r.name); setSelected([...r.templateIds]); setShowCreate(true); };
  const submit = () => {
    if (!newName.trim() || selected.length === 0) return;
    if (editingId) updateRoutine(editingId, { name: newName, templateIds: selected });
    else addRoutine(newName, selected);
    cancelForm();
  };
  const confirmDeleteRoutine = (r: Routine) =>
    Alert.alert('Delete routine?', `Remove "${r.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRoutine(r.id) },
    ]);

  const startRoutine = (r: Routine) => {
    const nextId = getNextTemplateId(r);
    const t = nextId ? templates.find((x) => x.id === nextId) : null;
    if (!nextId || !t) return;
    markDone(r.id, nextId);
    startTemplate(t);
  };

  return (
    <>
      {session.active && (
        <Pressable onPress={() => router.push('/session')}>
          <Card outlined style={{ marginBottom: space[3], borderColor: colors.primary }}>
            <View style={styles.rowBetween}>
              <View>
                <FsText variant="cardTitle">Workout in progress</FsText>
                <FsText variant="caption">{session.exercises.length} exercises · tap to continue</FsText>
              </View>
              <Play color={colors.primary} size={22} />
            </View>
          </Card>
        </Pressable>
      )}

      {/* ── Routines ── */}
      <SectionHeader
        title="Routines"
        action={
          !showCreate ? (
            <Pressable onPress={openCreate} hitSlop={8}>
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>+ New</FsText>
            </Pressable>
          ) : undefined
        }
      />

      {showCreate && (
        <Card outlined style={{ marginBottom: space[3], borderColor: colors.primary }}>
          <FsText variant="bodyMedium" style={{ color: colors.primary, marginBottom: space[3] }}>{editingId ? 'Edit Routine' : 'New Routine'}</FsText>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Routine name…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {templates.length === 0 ? (
            <FsText variant="caption" style={{ marginTop: space[3] }}>
              Create a template first — routines rotate through templates.
            </FsText>
          ) : (
            <>
              <FsText variant="overline" style={{ marginTop: space[3], marginBottom: space[2] }}>
                Select templates · tap to set rotation order
              </FsText>
              <View style={{ gap: 6 }}>
                {templates.map((t) => {
                  const on = selected.includes(t.id);
                  const pos = selected.indexOf(t.id) + 1;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => toggleSelect(t.id)}
                      style={[styles.selectRow, on && { backgroundColor: tintBg.primary, borderColor: colors.primary }]}
                    >
                      <View style={[styles.orderChip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        {on ? (
                          <FsText variant="caption" style={{ color: colors.white, fontWeight: '700' }}>{pos}</FsText>
                        ) : (
                          <Plus color={colors.muted} size={13} />
                        )}
                      </View>
                      <FsText variant="bodyMedium" style={{ flex: 1 }}>{t.name}</FsText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="ghost" onPress={cancelForm} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={editingId ? 'Save' : 'Create'} onPress={submit} disabled={!newName.trim() || selected.length === 0} />
            </View>
          </View>
        </Card>
      )}

      {!showCreate && routines.length === 0 && (
        <Card style={{ marginBottom: space[3] }}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flex: 1 }}>
              <View style={styles.iconWrap}>
                <Repeat color={colors.primary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">Create a routine</FsText>
                <FsText variant="caption">Auto-rotate through your templates</FsText>
              </View>
            </View>
          </View>
        </Card>
      )}

      {routines.map((r) => {
        const nextId = getNextTemplateId(r);
        return (
          <Card key={r.id} style={{ marginBottom: space[3] }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <FsText variant="cardTitle">{r.name}</FsText>
                  {defaultRoutineId === r.id && <Badge label="Default" tone="primary" />}
                </View>
                <FsText variant="caption">
                  {r.templateIds.length} workout{r.templateIds.length !== 1 ? 's' : ''} in rotation
                </FsText>
              </View>
              <Button title="Start" onPress={() => startRoutine(r)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
            </View>
            {nextId && (
              <View style={styles.nextChip}>
                <ArrowRightCircle color={colors.primary} size={14} />
                <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                  Next: {templateName(nextId)}
                </FsText>
              </View>
            )}
            <View style={styles.routineActions}>
              <Pressable
                style={styles.routineAction}
                onPress={() => setDefaultRoutine(defaultRoutineId === r.id ? null : r.id)}
                hitSlop={6}
              >
                <Star color={defaultRoutineId === r.id ? colors.warning : colors.muted} size={15} fill={defaultRoutineId === r.id ? colors.warning : 'transparent'} />
                <FsText variant="caption" style={{ color: defaultRoutineId === r.id ? colors.warning : colors.muted }}>
                  {defaultRoutineId === r.id ? 'Default' : 'Set default'}
                </FsText>
              </Pressable>
              <Pressable style={styles.routineAction} onPress={() => startEdit(r)} hitSlop={6}>
                <Pencil color={colors.muted} size={15} />
                <FsText variant="caption">Edit</FsText>
              </Pressable>
              <Pressable style={styles.routineAction} onPress={() => confirmDeleteRoutine(r)} hitSlop={6}>
                <Trash2 color={colors.danger} size={15} />
                <FsText variant="caption" style={{ color: colors.danger }}>Delete</FsText>
              </Pressable>
            </View>
          </Card>
        );
      })}

      {/* ── Templates ── */}
      <SectionHeader
        title="Templates"
        action={
          <Pressable onPress={newTemplate} hitSlop={8}>
            <FsText variant="bodyMedium" style={{ color: colors.primary }}>+ New</FsText>
          </Pressable>
        }
      />
      <Button title="Quick Start" onPress={startEmpty} style={{ marginBottom: space[3] }} />
      {templates.length === 0 ? (
        <Card style={{ marginBottom: space[3] }}>
          <FsText variant="caption">No templates yet. Build one to start logging workouts.</FsText>
        </Card>
      ) : (
        <>
          {templates.length > 1 && (
            <View style={styles.tplSearch}>
              <Search color={colors.muted} size={16} />
              <TextInput
                value={tplQuery}
                onChangeText={setTplQuery}
                placeholder="Search templates or labels…"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 }}
              />
            </View>
          )}
          {labels.length > 0 && (
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setLabelFilter(null)}
                style={[styles.filterChip, labelFilter === null && styles.filterChipOn]}
              >
                <FsText variant="caption" style={{ color: labelFilter === null ? colors.white : colors.muted, fontWeight: '600' }}>All</FsText>
              </Pressable>
              {labels.map((l) => {
                const on = labelFilter === l;
                return (
                  <Pressable key={l} onPress={() => setLabelFilter(on ? null : l)} style={[styles.filterChip, on && styles.filterChipOn]}>
                    <FsText variant="caption" style={{ color: on ? colors.white : colors.muted, fontWeight: '600' }}>{l}</FsText>
                  </Pressable>
                );
              })}
            </View>
          )}
          {filteredTemplates.length === 0 && (
            <Card style={{ marginBottom: space[3] }}>
              <FsText variant="caption">No templates match your filter.</FsText>
            </Card>
          )}
          {groups.map(([groupLabel, items]) => (
            <View key={groupLabel || '_'}>
              {(groups.length > 1 || groupLabel) && (
                <FsText variant="overline" style={{ marginBottom: space[2], color: colors.muted }}>
                  {groupLabel || 'Unlabeled'}
                </FsText>
              )}
              <View style={styles.grid}>
                {items.map((t) => (
                  <Pressable key={t.id} style={styles.gridItem} onPress={() => startTemplate(t)}>
                    <Card style={{ flex: 1, minHeight: 124, justifyContent: 'space-between' }}>
                      <FsText variant="cardTitle" numberOfLines={2}>{t.name}</FsText>
                      <View>
                        <FsText variant="caption">{t.exercises.length} exercises</FsText>
                        {t.lastPerformedAt && (
                          <FsText variant="caption">Last {formatDistanceToNow(new Date(t.lastPerformedAt))} ago</FsText>
                        )}
                      </View>
                      <View style={styles.tplActions}>
                        <Pressable onPress={() => editTemplate(t)} hitSlop={8} style={styles.tplActionBtn}>
                          <Pencil color={colors.muted} size={15} />
                        </Pressable>
                        <Pressable onPress={() => confirmDeleteTemplate(t)} hitSlop={8} style={styles.tplActionBtn}>
                          <Trash2 color={colors.danger} size={15} />
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      <Pressable onPress={() => router.push('/exercises')}>
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <FsText variant="cardTitle">Exercise Library</FsText>
              <FsText variant="caption">{exerciseCount} exercises with demos</FsText>
            </View>
            <ChevronRight color={colors.muted} size={20} />
          </View>
        </Card>
      </Pressable>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[2],
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceHigh,
  },
  orderChip: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: tintBg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tintBg.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: space[3],
  },
  routineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  routineAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[3] },
  gridItem: { width: '47.5%', flexGrow: 1 },
  tplSearch: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, marginBottom: space[3],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border,
  },
  filterChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tplActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[3], marginTop: space[2], paddingTop: space[2], borderTopWidth: 1, borderTopColor: colors.border },
  tplActionBtn: { padding: 2 },
}));
