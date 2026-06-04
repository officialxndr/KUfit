import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button, Chip } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const COMMON_EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band'];

export default function NewExercise() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [description, setDescription] = useState('');

  const muscleSuggestions = useMemo(() => workoutRepo.getDistinctMuscleGroups().slice(0, 10), []);

  const save = () => {
    if (!name.trim()) return Alert.alert('Name required', 'Give the exercise a name.');
    workoutRepo.createCustomExercise({
      name: name.trim(),
      muscleGroup: muscle.trim() || null,
      equipment: equipment.trim() || null,
      description: description.trim() || null,
    });
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: space[3] }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">New Exercise</FsText>
        <Pressable onPress={save} hitSlop={10}>
          <FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Field label="Name">
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Incline DB Press" placeholderTextColor={colors.muted} style={styles.input} />
        </Field>

        <Field label="Muscle group">
          <TextInput value={muscle} onChangeText={setMuscle} placeholder="e.g. Chest" placeholderTextColor={colors.muted} style={styles.input} />
          {muscleSuggestions.length > 0 && (
            <View style={styles.chipWrap}>
              {muscleSuggestions.map((m) => (
                <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(m)} />
              ))}
            </View>
          )}
        </Field>

        <Field label="Equipment">
          <TextInput value={equipment} onChangeText={setEquipment} placeholder="e.g. Dumbbell" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.chipWrap}>
            {COMMON_EQUIPMENT.map((e) => (
              <Chip key={e} label={e} selected={equipment === e} onPress={() => setEquipment(e)} />
            ))}
          </View>
        </Field>

        <Field label="Notes / how-to (optional)">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Cues, setup, range of motion…"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          />
        </Field>

        <Button title="Save Exercise" onPress={save} style={{ marginTop: space[4] }} />
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space[4] }}>
      <FsText variant="caption" style={{ marginBottom: 6 }}>{label}</FsText>
      {children}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingBottom: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
}));
