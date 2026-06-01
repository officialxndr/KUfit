import { create } from 'zustand';
import type { SectionKey } from '@/navigation/config';

/**
 * Shell navigation state: which top-level section is active and (for sections
 * with sub-tabs) which sub-tab. A null subTab means "use the section default"
 * (the first tab in SECTION_TABS). Kept in a store so cross-section actions —
 * dashboard quick links, FAB actions — can switch sections from anywhere.
 */
interface NavState {
  section: SectionKey;
  subTab: string | null;
  setSection: (section: SectionKey, subTab?: string | null) => void;
  setSubTab: (subTab: string) => void;
}

export const useNavStore = create<NavState>((set) => ({
  section: 'dashboard',
  subTab: null,
  setSection: (section, subTab = null) => set({ section, subTab }),
  setSubTab: (subTab) => set({ subTab }),
}));
