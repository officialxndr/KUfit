import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Timer, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, X } from 'lucide-react-native';

import { Card, FsText, Badge } from '@/components/ui';
import { MonthCalendar } from '@/components/MonthCalendar';
import { WorkoutSummarySheet } from '@/components/WorkoutSummarySheet';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatVolume } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { WorkoutSession } from '@/types';

const isoDay = (s: string) => new Date(s).toISOString().slice(0, 10);
const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function durationLabel(s: WorkoutSession): string | null {
  if (!s.finishedAt) return null;
  const mins = Math.round((new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
  return mins > 0 ? `${mins} min` : null;
}

export function WorkoutHistory() {
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [detail, setDetail] = useState<WorkoutSession | null>(null);

  const refresh = useCallback(() => setSessions(workoutRepo.getSessions(300)), []);
  useFocusEffect(refresh);

  const marked = useMemo(() => new Set(sessions.map((s) => isoDay(s.startedAt))), [sessions]);

  const changeMonth = (delta: number) => {
    setSelectedDate(null);
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const remove = (s: WorkoutSession) =>
    Alert.alert('Delete workout?', `Remove "${s.name}" from ${new Date(s.startedAt).toLocaleDateString()}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { workoutRepo.deleteSession(s.id); refresh(); } },
    ]);

  const monthSessions = sessions.filter((s) => ymKey(new Date(s.startedAt)) === ymKey(viewMonth));
  const visible = selectedDate ? monthSessions.filter((s) => isoDay(s.startedAt) === selectedDate) : monthSessions;

  const renderCard = (s: WorkoutSession) => {
    const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
    const prs = s.exercises.reduce((n, e) => n + e.sets.filter((st) => st.isPersonalBest).length, 0);
    const duration = durationLabel(s);
    return (
      <Swipeable
        key={s.id}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable style={styles.deleteAction} onPress={() => remove(s)}>
            <Trash2 color={colors.white} size={18} />
            <FsText variant="caption" style={{ color: colors.white }}>Delete</FsText>
          </Pressable>
        )}
      >
        <Pressable onPress={() => setDetail(s)}>
          <Card style={{ marginBottom: space[3] }}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <FsText variant="cardTitle">{s.name}</FsText>
                  {prs > 0 && <Badge label={`${prs} PR${prs > 1 ? 's' : ''}`} tone="warning" />}
                </View>
                <FsText variant="caption" style={{ marginTop: 2 }}>
                  {new Date(s.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </FsText>
              </View>
              {duration && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Timer color={colors.muted} size={13} />
                  <FsText variant="caption">{duration}</FsText>
                </View>
              )}
            </View>
            <View style={styles.statRow}>
              <Stat label="Sets" value={String(sets)} />
              <Stat label="Volume" value={formatVolume(s.totalVolume ?? 0, unit)} />
              <Stat label="Exercises" value={String(s.exercises.length)} />
            </View>
          </Card>
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <>
      {/* Month navigator (outer ‹‹ ›› jump a year) */}
      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth(-12)} hitSlop={6} style={styles.navArrow}>
          <ChevronsLeft color={colors.muted} size={20} />
        </Pressable>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={6} style={styles.navArrow}>
          <ChevronLeft color={colors.text} size={22} />
        </Pressable>
        <Pressable style={styles.monthLabel} onPress={() => setCalOpen(true)}>
          <FsText variant="cardTitle">{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</FsText>
          <ChevronDown color={colors.muted} size={16} />
        </Pressable>
        <Pressable onPress={() => changeMonth(1)} hitSlop={6} style={styles.navArrow}>
          <ChevronRight color={colors.text} size={22} />
        </Pressable>
        <Pressable onPress={() => changeMonth(12)} hitSlop={6} style={styles.navArrow}>
          <ChevronsRight color={colors.muted} size={20} />
        </Pressable>
      </View>

      <FsText variant="caption" style={{ marginBottom: space[3] }}>
        {monthSessions.length} session{monthSessions.length !== 1 ? 's' : ''} this month
      </FsText>

      {selectedDate && (
        <Pressable style={styles.filterBanner} onPress={() => setSelectedDate(null)}>
          <FsText variant="bodyMedium" style={{ flex: 1 }}>
            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </FsText>
          <X color={colors.muted} size={16} />
        </Pressable>
      )}

      {visible.length === 0 ? (
        <Card><FsText variant="caption">{selectedDate ? 'No workouts on this day.' : 'No workouts this month.'}</FsText></Card>
      ) : (
        visible.map(renderCard)
      )}

      <Modal visible={calOpen} transparent animationType="fade" onRequestClose={() => setCalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCalOpen(false)}>
          <Pressable style={styles.calCard} onPress={(e) => e.stopPropagation()}>
            <MonthCalendar
              month={viewMonth}
              marked={marked}
              selected={selectedDate}
              onSelectDay={(d) => { setSelectedDate(d); setViewMonth(firstOfMonth(new Date(d))); setCalOpen(false); }}
              onMonthChange={changeMonth}
            />
            <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[3] }}>
              Tap a highlighted day to filter, or use the arrows to change month.
            </FsText>
          </Pressable>
        </Pressable>
      </Modal>

      <WorkoutSummarySheet session={detail} unit={unit} onClose={() => setDetail(null)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <FsText variant="overline">{label}</FsText>
      <FsText variant="bodyMedium" style={{ marginTop: 2 }}>{value}</FsText>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[1] },
  navArrow: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterBanner: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: space[3], paddingVertical: space[3], marginBottom: space[3],
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
  stat: {
    flex: 1, backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    paddingVertical: space[2], paddingHorizontal: space[3], gap: 2,
  },
  deleteAction: {
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: space[3], borderRadius: radius.lg, gap: 3,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[4] },
  calCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
}));
