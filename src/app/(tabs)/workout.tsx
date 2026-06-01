import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Play } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import { Screen, Card, FsText, Button, SectionHeader, Badge } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTemplateDraftStore } from '@/stores/templateDraftStore';
import { colors, space } from '@/theme/tokens';
import type { WorkoutSession, WorkoutTemplate } from '@/types';

export default function WorkoutScreen() {
  const router = useRouter();
  const session = useSessionStore();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exerciseCount, setExerciseCount] = useState(0);

  const refresh = useCallback(() => {
    setTemplates(workoutRepo.getTemplates());
    setSessions(workoutRepo.getSessions(10));
    setExerciseCount(workoutRepo.countExercises());
  }, []);

  useFocusEffect(refresh);

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
    router.push('/template/new');
  };

  return (
    <Screen>
      <FsText variant="h1" style={{ paddingTop: space[2], marginBottom: space[4] }}>Workout</FsText>

      {session.active && (
        <Pressable onPress={() => router.push('/session')}>
          <Card outlined style={{ marginBottom: space[3], borderColor: colors.primary }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <FsText variant="cardTitle">Workout in progress</FsText>
                <FsText variant="caption">{session.exercises.length} exercises · tap to continue</FsText>
              </View>
              <Play color={colors.primary} size={22} />
            </View>
          </Card>
        </Pressable>
      )}

      <Button title="Start Empty Workout" onPress={startEmpty} style={{ marginBottom: space[3] }} />

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Templates" action={
          <Pressable onPress={newTemplate} hitSlop={8}>
            <FsText variant="bodyMedium" style={{ color: colors.primary }}>New</FsText>
          </Pressable>
        } />
        {templates.length === 0 ? (
          <FsText variant="caption">No templates yet. Build one to start logging workouts.</FsText>
        ) : (
          templates.map((t) => (
            <Pressable key={t.id} style={{ paddingVertical: space[2] }} onPress={() => startTemplate(t)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <FsText variant="bodyMedium">{t.name}</FsText>
                  <FsText variant="caption">
                    {t.exercises.length} exercises
                    {t.lastPerformedAt ? ` · ${formatDistanceToNow(new Date(t.lastPerformedAt))} ago` : ''}
                  </FsText>
                </View>
                <Play color={colors.primary} size={18} />
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="History" />
        {sessions.length === 0 ? (
          <FsText variant="caption">No sessions logged yet.</FsText>
        ) : (
          sessions.map((s) => {
            const prs = s.exercises.reduce((n, e) => n + e.sets.filter((st) => st.isPersonalBest).length, 0);
            return (
              <View key={s.id} style={{ paddingVertical: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <FsText variant="bodyMedium" style={{ flex: 1 }}>{s.name}</FsText>
                  {prs > 0 && <Badge label={`${prs} PR${prs > 1 ? 's' : ''}`} tone="warning" />}
                </View>
                <FsText variant="caption">
                  {new Date(s.startedAt).toLocaleDateString()} · {Math.round(s.totalVolume ?? 0)} kg volume · {s.exercises.length} exercises
                </FsText>
              </View>
            );
          })
        )}
      </Card>

      <Pressable onPress={() => router.push('/exercises')}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <FsText variant="cardTitle">Exercise Library</FsText>
              <FsText variant="caption">{exerciseCount} exercises with demos</FsText>
            </View>
            <ChevronRight color={colors.muted} size={20} />
          </View>
        </Card>
      </Pressable>
    </Screen>
  );
}
