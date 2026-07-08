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
export const WHATS_NEW_VERSION = '1.0.0-b11';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Body-fat sources cleaned up: on Health → Body the DEXA/Estimate ↔ U.S. Navy toggle now actually moves your body-fat-% goal weight (it used to be ignored). New Settings → Body option "Estimate body fat from DEXA only" anchors the estimate strictly to your latest DEXA, ignoring any other logged % — handy if you don\'t trust a body scale. You can now tap any weigh-in under Health → Weight to edit or clear its body-fat reading (or delete it).',
    'Optional Apple Health body-fat import (Settings → Health, off by default): pull body-fat % from Health alongside weight. It never overwrites a DEXA or hand-logged reading.',
    'Apple Health weigh-ins sync automatically once connected — no reopening Settings to reconnect; updates on return and live while open.',
    'Estimate a meal with AI: snap or pick a photo of a plate and the AI estimates its calories + macros — review and edit before logging.',
    'Bring your own AI: Settings → AI vision lets you add API / cloud endpoints (Ollama, LM Studio, OpenWebUI, OpenAI, OpenRouter, Gemini) for label scanning + meal estimates.',
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
