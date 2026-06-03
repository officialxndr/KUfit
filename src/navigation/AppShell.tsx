import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, space, PAGE_PADDING, themedStyles } from '@/theme/tokens';
import { haptic } from '@/lib/haptics';
import { useNavStore } from '@/stores/navStore';
import { useRefreshStore } from '@/stores/refreshStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoutineStore, getNextTemplateId } from '@/stores/routineStore';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import {
  FAB_ACTIONS,
  SECTION_TABS,
  navTabsFor,
  isSectionKey,
  type SectionKey,
} from './config';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { QuickActionsSheet } from './QuickActionsSheet';
import { ScreenTransition } from '@/components/anim/ScreenTransition';
import { FeatureTour } from '@/components/FeatureTour';

import { Target } from 'lucide-react-native';
import { DashboardOverview } from '@/screens/DashboardOverview';
import { DashboardReports } from '@/screens/DashboardReports';
import { FoodToday } from '@/screens/FoodToday';
import { FoodRecipes } from '@/screens/FoodRecipes';
import { FoodTrends } from '@/screens/FoodTrends';
import { FoodSearch } from '@/screens/FoodSearch';
import { WorkoutLibrary } from '@/screens/WorkoutLibrary';
import { WorkoutHistory } from '@/screens/WorkoutHistory';
import { WorkoutExercises } from '@/screens/WorkoutExercises';
import { WorkoutStats } from '@/screens/WorkoutStats';
import { HealthWeight } from '@/screens/HealthWeight';
import { HealthTrends } from '@/screens/HealthTrends';
import { HealthBody } from '@/screens/HealthBody';
import { HealthMeasure } from '@/screens/HealthMeasure';
import { SettingsView } from '@/screens/SettingsView';
import { GoalsEditorModal } from '@/components/GoalsEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerMainScroll } from '@/lib/appScroll';

const today = () => new Date().toISOString().slice(0, 10);

// Section order (left→right) so a tab change can slide in the right direction.
const SECTION_ORDER: SectionKey[] = ['dashboard', 'food', 'workout', 'health', 'settings'];

/**
 * The app's main shell — a two-level nav recreated from the design mock:
 * top section switcher (AppHeader), contextual bottom bar (BottomNav), and a
 * center "+" FAB opening section-specific quick actions. Sub-views are plain
 * content fragments rendered inside a single scroll area.
 */
