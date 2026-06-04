import {
  Compass, LayoutDashboard, UtensilsCrossed, Dumbbell, Flame, BarChart2,
  HeartPulse, Target, Bell, Palette, ShieldCheck, Settings, type LucideIcon,
} from 'lucide-react-native';

/**
 * Detailed, user-facing feature reference shown in the in-app guide (Settings → Help →
 * Feature guide). This is hand-written documentation — fuller than the guided-tour blurbs —
 * grouped by app area and searchable. Keep it accurate to how the app actually behaves; when
 * a feature changes, update the matching entry here.
 */

export interface GuideEntry {
  title: string;
  body: string;
  /** Extra search terms not already in the title/body. */
  keywords?: string;
  /** Optional short, practical pointers. */
  tips?: string[];
}

export interface GuideSection {
  key: string;
  label: string;
  icon: LucideIcon;
  intro: string;
  entries: GuideEntry[];
}

export const GUIDE: GuideSection[] = [
  {
    key: 'basics',
    label: 'Getting around',
    icon: Compass,
    intro: 'How Hale is laid out and the quickest ways to move through it.',
    entries: [
      {
        title: 'Sections & switching',
        body: 'Hale is split into five sections: Dashboard, Food, Workout, Health, and Settings. Tap the title at the top of the screen to open a dropdown and jump to any section, or swipe the header up/down to flip between them.',
        keywords: 'navigation navigate header switch tabs areas move',
      },
      {
        title: 'Sub-tabs (bottom bar)',
        body: 'Each section has its own bottom bar that switches between its sub-tabs — for example Workout has Library, History, and Stats. The far-right tab in Food, Workout, and Health is always the Stats/Trends view for that area.',
        keywords: 'bottom bar tabs subtabs sections',
      },
      {
        title: 'Quick add (the + button)',
        body: 'The + in the center of the bottom bar is a shortcut from anywhere in the app. It opens a small menu to log food, log your weight, or start a workout, so you do not have to navigate to the right section first.',
        keywords: 'fab plus quick actions add log shortcut',
      },
      {
        title: 'Pull to refresh',
        body: 'On most screens you can pull down to refresh the data — useful after logging something elsewhere or syncing with Health.',
        keywords: 'reload update swipe down',
      },
      {
        title: 'Searching',
        body: 'Settings, the exercise library, and the food search all have a search box. In Settings the search filters every section at once, so you can type a keyword (like “units” or “backup”) to jump straight to it.',
        keywords: 'find filter lookup',
      },
    ],
  },

  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    intro: 'Your day at a glance, plus longer-term reports.',
    entries: [
      {
        title: "Today's overview",
        body: 'The Dashboard shows where you are today against your targets — calories eaten vs. your budget, protein/carbs/fat, and how much you have left. It updates the moment you log food or a workout.',
        keywords: 'rings progress calories macros remaining budget summary',
      },
      {
        title: 'Reports',
        body: 'Reports pull your food, workout, and health data into trends over time so you can see the bigger picture rather than a single day. Use the date-range bar to change the window.',
        keywords: 'trends charts history analytics graphs',
      },
      {
        title: 'Due reminders & banners',
        body: 'When a reminder is due (like logging your weight) a banner appears on the Dashboard so you can act on it in one tap. An optional, dismissible donation banner may also appear.',
        keywords: 'notifications nudges prompts',
      },
    ],
  },

  {
    key: 'food',
    label: 'Food & nutrition',
    icon: UtensilsCrossed,
    intro: 'Logging what you eat, fast — by search, barcode, or label scan.',
    entries: [
      {
        title: 'Logging food',
        body: 'Open Food (or the + → Log food), search for an item, tap it, set the amount and unit, and choose the meal. The item is added to today by default; you can change the date and meal from the food screen.',
        keywords: 'add eat meal log diary quantity serving',
      },
      {
        title: 'Where search results come from',
        body: 'Food search combines a built-in set of base ingredients, your previously logged foods, and the Open Food Facts database (a large open product catalog). Results are ranked by relevance, and anything you have logged before surfaces first.',
        keywords: 'database open food facts off products ingredients source',
      },
      {
        title: 'Barcode scanning',
        body: 'Tap the scan icon on the food search screen and point your camera at a product barcode to look it up instantly. If it is found, you go straight to the quantity sheet.',
        keywords: 'scan camera upc ean product code',
      },
      {
        title: 'Scan a nutrition label',
        body: 'When creating a custom food you can scan the nutrition-facts panel with your camera. On-device text recognition reads the calories and macros and fills the form for you — no typing, and nothing leaves your phone.',
        keywords: 'ocr label nutrition facts panel custom food camera recognition',
      },
      {
        title: 'Custom foods',
        body: 'Cannot find something, or want your own entry? Create a custom food with its calories and macros (optionally scanning the label). It is saved for reuse and appears in your search.',
        keywords: 'create add manual homemade own item',
      },
      {
        title: 'Recipes',
        body: 'Build a recipe from multiple ingredients and a serving size; Hale calculates the per-serving nutrition. Log a recipe like any other food by choosing how many servings you ate.',
        keywords: 'meal multi ingredient cook serving combine',
      },
      {
        title: 'Favorites & recents',
        body: 'Star foods and recipes to keep them in your Favorites tab, and recently logged items appear automatically so your regulars are always one tap away.',
        keywords: 'star quick frequent saved',
      },
      {
        title: 'Macros, calories & targets',
        body: 'Every food contributes to your daily calories and protein/carbs/fat, measured against the targets from your goal or profile. The Food screen and Dashboard both show progress toward those numbers.',
        keywords: 'protein carbs fat budget goal nutrition',
      },
      {
        title: 'Food trends',
        body: 'The Stats tab in Food aggregates your intake over a chosen window (week, month, and so on) — average calories, macro splits, and consistency — so you can spot patterns.',
        keywords: 'stats averages history analytics report range',
      },
    ],
  },

  {
    key: 'exercises',
    label: 'Exercise library',
    icon: Dumbbell,
    intro: 'Browse 1,500+ exercises, set how each is logged, and add your own.',
    entries: [
      {
        title: 'The exercise library',
        body: 'Workout → Exercises has a catalog of over 1,500 movements, each with an animated demo, step-by-step instructions, and the muscles it works. Browse by muscle group or search by name.',
        keywords: 'catalog browse gif demo instructions muscles database exercisedb',
      },
      {
        title: 'Exercise details',
        body: 'Tap any exercise to open its page: a looping demo, how-to steps, primary and secondary muscles, equipment, and its logging defaults. Demos stream the first time and are cached for offline use after.',
        keywords: 'preview gif video how to muscles worked equipment',
      },
      {
        title: 'Logging defaults (per exercise)',
        body: 'Each exercise has two settings you control from its page (and from the same little selectors during a workout): Per-arm and Load counting. These are saved on the exercise and reused every time you add it — set them once.',
        keywords: 'config settings default per arm load counting global',
      },
      {
        title: 'Load counting (per side)',
        body: 'For two-arm dumbbell or kettlebell moves the weight you log is per hand, so it should count twice toward volume. Set Load counting to “Per side ×2” for those, or “Total” when the logged weight is the whole load. It only affects volume math — your 1RM and top weight stay per hand.',
        keywords: 'volume dumbbell kettlebell two arm per side total weight x2',
      },
      {
        title: 'Per-arm sets',
        body: 'Turn on Per-arm to log a movement one arm at a time — each set splits into an L row and an R row (e.g. 1 L, 1 R), and you choose which side leads. Volume sums both arms, and each side keeps its own history so you can watch for left/right imbalances.',
        keywords: 'unilateral left right single arm alternating l r lead side',
      },
      {
        title: 'Creating your own exercises',
        body: 'Tap “+ New” in the exercise library to add a custom exercise with a name, muscle group, equipment, and notes. It behaves like any catalog exercise — add it to workouts and templates.',
        keywords: 'custom add new own create movement',
      },
      {
        title: 'My exercises',
        body: 'Everything you create is gathered in a “My exercises” group at the top of the library (and a matching filter in the add-exercise picker), so your own movements are easy to find.',
        keywords: 'custom group filter mine own list',
      },
      {
        title: 'Deleting an exercise',
        body: 'You can delete exercises you created from their detail page — the built-in catalog exercises cannot be removed. If a custom exercise is used in templates or past workouts, Hale warns you before removing it everywhere.',
        keywords: 'remove custom delete trash own',
      },
    ],
  },

  {
    key: 'workout',
    label: 'Doing a workout',
    icon: Flame,
    intro: 'Start, log, and finish a session — with fast entry and smart defaults.',
    entries: [
      {
        title: 'Starting a workout',
        body: 'Start an empty workout and add exercises as you go, or start from a saved template/routine to pre-load its exercises and sets. The + button can start a workout from anywhere.',
        keywords: 'begin new session template routine empty',
      },
      {
        title: 'Logging sets',
        body: 'Tap a weight or reps cell to open the keypad, type the value, and tap Next/Done. Check off each set as you complete it; completed sets turn green. Add or remove sets per exercise, and swipe a set left to delete it.',
        keywords: 'reps weight keypad numpad check off complete entry',
      },
      {
        title: 'Previous values & “Use previous”',
        body: 'The “Previous” column shows what you did for that set last time as a faint ghost. While typing, a “Use previous” button above the keypad fills the focused field with the previous set’s value (or last workout’s, for set 1) — handy for keeping the same weight across sets.',
        keywords: 'ghost last time carry forward repeat copy reuse',
      },
      {
        title: 'Rest timer',
        body: 'When you complete a set, a rest timer starts automatically with a bar that depletes as it counts down. Tap between two sets to set a custom rest, pick from presets, or override the rest after a single set. Skip it anytime.',
        keywords: 'timer countdown break recover bar presets',
      },
      {
        title: 'Supersets',
        body: 'Group adjacent exercises into a superset and Hale interleaves their sets by round (do one set of each, then rest), labeling them A1/A2 and only resting at the end of each round.',
        keywords: 'group circuit alternate combine round',
      },
      {
        title: 'Cable attachments',
        body: 'On cable exercises a small Attachment selector sits under the name. Pick Rope, Straight Bar, V-Bar, and so on — and each attachment keeps its own weights, PRs, and history, so a rope pushdown and a bar pushdown track as separate progress lines.',
        keywords: 'cable handle rope bar v-bar grip attachment selector pulldown pushdown',
      },
      {
        title: 'Notes & rest per exercise',
        body: 'Use the ⋮ menu on an exercise to add a note (e.g. “felt heavy, drop set next time”), set its default rest, group it into a superset, or change its load counting.',
        keywords: 'menu kebab options note comment',
      },
      {
        title: 'Finishing & the summary',
        body: 'Tap Finish to save the workout. If enabled, a summary celebrates the session and flags any personal bests. Hale records your total volume and, where available, calories burned and heart rate.',
        keywords: 'save complete done summary recap pr personal best',
      },
      {
        title: 'Discarding a workout',
        body: 'Tap the ✕ and confirm to discard a session you do not want to keep. Nothing is saved and you return to the workout library.',
        keywords: 'cancel delete abandon quit exit',
      },
    ],
  },

  {
    key: 'templates',
    label: 'Templates & routines',
    icon: Dumbbell,
    intro: 'Save workouts you repeat so you can start them in one tap.',
    entries: [
      {
        title: 'Building a template',
        body: 'Create a template by adding exercises and their default sets, reps, weight, and rest. You can also set per-arm and a default cable attachment per exercise. Starting a workout from the template pre-fills everything.',
        keywords: 'routine plan create build default reusable',
      },
      {
        title: 'Editing & reordering',
        body: 'Open a template to edit it; drag exercises to reorder, group them into supersets, or remove them. Changes apply the next time you start it.',
        keywords: 'rearrange drag manage update superset',
      },
    ],
  },

  {
    key: 'workout-stats',
    label: 'Workout progress',
    icon: BarChart2,
    intro: 'See strength and volume trends over time.',
    entries: [
      {
        title: 'Workout stats',
        body: 'The Stats tab in Workout summarizes your training over a chosen window — total volume, number of sessions, and trends — using the same date-range bar as the other Stats screens.',
        keywords: 'volume sessions trends analytics range report',
      },
      {
        title: 'Per-exercise progress',
        body: 'Open an exercise’s progress to chart it session by session: estimated 1-rep max (Epley formula), top weight, total volume, and reps. For per-arm exercises and cable attachments, each variation tracks separately.',
        keywords: 'progress chart history 1rm one rep max epley strength top weight',
      },
      {
        title: 'Personal bests',
        body: 'When a set beats your previous best estimated 1RM for that exercise (and attachment), it is marked as a personal best in the workout and summary.',
        keywords: 'pr record best milestone',
      },
      {
        title: 'Calories & heart rate',
        body: 'Each workout estimates calories burned from its duration and your body weight; if a connected watch or Health provides measured active energy and heart rate for the window, Hale uses those instead and can show a heart-rate chart.',
        keywords: 'kcal energy burned bpm watch apple health duration',
      },
      {
        title: 'Weekly session goal',
        body: 'Set a weekly workout target and Hale tracks how many sessions you have done toward it this week.',
        keywords: 'target frequency per week goal consistency',
      },
    ],
  },

  {
    key: 'health',
    label: 'Health & body',
    icon: HeartPulse,
    intro: 'Track weight, body composition, and measurements — and sync with Health.',
    entries: [
      {
        title: 'Weight logging',
        body: 'Log your weight (+ → Log weight, or the Health section) and Hale charts the trend over time. Your latest weight also feeds calorie and volume calculations.',
        keywords: 'weigh in scale bodyweight trend graph',
      },
      {
        title: 'Body composition',
        body: 'Hale can estimate body-fat percentage, including the U.S. Navy method from your measurements, and shows lean mass alongside it. Turn the Navy method on in onboarding or Settings → Body composition.',
        keywords: 'body fat percentage navy lean mass estimate composition',
      },
      {
        title: 'Measurements',
        body: 'Record circumference measurements — chest, waist, hips, arms, thighs, calves, neck — and track each over time. These also feed the Navy body-fat estimate.',
        keywords: 'tape circumference chest waist arms measure inches cm',
      },
      {
        title: 'Renpho tape measure (Bluetooth)',
        body: 'If you have a Renpho RF-BMF01 smart tape, Hale can read measurements straight from it over Bluetooth, so you do not have to type them. This needs a physical device with Bluetooth.',
        keywords: 'bluetooth ble smart tape renpho measure connect',
      },
      {
        title: 'DEXA scans',
        body: 'Log a DEXA scan to capture richer body data — bone mass, visceral fat, and a bone-density T-score — on a weigh-in, for the days you get scanned.',
        keywords: 'dexa scan bone visceral fat t-score density composition',
      },
      {
        title: 'Apple Health / Health Connect',
        body: 'Connect to Apple Health (iOS) or Health Connect (Android) to import steps, active calories, weight, and workout heart rate. The active-calorie source is configurable, and connecting is optional — Hale works fully without it.',
        keywords: 'healthkit sync apple watch steps active calories import connect',
      },
      {
        title: 'Health trends',
        body: 'The Stats tab in Health charts weight, body-fat, and measurements over your chosen window so you can see direction and rate of change.',
        keywords: 'trends charts history range analytics',
      },
    ],
  },

  {
    key: 'goals',
    label: 'Goals & targets',
    icon: Target,
    intro: 'Set what you are working toward and let Hale do the math.',
    entries: [
      {
        title: 'Calorie & macro targets',
        body: 'Your daily calorie and macro targets come from your active goal phase if you have one, otherwise from your profile and estimated maintenance (TDEE). They drive the progress you see on the Dashboard and Food screens.',
        keywords: 'budget protein carbs fat tdee maintenance numbers',
      },
      {
        title: 'Goal phases',
        body: 'Create a phase — cut, bulk, or maintain — with a date range, a target weight or body-fat, and a weekly rate of change. Hale sets your calorie/macro targets for the phase and tracks your progress through it.',
        keywords: 'cut bulk maintain phase plan target rate weekly deficit surplus',
      },
      {
        title: 'TDEE & activity level',
        body: 'Your activity level (from sedentary to very active) plus your profile estimate your total daily energy expenditure, the baseline for maintenance and your targets.',
        keywords: 'tdee maintenance activity level energy expenditure calculator',
      },
      {
        title: 'Eat-back (active calories)',
        body: 'Optionally add calories you burn in workouts (or measured active energy from Health) back into your daily budget. Choose the source — automatic, watch only, in-app only, or off — in Settings → Health.',
        keywords: 'eat back active calories burned add budget watch refresh',
      },
    ],
  },

  {
    key: 'reminders',
    label: 'Reminders & notifications',
    icon: Bell,
    intro: 'Gentle nudges to keep your logging on track.',
    entries: [
      {
        title: 'Setting reminders',
        body: 'In Settings → Notifications & reminders you can schedule per-item reminders (for example, a nightly weigh-in or a meal log) at the times that suit you.',
        keywords: 'schedule alerts notify nudge time daily',
      },
      {
        title: 'Due banners',
        body: 'Even without system notifications, Hale shows a banner on the Dashboard when a reminder is due, so you can act on it in one tap.',
        keywords: 'banner prompt dashboard due',
      },
    ],
  },

  {
    key: 'appearance',
    label: 'Appearance & motion',
    icon: Palette,
    intro: 'Make Hale look and feel the way you like.',
    entries: [
      {
        title: 'Theme & appearance',
        body: 'Hale is dark-first with a single indigo accent. Adjust the appearance in Settings → Appearance.',
        keywords: 'theme dark light color accent display mode',
      },
      {
        title: 'Motion & confetti',
        body: 'Animations are subtle and can be tuned in Settings → Motion. Hale also honors your system Reduce Motion setting, and celebratory confetti (for big wins) has its own toggle.',
        keywords: 'animation reduce motion confetti celebration transitions accessibility',
      },
    ],
  },

  {
    key: 'data',
    label: 'Data, privacy & backup',
    icon: ShieldCheck,
    intro: 'Your data stays on your device — and you stay in control of it.',
    entries: [
      {
        title: 'Local-first & private',
        body: 'Everything you log lives on your device — no account, no sign-in, and no server required. The app works fully offline, and your data is not sent anywhere unless you choose to.',
        keywords: 'privacy offline on device no account local sqlite secure',
      },
      {
        title: 'Backup & restore',
        body: 'Export a full backup file from Settings → Data & backup and keep it somewhere safe; import it later to restore or move to a new device. You can merge or replace on import.',
        keywords: 'export import restore transfer save file move device',
      },
      {
        title: 'Download demos for offline',
        body: 'Exercise demo GIFs stream the first time you view them and are cached afterward. To have them all available offline up front, use Settings → Offline to download the full set.',
        keywords: 'offline gifs media download cache exercise demos',
      },
      {
        title: 'Optional server sync',
        body: 'Advanced: Hale can connect to your own self-hosted server for backup and automations. It is off by default and entirely optional — everything works without it.',
        keywords: 'server self hosted sync backup token url advanced',
      },
      {
        title: 'Wipe all data',
        body: 'Settings → Data & backup has a guarded “Wipe all data” that permanently erases everything and returns the app to first-run setup. It requires confirmation and a slide-to-confirm, so it cannot happen by accident — export a backup first if you want to keep anything.',
        keywords: 'reset erase delete everything clear start over factory',
      },
    ],
  },

  {
    key: 'settings',
    label: 'Settings & support',
    icon: Settings,
    intro: 'Profile, units, help, and the people behind the data.',
    entries: [
      {
        title: 'Units',
        body: 'Switch between metric and imperial in Settings → Units; weights, heights, and measurements display in your chosen system everywhere.',
        keywords: 'metric imperial kg lbs cm inches pounds',
      },
      {
        title: 'Profile',
        body: 'Your profile (name, height, birthday, sex) underpins the calorie, TDEE, and body-fat calculations. Update it anytime in Settings → Profile.',
        keywords: 'name height age birthday sex gender avatar',
      },
      {
        title: 'Feedback',
        body: 'Found a bug or have an idea? Settings → Feedback files a bug report or feature request — it attaches a little diagnostic info and sends it by email, and saves a copy in the app.',
        keywords: 'bug report feature request idea contact suggestion',
      },
      {
        title: 'Replaying the tour',
        body: 'New or want a refresher? Settings → Help can replay the guided tour — a quick Basic run, the full Advanced walkthrough, or just one section. This guide is searchable any time, too.',
        keywords: 'tour guide walkthrough onboarding intro replay help',
      },
      {
        title: 'Supporting Hale',
        body: 'Hale is free, with no ads and nothing behind a paywall. If it helps you, an optional donation (never required) keeps it free for everyone — find it at the bottom of Settings.',
        keywords: 'donate donation support tip ko-fi contribute free',
      },
      {
        title: 'Credits & data sources',
        body: 'Exercise data, images, and demo GIFs are provided by ExerciseDB (AscendAPI). Food and barcode data contains information from Open Food Facts, made available under the Open Database License (ODbL). See Settings → About & credits.',
        keywords: 'attribution credits exercisedb ascendapi open food facts odbl license sources',
      },
    ],
  },
];
