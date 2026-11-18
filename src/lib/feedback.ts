import { Linking } from 'react-native';

import { feedbackRepo, type FeedbackType } from '@/lib/repositories/FeedbackRepo';
import { FEEDBACK_EMAIL, gatherDiagnostics, type Diagnostics } from '@/lib/diagnostics';

// Re-exported so existing imports from '@/lib/feedback' keep working.
export { FEEDBACK_EMAIL, gatherDiagnostics, type Diagnostics };

/**
 * Bump this whenever there's something new for testers to see. The What's-New sheet
 * shows once per version (tracked in `app_meta`). Keep the list short + tester-focused.
 */
export const WHATS_NEW_VERSION = '1.0.0-b17';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Edit a past workout: open any finished workout in history, tap Edit, and fix a mistyped set, add one, or delete one — your stats, PRs, and next-time prefills all recompute from the corrected numbers.',
    'Workout variations (A/B days): give one workout named versions (A, B, …) that share most exercises but swap a few. Tap an A/B pill to start that version, or tap the card to auto-alternate to whichever you did least recently.',
    'Coaching notes can now also be added while building or editing a template.',
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
