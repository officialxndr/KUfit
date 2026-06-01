import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Trash2, Plus } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { useTemplateDraftStore } from '@/stores/templateDraftStore';
import { colors, radius, space } from '@/theme/tokens';

export default function NewTemplate() {
  const router = useRouter();
  const { name, exercises, setName, removeExercise, patch, save } = useTemplateDraftStore();

  const onSave = () => {
    const id = save();
    if (!id) {
      Alert.alert('Incomplete', 'Add a name and at least one exercise.');
      return;
    }
    router.replace('/(tabs)/workout');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
        <FsText variant="cardTitle">New Template</FsText>
        <Pressable onPress={onSave} hitSlop={10}>
          <FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        <View style={styles.field}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Template name (e.g. Push Day)"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        {exercises.map((d) => (
          <Card key={d.exercise.id} style={{ marginBottom: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space[2] }}>
              <FsText variant="cardTitle" style={{ flex: 1 }} numberOfLines={1}>{d.exercise.name}</FsText>
              <Pressable onPress={() => removeExercise(d.exercise.id)} hitSlop={8}>
                <Trash2 color={colors.muted} size={18} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <NumField label="Sets" value={d.defaultSets} onChange={(n) => patch(d.exercise.id, { defaultSets: n })} />
              <NumField label="Reps" value={d.defaultReps} onChange={(n) => patch(d.exercise.id, { defaultReps: n })} />
              <NumField label="Rest (s)" value={d.restSeconds} onChange={(n) => patch(d.exercise.id, { restSeconds: n })} />
            </View>
          </Card>
        ))}

        <Button title="Add Exercise" variant="ghost" onPress={() => router.push('/exercises?pick=template')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <FsText variant="caption" style={{ marginBottom: 4 }}>{label}</FsText>
      <TextInput
        defaultValue={String(value)}
        onChangeText={(t) => onChange(Number(t) || 0)}
        keyboardType="number-pad"
        style={[styles.input, { textAlign: 'center' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  field: { marginBottom: space[3] },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
  },
});
