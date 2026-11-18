import { Linking } from 'react-native';

import { feedbackRepo, type FeedbackType } from '@/lib/repositories/FeedbackRepo';
import { FEEDBACK_EMAIL, gatherDiagnostics, type Diagnostics } from '@/lib/diagnostics';

// Re-exported so existing imports from '@/lib/feedback' keep working.
export { FEEDBACK_EMAIL, gatherDiagnostics, type Diagnostics };

/**
 * Bump this whenever there's something new for testers to see. The What's-New sheet
 * shows once per version (tracked in `app_meta`). Keep the list short + tester-focused.
 */
export const WHATS_NEW_VERSION = '1.0.0-b18';
export const WHATS_NEW = {
  title: "What's new to test",
  items: [
    'Log by the piece: foods with a serving like "3 cookies" or "1 bar" now offer that as a unit — log 1 cookie instead of 0.33 servings. Cereal-style "2/3 cup (55 g)" labels let you log in cups.',
    'Amounts accept 1,5 · 1/2 · 1 1/2 · ½. Edited entries reopen in the unit you used (150 g, not 1.5 servings), and the Today list shows what you entered.',
    'Custom foods understand units like "Grams" or "Tbsp", and the label scanner reads "2/3 cup" correctly.',
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
