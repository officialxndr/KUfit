import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { feedbackRepo, type FeedbackType } from '@/lib/repositories/FeedbackRepo';

/** Where bug reports / feature requests are emailed (no server — the user sends from their mail app). */
export const FEEDBACK_EMAIL = 'haledevteam@protonmail.com';

/**
 * Bump this whenever there's something new for testers to see. The What's-New sheet
 * shows once per version (tracked in `app_meta`). Keep the list short + tester-focused.
 */
export const WHATS_NEW_VERSION = '1.0.0-b6';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Exercise library expanded to 1,500+ moves with demo GIFs — browse and search the whole catalog (it no longer cuts off partway).',
    'Cable attachments: pick Rope / Bar / V-Bar etc. on a cable exercise — each attachment tracks its own weights, PRs, and history.',
    'Per-arm (L/R) sets: log each arm separately with a lead side; volume sums both arms. Set it (and Load counting) from the little selectors under the exercise name.',
    'Faster logging: a "Use previous" button on the keypad reuses the last set\'s weight/reps, plus a bigger rest timer with a countdown bar.',
    'Your own exercises: create them, find them in a "My exercises" group, and delete the ones you made (catalog ones are protected).',
    'Pre-set templates: ready-made starter workouts (Full Body, Push/Pull/Legs, Upper/Lower, Dumbbell-only, Bodyweight) — tap one to drop an editable copy into your templates. Find it above the Exercise Library.',
    'iOS widgets (x4): pick Food (calorie ring + macros + weight/body-fat), Workout (next workout + this-week sets/volume), Health (weight, body-fat/lean/fat, trend), or a combined Overview that shows all three (Medium or Large). Home screen + lock screen, matching your in-app theme/accent. Long-press the home screen → + → search "Hale".',
    'Workout Live Activity: start a workout and you\'ll get a Lock Screen + Dynamic Island live view — current exercise, sets done, a running timer, and volume — so you can glance at your phone between sets without unlocking. (iPhone, real device; turn on Live Activities in iOS Settings if you don\'t see it.)',
    'New searchable Feature guide in Settings → Help, and credits for our data sources (ExerciseDB, Open Food Facts).',
  ],
};

export interface Diagnostics {
  app: string;
  version: string | undefined;
  variant: string;
  platform: string;
  osVersion: string | number;
  device: string | null;
}

export function gatherDiagnostics(): Diagnostics {
  return {
    app: 'Hale',
    version: Constants.expoConfig?.version,
    variant: ((Constants.expoConfig?.extra as Record<string, unknown>)?.appVariant as string) ?? 'unknown',
    platform: Platform.OS,
    osVersion: Platform.Version,
    device: Device.modelName ?? null,
  };
}

function diagnosticsText(d: Diagnostics): string {
  return [
    `App: ${d.app} ${d.version ?? '?'} (${d.variant})`,
    `Device: ${d.device ?? 'unknown'} — ${d.platform} ${d.osVersion}`,
  ].join('\n');
}

/**
 * Save the report locally, then open the user's mail app with everything pre-filled.
 * Nothing is sent automatically — the user reviews and taps send (fits the no-server,
 * private design). Returns false if no mail app could be opened.
 */
export async function submitFeedback(input: {
  type: FeedbackType;
  title: string;
  body: string;
  steps?: string;
}): Promise<boolean> {
  const diag = gatherDiagnostics();
  const id = feedbackRepo.create({
    type: input.type,
    title: input.title,
    body: input.body || null,
    steps: input.steps || null,
    diagnostics: JSON.stringify(diag),
  });

  const label = input.type === 'bug' ? 'Bug' : 'Feature';
  const subject = `[Hale ${label}] ${input.title.trim()}`;
  const body = [
    input.body || '',
    input.type === 'bug' && input.steps ? `\nSteps to reproduce:\n${input.steps}` : '',
    `\n\n— — —\n${diagnosticsText(diag)}`,
  ].join('\n');
  const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  try {
    await Linking.openURL(url);
    feedbackRepo.markSent(id);
    return true;
  } catch {
    return false;
  }
}
