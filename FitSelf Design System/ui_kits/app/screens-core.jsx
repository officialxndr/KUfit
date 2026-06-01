/* FitSelf UI Kit — core screens: Login, Dashboard, Food (sub-views), Settings. */

// ── Login ──────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = React.useState('alex@home.local');
  const [pw, setPw] = React.useState('••••••••');
  const field = {
    width: '100%', background: FS.surface, border: `1px solid ${FS.border}`, borderRadius: 12,
    padding: '12px 16px', fontSize: 14, color: FS.text, outline: 'none', fontFamily: FS.font, boxSizing: 'border-box',
  };
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: FS.bg }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>FitSelf</h1>
          <p style={{ color: FS.muted, fontSize: 14, marginTop: 8 }}>Sign in to continue</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={field} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
          <input style={field} value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="Password" />
          <Button full onClick={onLogin} style={{ borderRadius: 12, padding: '12px' }}>Sign In</Button>
        </div>
        <p style={{ textAlign: 'center', color: FS.muted, fontSize: 14, marginTop: 24 }}>
          Don't have an account? <span style={{ color: FS.primary, fontWeight: 500 }}>Register</span>
        </p>
      </div>
    </div>
  );
}

// ── Dashboard / Overview ───────────────────────────────────────────────────────
function DashboardOverviewView({ go, openSheet }) {
  const week = [
    { d: 'Su', v: 1820 }, { d: 'Mo', v: 2010 }, { d: 'Tu', v: 1640 }, { d: 'We', v: 1980 },
    { d: 'Th', v: 2100 }, { d: 'Fr', v: 1604 }, { d: 'Sa', v: 0 },
  ];
  const goal = 2000, maxV = 2200;
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 16, background: FS.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="user-circle" size={44} stroke={1.25} color={FS.muted} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Good morning</h1>
            <p style={{ color: FS.muted, fontSize: 14, margin: 0 }}>Alex</p>
          </div>
        </div>
        <span style={{ color: FS.muted, fontSize: 13 }}>{date}</span>
      </div>

      <Card onClick={() => go('food')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <CalorieRing eaten={1604} goal={goal} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MacroBar label="Protein" value={112} target={150} color={FS.protein} />
            <MacroBar label="Carbs" value={125} target={200} color={FS.carbs} />
            <MacroBar label="Fat" value={48} target={65} color={FS.fat} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: FS.muted, marginTop: 12, marginBottom: 0, textAlign: 'center' }}>Tap to log food →</p>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>This Week</span>
          <Badge tone="warning" icon="flame">5 day streak</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8%', height: 80, position: 'relative' }}>
          {week.map((b, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', maxWidth: 28, height: 64, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(b.v / maxV * 100, 3)}%`, borderRadius: '3px 3px 0 0',
                  background: b.v > 0 ? FS.primary : FS.surfaceHigh, opacity: b.v === 0 ? 1 : (b.v >= goal * 0.8 ? 1 : 0.6) }} />
              </div>
              <span style={{ fontSize: 10, color: FS.muted }}>{b.d}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card onClick={() => go('health')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 4px' }}>Current Weight</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>182.4 lb</p>
            <p style={{ fontSize: 14, color: FS.success, margin: '2px 0 0' }}>−1.3 lb this week</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: FS.muted, margin: 0 }}>Goal ETA</p>
            <p style={{ fontSize: 14, fontWeight: 500, margin: '2px 0 0' }}>Aug 14</p>
          </div>
        </div>
      </Card>

      <div onClick={() => go('health')} style={{ background: FS.surface, borderRadius: 16, border: `1px solid ${FS.border}`, cursor: 'pointer' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, background: FS.warning + '1a', borderRadius: '14px 14px 0 0' }}>
          <Icon name="alert-triangle" size={16} color={FS.warning} />
          <span style={{ fontSize: 14, fontWeight: 600, color: FS.warning }}>Slightly Behind</span>
          <span style={{ fontSize: 12, color: FS.muted, marginLeft: 'auto' }}>Pace →</span>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <p style={{ fontSize: 14, color: FS.muted, margin: 0 }}>Cut ~120 cal/day to stay on track</p>
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Recent Workouts</span>
          <span onClick={() => go('workout')} style={{ fontSize: 12, color: FS.primary, cursor: 'pointer' }}>See all →</span>
        </div>
        {[['Push Day', 'Today'], ['Leg Day', '2d ago'], ['Pull Day', '4d ago']].map(([n, t], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? `1px solid ${FS.border}` : 'none' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{n}</p>
              <p style={{ fontSize: 12, color: FS.muted, margin: 0 }}>{t}</p>
            </div>
            <Icon name="dumbbell" size={16} color={FS.muted} />
          </div>
        ))}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card onClick={() => go('workout')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Icon name="dumbbell" size={28} color={FS.primary} /><span style={{ fontSize: 14, fontWeight: 500 }}>Log Workout</span>
        </Card>
        <Card onClick={() => go('health')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Icon name="ruler" size={28} color={FS.primary} /><span style={{ fontSize: 14, fontWeight: 500 }}>Measurements</span>
        </Card>
      </div>
    </div>
  );
}

