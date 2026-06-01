/* FitSelf UI Kit — fitness screens: Workout (sub-views), ActiveSession, Health (sub-views). */

// ── Workout / Templates ────────────────────────────────────────────────────────
const TEMPLATES = [
  { name: 'Push Day', muscles: 'Chest · Shoulders · Triceps', last: '2 days ago' },
  { name: 'Pull Day', muscles: 'Back · Biceps', last: '4 days ago' },
  { name: 'Leg Day', muscles: 'Quads · Hamstrings · Glutes', last: '6 days ago' },
  { name: 'Upper Body', muscles: 'Chest · Back · Arms', last: 'Never' },
];

// ── Routine data model ────────────────────────────────────────────────────────
const TEMPLATE_DEFS = [
  { id: 'push',  name: 'Push Day',   muscles: 'Chest · Shoulders · Triceps' },
  { id: 'pull',  name: 'Pull Day',   muscles: 'Back · Biceps'               },
  { id: 'legs',  name: 'Leg Day',    muscles: 'Quads · Hamstrings · Glutes' },
  { id: 'upper', name: 'Upper Body', muscles: 'Chest · Back · Arms'         },
];

// Returns the TEMPLATE_DEF that is next up — the one done least recently (lowest timestamp).
function getNextInRoutine(routine) {
  if (!routine || !routine.templateIds.length) return null;
  let nextId   = routine.templateIds[0];
  let nextTime = routine.lastDones[nextId] || 0;
  for (const id of routine.templateIds) {
    const t = routine.lastDones[id] || 0;
    if (t < nextTime) { nextId = id; nextTime = t; }
  }
  return TEMPLATE_DEFS.find(t => t.id === nextId) || null;
}