export function AppShell() {
  const router = useRouter();
  const { section, subTab, setSection, setSubTab } = useNavStore();
  const session = useSessionStore();
  // Remount the shell when the theme changes so every style/colour recomputes.
  const themeVersion = useThemeStore((s) => s.version);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Expose the main scroll so the feature tour can scroll a section into view.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    registerMainScroll((y, animated) => scrollRef.current?.scrollTo({ y, animated }));
    return () => registerMainScroll(null);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    haptic.tap();
    useRefreshStore.getState().bump();
    // Reads are synchronous; a short spinner just gives the gesture a beat.
    setTimeout(() => setRefreshing(false), 500);
  };

  const tabs = navTabsFor(section);
  const usesSubTabs = !!SECTION_TABS[section];
  const activeSub = usesSubTabs ? subTab ?? tabs[0].key : section;
  const routines = useRoutineStore((s) => s.routines);
  const defaultRoutineId = useRoutineStore((s) => s.defaultRoutineId);
  const defaultRoutine = routines.find((r) => r.id === defaultRoutineId) ?? routines[0] ?? null;

  // Label the "Start routine" action with the default routine's name.
  const fabActions = useMemo(() => {
    const base = FAB_ACTIONS[section];
    if (base && section === 'workout' && defaultRoutine) {
      return base.map((a) => (a.key === 'start-routine' ? { ...a, label: `Start ${defaultRoutine.name}` } : a));
    }
    return base;
  }, [section, defaultRoutine]);
  const showFab = !!fabActions && fabActions.length > 0;
  // Settings is reachable/leavable via the header switcher, so it needs no bottom bar.
  const showBottomNav = section !== 'settings';

  // Direction for the screen transition: compare the new section/sub-tab position
  // to the previous one so content slides in from the side you moved toward.
  const subIndex = Math.max(0, tabs.findIndex((t) => t.key === activeSub));
  const order = SECTION_ORDER.indexOf(section) * 100 + subIndex;
  const orderRef = useRef(order);
  const dirRef = useRef(0);
  if (order !== orderRef.current) {
    dirRef.current = order > orderRef.current ? 1 : -1;
    orderRef.current = order;
  }

  // Bottom-nav tap: launcher items switch sections; sub-tabs set the sub-tab.
  const onTab = (key: string) => {
    if (usesSubTabs) setSubTab(key);
    else if (isSectionKey(key)) setSection(key);
  };

  const openAddFood = () =>
    router.push({ pathname: '/add-food', params: { meal: 'SNACK', date: today() } });

  const handleFabAction = (key: string) => {
    setSheetOpen(false);
    switch (key) {
      case 'log-food':
      case 'search-food':
      case 'scan-barcode':
        openAddFood();
        break;
      case 'log-weight':
        router.push('/log-weight');
        break;
      case 'log-measurement':
        router.push('/measurements');
        break;
      case 'start-workout':
      case 'start-empty':
        session.startEmpty();
        router.push('/session');
        break;
      case 'start-template':
        setSection('workout', 'library');
        break;
      case 'start-routine': {
        const { routines, defaultRoutineId, markDone } = useRoutineStore.getState();
        const routine = routines.find((r) => r.id === defaultRoutineId) ?? routines[0];
        const nextId = routine ? getNextTemplateId(routine) : null;
        const tmpl = nextId ? workoutRepo.getTemplates().find((t) => t.id === nextId) : null;
        if (routine && nextId && tmpl) {
          markDone(routine.id, nextId);
          session.startFromTemplate(tmpl.id, tmpl.name);
          router.push('/session');
        } else {
          // No routine (or its templates) yet — send them to the Library to set one up.
          setSection('workout', 'library');
        }
        break;
      }
    }
  };

  return (
    <View style={styles.root} key={themeVersion}>
      <AppHeader
        section={section}
        onSwitch={(s: SectionKey) => setSection(s)}
        onOpenProfile={() => setSection('settings')}
        rightAction={section === 'dashboard' || section === 'food' || section === 'health' || section === 'workout'
          ? { icon: Target, onPress: () => setGoalsOpen(true) }
          : undefined}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <ScreenTransition transitionKey={`${section}:${activeSub}`} direction={dirRef.current}>
          <SectionContent section={section} activeSub={activeSub} />
        </ScreenTransition>
      </ScrollView>

      {showBottomNav && (
        <BottomNav
          tabs={tabs}
          activeKey={activeSub}
          onTab={onTab}
          showFab={showFab}
          onFab={() => setSheetOpen(true)}
          fabOpen={sheetOpen}
        />
      )}

      <QuickActionsSheet
        visible={sheetOpen}
        actions={fabActions ?? []}
        onAction={handleFabAction}
        onClose={() => setSheetOpen(false)}
      />

      <GoalsEditorModal visible={goalsOpen} onClose={() => setGoalsOpen(false)} focusSection={section} />

      <FeatureTour />
    </View>
  );
}

function SectionContent({ section, activeSub }: { section: SectionKey; activeSub: string }) {
  switch (section) {
    case 'dashboard':
      if (activeSub === 'reports') return <DashboardReports />;
      return <DashboardOverview />;
    case 'settings':
      return <SettingsView />;
    case 'food':
      if (activeSub === 'recipes') return <FoodRecipes />;
      if (activeSub === 'trends') return <FoodTrends />;
      if (activeSub === 'search') return <FoodSearch />;
      return <FoodToday />;
    case 'workout':
      if (activeSub === 'history') return <WorkoutHistory />;
      if (activeSub === 'exercises') return <WorkoutExercises />;
      if (activeSub === 'stats') return <WorkoutStats />;
      return <WorkoutLibrary />;
    case 'health':
      if (activeSub === 'trends') return <HealthTrends />;
      if (activeSub === 'body') return <HealthBody />;
      if (activeSub === 'measure') return <HealthMeasure />;
      return <HealthWeight />;
    default:
      return null;
  }
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: space[4],
    paddingBottom: space[8] * 2,
  },
}));