// ── Dashboard / Goals ──────────────────────────────────────────────────────────
function DashboardGoalsView() {
  // Nutrition
  const [nutr, setNutr] = React.useState({ calories: 2000, protein: 150, carbs: 200, fat: 65 });
  const setN = (field, delta, min, max) => setNutr(n => ({ ...n, [field]: Math.min(Math.max(n[field] + delta, min), max) }));
  const macroKcal = nutr.protein * 4 + nutr.carbs * 4 + nutr.fat * 9;
  const pPct = Math.round(nutr.protein * 4 / macroKcal * 100);
  const cPct = Math.round(nutr.carbs * 4 / macroKcal * 100);
  const fPct = Math.max(100 - pPct - cPct, 0);

  // Weight goal
  const currentW = 182.4;
  const [goalW, setGoalW] = React.useState(170);
  const [mode, setMode] = React.useState('rate');   // 'rate' | 'date'
  const [rate, setRate] = React.useState(1.0);
  const today = new Date(); today.setHours(0,0,0,0);
  const defaultEta = new Date(today); defaultEta.setDate(today.getDate() + 87);
  const [targetDate, setTargetDate] = React.useState(defaultEta.toISOString().split('T')[0]);
  const lbsToLose = Math.max(currentW - goalW, 0);
  const minDateStr = new Date(today.getTime() + 14*86400000).toISOString().split('T')[0];

  let etaStr, rateStr;
  if (mode === 'rate') {
    const eta = new Date(today.getTime() + Math.round(lbsToLose / rate * 7) * 86400000);
    etaStr = eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } else {
    const tDate = new Date(targetDate);
    const weeks = Math.max((tDate - today) / (7*86400000), 0.1);
    const r = (lbsToLose / weeks).toFixed(2);
    rateStr = r + ' lb/wk';
    etaStr = tDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Training
  const [weeklyTarget, setWeeklyTarget] = React.useState(4);
  const [focus, setFocus] = React.useState('cut');

  const SecHeader = ({ label }) => (
    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: FS.muted, margin: '16px 4px 6px 4px' }}>{label}</p>
  );

  const Row = ({ label, note, value, unit, onInc, onDec, first }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: first ? 'none' : `1px solid ${FS.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{label}</p>
        {note && <p style={{ fontSize: 11, color: FS.muted, margin: '2px 0 0' }}>{note}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onDec} style={{ width: 28, height: 28, borderRadius: 7, background: FS.surfaceHigh, border: 'none', color: FS.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="minus" size={13} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 68, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {value} <span style={{ fontSize: 11, color: FS.muted, fontWeight: 400 }}>{unit}</span>
        </span>
        <button onClick={onInc} style={{ width: 28, height: 28, borderRadius: 7, background: FS.surfaceHigh, border: 'none', color: FS.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={13} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: FS.bg }}>
    <div style={{ padding: '4px 16px 90px' }}>

      {/* ── NUTRITION ─────────────────────────────────────────────── */}
      <SecHeader label="Nutrition" />
      <div style={{ background: FS.surface, borderRadius: 16 }}>
        <div style={{ padding: '14px 16px 12px' }}>
          <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 8 }}>
            <div style={{ flex: pPct, background: FS.protein }} />
            <div style={{ flex: cPct, background: FS.carbs }} />
            <div style={{ flex: fPct, background: FS.fat }} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['Protein', pPct + '%', FS.protein], ['Carbs', cPct + '%', FS.carbs], ['Fat', fPct + '%', FS.fat]].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: c, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: FS.muted }}>{l} <strong style={{ color: FS.text }}>{v}</strong></span>
              </div>
            ))}
          </div>
        </div>
        <Row first label="Daily Calories" value={nutr.calories} unit="kcal"
          note={macroKcal !== nutr.calories ? `${macroKcal} kcal from macros` : undefined}
          onInc={() => setN('calories', 50, 1000, 5000)} onDec={() => setN('calories', -50, 1000, 5000)} />
        <Row label="Protein" value={nutr.protein} unit="g"
          note={`${nutr.protein * 4} kcal · ${pPct}%`}
          onInc={() => setN('protein', 5, 30, 400)} onDec={() => setN('protein', -5, 30, 400)} />
        <Row label="Carbohydrates" value={nutr.carbs} unit="g"
          note={`${nutr.carbs * 4} kcal · ${cPct}%`}
          onInc={() => setN('carbs', 5, 30, 600)} onDec={() => setN('carbs', -5, 30, 600)} />
        <Row label="Fat" value={nutr.fat} unit="g"
          note={`${nutr.fat * 9} kcal · ${fPct}%`}
          onInc={() => setN('fat', 2, 10, 200)} onDec={() => setN('fat', -2, 10, 200)} />
      </div>

      {/* ── WEIGHT GOAL ───────────────────────────────────────────── */}
      <SecHeader label="Weight Goal" />
      <div style={{ background: FS.surface, borderRadius: 16 }}>
        {/* current vs goal chips */}
        <div style={{ padding: '14px 16px 12px', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: FS.surfaceHigh, borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 10, color: FS.muted, margin: '0 0 3px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Current</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{currentW} <span style={{ fontSize: 12, color: FS.muted, fontWeight: 400 }}>lb</span></p>
          </div>
          <div style={{ flex: 1, background: FS.primary + '18', border: `1px solid ${FS.primary}33`, borderRadius: 12, padding: '10px 14px' }}>
            <p style={{ fontSize: 10, color: FS.primary, margin: '0 0 3px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Goal</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{goalW} <span style={{ fontSize: 12, color: FS.muted, fontWeight: 400 }}>lb</span></p>
              <div style={{ display: 'flex', gap: 3 }}>
                {[-1, 1].map(d => (
                  <button key={d} onClick={() => setGoalW(g => Math.min(Math.max(g + d, 90), currentW - 1))}
                    style={{ width: 24, height: 24, borderRadius: 6, background: FS.primary + '33', border: 'none', color: FS.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={d > 0 ? 'plus' : 'minus'} size={12} />
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 11, color: FS.primary, margin: '3px 0 0' }}>−{lbsToLose.toFixed(1)} lb to lose</p>
          </div>
        </div>

        {/* by-rate / by-date toggle */}
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', background: FS.surfaceHigh, borderRadius: 10, padding: 3, gap: 2 }}>
            {[['rate', 'By Rate'], ['date', 'By Date']].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FS.font, fontSize: 13, fontWeight: 500,
                background: mode === k ? FS.surface : 'transparent', color: mode === k ? FS.text : FS.muted,
                boxShadow: mode === k ? '0 1px 3px rgba(0,0,0,.3)' : 'none', transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
        </div>

        {mode === 'rate' ? (
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${FS.border}` }}>
            <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 8px' }}>Weekly rate of loss</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[0.5, 1.0, 1.5, 2.0].map(r => (
                <button key={r} onClick={() => setRate(r)}
                  style={{ padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: FS.font, fontSize: 13, fontWeight: 600,
                    background: rate === r ? FS.primary : FS.surfaceHigh, color: rate === r ? '#fff' : FS.muted }}>{r} lb</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: FS.muted, margin: '8px 0 0', textAlign: 'center' }}>
              {rate <= 0.5 ? 'Conservative · very sustainable' : rate <= 1.0 ? 'Moderate · recommended' : rate <= 1.5 ? 'Aggressive · challenging' : 'Very aggressive · hard to sustain'}
            </p>
          </div>
        ) : (
          <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${FS.border}` }}>
            <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 8px' }}>Target date</p>
            <input type="date" value={targetDate} min={minDateStr}
              onChange={e => setTargetDate(e.target.value)}
              style={{ width: '100%', background: FS.surfaceHigh, border: `1px solid ${FS.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: FS.text, fontFamily: FS.font, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
          </div>
        )}

        {/* ETA / rate result */}
        <div style={{ margin: '0 16px 16px', background: FS.primary + '15', border: `1px solid ${FS.primary}25`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, color: FS.primary, fontWeight: 700, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {mode === 'rate' ? 'Estimated Reach' : 'Required Rate'}
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: FS.text }}>{mode === 'rate' ? etaStr : rateStr}</p>
            {mode === 'date' && <p style={{ fontSize: 11, color: FS.muted, margin: '2px 0 0' }}>Goal: {etaStr}</p>}
          </div>
          <Icon name="target" size={28} color={FS.primary} stroke={1.5} />
        </div>
      </div>

      {/* ── TRAINING ──────────────────────────────────────────────── */}
      <SecHeader label="Training" />
      <div style={{ background: FS.surface, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Weekly Sessions</p>
            <p style={{ fontSize: 11, color: FS.muted, margin: '2px 0 0' }}>{weeklyTarget} workouts per week</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setWeeklyTarget(v => Math.max(v - 1, 1))}
              style={{ width: 28, height: 28, borderRadius: 7, background: FS.surfaceHigh, border: 'none', color: FS.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" size={13} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{weeklyTarget}</span>
            <button onClick={() => setWeeklyTarget(v => Math.min(v + 1, 7))}
              style={{ width: 28, height: 28, borderRadius: 7, background: FS.surfaceHigh, border: 'none', color: FS.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={13} />
            </button>
          </div>
        </div>
        <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${FS.border}` }}>
          <p style={{ fontSize: 12, color: FS.muted, margin: '0 0 8px' }}>Primary focus</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[['cut', 'Cut'], ['maintain', 'Maintain'], ['bulk', 'Bulk'], ['recomp', 'Recomp']].map(([k, l]) => (
              <button key={k} onClick={() => setFocus(k)}
                style={{ padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: FS.font, fontSize: 12, fontWeight: 600,
                  background: focus === k ? FS.primary : FS.surfaceHigh, color: focus === k ? '#fff' : FS.muted }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />
      <Button full style={{ borderRadius: 14, padding: 14 }}>Save All Goals</Button>
      <div style={{ height: 8 }} />
    </div>
    </div>
  );
}

// ── Dashboard (router) ─────────────────────────────────────────────────────────
function DashboardScreen({ subTab, go, openSheet }) {
  if (subTab === 'goals') return <DashboardGoalsView />;
  return <DashboardOverviewView go={go} openSheet={openSheet} />;
}

// ── Food helpers ───────────────────────────────────────────────────────────────
const FOOD_LOGGED = new Set([-1, -2, -3, -5, -6, -7, -8, -10, -12, -13]);

function fsDayLabel(off) {
  if (off === 0) return 'Today';
  if (off === -1) return 'Yesterday';
  if (off === 1) return 'Tomorrow';
  const d = new Date(); d.setDate(d.getDate() + off);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
function fsDateSub(off) {
  const d = new Date(); d.setDate(d.getDate() + off);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function WeekStrip({ sel, onSel }) {
  const WK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const days = [];
  for (let i = -3; i <= 3; i++) days.push(sel + i);
  return (
    <div style={{ display: 'flex', padding: '2px 10px 12px' }}>
      {days.map(off => {
        const d = new Date(); d.setDate(d.getDate() + off);
        const isSel = off === sel, isToday = off === 0, future = off > 0;
        const hasLog = FOOD_LOGGED.has(off);
        return (
          <button key={off} onClick={() => onSel(off)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', opacity: future ? 0.5 : 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: isSel ? FS.primary : FS.muted }}>{WK[d.getDay()]}</span>
            <span style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600,
              background: isSel ? FS.primary : 'transparent', color: isSel ? '#fff' : FS.text,
              border: isToday && !isSel ? `1.5px solid ${FS.primary}` : '1.5px solid transparent' }}>
              {d.getDate()}
            </span>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: hasLog ? FS.primary : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

function MonthCalendar({ sel, onPick, onClose }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const selDate = new Date(today); selDate.setDate(today.getDate() + sel);
  const [view, setView] = React.useState({ y: selDate.getFullYear(), m: selDate.getMonth() });
  const offsetOf = (d) => Math.round((d - today) / 86400000);
  const first = new Date(view.y, view.m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const WK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const shiftMonth = (dir) => setView(v => {
    const m = v.m + dir;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });
  const navBtn = { width: 34, height: 34, borderRadius: 999, background: FS.surfaceHigh, border: 'none', color: FS.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 96 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'calc(100% - 32px)', maxWidth: 360, background: FS.surface, border: `1px solid ${FS.border}`, borderRadius: 20, padding: 16, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => shiftMonth(-1)} style={navBtn}><Icon name="chevron-left" size={20} /></button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} style={navBtn}><Icon name="chevron-right" size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {WK.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: FS.muted, padding: '4px 0' }}>{w}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const date = new Date(view.y, view.m, d);
            const off = offsetOf(date);
            const isSel = off === sel, isToday = off === 0, future = off > 0;
            const hasLog = FOOD_LOGGED.has(off);
            return (
              <button key={i} onClick={() => onPick(off)}
                style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, border: isToday && !isSel ? `1.5px solid ${FS.primary}` : '1.5px solid transparent', background: isSel ? FS.primary : 'transparent', color: isSel ? '#fff' : FS.text, fontSize: 14, fontWeight: isSel || isToday ? 700 : 500, cursor: 'pointer', fontFamily: FS.font, opacity: future ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {d}
                <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 999, background: hasLog && !isSel ? FS.primary : 'transparent' }} />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${FS.border}` }}>
          <button onClick={() => onPick(0)} style={{ background: 'none', border: 'none', color: FS.primary, fontSize: 14, fontWeight: 600, fontFamily: FS.font, cursor: 'pointer' }}>Today</button>
          <button onClick={onClose} style={{ background: FS.surfaceHigh, border: 'none', color: FS.text, fontSize: 14, fontWeight: 500, fontFamily: FS.font, cursor: 'pointer', padding: '8px 18px', borderRadius: 10 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

const FOOD_MEALS = [
  { key: 'BREAKFAST', label: 'Breakfast', icon: 'coffee', items: [['Oatmeal with berries', '120 g', 210], ['Greek yogurt', '1 × 170g', 145], ['Black coffee', '1 cup', 5]] },
  { key: 'LUNCH', label: 'Lunch', icon: 'sun', items: [['Chicken Cobb salad', '1 serving', 520], ['Whole-grain roll', '1 × 60g', 160]] },
  { key: 'DINNER', label: 'Dinner', icon: 'moon', items: [['Chicken Stir Fry', '1 serving', 520]] },
  { key: 'SNACK', label: 'Snacks', icon: 'cookie', items: [['Protein shake', '1 scoop', 44]] },
];

// ── Food / Today ───────────────────────────────────────────────────────────────
function FoodTodayView({ openSheet }) {
  const [open, setOpen] = React.useState({ BREAKFAST: true, LUNCH: true, DINNER: false, SNACK: false });
  const [sel, setSel] = React.useState(0);
  const [showCal, setShowCal] = React.useState(false);
  const goal = 2000;
  const totals = FOOD_MEALS.reduce((a, m) => a + m.items.reduce((s, it) => s + it[2], 0), 0);
  const remaining = goal - totals;
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: FS.bg }}>
      <div style={{ background: FS.surface, borderBottom: `1px solid ${FS.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
          <button onClick={() => setSel(s => s - 1)} style={{ background: 'none', border: 'none', color: FS.muted, cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="chevron-left" size={24} /></button>
          <button onClick={() => setShowCal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: FS.text, fontFamily: FS.font }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>{fsDayLabel(sel)}</span>
              <Icon name="calendar" size={14} color={FS.muted} />
            </div>
            <span style={{ fontSize: 12, color: FS.muted }}>{fsDateSub(sel)}</span>
          </button>
          <button onClick={() => setSel(s => s + 1)} style={{ background: 'none', border: 'none', color: FS.muted, cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="chevron-right" size={24} /></button>
        </div>
        <WeekStrip sel={sel} onSel={setSel} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px 16px' }}>
          <CalorieRing eaten={totals} goal={goal} size={120} strokeWidth={9} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MacroBar label="Protein" value={112} target={150} color={FS.protein} />
            <MacroBar label="Carbs" value={125} target={200} color={FS.carbs} />
            <MacroBar label="Fat" value={48} target={65} color={FS.fat} />
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, padding: '6px 0', borderTop: `1px solid ${FS.border}`, color: remaining < 0 ? FS.danger : FS.muted }}>
          {remaining < 0 ? `${Math.abs(remaining)} kcal over goal` : `${remaining} kcal remaining`}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '16px 16px 90px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FOOD_MEALS.map(m => {
          const cals = m.items.reduce((s, it) => s + it[2], 0);
          const isOpen = open[m.key];
          return (
            <div key={m.key} style={{ background: FS.surface, borderRadius: 16, flexShrink: 0 }}>
              <div onClick={() => setOpen(o => ({ ...o, [m.key]: !o[m.key] }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={m.icon} size={16} color={FS.muted} />
                  <span style={{ fontWeight: 500 }}>{m.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, color: FS.muted }}>{cals} kcal</span>
                  <span style={{ display: 'flex', alignItems: 'center', transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <Icon name="chevron-down" size={14} color={FS.muted} />
                  </span>
                  <button onClick={e => { e.stopPropagation(); openSheet(); }} style={{ width: 28, height: 28, borderRadius: 999, background: FS.primary + '33', color: FS.primary, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ overflow: 'hidden' }}>
                  {m.items.length > 0 && (
                    <div style={{ borderTop: `1px solid ${FS.border}` }}>
                      {m.items.map((it, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '10px 16px', borderTop: i ? `1px solid ${FS.border}` : 'none' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{it[0]}</p>
                            <p style={{ fontSize: 12, color: FS.muted, margin: 0 }}>{it[1]}</p>
                          </div>
                          <span style={{ fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>{it[2]} kcal</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {showCal && <MonthCalendar sel={sel} onPick={(off) => { setSel(off); setShowCal(false); }} onClose={() => setShowCal(false)} />}
    </div>
  );
}

// ── Food / Recipes ─────────────────────────────────────────────────────────────
const RECIPES = [
  { name: 'Chicken Stir Fry', cal: 520, p: 42, c: 38, f: 14, time: '25 min', servings: 2 },
  { name: 'Overnight Oats', cal: 380, p: 18, c: 55, f: 9, time: '5 min', servings: 1 },
  { name: 'Tuna Salad Wrap', cal: 440, p: 38, c: 32, f: 16, time: '10 min', servings: 1 },
  { name: 'Protein Pancakes', cal: 320, p: 28, c: 30, f: 8, time: '15 min', servings: 1 },
  { name: 'Greek Chicken Bowl', cal: 580, p: 45, c: 52, f: 14, time: '20 min', servings: 2 },
  { name: 'Egg White Omelette', cal: 220, p: 26, c: 4, f: 10, time: '10 min', servings: 1 },
];

function FoodRecipesView({ openSheet }) {
  const [query, setQuery] = React.useState('');
  const filtered = RECIPES.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: FS.bg }}>
    <div style={{ padding: '16px 16px 90px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: FS.surface, borderRadius: 12, padding: '10px 14px', border: `1px solid ${FS.border}` }}>
          <Icon name="search" size={16} color={FS.muted} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipes…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: FS.text, fontFamily: FS.font }} />
        </div>
        <Button onClick={openSheet} style={{ borderRadius: 12, padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 13 }}>+ New</Button>
      </div>
      {filtered.map((r, i) => (
        <div key={i} style={{ background: FS.surface, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{r.name}</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 12, color: FS.muted }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={12} />{r.time}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="users" size={12} />{r.servings} serving{r.servings > 1 ? 's' : ''}</span>
              </div>
            </div>
            <Badge tone="primary">{r.cal} kcal</Badge>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['P', r.p + 'g', FS.protein], ['C', r.c + 'g', FS.carbs], ['F', r.f + 'g', FS.fat]].map(([l, v, c]) => (
              <div key={l} style={{ flex: 1, background: FS.surfaceHigh, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: c, fontWeight: 700, margin: '0 0 2px', letterSpacing: '.04em' }}>{l}</p>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
          <button style={{ background: 'none', border: `1px solid ${FS.border}`, borderRadius: 8, padding: '8px 0', color: FS.primary, fontSize: 13, fontWeight: 600, fontFamily: FS.font, cursor: 'pointer' }}>
            Log Serving
          </button>
        </div>
      ))}
    </div>
    </div>
  );
}

// ── Food / Trends ──────────────────────────────────────────────────────────────
const TREND_DATA = {
  '7d':  [1820, 2010, 1640, 1980, 2100, 1604, 0],
  '30d': [1820, 1950, 1640, 2100, 1890, 1750, 1600, 1980, 2050, 1720, 1840, 2000, 1650, 1910, 1780, 2030, 1700, 1850, 1920, 1660, 2080, 1740, 1890, 1810, 1950, 1680, 1770, 1930, 1850, 0],
  '90d': [1810,1940,1720,1880,2030,1760,1650,1920,1840,1780,2010,1700,1860,1950,1740,1820,1990,1670,1830,2060,1750,1910,1840,1780,2020,1700,1860,1940,1730,1880,1820,1960,1710,1870,2040,1760,1820,1890,1740,1810,2000,1680,1850,1930,1770,1820,1990,1710,1870,2050,1740,1820,1900,1760,1830,1980,1720,1880,1940,1760,1810,1970,1710,1860,2030,1750,1820,1890,1740,1800,1970,1720,1870,2040,1760,1820,1890,1740,1810,1970,1720,1870,2030,1750,1820,1890,1740,1810,1870,0],
};

function FoodTrendsView() {
  const [period, setPeriod] = React.useState('7d');
  const current = TREND_DATA[period];
  const goal = 2000;
  const filled = current.filter(v => v > 0);
  const avg = Math.round(filled.reduce((a, b) => a + b, 0) / (filled.length || 1));
  const maxV = Math.max(...current, goal + 200);
  const labels7 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const status = avg > goal * 1.05 ? { label: 'Slightly over', color: FS.danger } : avg < goal * 0.85 ? { label: 'Under target', color: FS.warning } : { label: 'On track', color: FS.success };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: FS.bg }}>
    <div style={{ padding: '16px 16px 90px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, background: FS.surface, padding: 4, borderRadius: 10, border: `1px solid ${FS.border}` }}>
        {[['7d', '7 Day'], ['30d', '30 Day'], ['90d', '90 Day']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FS.font, fontSize: 13, fontWeight: 500,
            background: period === k ? FS.primary : 'transparent', color: period === k ? '#fff' : FS.muted }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[['Avg', avg.toLocaleString() + ' cal'], ['Goal', goal.toLocaleString() + ' cal'], ['Logged', filled.length + ' / ' + current.length + 'd']].map(([l, v]) => (
          <div key={l} style={{ background: FS.surface, borderRadius: 14, padding: '10px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: FS.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Calorie Intake</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.label}</span>
        </div>
        <div style={{ position: 'relative', height: 80 }}>
          <div style={{ position: 'absolute', bottom: `${(goal / maxV) * 80}px`, left: 0, right: 0, borderTop: `1.5px dashed ${FS.primary}`, opacity: 0.4 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === '7d' ? '6%' : period === '30d' ? 3 : 1, height: '100%' }}>
            {current.map((v, i) => (
              <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(v > 0 ? v / maxV * 100 : 0, v > 0 ? 4 : 0)}%`, borderRadius: '2px 2px 0 0',
                  background: v === 0 ? FS.surfaceHigh : v > goal * 1.1 ? FS.danger : FS.primary, opacity: v === 0 ? 0.4 : 0.85 }} />
              </div>
            ))}
          </div>
        </div>
        {period === '7d' && (
          <div style={{ display: 'flex', gap: '6%', marginTop: 8 }}>
            {labels7.map((l, i) => <span key={i} style={{ flex: 1, fontSize: 10, color: FS.muted, textAlign: 'center' }}>{l}</span>)}
          </div>
        )}
      </div>

      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Avg Macro Split</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MacroBar label="Protein" value={112} target={150} color={FS.protein} />
          <MacroBar label="Carbs" value={125} target={200} color={FS.carbs} />
          <MacroBar label="Fat" value={48} target={65} color={FS.fat} />
        </div>
      </div>
    </div>
    </div>
  );
}

