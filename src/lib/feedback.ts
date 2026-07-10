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
export const WHATS_NEW_VERSION = '1.0.0-b13';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Profile photo sticks: it no longer disappears after an app update.',
    'Per-day calorie budget: burned calories are now counted for the day they happened (incl. Apple Health), instead of today\'s burn showing on every day.',
    'Pick your next routine workout: tap the "Next:" chip on a routine to choose which one comes next.',
    'Overview → Stats: the consistency card is now a GitHub-style grid — each day greys→greens as you log weight, food, and a workout. A weight loss now shows a minus sign.',
    'Training Volume chart now has numbers (a scale + date range), and food-search foods with grams no longer show wild calorie totals (a bad OpenFoodFacts serving-size bug). Measurement goal input no longer hides behind the keyboard.',
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
