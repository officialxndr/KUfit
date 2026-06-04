/**
 * De-bake cable attachments out of exercise names.
 *
 * Many source names bake the attachment in ("Cable Pushdown (with Rope Attachment)",
 * "Cable Rope Hammer Curl", "Cable Lateral Pulldown with V-Bar"). Now that the app has an
 * attachment picker, that's redundant. `debake()` strips the attachment from the name — but
 * only when the cleaned name stays unique, so two distinct movements (e.g. a Rope vs a V-Bar
 * pulldown that both collapse to "Cable Lateral Pulldown") keep their disambiguating names.
 * The `attachment` field is left in place as metadata regardless.
 */

const ATT_WORD =
  '(rope|v-?bar|straight\\s*bar|ez\\s*bar|pro\\s*lat\\s*bar|lat\\s*pulldown\\s*bar|lat\\s*bar|d-?handle|stirrup\\s*handle|stirrup|single\\s*handle|dual\\s*handle|double\\s*handle|ankle\\s*strap)';
const ATT_RE = new RegExp(ATT_WORD, 'i');

export function stripAttachmentFromName(name) {
  let n = name;
  // 1) parenthetical groups that are (or contain) an attachment, or the word "attachment"
  n = n.replace(/\s*\(([^)]*)\)/g, (m, inner) => (ATT_RE.test(inner) || /attachment/i.test(inner) ? ' ' : m));
  // 2) trailing "with [the] <attachment> [attachment]" (no parens)
  n = n.replace(new RegExp(`\\s+with\\s+(?:the\\s+|a\\s+)?[\\w- ]*?${ATT_WORD}(?:\\s+attachment)?\\s*$`, 'i'), '');
  // 3) a leading attachment word right after "Cable " ("Cable Rope X" → "Cable X")
  n = n.replace(new RegExp(`^(\\s*cable)\\s+${ATT_WORD}\\s+`, 'i'), '$1 ');
  // tidy: collapse spaces, fix spacing around dashes, drop stray leading/trailing punctuation
  return n.replace(/\s{2,}/g, ' ').replace(/\s+-\s+/g, ' - ').replace(/^[\s-]+|[\s-]+$/g, '').trim();
}

const key = (name, equipment) => `${name}|${equipment ?? ''}`.toLowerCase();

/** Return a new list with attachment-bearing names cleaned where the result stays unique. */
export function debake(list) {
  // Proposed names assuming every strip applies (non-attachment rows keep their name).
  const proposed = list.map((e) => (e.attachment ? stripAttachmentFromName(e.name) : e.name));
  const count = {};
  proposed.forEach((nm, i) => { const k = key(nm, list[i].equipment); count[k] = (count[k] ?? 0) + 1; });

  let changed = 0;
  const out = list.map((e, i) => {
    if (!e.attachment) return e;
    const nm = proposed[i];
    if (nm && nm !== e.name && count[key(nm, e.equipment)] === 1) {
      changed += 1;
      return { ...e, name: nm };
    }
    return e;
  });
  return { list: out, changed };
}
