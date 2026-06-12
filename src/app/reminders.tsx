import { View, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Plus } from 'lucide-react-native';

import { FsText, Card, Chip } from '@/components/ui';
import { TimeField, formatTime } from '@/components/TimeField';
import { StepperField } from '@/components/StepperField';
import {
  useRemindersStore, REMINDER_KEYS, REMINDER_META, EVERY_DAY, todayISO,
  type IntervalReminder, type IntervalUnit, type FoodReminder, type ReminderKey,
  type ReminderPatch, type ScheduleReminder,
} from '@/stores/remindersStore';
import { ensurePermission, syncScheduledNotifications } from '@/lib/reminders';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const UNITS: { key: IntervalUnit; label: string }[] = [
  { key: 'days', label: 'Days' },
  { key: 'weeks', label: 'Weeks' },
  { key: 'months', label: 'Months' },
  { key: 'years', label: 'Years' },
];

export default function RemindersScreen() {
  const router = useRouter();
  const reminders = useRemindersStore((s) => s.reminders);
  const setReminder = useRemindersStore((s) => s.setReminder);
  const setPermissionGranted = useRemindersStore((s) => s.setPermissionGranted);

  // Persist the patch, then re-sync the OS schedule from the freshest store state.
  const update = (key: ReminderKey, patch: ReminderPatch) => {
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
    const patch: ReminderPatch = { enabled: on };
    // Start an interval reminder's cadence from today when first turned on.
    if (on && reminders[key].mode === 'interval' && !(reminders[key] as IntervalReminder).anchorDate) {
      patch.anchorDate = todayISO();
    }
    update(key, patch);
  };

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.header}>
        <FsText variant="h2">Reminders</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }}>
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Turn on only the reminders you want — each is off until you flip its switch. You'll get a
          notification plus a Dashboard banner; every type has its own schedule below.
        </FsText>

        {REMINDER_KEYS.map((key) => {
          const cfg = reminders[key];
          const meta = REMINDER_META[key];
          return (
            <Card key={key} style={{ marginBottom: space[3] }}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <FsText variant="cardTitle">{meta.title}</FsText>
                  {cfg.enabled && (
                    <FsText variant="caption" style={{ color: colors.muted, marginTop: 2 }}>{summarize(cfg)}</FsText>
                  )}
                </View>
                <Switch
                  value={cfg.enabled}
                  onValueChange={(v) => toggle(key, v)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>

              {cfg.enabled && (
                <View style={{ marginTop: space[3], gap: space[3] }}>
                  {cfg.mode === 'interval' && <IntervalEditor cfg={cfg} onChange={(p) => update(key, p)} />}
                  {cfg.mode === 'schedule' && <ScheduleEditor cfg={cfg} onChange={(p) => update(key, p)} />}
                  {cfg.mode === 'food' && <FoodEditor cfg={cfg} onChange={(p) => update(key, p)} />}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Measurements: every N days/weeks/months/years at a time of day. */
function IntervalEditor({ cfg, onChange }: { cfg: IntervalReminder; onChange: (p: ReminderPatch) => void }) {
  return (
    <>
      <View>
        <FsText variant="caption" style={{ marginBottom: 6 }}>Repeat every</FsText>
        <View style={styles.intervalRow}>
          <StepperField
            value={cfg.every}
            min={1}
            max={999}
            onCommit={(n) => onChange({ every: n, anchorDate: todayISO() })}
          />
          <View style={[styles.chipRow, { flex: 1 }]}>
            {UNITS.map((u) => (
              <Chip key={u.key} label={u.label} selected={cfg.unit === u.key} onPress={() => onChange({ unit: u.key, anchorDate: todayISO() })} />
            ))}
          </View>
        </View>
      </View>
      <View>
        <FsText variant="caption" style={{ marginBottom: 6 }}>Time</FsText>
        <TimeField hour={cfg.hour} minute={cfg.minute} onChange={(hour, minute) => onChange({ hour, minute })} />
      </View>
    </>
  );
}

/** Weight + workout: weekdays (with an "Every day" shortcut) at a time of day. */
function ScheduleEditor({ cfg, onChange }: { cfg: ScheduleReminder; onChange: (p: ReminderPatch) => void }) {
  const everyDay = cfg.weekdays.length >= 7;
  const toggleWeekday = (day: number) => {
    const has = cfg.weekdays.includes(day);
    const weekdays = has ? cfg.weekdays.filter((d) => d !== day) : [...cfg.weekdays, day].sort((a, b) => a - b);
    onChange({ weekdays: weekdays.length ? weekdays : cfg.weekdays }); // never empty
  };
  return (
    <>
      <View>
        <View style={styles.labelRow}>
          <FsText variant="caption">Days</FsText>
          <Chip label="Every day" selected={everyDay} onPress={() => onChange({ weekdays: [...EVERY_DAY] })} />
        </View>
        <View style={styles.chipRow}>
          {WEEKDAYS.map((label, day) => (
            <Chip key={day} label={label} selected={cfg.weekdays.includes(day)} onPress={() => toggleWeekday(day)} />
          ))}
        </View>
      </View>
      <View>
        <FsText variant="caption" style={{ marginBottom: 6 }}>Time</FsText>
        <TimeField hour={cfg.hour} minute={cfg.minute} onChange={(hour, minute) => onChange({ hour, minute })} />
      </View>
    </>
  );
}

/** Food: one or more daily times; only nudges if nothing's been logged that day. */
function FoodEditor({ cfg, onChange }: { cfg: FoodReminder; onChange: (p: ReminderPatch) => void }) {
  const setTime = (idx: number, hour: number, minute: number) =>
    onChange({ times: cfg.times.map((t, i) => (i === idx ? { hour, minute } : t)) });
  const removeTime = (idx: number) =>
    onChange({ times: cfg.times.filter((_, i) => i !== idx) });
  const addTime = () => onChange({ times: [...cfg.times, { hour: 12, minute: 0 }] });

  return (
    <>
      <View>
        <FsText variant="caption" style={{ marginBottom: 6 }}>Alert me at</FsText>
        <View style={{ gap: space[2] }}>
          {cfg.times.map((t, idx) => (
            <View key={idx} style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <TimeField hour={t.hour} minute={t.minute} onChange={(hour, minute) => setTime(idx, hour, minute)} />
              </View>
              {cfg.times.length > 1 && (
                <Pressable onPress={() => removeTime(idx)} hitSlop={8} style={styles.removeBtn}>
                  <X color={colors.muted} size={18} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <Pressable onPress={addTime} style={styles.addRow} hitSlop={6}>
          <Plus color={colors.primary} size={16} />
          <FsText variant="caption" style={{ color: colors.primary }}>Add another time</FsText>
        </Pressable>
      </View>
      <FsText variant="caption" style={{ color: colors.muted }}>
        Only nudges if you haven't logged any food yet that day.
      </FsText>
    </>
  );
}

/** One-line summary shown under an enabled reminder's title. */
function summarize(cfg: IntervalReminder | ScheduleReminder | FoodReminder): string {
  if (cfg.mode === 'interval') {
    const unit = cfg.every === 1 ? cfg.unit.replace(/s$/, '') : cfg.unit;
    return `Every ${cfg.every} ${unit} · ${formatTime(cfg.hour, cfg.minute)}`;
  }
  if (cfg.mode === 'schedule') {
    const days = cfg.weekdays.length >= 7
      ? 'Every day'
      : [...cfg.weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(' ');
    return `${days} · ${formatTime(cfg.hour, cfg.minute)}`;
  }
  return cfg.times.map((t) => formatTime(t.hour, t.minute)).join(', ');
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  removeBtn: {
    width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space[2], paddingVertical: 4 },
}));
