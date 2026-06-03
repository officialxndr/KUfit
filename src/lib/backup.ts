import * as FileSystem from 'expo-file-system/legacy';

import { db } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRoutineStore } from '@/stores/routineStore';
import { useRemindersStore, REMINDER_KEYS } from '@/stores/remindersStore';
import { useThemeStore } from '@/stores/themeStore';
import { syncScheduledNotifications } from '@/lib/reminders';

/**
 * User-owned data backup / restore / wipe. Local-first means there's no server,
 * so this is how a user keeps their own backup. `exportData` dumps every data
 * table + the persisted stores to JSON; `importData` restores it (Replace = exact
 * clone, Merge = add records by `localId`); `wipeAllData` clears the user's data
 * but keeps the seeded catalog so the app still works. Touches `db` directly for
 * the bulk dump (same precedent as `lib/demoSeed.ts`).
 */

const SCHEMA = 1;

// Parent-first order so restore inserts referenced rows before their children.
const TABLES = [
  'food_items', 'exercises', 'recipes', 'recipe_ingredients',
  'workout_templates', 'template_exercises', 'workout_sessions', 'session_exercises', 'exercise_sets',
  'weight_entries', 'body_measurements', 'food_logs', 'goal_phases',
] as const;

interface Backup {
  app: string;
  schema: number;
  exportedAt: string;
  db: Record<string, Record<string, unknown>[]>;
  stores: {
    settings?: { profile: unknown; onboarded: boolean };
    routines?: { routines: unknown[]; defaultRoutineId: string | null };
    reminders?: { reminders: unknown };
    theme?: { preset: string; accent: string };
  };
}

function tableColumns(table: string): Set<string> {
  return new Set((db.getAllSync(`PRAGMA table_info(${table})`) as { name: string }[]).map((r) => r.name));
}

/** Serialize all data + persisted stores to a JSON string. */
export function exportData(): string {
  const dump: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) dump[t] = db.getAllSync(`SELECT * FROM ${t}`) as Record<string, unknown>[];

  const settings = useSettingsStore.getState();
  const routines = useRoutineStore.getState();
  const reminders = useRemindersStore.getState();
  const theme = useThemeStore.getState();

  const backup: Backup = {
    app: 'FitSelf', schema: SCHEMA, exportedAt: new Date().toISOString(),
    db: dump,
    stores: {
      settings: { profile: settings.profile, onboarded: settings.onboarded },
      routines: { routines: routines.routines, defaultRoutineId: routines.defaultRoutineId },
      reminders: { reminders: reminders.reminders },
      theme: { preset: theme.preset, accent: theme.accent },
    },
  };
  return JSON.stringify(backup);
}

/** Write the export to a temp file and open the share sheet. `expo-sharing` is a
 *  native module, loaded lazily so a build without it degrades gracefully. */
export async function writeAndShareBackup(): Promise<void> {
  let Sharing: typeof import('expo-sharing');
  try { Sharing = await import('expo-sharing'); }
  catch { throw new Error('Sharing needs a dev build of the app — rebuild and try again.'); }

  const json = exportData();
  const uri = `${FileSystem.cacheDirectory}fitself-backup-${new Date().toISOString().slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export FitSelf data' });
  }
}

function insertRow(table: string, row: Record<string, unknown>, cols: Set<string>, orIgnore: boolean): void {
  const keys = Object.keys(row).filter((k) => cols.has(k));
  if (!keys.length) return;
  db.runSync(
    `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => (row[k] as string | number | null) ?? null)
  );
}

/** Restore a backup. `replace` = exact clone (wipes first, restores stores too);
 *  `merge` = add rows by localId, leaving the current profile/settings untouched. */
export function importData(json: unknown, mode: 'replace' | 'merge'): void {
  const b = json as Backup;
  if (!b || b.app !== 'FitSelf' || typeof b.db !== 'object') {
    throw new Error('Not a valid FitSelf backup file.');
  }

  db.withTransactionSync(() => {
    for (const t of TABLES) {
      const rows = b.db[t];
      if (!Array.isArray(rows)) continue;
      const cols = tableColumns(t);
      if (mode === 'replace') db.runSync(`DELETE FROM ${t}`);
      for (const row of rows) insertRow(t, row, cols, mode === 'merge');
    }
  });

  const s = b.stores;
  if (mode === 'replace' && s) {
    // Full restore of every persisted store.
    if (s.settings?.profile) useSettingsStore.getState().setProfile(s.settings.profile as never);
    if (s.settings?.onboarded) useSettingsStore.getState().completeOnboarding();
    if (s.routines) useRoutineStore.setState({ routines: (s.routines.routines as never) ?? [], defaultRoutineId: s.routines.defaultRoutineId ?? null });
    if (s.reminders?.reminders) {
      useRemindersStore.setState({ reminders: s.reminders.reminders as never });
      syncScheduledNotifications(useRemindersStore.getState().reminders);
    }
    if (s.theme) {
      useThemeStore.getState().setAccent(s.theme.accent);
      useThemeStore.getState().setPreset(s.theme.preset);
    }
  } else if (mode === 'merge' && Array.isArray(s?.routines?.routines)) {
    // Routines are user data (not a setting), so merge them too — append any whose
    // `id` isn't already present, keeping the current routines + default. Their
    // templates merged into the DB above, so the references hold up.
    const cur = useRoutineStore.getState().routines;
    const have = new Set(cur.map((r) => r.id));
    const add = (s!.routines!.routines as { id: string }[]).filter((r) => r && !have.has(r.id));
    if (add.length) useRoutineStore.setState({ routines: [...cur, ...(add as never)] });
  }
}

/** Read a picked backup file and restore it. */
export async function importFromUri(uri: string, mode: 'replace' | 'merge'): Promise<void> {
  const text = await FileSystem.readAsStringAsync(uri);
  importData(JSON.parse(text), mode);
}

/** Permanently delete the user's data. Keeps the seeded base foods + exercise
 *  catalog so the library still works; resets the profile back to onboarding. */
export function wipeAllData(): void {
  db.withTransactionSync(() => {
    for (const t of [
      'food_logs', 'recipe_ingredients', 'recipes', 'weight_entries', 'body_measurements',
      'exercise_sets', 'session_exercises', 'workout_sessions', 'template_exercises', 'workout_templates', 'goal_phases',
    ]) db.runSync(`DELETE FROM ${t}`);
    db.runSync(`DELETE FROM food_items WHERE barcode IS NULL OR barcode NOT LIKE 'base:%'`);
    db.runSync(`DELETE FROM exercises WHERE exerciseDbId IS NULL`);
  });

  useRoutineStore.setState({ routines: [], defaultRoutineId: null });
  for (const k of REMINDER_KEYS) useRemindersStore.getState().setReminder(k, { enabled: false, bannerDismissedFor: null });
  syncScheduledNotifications(useRemindersStore.getState().reminders);
  useSettingsStore.getState().resetProfile(); // onboarded → false; caller routes to /onboarding
}
