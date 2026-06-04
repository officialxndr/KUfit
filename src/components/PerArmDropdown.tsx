import { ArrowLeftRight } from 'lucide-react-native';

import { Dropdown } from '@/components/Dropdown';
import type { Side } from '@/types';

/**
 * Per-arm (unilateral) picker: Both together / Per arm — L first / Per arm — R first.
 * Sits next to the attachment dropdown under an exercise's name. Reports the resulting
 * `{ unilateral, leadSide }`; the caller persists it (callers guard no-op changes so the
 * set rows aren't needlessly rebuilt).
 */
export function PerArmDropdown({
  unilateral,
  leadSide,
  onChange,
}: {
  unilateral?: boolean | null;
  leadSide?: Side | null;
  onChange: (next: { unilateral: boolean; leadSide: Side }) => void;
}) {
  const lead: Side = leadSide === 'R' ? 'R' : 'L';
  const selectedKey = !unilateral ? 'both' : lead === 'R' ? 'r' : 'l';
  // Compact label so it shares one line with the attachment pill (the ⇄ icon gives context).
  const label = !unilateral ? 'Both arms' : `${lead} first`;
  const items = [
    { key: 'both', label: 'Both together' },
    { key: 'l', label: 'Per arm — L first' },
    { key: 'r', label: 'Per arm — R first' },
  ];
  return (
    <Dropdown
      icon={ArrowLeftRight}
      label={label}
      items={items}
      selectedKey={selectedKey}
      active={!!unilateral}
      width={190}
      onSelect={(k) =>
        k === 'both'
          ? onChange({ unilateral: false, leadSide: lead })
          : onChange({ unilateral: true, leadSide: k === 'r' ? 'R' : 'L' })
      }
    />
  );
}