// ── Food / Goals ───────────────────────────────────────────────────────────────
function FoodGoalsView() {
  const [goals, setGoals] = React.useState({ calories: 2000, protein: 150, carbs: 200, fat: 65 });
  const macroKcal = goals.protein * 4 + goals.carbs * 4 + goals.fat * 9;
  const pPct = Math.round(goals.protein * 4 / macroKcal * 100);
  const cPct = Math.round(goals.carbs * 4 / macroKcal * 100);
  const fPct = 100 - pPct - cPct;
  const diff = macroKcal - goals.calories;

  const Stepper = ({ label, value, field, unit, step, min, max }) => (
    <div style={{ background: FS.surface, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, color: FS.muted, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{value}<span style={{ fontSize: 13, color: FS.muted, fontWeight: 400, marginLeft: 4 }}>{unit}</span></p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[1, -1].map(dir => (
          <button key={dir} onClick={() => setGoals(g => ({ ...g, [field]: Math.min(Math.max(g[field] + dir * step, min), max) }))}
            style={{ width: 36, height: 36, borderRadius: 8, background: FS.surfaceHigh, border: 'none', cursor: 'pointer', color: FS.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={dir === 1 ? 'plus' : 'minus'} size={16} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: FS.bg }}>
    <div style={{ padding: '16px 16px 90px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: FS.surface, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Macro Split</p>
        <div style={{ height: 10, borderRadius: 99, overflow: 'hidden', display: 'flex', gap: 2 }}>
          <div style={{ flex: pPct, background: FS.protein, borderRadius: 99 }} />
          <div style={{ flex: cPct, background: FS.carbs }} />
          <div style={{ flex: fPct, background: FS.fat, borderRadius: 99 }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          {[['Protein', pPct + '%', FS.protein], ['Carbs', cPct + '%', FS.carbs], ['Fat', fPct + '%', FS.fat]].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: FS.muted }}>{l} <strong style={{ color: FS.text }}>{v}</strong></span>
            </div>
          ))}
        </div>
      </div>

      <Stepper label="Daily Calories" value={goals.calories} field="calories" unit="kcal" step={50} min={1000} max={5000} />
      <Stepper label="Protein" value={goals.protein} field="protein" unit="g/day" step={5} min={50} max={300} />
      <Stepper label="Carbohydrates" value={goals.carbs} field="carbs" unit="g/day" step={5} min={50} max={500} />
      <Stepper label="Fat" value={goals.fat} field="fat" unit="g/day" step={2} min={20} max={200} />

      <p style={{ fontSize: 12, color: diff === 0 ? FS.success : FS.warning, textAlign: 'center', margin: '0' }}>
        {macroKcal.toLocaleString()} kcal from macros · {Math.abs(diff)} kcal {diff > 0 ? 'over' : 'under'} goal
      </p>
      <Button full style={{ borderRadius: 14, padding: 14 }}>Save Goals</Button>
    </div>
    </div>
  );
}

// ── Food (router) ──────────────────────────────────────────────────────────────
function FoodScreen({ subTab, openSheet }) {
  const tab = subTab || 'today';
  if (tab === 'recipes') return <FoodRecipesView openSheet={openSheet} />;
  if (tab === 'trends') return <FoodTrendsView />;
  if (tab === 'goals') return <FoodGoalsView />;
  return <FoodTodayView openSheet={openSheet} />;
}

// ── Settings ───────────────────────────────────────────────────────────────────
function SettingsScreen({ onLogout }) {
  const [unit, setUnit] = React.useState('IMPERIAL');
  const divider = { borderTop: `1px solid ${FS.border}` };
  const Group = ({ header, children }) => (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: FS.muted, padding: '0 4px 8px', margin: 0 }}>{header}</p>
      <div style={{ background: FS.surface, borderRadius: 16 }}>{children}</div>
    </div>
  );
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 20, background: FS.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 4px' }}>
        <Icon name="user-circle" size={52} stroke={1.25} color={FS.muted} />
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Alex</p>
          <p style={{ fontSize: 13, color: FS.muted, margin: 0 }}>alex@home.local</p>
        </div>
      </div>
      <Group header="Preferences">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <Icon name="scale" size={20} color={FS.primary} />
          <span style={{ flex: 1, fontSize: 14 }}>Units</span>
          <div style={{ display: 'inline-flex', background: FS.surfaceHigh, borderRadius: 8, padding: 2, fontSize: 12 }}>
            {['METRIC', 'IMPERIAL'].map(u => (
              <button key={u} onClick={() => setUnit(u)} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: FS.font, textTransform: 'capitalize',
                background: unit === u ? FS.primary : 'transparent', color: unit === u ? '#fff' : FS.muted }}>{u.toLowerCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ ...divider, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <Icon name="target" size={20} color={FS.primary} /><span style={{ flex: 1, fontSize: 14 }}>Goals</span><Icon name="chevron-right" size={16} color={FS.muted} />
        </div>
        <div style={{ ...divider, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <Icon name="heart" size={20} color={FS.primary} /><span style={{ flex: 1, fontSize: 14 }}>Apple Health</span><Icon name="chevron-right" size={16} color={FS.muted} />
        </div>
      </Group>
      <Group header="Tools">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <Icon name="flame" size={20} color={FS.primary} /><span style={{ flex: 1, fontSize: 14 }}>TDEE Calculator</span><Icon name="chevron-right" size={16} color={FS.muted} />
        </div>
      </Group>
      <Button variant="neutral" full onClick={onLogout} style={{ color: FS.danger }}>Sign Out</Button>
    </div>
  );
}

Object.assign(window, { LoginScreen, DashboardScreen, FoodScreen, SettingsScreen });
