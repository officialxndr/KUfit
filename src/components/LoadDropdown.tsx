import { Scale } from 'lucide-react-native';

import { Dropdown } from '@/components/Dropdown';

/**
 * Load-counting picker: Total vs Per side ×2 (for two-arm dumbbell/kettlebell moves whose
 * logged weight is per hand). A global per-exercise default, like the per-arm setting.
 */
export function LoadDropdown({ perSide, onChange }: { perSide: boolean; onChange: (perSide: boolean) => void }) {
  return (
    <Dropdown
      icon={Scale}
      label={perSide ? 'Per side ×2' : 'Total'}
      items={[{ key: 'total', label: 'Total' }, { key: 'perside', label: 'Per side ×2' }]}
      selectedKey={perSide ? 'perside' : 'total'}
      active={perSide}
      width={150}
      onSelect={(k) => onChange(k === 'perside')}
    />
  );
}
