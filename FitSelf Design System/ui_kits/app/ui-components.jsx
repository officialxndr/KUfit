/* FitSelf UI Kit — shared primitives, tokens, and signature components.
   Recreates the FitSelf mobile app look (dark-first, indigo accent, lucide icons).
   Source of truth: officialxndr/health-app (apps/web/src). */

// ── Design tokens (dark theme — the product default) ───────────────────────────
const FS = {
  bg: '#0a0a0a', surface: '#141414', surfaceHigh: '#1e1e1e', border: '#2a2a2a',
  text: '#f9f9f9', muted: '#6b7280',
  primary: '#6366f1', primaryHover: '#818cf8',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  protein: '#6366f1', carbs: '#f59e0b', fat: '#ec4899',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

// ── lucide Icon helper — builds an SVG from the lucide UMD icon node ────────────
function fsPascal(name) {
  return name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}
function Icon({ name, size = 24, stroke = 2, color = 'currentColor', style, className }) {
  const node = (window.lucide && window.lucide.icons) ? window.lucide.icons[fsPascal(name)] : null;
  const inner = node ? node.map(([tag, attrs]) => {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a} />`;
  }).join('') : '';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: inner }} />
  );
}

// ── Button ─────────────────────────────────────────────────────────────────────
function Button({ children, variant = 'primary', full, onClick, disabled, style }) {
  const [press, setPress] = React.useState(false);
  const base = {
    primary: { background: FS.primary, color: '#fff' },
    success: { background: FS.success, color: '#fff' },
    neutral: { background: FS.surfaceHigh, color: FS.text },
    ghost:   { background: 'transparent', color: FS.primary },
    danger:  { background: FS.danger, color: '#fff' },
  }[variant];
  return (
    <button onClick={disabled ? undefined : onClick}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{
        ...base, border: 'none', fontFamily: FS.font, fontWeight: 600, fontSize: 14,
        padding: '12px 20px', borderRadius: 14, width: full ? '100%' : undefined,
        opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer',
        transform: press && !disabled ? 'scale(0.97)' : 'scale(1)', transition: 'transform .1s ease',
        ...style,
      }}>
      {children}
    </button>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, onClick, outlined, style }) {
  return (
    <div onClick={onClick} style={{
      background: FS.surface, borderRadius: 16, padding: 16,
      border: outlined ? `1px solid ${FS.border}` : 'none',
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

// ── Badge (tinted status wash) ─────────────────────────────────────────────────
function Badge({ children, tone = 'primary', icon }) {
  const c = { success: FS.success, warning: FS.warning, danger: FS.danger, primary: FS.primary }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999,
      padding: '4px 12px', fontSize: 12, fontWeight: 600, color: c,
      background: c + '1a',
    }}>
      {icon && <Icon name={icon} size={14} />}{children}
    </span>
  );
}

// ── Calorie ring ───────────────────────────────────────────────────────────────
function CalorieRing({ eaten, goal, size = 130, strokeWidth = 10 }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const dash = pct * circ;
  const color = pct < 0.75 ? FS.success : pct < 0.95 ? FS.warning : FS.danger;
  const cx = size / 2, cy = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={FS.border} strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(eaten).toLocaleString()}</div>
        <div style={{ fontSize: 12, color: FS.muted }}>/ {goal.toLocaleString()} kcal</div>
      </div>
    </div>
  );
}

// ── Macro bar ──────────────────────────────────────────────────────────────────
function MacroBar({ label, value, target, color }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: FS.muted }}>{label}</span>
        <span>{Math.round(value)}g / {target}g</span>
      </div>
      <div style={{ height: 6, background: FS.surfaceHigh, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}

// ── App header (section dropdown + profile) ────────────────────────────────────
function AppHeader({ section, onOpenSettings, sections, onSwitch }) {
  const [open, setOpen] = React.useState(false);
  const s = sections.find(x => x.key === section) || sections[0];
  return (
    <div style={{ background: FS.surface, borderBottom: `1px solid ${FS.border}`, paddingTop: 50, position: 'relative', zIndex: 30, flexShrink: 0 }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', color: FS.text, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18, fontFamily: FS.font, cursor: 'pointer' }}>
          <Icon name={s.icon} size={20} color={FS.primary} />{s.label}
          <Icon name="chevron-down" size={16} color={FS.muted} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', color: FS.muted, cursor: 'pointer', display: 'flex' }}>
          <Icon name="user-circle" size={28} />
        </button>
      </div>
      {open && (
        <React.Fragment>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{ position: 'absolute', left: 16, top: '100%', marginTop: 4, zIndex: 40, background: FS.surface, border: `1px solid ${FS.border}`, borderRadius: 16, overflow: 'hidden', minWidth: 208, boxShadow: '0 10px 25px rgba(0,0,0,.45)' }}>
            {sections.map(x => {
              const active = x.key === section;
              return (
                <button key={x.key} onClick={() => { setOpen(false); onSwitch(x.key); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', fontSize: 14, textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: FS.font,
                    background: active ? FS.primary + '1a' : 'transparent', color: active ? FS.primary : FS.text, fontWeight: active ? 600 : 400 }}>
                  <Icon name={x.icon} size={20} />{x.label}
                </button>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ── Bottom nav (contextual tabs + center FAB) ──────────────────────────────────
function BottomNav({ tabs, active, onTab, hasFab, onFab }) {
  const splitAt = Math.ceil(tabs.length / 2);
  const left = tabs.slice(0, splitAt), right = tabs.slice(splitAt);
  const item = (t) => {
    const on = t.key === active;
    return (
      <button key={t.key} onClick={() => onTab(t.key)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0', color: on ? FS.primary : FS.muted, fontFamily: FS.font }}>
        <Icon name={t.icon} size={24} stroke={on ? 2.4 : 2} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>{t.label}</span>
      </button>
    );
  };
  return (
    <div style={{ position: 'relative', flexShrink: 0, background: FS.surface, borderTop: `1px solid ${FS.border}`, paddingBottom: 22 }}>
      {hasFab ? (
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex' }}>{left.map(item)}</div>
          <div style={{ width: 64, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>{right.map(item)}</div>
        </div>
      ) : (
        <div style={{ display: 'flex' }}>{tabs.map(item)}</div>
      )}
      {hasFab && (
        <button onClick={onFab} aria-label="Quick actions" style={{ position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)', width: 56, height: 56, borderRadius: 999, background: FS.primary, border: '4px solid ' + FS.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(99,102,241,.3)' }}>
          <Icon name="plus" size={28} stroke={2.5} />
        </button>
      )}
    </div>
  );
}

// ── Bottom sheet ───────────────────────────────────────────────────────────────
function Sheet({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: FS.surface, borderRadius: '24px 24px 0 0', padding: 24, paddingBottom: 36 }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { FS, Icon, Button, Card, Badge, CalorieRing, MacroBar, AppHeader, BottomNav, Sheet });
