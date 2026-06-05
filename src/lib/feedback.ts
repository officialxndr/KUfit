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
export const WHATS_NEW_VERSION = '1.0.0-b7';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Apple Watch app: log a workout from your wrist — elapsed time, live heart-rate calories, and the current set entered with +/- and the Digital Crown. Full-screen rest timer, then finish → summary. Start from the watch (your routine + templates) or the phone. (Install the watch app and keep your phone nearby.)',
    'Watch auto-launch: starting a workout on your phone now opens the watch app right into it. Grant the one-time Apple Health "workout" permission the first time.',
    'Watch polish: the Digital Crown changes weight/reps with far less turning, and completing sets on the watch now advances correctly even when you tap around on the phone.',
    'Search exercises by machine: type a machine ("Smith machine", "cable", "sled") to find its exercises — plus a new equipment filter row in the picker (tap a machine type to narrow the list).',
    '65 new exercises: machines (hack/pendulum/belt squat, pec deck, seal & Meadows row, standing leg curl…), barbell/dumbbell staples (barbell hip thrust, RDL variants, face pull, JM/Z/landmine press, Bayesian curl…), and bodyweight/core (Nordic curl, dragon flag, hollow hold, ab-wheel rollout, toes-to-bar…).',
    'Exercise preview now scrolls: long-press an exercise in the picker and the popup scrolls through all the instructions (it used to be stuck). Exiting the picker with exercises selected also asks before discarding.',
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
