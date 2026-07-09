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
export const WHATS_NEW_VERSION = '1.0.0-b12';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Drag food between meals: press and hold a logged item, then drag it onto another meal (breakfast → lunch). Tap still edits, swipe still deletes.',
    'Copy specific items: "Copy from another day" now lets you pick exactly which items to bring over (all pre-checked — uncheck what you don\'t want), instead of only the whole day/meal.',
    'Goal date vs. projection: the goal date around the app now shows YOUR set target date, and you can tap it (on Health → Weight) to flip between your target and the "at current pace" projection.',
    'Date fix: weigh-in dates on the weight trend no longer show a day early, and evening entries are filed under the correct local day.',
    'Earlier betas: Apple Health weight auto-import + optional body-fat import, DEXA-only body-fat estimate, and tap-to-edit weigh-ins.',
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
