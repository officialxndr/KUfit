import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { GoalPhasesPanel } from '@/components/GoalPhasesPanel';
import { colors } from '@/theme/tokens';

/** Standalone route wrapper around the shared Goal Phases editor. */
export default function GoalPhasesScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <GoalPhasesPanel onBack={() => router.back()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