function fmtAge(ts) {
  if (!ts) return 'Never';
  const days = Math.round((Date.now() - ts) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return days + 'd ago';
}

function WorkoutTemplatesView({ onStart, routines, setRoutines }) {
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName]       = React.useState('');
  const [selected, setSelected]     = React.useState([]);

  const toggle = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const create = () => {
    if (!newName.trim() || !selected.length) return;
    setRoutines(prev => [
      ...prev,
      { id: 'r' + Date.now(), name: newName.trim(), templateIds: [...selected], lastDones: {} },
    ]);
    setNewName(''); setSelected([]); setShowCreate(false);
  };

  const startRoutine = (routine) => {
    const next = getNextInRoutine(routine);
    if (!next) return;
    setRoutines(prev => prev.map(r =>
      r.id !== routine.id ? r : { ...r, lastDones: { ...r.lastDones, [next.id]: Date.now() } }
    ));
    onStart(next.name);
  };

  const deleteRoutine = (id) => setRoutines(prev => prev.filter(r => r.id !== id));
  const rList = routines || [];

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90,
      display: 'flex', flexDirection: 'column', gap: 12, background: FS.bg }}>

      {/* ── Routines ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>Routines</span>
        {!showCreate && (
          <span onClick={() => setShowCreate(true)}
            style={{ fontSize: 14, color: FS.primary, fontWeight: 500, cursor: 'pointer' }}>+ New</span>
        )}
      </div>

      {showCreate && (
        <div style={{ background: FS.surface, borderRadius: 20, padding: 16,
          border: '1px solid ' + FS.primary + '33', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: FS.primary, margin: 0 }}>New Routine</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Routine name…"
            style={{ background: FS.surfaceHigh, border: '1px solid ' + FS.border, borderRadius: 10,
              padding: '10px 12px', fontSize: 14, color: FS.text, fontFamily: FS.font,
              outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <p style={{ fontSize: 11, color: FS.muted, margin: 0, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.05em' }}>Select templates · tap to set rotation order</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TEMPLATE_DEFS.map(t => {
              const on  = selected.includes(t.id);
              const pos = selected.indexOf(t.id) + 1;
              return (
                <button key={t.id} onClick={() => toggle(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: on ? FS.primary + '18' : FS.surfaceHigh,
                  border: '1.5px solid ' + (on ? FS.primary + '55' : 'transparent'),
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: FS.font, textAlign: 'left',
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: on ? FS.primary : 'transparent',
                    border: '1.5px solid ' + (on ? FS.primary : FS.border),
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{pos}</span>
                        : <Icon name="plus" size={13} color={FS.muted} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: FS.text }}>{t.name}</p>
                    <p style={{ fontSize: 11, color: FS.muted, margin: '2px 0 0' }}>{t.muscles}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="neutral"
              onClick={() => { setShowCreate(false); setNewName(''); setSelected([]); }}
              style={{ flex: 1, borderRadius: 12 }}>Cancel</Button>
            <Button onClick={create} disabled={!newName.trim() || !selected.length}
              style={{ flex: 1, borderRadius: 12 }}>Create</Button>
          </div>
        </div>
      )}

      {!showCreate && rList.length === 0 && (
        <div onClick={() => setShowCreate(true)} style={{ background: FS.surface, borderRadius: 14,
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: FS.primary + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="repeat" size={18} color={FS.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Create a routine</p>
            <p style={{ fontSize: 12, color: FS.muted, margin: '2px 0 0' }}>Auto-rotate through your templates</p>
          </div>
          <Icon name="chevron-right" size={16} color={FS.muted} />
        </div>
      )}

      {rList.map(r => {
        const next = getNextInRoutine(r);
        return (
          <div key={r.id} style={{ background: FS.surface, borderRadius: 16,
            padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{r.name}</h3>
                <p style={{ fontSize: 12, color: FS.muted, margin: '2px 0 0' }}>
                  {r.templateIds.length} workout{r.templateIds.length !== 1 ? 's' : ''} in rotation
                </p>
              </div>
              <button onClick={() => deleteRoutine(r.id)} style={{ background: 'none', border: 'none',
                cursor: 'pointer', color: FS.muted, padding: '4px 6px', display: 'flex' }}>
                <Icon name="trash-2" size={15} /></button>
              <button onClick={() => startRoutine(r)} style={{
                background: FS.primary, color: '#fff', border: 'none', borderRadius: 10,
                padding: '7px 12px', fontSize: 13, fontWeight: 600, fontFamily: FS.font,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="play" size={13} color="#fff" />Start
              </button>
            </div>
            {next && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                background: FS.primary + '12', borderRadius: 8, padding: '5px 10px', alignSelf: 'flex-start' }}>
                <Icon name="arrow-right-circle" size={13} color={FS.primary} />
                <span style={{ fontSize: 12, color: FS.primary, fontWeight: 600 }}>Next: {next.name}</span>
                <span style={{ fontSize: 11, color: FS.muted }}>· {fmtAge(r.lastDones[next.id])}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* ── divider ── */}
      <div style={{ height: 1, background: FS.border, margin: '2px 0' }} />

      {/* ── Templates ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>Templates</span>
        <span style={{ fontSize: 14, color: FS.primary, fontWeight: 500, cursor: 'pointer' }}>+ New</span>
      </div>
      <Button full onClick={() => onStart('Quick Workout')} style={{ borderRadius: 16, padding: 14 }}>Quick Start</Button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {TEMPLATES.map((t, i) => (
          <div key={i} onClick={() => onStart(t.name)} style={{ background: FS.surface, borderRadius: 16,
            padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{t.name}</h3>
              <Icon name="more-horizontal" size={20} color={FS.muted} />
            </div>
            <p style={{ fontSize: 12, color: FS.muted, margin: 0 }}>{t.muscles}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: FS.muted, marginTop: 'auto' }}>
              <Icon name="clock" size={14} /><span>Last {t.last}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Workout / History ──────────────────────────────────────────────────────────
const HISTORY = [
  { name: 'Push Day',   date: 'Today',      duration: '48 min', sets: 18, volume: '8,420 lb', pr: true  },
  { name: 'Leg Day',    date: 'Wed May 28',  duration: '55 min', sets: 22, volume: '12,140 lb', pr: false },
  { name: 'Pull Day',   date: 'Mon May 26',  duration: '42 min', sets: 16, volume: '6,880 lb', pr: false },
  { name: 'Push Day',   date: 'Sat May 24',  duration: '50 min', sets: 18, volume: '8,100 lb', pr: false },
  { name: 'Leg Day',    date: 'Thu May 22',  duration: '58 min', sets: 24, volume: '11,800 lb', pr: false },
  { name: 'Pull Day',   date: 'Tue May 20',  duration: '40 min', sets: 15, volume: '6,500 lb', pr: false },
  { name: 'Upper Body', date: 'Sun May 18',  duration: '45 min', sets: 20, volume: '9,200 lb', pr: true  },
];

function WorkoutHistoryView() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, background: FS.bg, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{HISTORY.length} sessions</span>
        <span style={{ fontSize: 13, color: FS.muted }}>This month</span>
      </div>
      {HISTORY.map((w, i) => (
        <div key={i} style={{ background: FS.surface, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{w.name}</p>
                {w.pr && <Badge tone="success" icon="trophy">PR</Badge>}
              </div>
              <p style={{ fontSize: 12, color: FS.muted, margin: '3px 0 0' }}>{w.date}</p>
            </div>
            <span style={{ fontSize: 12, color: FS.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="timer" size={13} />{w.duration}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['Sets', w.sets], ['Volume', w.volume]].map(([l, v]) => (
              <div key={l} style={{ flex: 1, background: FS.surfaceHigh, borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ fontSize: 10, color: FS.muted, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{l}</p>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Workout / Exercises ────────────────────────────────────────────────────────
const EXERCISE_GROUPS = [
  { muscle: 'Chest', icon: 'dumbbell', exercises: ['Bench Press (Barbell)', 'Incline DB Press', 'Cable Chest Fly', 'Push-up'] },
  { muscle: 'Back', icon: 'arrow-up-from-line', exercises: ['Pull-up', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row'] },
  { muscle: 'Legs', icon: 'footprints', exercises: ['Squat (Barbell)', 'Romanian Deadlift', 'Leg Press', 'Goblet Squat'] },
  { muscle: 'Shoulders', icon: 'zap', exercises: ['OHP (Barbell)', 'Lateral Raise', 'Face Pull', 'Arnold Press'] },
  { muscle: 'Arms', icon: 'biceps-flexed', exercises: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skull Crusher'] },
  { muscle: 'Core', icon: 'circle-dot', exercises: ['Plank', 'Ab Wheel Rollout', 'Cable Crunch', 'Hanging Leg Raise'] },
];

function WorkoutExercisesView() {
  const [query, setQuery] = React.useState('');
  const [expanded, setExpanded] = React.useState({ Chest: true, Back: false, Legs: false, Shoulders: false, Arms: false, Core: false });
  const filtered = query
    ? EXERCISE_GROUPS.map(g => ({ ...g, exercises: g.exercises.filter(e => e.toLowerCase().includes(query.toLowerCase())) })).filter(g => g.exercises.length > 0)
    : EXERCISE_GROUPS;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, background: FS.bg, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: FS.surface, borderRadius: 12, padding: '10px 14px', border: `1px solid ${FS.border}` }}>
        <Icon name="search" size={16} color={FS.muted} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search exercises…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: FS.text, fontFamily: FS.font }} />
      </div>
      {filtered.map((g) => {
        const isOpen = query ? true : expanded[g.muscle];
        return (
          <div key={g.muscle} style={{ background: FS.surface, borderRadius: 16 }}>
            <button onClick={() => setExpanded(x => ({ ...x, [g.muscle]: !x[g.muscle] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: FS.text, fontFamily: FS.font }}>
              <Icon name={g.icon} size={18} color={FS.primary} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, textAlign: 'left' }}>{g.muscle}</span>
              <span style={{ fontSize: 12, color: FS.muted }}>{g.exercises.length}</span>
              <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={FS.muted} />
            </button>
            {isOpen && g.exercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: '1px solid ' + FS.border }}>
                <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex}</span>
                <button style={{ width: 30, height: 30, borderRadius: 8, background: FS.primary + '22', border: 'none', color: FS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Workout / Stats ────────────────────────────────────────────────────────────
const WEEKLY_VOLUME = [41200, 38600, 44100, 39800, 47200, 42500, 45900, 48200];
const WEEK_LABELS   = ['Apr 7','Apr 14','Apr 21','Apr 28','May 5','May 12','May 19','May 26'];

function WorkoutStatsView() {
  const maxVol = Math.max(...WEEKLY_VOLUME) * 1.1;
  const fmt = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v;
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, background: FS.bg, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[['Workouts / mo', '14', 'dumbbell'], ['Avg duration', '48 min', 'timer'], ['Streak', '5 days', 'flame'], ['Best week', '48.2k lb', 'trophy']].map(([l, v, ic]) => (
          <div key={l} style={{ background: FS.surface, borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name={ic} size={14} color={FS.primary} />
              <span style={{ fontSize: 11, color: FS.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Weekly Volume</span>
          <span style={{ fontSize: 12, color: FS.success, fontWeight: 600 }}>↑ 6% vs last month</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
          {WEEKLY_VOLUME.map((v, i) => (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <div style={{ width: '100%', height: `${(v / maxVol) * 100}%`, borderRadius: '3px 3px 0 0',
                background: i === WEEKLY_VOLUME.length - 1 ? FS.primary : FS.primary + '66' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {WEEKLY_VOLUME.map((v, i) => (
            <span key={i} style={{ flex: 1, fontSize: 9, color: FS.muted, textAlign: 'center' }}>{fmt(v)}</span>
          ))}
        </div>
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Recent PRs</p>
        {[['Bench Press', '185 lb × 5', 'May 30'], ['Squat', '225 lb × 3', 'May 28'], ['OHP', '115 lb × 5', 'May 26'], ['Pull-up', 'BW+45 × 6', 'May 18']].map(([ex, val, date], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: i ? `1px solid ${FS.border}` : 'none' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{ex}</p>
              <p style={{ fontSize: 12, color: FS.muted, margin: '2px 0 0' }}>{date}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{val}</span>
              <Badge tone="success" icon="trophy"></Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Workout / Routines ───────────────────────────────────────────────────────
function WorkoutRoutinesView({ routines, setRoutines, onStart }) {
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName,    setNewName]    = React.useState('');
  const [selected,   setSelected]   = React.useState([]);

  const toggle = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const create = () => {
    if (!newName.trim() || !selected.length) return;
    setRoutines(prev => [
      ...prev,
      { id: 'r' + Date.now(), name: newName.trim(), templateIds: [...selected], lastDones: {} },
    ]);
    setNewName(''); setSelected([]); setShowCreate(false);
  };

  const startRoutine = (routine) => {
    const next = getNextInRoutine(routine);
    if (!next) return;
    setRoutines(prev => prev.map(r =>
      r.id !== routine.id ? r : { ...r, lastDones: { ...r.lastDones, [next.id]: Date.now() } }
    ));
    onStart(next.name);
  };

  const deleteRoutine = (id) => setRoutines(prev => prev.filter(r => r.id !== id));

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90,
      display: 'flex', flexDirection: 'column', gap: 12, background: FS.bg }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>Routines</span>
        {!showCreate && (
          <span onClick={() => setShowCreate(true)}
            style={{ fontSize: 14, color: FS.primary, fontWeight: 500, cursor: 'pointer' }}>+ New</span>
        )}
      </div>

      {showCreate && (
        <div style={{ background: FS.surface, borderRadius: 20, padding: 16,
          border: '1px solid ' + FS.primary + '33', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: FS.primary, margin: 0 }}>New Routine</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Routine name…"
            style={{ background: FS.surfaceHigh, border: '1px solid ' + FS.border, borderRadius: 10,
              padding: '10px 12px', fontSize: 14, color: FS.text, fontFamily: FS.font,
              outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <p style={{ fontSize: 11, color: FS.muted, margin: 0, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.05em' }}>Select templates · tap to set rotation order</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TEMPLATE_DEFS.map(t => {
              const on  = selected.includes(t.id);
              const pos = selected.indexOf(t.id) + 1;
              return (
                <button key={t.id} onClick={() => toggle(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: on ? FS.primary + '18' : FS.surfaceHigh,
                  border: '1.5px solid ' + (on ? FS.primary + '55' : 'transparent'),
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: FS.font, textAlign: 'left',
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: on ? FS.primary : 'transparent',
                    border: '1.5px solid ' + (on ? FS.primary : FS.border),
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{pos}</span>
                        : <Icon name="plus" size={13} color={FS.muted} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: FS.text }}>{t.name}</p>
                    <p style={{ fontSize: 11, color: FS.muted, margin: '2px 0 0' }}>{t.muscles}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="neutral"
              onClick={() => { setShowCreate(false); setNewName(''); setSelected([]); }}
              style={{ flex: 1, borderRadius: 12 }}>Cancel</Button>
            <Button onClick={create} disabled={!newName.trim() || !selected.length}
              style={{ flex: 1, borderRadius: 12 }}>Create</Button>
          </div>
        </div>
      )}

      {routines.length === 0 && !showCreate && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 10, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: FS.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="repeat" size={28} color={FS.border} />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: FS.muted }}>No routines yet</p>
          <p style={{ margin: 0, fontSize: 13, color: FS.muted, maxWidth: 240, lineHeight: 1.5 }}>
            Group templates into a rotation — FitSelf auto-picks whichever you’ve done least recently.
          </p>
          <Button onClick={() => setShowCreate(true)} style={{ borderRadius: 12, marginTop: 4 }}>Create Routine</Button>
        </div>
      )}

      {routines.map(r => {
        const next = getNextInRoutine(r);
        return (
          <div key={r.id} style={{ background: FS.surface, borderRadius: 20 }}>

            <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>{r.name}</h3>
                <p style={{ fontSize: 12, color: FS.muted, margin: 0 }}>
                  {r.templateIds.length} workout{r.templateIds.length !== 1 ? 's' : ''} in rotation
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => deleteRoutine(r.id)} style={{ background: 'none', border: 'none',
                  cursor: 'pointer', color: FS.muted, padding: 4, display: 'flex' }}>
                  <Icon name="trash-2" size={16} /></button>
                <button onClick={() => startRoutine(r)} style={{
                  background: FS.primary, color: '#fff', border: 'none', borderRadius: 10,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: FS.font,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="play" size={13} color="#fff" />Start
                </button>
              </div>
            </div>

            {next && (
              <div style={{ margin: '0 12px 10px', borderRadius: 10,
                background: FS.primary + '15', padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="arrow-right-circle" size={15} color={FS.primary} />
                <span style={{ fontSize: 13, color: FS.primary, fontWeight: 600, flex: 1 }}>Next up: {next.name}</span>
                <span style={{ fontSize: 11, color: FS.muted }}>{fmtAge(r.lastDones[next.id])}</span>
              </div>
            )}

            <div style={{ borderTop: '1px solid ' + FS.border }}>
              {r.templateIds.map((id, i) => {
                const tmpl   = TEMPLATE_DEFS.find(t => t.id === id);
                if (!tmpl) return null;
                const isNext = next && next.id === id;
                return (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderBottom: i < r.templateIds.length - 1 ? '1px solid ' + FS.border : 'none',
                    background: isNext ? FS.primary + '08' : 'transparent',
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: isNext ? FS.primary : FS.surfaceHigh,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isNext
                        ? <Icon name="chevron-right" size={14} color="#fff" />
                        : <span style={{ fontSize: 12, fontWeight: 600, color: FS.muted }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: isNext ? 600 : 400, margin: 0 }}>{tmpl.name}</p>
                      <p style={{ fontSize: 11, color: FS.muted, margin: '2px 0 0' }}>{tmpl.muscles}</p>
                    </div>
                    <span style={{ fontSize: 11, color: FS.muted, flexShrink: 0 }}>{fmtAge(r.lastDones[id])}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Workout (router) ───────────────────────────────────────────────────────────
function WorkoutScreen({ subTab, onStart, routines, setRoutines }) {
  const tab = subTab || 'templates';
  if (tab === 'history')   return <WorkoutHistoryView />;
  if (tab === 'exercises') return <WorkoutExercisesView />;
  if (tab === 'stats')     return <WorkoutStatsView />;
  return <WorkoutTemplatesView onStart={onStart} routines={routines || []} setRoutines={setRoutines || (() => {})} />;
}

// ── Active Session (signature set logger) ──────────────────────────────────────
function ActiveSession({ name, onFinish, onDiscard }) {
  const [elapsed, setElapsed] = React.useState(3067);
  React.useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(id); }, []);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const [exercises, setExercises] = React.useState([
    { id: 'e1', name: 'Goblet Squat (Kettlebell)', muscle: 'Legs',
      sets: [{ id: 's1', prev: '30 × 8', w: 30, r: 8, done: true }, { id: 's2', prev: '30 × 8', w: 30, r: 8, done: true }, { id: 's3', prev: '30 × 8', w: 30, r: 8, done: false }] },
    { id: 'e2', name: 'Bench Press (Dumbbell)', muscle: 'Chest',
      sets: [{ id: 's4', prev: '45 × 10', w: 45, r: 10, done: false }, { id: 's5', prev: '45 × 10', w: 0, r: 0, done: false }] },
  ]);
  const [focus, setFocus] = React.useState({ ex: 'e1', set: 's3', field: 'w' });

  const setVal = (exId, setId, field, val) =>
    setExercises(prev => prev.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(s => s.id !== setId ? s : { ...s, [field]: val }) }));
  const toggleDone = (exId, setId) =>
    setExercises(prev => prev.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(s => s.id !== setId ? s : { ...s, done: !s.done }) }));

  const draft = focus ? (exercises.find(e => e.id === focus.ex)?.sets.find(s => s.id === focus.set)?.[focus.field] ?? 0) : 0;
  const press = (key) => {
    if (!focus) return;
    if (key === 'next') {
      if (focus.field === 'w') { setFocus({ ...focus, field: 'r' }); return; }
      toggleDone(focus.ex, focus.set); setFocus(null); return;
    }
    let cur = String(draft === 0 ? '' : draft);
    if (key === 'del') cur = cur.slice(0, -1); else cur = cur + key;
    setVal(focus.ex, focus.set, focus.field, parseInt(cur || '0', 10) || 0);
  };
  const step = (dir) => { if (focus) setVal(focus.ex, focus.set, focus.field, Math.max(0, (draft || 0) + dir * (focus.field === 'w' ? 5 : 1))); };

  const removeSet = (exId, setId) =>
    setExercises(prev => prev.map(e => e.id !== exId ? e : {
      ...e, sets: e.sets.filter(s => s.id !== setId)
    }));

  const cell = (e, s, field) => {
    const on = focus && focus.ex === e.id && focus.set === s.id && focus.field === field;
    return (
      <button onClick={() => setFocus({ ex: e.id, set: s.id, field })} style={{
        width: '100%', padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        background: on ? FS.surface : FS.surfaceHigh, color: s[field] > 0 ? FS.text : FS.muted, border: 'none', cursor: 'pointer',
        boxShadow: on ? '0 0 0 2px ' + FS.primary : 'none',
      }}>{s[field] > 0 ? s[field] : 0}</button>
    );
  };

  return (
    <div style={{ position: 'relative', height: '100%', background: FS.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: FS.surface, borderBottom: `1px solid ${FS.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '50px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: FS.muted, background: FS.surfaceHigh, padding: '6px 12px', borderRadius: 8 }}>
          <Icon name="timer" size={16} />2:00
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{name}</h1>
          <p style={{ fontSize: 12, color: FS.muted, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsed)}</p>
        </div>
        <Button variant="success" onClick={onFinish} style={{ padding: '8px 18px', borderRadius: 12, fontSize: 14 }}>Finish</Button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: focus ? 290 : 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exercises.map(e => (
          <div key={e.id} style={{ background: FS.surface, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${FS.border}` }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: FS.primary }}>{e.name}</h3>
                <p style={{ fontSize: 12, color: FS.muted, margin: '2px 0 0' }}>{e.muscle}</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Icon name="sticky-note" size={20} color={FS.muted} />
                <Icon name="x" size={20} color={FS.muted} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 1fr 1fr 38px 30px', columnGap: 8, alignItems: 'center', padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: FS.muted }}>
              <span style={{ textAlign: 'center' }}>Set</span>
              <span style={{ textAlign: 'center' }}>Previous</span>
              <span style={{ textAlign: 'center' }}>lbs</span>
              <span style={{ textAlign: 'center' }}>Reps</span>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Icon name="check" size={13} color={FS.muted} /></div>
              <span></span>
            </div>
            {e.sets.map((s, i) => (
              <React.Fragment key={s.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 1fr 1fr 38px 30px', columnGap: 8, alignItems: 'center', padding: '3px 16px', borderRadius: 8, margin: '1px 6px', background: s.done ? FS.success + '1a' : 'transparent' }}>
                  <div style={{ width: 34, height: 30, borderRadius: 8, background: FS.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
                  <span style={{ textAlign: 'center', color: FS.muted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{s.prev}</span>
                  {cell(e, s, 'w')}{cell(e, s, 'r')}
                  <button onClick={() => toggleDone(e.id, s.id)} style={{ width: 38, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.done ? FS.success : FS.surfaceHigh, color: s.done ? '#fff' : FS.muted }}>
                    <Icon name="check" size={16} />
                  </button>
                  {i === e.sets.length - 1 && e.sets.length > 1
                    ? <button onClick={() => removeSet(e.id, s.id)} style={{ width: 30, height: 30, borderRadius: 8, background: FS.surfaceHigh, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: FS.muted }}>
                        <Icon name="x" size={15} />
                      </button>
                    : <span />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
                  <div style={{ flex: 1, height: 2, borderRadius: 2, background: FS.primary, opacity: 0.45 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: FS.primary, fontVariantNumeric: 'tabular-nums' }}>2:00</span>
                  <div style={{ flex: 1, height: 2, borderRadius: 2, background: FS.primary, opacity: 0.18 }} />
                </div>
              </React.Fragment>
            ))}
            <button style={{ margin: '4px 8px 8px', width: 'calc(100% - 16px)', background: FS.surfaceHigh, border: 'none', borderRadius: 10, color: FS.text, fontSize: 14, fontWeight: 600, padding: '11px 0', fontFamily: FS.font, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" size={16} /> Add Set <span style={{ color: FS.muted, fontWeight: 400 }}>(2:00)</span>
            </button>
          </div>
        ))}
        <button style={{ width: '100%', border: `2px dashed ${FS.border}`, background: 'none', color: FS.muted, padding: 16, borderRadius: 16, fontSize: 14, fontFamily: FS.font, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Icon name="plus" size={16} /> Add Exercise
        </button>
        <button onClick={onDiscard} style={{ width: '100%', background: 'none', border: 'none', color: FS.danger, padding: 8, fontSize: 14, fontFamily: FS.font, cursor: 'pointer' }}>Discard Workout</button>
      </div>
      {focus && <Numpad onKey={press} onStep={step} field={focus.field} onClose={() => setFocus(null)} />}
    </div>
  );
}

function Numpad({ onKey, onStep, field, onClose }) {
  const keyStyle = { background: FS.surfaceHigh, border: 'none', borderRadius: 10, color: FS.text, fontSize: 24, fontWeight: 400, fontFamily: FS.font, padding: '14px 0', cursor: 'pointer' };
  const K = ({ children, onClick, style }) => <button onClick={onClick} style={{ ...keyStyle, ...style }}>{children}</button>;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: FS.surface, borderTop: `1px solid ${FS.border}`, padding: '12px 12px 28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, zIndex: 50 }}>
      {['1', '2', '3'].map(n => <K key={n} onClick={() => onKey(n)}>{n}</K>)}
      <K onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-down" size={22} color={FS.muted} /></K>
      {['4', '5', '6'].map(n => <K key={n} onClick={() => onKey(n)}>{n}</K>)}
      <K onClick={() => onStep(1)} style={{ fontSize: 18, color: FS.muted }}>＋</K>
      {['7', '8', '9'].map(n => <K key={n} onClick={() => onKey(n)}>{n}</K>)}
      <K onClick={() => onStep(-1)} style={{ fontSize: 18, color: FS.muted }}>－</K>
      <K onClick={() => onKey('del')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="delete" size={22} color={FS.muted} /></K>
      <K onClick={() => onKey('0')}>0</K>
      <button onClick={() => onKey('del')} style={{ ...keyStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="delete" size={20} color={FS.muted} /></button>
      <button onClick={() => onKey('next')} style={{ background: FS.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, fontFamily: FS.font, cursor: 'pointer' }}>{field === 'w' ? 'Next' : 'Done'}</button>
    </div>
  );
}

// ── Health / Weight ────────────────────────────────────────────────────────────
function HealthWeightView() {
  const data = [188.5, 187.9, 188.1, 187.2, 186.8, 186.0, 185.4, 185.7, 184.9, 184.2, 183.8, 183.1, 182.9, 182.4];
  const goalW = 170, maxW = 190, minW = 168;
  const W = 320, H = 150;
  const x = i => (i / (data.length - 1)) * W;
  const y = v => H - ((v - minW) / (maxW - minW)) * H;
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const periods = ['7 Day', '30 Day', '90 Day', '1 Year'];
  const [p, setP] = React.useState('30 Day');

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 16, background: FS.bg }}>
      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 4px' }}>Current Weight</p>
            <p style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>182.4 <span style={{ fontSize: 16, color: FS.muted, fontWeight: 500 }}>lb</span></p>
          </div>
          <Badge tone="success" icon="trending-down">−1.3 lb/wk</Badge>
        </div>
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Weight Trend</span>
          <span style={{ fontSize: 12, color: FS.muted }}>2026</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible' }}>
          <line x1="0" y1={y(goalW)} x2={W} y2={y(goalW)} stroke={FS.primary} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
          <text x="4" y={y(goalW) - 5} fill={FS.primary} fontSize="9" fontWeight="600">GOAL 170</text>
          <path d={`${path} L${W} ${H} L0 ${H} Z`} fill={FS.primary} opacity="0.08" />
          <path d={path} fill="none" stroke={FS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={FS.primary} />)}
        </svg>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {periods.map(per => (
            <button key={per} onClick={() => setP(per)} style={{ flex: 1, fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FS.font,
              background: p === per ? FS.primary : FS.surfaceHigh, color: p === per ? '#fff' : FS.muted }}>{per}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[['Lost · 30 days', '−4.2 lb', FS.success], ['Goal ETA', 'Aug 14', FS.text], ['Avg intake (7d)', '1,840 cal', FS.text], ['Body fat', '18.2%', FS.text]].map(([l, v, c], i) => (
          <div key={i} style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: c }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, border: `1px solid ${FS.border}` }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, background: FS.warning + '1a', borderRadius: '14px 14px 0 0' }}>
          <Icon name="alert-triangle" size={16} color={FS.warning} />
          <span style={{ fontSize: 14, fontWeight: 600, color: FS.warning }}>Slightly Behind Pace</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <p style={{ fontSize: 14, color: FS.text, margin: '0 0 8px' }}>You're 0.4 lb/week behind. To stay on track for Aug 14:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: FS.muted }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="footprints" size={15} color={FS.primary} /> Walk briskly ~25 min</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="utensils-crossed" size={15} color={FS.primary} /> Or trim ~120 cal from intake</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Health / Goals ─────────────────────────────────────────────────────────────
const RATES = [0.5, 1.0, 1.5, 2.0];

function HealthGoalsView() {
  const [goalW, setGoalW] = React.useState(170);
  const [rate, setRate] = React.useState(1.0);
  const currentW = 182.4;
  const lbsToLose = Math.max(currentW - goalW, 0);
  const weeksNeeded = lbsToLose / rate;
  const eta = new Date();
  eta.setDate(eta.getDate() + Math.round(weeksNeeded * 7));
  const etaStr = eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, background: FS.bg, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 4px' }}>Current Weight</p>
        <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{currentW} <span style={{ fontSize: 14, color: FS.muted, fontWeight: 400 }}>lb</span></p>
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Goal Weight</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{goalW} <span style={{ fontSize: 14, color: FS.muted, fontWeight: 400 }}>lb</span></p>
          <p style={{ fontSize: 12, color: FS.muted, margin: '4px 0 0' }}>{lbsToLose.toFixed(1)} lb to lose</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[1, -1].map(dir => (
            <button key={dir} onClick={() => setGoalW(g => Math.min(Math.max(g + dir, 90), currentW - 1))}
              style={{ width: 40, height: 40, borderRadius: 10, background: FS.surfaceHigh, border: 'none', cursor: 'pointer', color: FS.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={dir === 1 ? 'plus' : 'minus'} size={18} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Weekly Rate of Loss</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {RATES.map(r => (
            <button key={r} onClick={() => setRate(r)}
              style={{ padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: FS.font, fontSize: 13, fontWeight: 600,
                background: rate === r ? FS.primary : FS.surfaceHigh, color: rate === r ? '#fff' : FS.muted }}>
              {r} lb
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: FS.muted, margin: '10px 0 0', textAlign: 'center' }}>
          {rate <= 0.5 ? 'Conservative — very sustainable' : rate <= 1.0 ? 'Moderate — recommended' : rate <= 1.5 ? 'Aggressive — challenging' : 'Very aggressive — difficult to sustain'}
        </p>
      </div>

      <div style={{ background: FS.primary + '18', border: `1px solid ${FS.primary}33`, borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, color: FS.primary, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Estimated Reach</p>
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: FS.text }}>{etaStr}</p>
          <p style={{ fontSize: 12, color: FS.muted, margin: '3px 0 0' }}>{Math.round(weeksNeeded)} weeks · ~{Math.round(rate * 500)} cal/day deficit</p>
        </div>
        <Icon name="target" size={36} color={FS.primary} stroke={1.5} />
      </div>

      <Button full style={{ borderRadius: 14, padding: 14 }}>Save Goal</Button>
    </div>
  );
}

// ── Health / Body ──────────────────────────────────────────────────────────────
function HealthBodyView() {
  const weight = 182.4, fatPct = 18.2;
  const fatMass = (weight * fatPct / 100).toFixed(1);
  const leanMass = (weight - fatMass).toFixed(1);
  const bmi = (weight / (69 * 69) * 703).toFixed(1);
  const ffmi = (leanMass / 2.205 / Math.pow(1.75, 2)).toFixed(1);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, background: FS.bg, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 4px' }}>Body Fat</p>
            <p style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{fatPct}<span style={{ fontSize: 18, color: FS.muted, fontWeight: 400 }}>%</span></p>
          </div>
          <Badge tone="success">Athletic range</Badge>
        </div>
        <div style={{ height: 12, borderRadius: 99, overflow: 'hidden', background: FS.surfaceHigh, marginBottom: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fatPct}%`, background: `linear-gradient(90deg, ${FS.success}, ${FS.warning})`, borderRadius: 99 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: FS.muted, fontWeight: 600 }}>
          <span>Essential 4%</span><span>Athletic 14%</span><span>Fitness 22%</span><span>Obese 32%+</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[['Lean Mass', leanMass + ' lb', FS.success], ['Fat Mass', fatMass + ' lb', FS.muted], ['BMI', bmi, FS.text], ['FFMI', ffmi, FS.primary]].map(([l, v, c]) => (
          <div key={l} style={{ background: FS.surface, borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: FS.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{l}</p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: c }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Composition</p>
        <div style={{ display: 'flex', gap: 2, height: 20, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ flex: parseFloat(leanMass), background: FS.primary }} />
          <div style={{ flex: parseFloat(fatMass), background: FS.warning + 'cc' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
          {[['Lean', leanMass + ' lb', FS.primary], ['Fat', fatMass + ' lb', FS.warning]].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
              <span style={{ color: FS.muted }}>{l} <strong style={{ color: FS.text }}>{v}</strong></span>
            </div>
          ))}
        </div>
      </div>

      <Button full variant="neutral" style={{ borderRadius: 14 }}>Update Body Fat %</Button>
    </div>
  );
}

// ── Health / Measurements ──────────────────────────────────────────────────────
const MEASUREMENTS = [
  { name: 'Waist',       current: '33.5 in', prev: '34.2 in', delta: '−0.7', good: true  },
  { name: 'Chest',       current: '42.0 in', prev: '41.5 in', delta: '+0.5', good: true  },
  { name: 'Hips',        current: '38.5 in', prev: '39.0 in', delta: '−0.5', good: true  },
  { name: 'Left Arm',    current: '14.5 in', prev: '14.0 in', delta: '+0.5', good: true  },
  { name: 'Right Arm',   current: '14.5 in', prev: '14.0 in', delta: '+0.5', good: true  },
  { name: 'Left Thigh',  current: '22.0 in', prev: '22.5 in', delta: '−0.5', good: true  },
  { name: 'Right Thigh', current: '22.0 in', prev: '22.5 in', delta: '−0.5', good: true  },
  { name: 'Neck',        current: '15.5 in', prev: '15.5 in', delta: '0.0',  good: false },
];

function HealthMeasureView() {
  const [logging, setLogging] = React.useState(false);
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, background: FS.bg, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>Body Measurements</p>
          <p style={{ fontSize: 12, color: FS.muted, margin: '2px 0 0' }}>Last logged May 15, 2026</p>
        </div>
        <Button onClick={() => setLogging(v => !v)} style={{ padding: '8px 14px', borderRadius: 12, fontSize: 13 }}>
          {logging ? 'Cancel' : '+ Log'}
        </Button>
      </div>

      {logging && (
        <div style={{ background: FS.surface, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${FS.primary}44` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: FS.primary, margin: 0 }}>New Entry — Today</p>
          {MEASUREMENTS.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: FS.muted }}>{m.name}</span>
              <input defaultValue={parseFloat(m.current)} style={{ width: 70, background: FS.surfaceHigh, border: `1px solid ${FS.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 14, color: FS.text, fontFamily: FS.font, outline: 'none', textAlign: 'right' }} />
              <span style={{ fontSize: 12, color: FS.muted, width: 18 }}>in</span>
            </div>
          ))}
          <Button full style={{ borderRadius: 12, marginTop: 4 }}>Save Measurements</Button>
        </div>
      )}

      <div style={{ background: FS.surface, borderRadius: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 50px', gap: 0, padding: '8px 16px', borderBottom: `1px solid ${FS.border}` }}>
          {['Measurement', 'Current', 'Last', 'Change'].map(h => (
            <span key={h} style={{ fontSize: 10, color: FS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: h === 'Measurement' ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>
        {MEASUREMENTS.map((m, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 50px', alignItems: 'center', padding: '11px 16px', borderTop: i ? `1px solid ${FS.border}` : 'none' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</span>
            <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.current}</span>
            <span style={{ fontSize: 13, color: FS.muted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.prev}</span>
            <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
              color: m.delta === '0.0' ? FS.muted : m.good ? FS.success : FS.danger }}>{m.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Health (router) ────────────────────────────────────────────────────────────
function HealthScreen({ subTab }) {
  const tab = subTab || 'weight';
  if (tab === 'goals')   return <HealthGoalsView />;
  if (tab === 'body')    return <HealthBodyView />;
  if (tab === 'measure') return <HealthMeasureView />;
  return <HealthWeightView />;
}

Object.assign(window, { WorkoutScreen, ActiveSession, HealthScreen, TEMPLATE_DEFS, getNextInRoutine });
