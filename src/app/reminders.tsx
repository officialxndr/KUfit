import { View, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Card, Chip } from '@/components/ui';
import { TimeField } from '@/components/TimeField';
import {
  useRemindersStore, REMINDER_KEYS, REMINDER_META,
  type ReminderConfig, type ReminderFrequency, type ReminderKey,
} from '@/stores/remindersStore';
import { ensurePermission, syncScheduledNotifications } from '@/lib/reminders';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const FREQS: { key: ReminderFrequency; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'custom', label: 'Custom' },
];

export default function RemindersScreen() {
  const router = useRouter();
  const reminders = useRemindersStore((s) => s.reminders);
  const setReminder = useRemindersStore((s) => s.setReminder);
  const setPermissionGranted = useRemindersStore((s) => s.setPermissionGranted);

  // Persist the patch, then re-sync the OS schedule from the freshest store state.
  const update = (key: ReminderKey, patch: Partial<ReminderConfig>) => {
    setReminder(key, patch);
    syncScheduledNotifications(useRemindersStore.getState().reminders);
  };

  const toggle = async (key: ReminderKey, on: boolean) => {
    if (on) {
      const granted = await ensurePermission();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          'Notifications off',
          "We couldn't get notification permission, so you won't get a push for this. The reminder banner will still appear on your Dashboard. Enable notifications in system settings to get alerts.",
        );
      }
    }
    update(key, { enabled: on });
  };

  const setFrequency = (key: ReminderKey, freq: ReminderFrequency) => {
    const cfg = reminders[key];
    // Keep at least one weekday selected when switching to weekly/custom.
    const weekdays = cfg.weekdays.length ? cfg.weekdays : [new Date().getDay()];
    update(key, { frequency: freq, weekdays: freq === 'weekly' ? [weekdays[0]] : weekdays });
  };

  const toggleWeekday = (key: ReminderKey, day: number) => {
    const cfg = reminders[key];
    if (cfg.frequency === 'weekly') {
      update(key, { weekdays: [day] }); // single day
      return;
    }
    const has = cfg.weekdays.includes(day);
    const weekdays = has ? cfg.weekdays.filter((d) => d !== day) : [...cfg.weekdays, day];
    update(key, { weekdays: weekdays.length ? weekdays : cfg.weekdays }); // never empty
  };

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.header}>
        <FsText variant="h2">Reminders</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }}>
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Get a nudge — a notification and a Dashboard banner — to keep your logging on track. Each
          reminder is off until you turn it on.
        </FsText>

        {REMINDER_KEYS.map((key) => {
          const cfg = reminders[key];
          const meta = REMINDER_META[key];
          return (
            <Card key={key} style={{ marginBottom: space[3] }}>
              <View style={styles.titleRow}>
                <FsText variant="cardTitle">{meta.title}</FsText>
                <Switch
                  value={cfg.enabled}
                  onValueChange={(v) => toggle(key, v)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>

              {cfg.enabled && (
                <View style={{ marginTop: space[3], gap: space[3] }}>
                  <View>
                    <FsText variant="caption" style={{ marginBottom: 6 }}>Frequency</FsText>
                    <View style={styles.chipRow}>
                      {FREQS.map((f) => (
                        <Chip key={f.key} label={f.label} selected={cfg.frequency === f.key} onPress={() => setFrequency(key, f.key)} />
                      ))}
                    </View>
                  </View>

                  {cfg.frequency !== 'daily' && (
                    <View>
                      <FsText variant="caption" style={{ marginBottom: 6 }}>
                        {cfg.frequency === 'weekly' ? 'Day' : 'Days'}
                      </FsText>
                      <View style={styles.chipRow}>
                        {WEEKDAYS.map((label, day) => (
                          <Chip key={day} label={label} selected={cfg.weekdays.includes(day)} onPress={() => toggleWeekday(key, day)} />
                        ))}
                      </View>
                    </View>
                  )}

                  <View>
                    <FsText variant="caption" style={{ marginBottom: 6 }}>Time</FsText>
                    <TimeField hour={cfg.hour} minute={cfg.minute} onChange={(hour, minute) => update(key, { hour, minute })} />
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
}));
