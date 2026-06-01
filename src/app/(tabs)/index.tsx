import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AppShell } from '@/navigation/AppShell';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Main() {
  const router = useRouter();
  const hydrated = useSettingsStore((s) => s.hydrated);
  const onboarded = useSettingsStore((s) => s.onboarded);

  // First-run: send the user through onboarding once the profile has hydrated.
  useEffect(() => {
    if (hydrated && !onboarded) router.replace('/onboarding');
  }, [hydrated, onboarded]);

  if (hydrated && !onboarded) return null; // avoid flashing the shell pre-redirect
  return <AppShell />;
}
