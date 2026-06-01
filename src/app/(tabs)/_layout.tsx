import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

/**
 * The main app area is a single custom shell screen (see AppShell), not a tab
 * navigator — the two-level nav (section switcher + contextual bottom bar) is
 * rendered inside that screen instead.
 */
export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
