import { Cable } from 'lucide-react-native';

import { Dropdown } from '@/components/Dropdown';
import { attachmentOptions, supportsAttachment } from '@/lib/attachments';

const NONE = '__none__';

/**
 * Cable-attachment picker (None + Rope/Bar/V-Bar/…). Renders nothing for non-cable
 * exercises, so callers can drop it in unconditionally. Each attachment is its own
 * progress line.
 */
export function AttachmentDropdown({
  equipment,
  value,
  onChange,
}: {
  equipment?: string | null;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (!supportsAttachment(equipment)) return null;
  const items = [{ key: NONE, label: 'None' }, ...attachmentOptions(equipment).map((o) => ({ key: o, label: o }))];
  return (
    <Dropdown
      icon={Cable}
      label={value ?? 'Attachment'}
      items={items}
      selectedKey={value ?? NONE}
      active={!!value}
      onSelect={(k) => onChange(k === NONE ? null : k)}
    />
  );
}
