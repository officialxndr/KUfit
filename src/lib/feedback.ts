import { Linking } from 'react-native';

import { feedbackRepo, type FeedbackType } from '@/lib/repositories/FeedbackRepo';
import { FEEDBACK_EMAIL, gatherDiagnostics, type Diagnostics } from '@/lib/diagnostics';

// Re-exported so existing imports from '@/lib/feedback' keep working.
export { FEEDBACK_EMAIL, gatherDiagnostics, type Diagnostics };

/**
 * Bump this whenever there's something new for testers to see. The What's-New sheet
 * shows once per version (tracked in `app_meta`). Keep the list short + tester-focused.
 */
export const WHATS_NEW_VERSION = '1.0.0-b19';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Progress photos, rebuilt: take front, side and back photos with a guided camera — a faint "ghost" of your last photo helps you line up, and a 3/5/10s self-timer handles mirror shots. Find it in Health → Body, the Weight tab, or the + button.',
    'New Photos gallery with first-vs-latest, side-by-side / slider compare, and a timelapse you can scrub through. Optional Face ID lock in Settings → Progress photos, plus a weekly photo reminder.',
    'Polish: your accent color now shows everywhere, modal headers match, form fields stay above the keyboard, and the workout calendar no longer jumps a month.',
  ],
};

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
