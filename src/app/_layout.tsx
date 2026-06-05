import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, AppState } from 'react-native';

import { initDb } from '@/lib/db';
import { seedExercisesIfEmpty } from '@/lib/exerciseSeed';
import { seedBaseFoodsIfNeeded } from '@/lib/baseFoodsSeed';
import { recoverTourPreview } from '@/lib/tourPreview';
import { syncWidget } from '@/lib/widget';
import { endLiveActivity } from '@/lib/liveActivity';
import { initWatchBridge, syncWatch } from '@/lib/watch';
import { configureNotifications, syncScheduledNotifications } from '@/lib/reminders';
import { useRemindersStore } from '@/stores/remindersStore';
import { useThemeStore } from '@/stores/themeStore';
import { colors, SURFACE_PRESETS } from '@/theme/tokens';

configureNotifications();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // Status-bar content must contrast the theme: light icons on dark themes,
  // dark icons on the light theme (otherwise the clock/icons vanish in light mode).
  const preset = useThemeStore((s) => s.preset);
  const isDarkTheme = SURFACE_PRESETS[preset]?.dark ?? true;

  useEffect(() => {
    try {
      initDb();
      seedExercisesIfEmpty();
      seedBaseFoodsIfNeeded();
      // Undo any tour preview data a force-quit mid-tour may have left behind.
      recoverTourPreview();
    } catch (e) {
      console.error('startup init failed', e);
    }
    // Re-assert the local notification schedule from the persisted reminder settings.
    const sync = () => syncScheduledNotifications(useRemindersStore.getState().reminders);
    if (useRemindersStore.getState().hydrated) sync();
    else { const unsub = useRemindersStore.subscribe((s) => { if (s.hydrated) { unsub(); sync(); } }); }
    setReady(true);
  }, []);

  // Keep the iOS home/lock-screen widget fresh: push a snapshot now and whenever the
  // app leaves the foreground (when the user might actually look at the widget) or returns
  // (in case the day rolled over). No-op off iOS / in Expo Go.
  useEffect(() => {
    syncWidget();
    // The active workout lives only in memory, so on a fresh launch there's never one in
    // progress — clear any Live Activity left ticking by a force-quit mid-workout.
    endLiveActivity();
    // Wire the Apple Watch bridge (watch → phone commands) and push the current state so a
    // freshly opened watch app is populated (active workout, or the start menu when idle).
    initWatchBridge();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'active') { syncWidget(); syncWatch(); }
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercises" options={{ presentation: 'modal' }} />
          <Stack.Screen name="preset-templates" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercise/[id]" />
          <Stack.Screen name="exercise/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="workout-summary" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="template/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipe/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goal-phases" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercise-reports" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercise-progress" options={{ presentation: 'modal' }} />
          <Stack.Screen name="measurements" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-weight" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-dexa" options={{ presentation: 'modal' }} />
          <Stack.Screen name="custom-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reminders" options={{ presentation: 'modal' }} />
          <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
          <Stack.Screen name="guide" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
