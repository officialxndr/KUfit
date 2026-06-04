/**
 * Cable attachments (rope, bars, handles) a user can swap on a movement.
 *
 * In the workout model an attachment is chosen at log time and tracked as its own
 * progress line — i.e. the history/PR identity is (exercise + attachment), not the
 * exercise alone. So "Cable Triceps Pushdown" is a single library row, and Rope vs
 * Straight Bar each keep their own weights, PRs, and chart. This module is the pure
 * source of truth for which exercises offer a picker and what the options are; the
 * repo and UI key off it.
 */

/** Ordered list of selectable cable attachments. First = most common default. */
export const CABLE_ATTACHMENTS = [
  'Rope',
  'Straight Bar',
  'V-Bar',
  'EZ Bar',
  'Lat Bar',
  'Single Handle',
  'Dual Handle',
  'D-Handle',
  'Stirrup Handle',
  'Ankle Strap',
] as const;

export type Attachment = (typeof CABLE_ATTACHMENTS)[number] | (string & {});

/**
 * Whether an exercise offers an attachment picker. Cable-only for now (the source's
 * "Rope" equipment is a battle/climbing rope, not a cable handle, so it's excluded).
 * The signature takes equipment so callers needn't pass a whole Exercise.
 */
export function supportsAttachment(equipment?: string | null): boolean {
  return (equipment ?? '').toLowerCase() === 'cable';
}

/** Attachment options to offer for an exercise (empty when unsupported). */
export function attachmentOptions(equipment?: string | null): readonly string[] {
  return supportsAttachment(equipment) ? CABLE_ATTACHMENTS : [];
}

/** Normalize a stored/picked attachment to a trimmed value, or null when blank/unsupported. */
export function normalizeAttachment(
  equipment: string | null | undefined,
  attachment: string | null | undefined
): string | null {
  if (!supportsAttachment(equipment)) return null;
  const a = (attachment ?? '').trim();
  return a.length ? a : null;
}
