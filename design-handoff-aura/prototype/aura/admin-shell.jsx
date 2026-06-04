// ============================================================
// AURA — Admin · Shell (sidebar) + gráficas reutilizables
// ============================================================
const { useState: useStateAd } = React;

const ADMIN_NAV = [
  { id: 'admin-dashboard', label: 'Dashboard', icon: 'grid', match: ['admin-dashboard'] },
  { id: 'admin-clients', label: 'Clientes', icon: 'users', match: ['admin-clients', 'admin-client'] },
  { id: 'admin-content', label: 'Contenido', icon: 'book', match: ['admin-content', 'admin-program', 'admin-editor'] },
  { id: 'admin-messages', label: 'Mensajes', icon: 'chat', match: ['admin-messages'] },
  { id: 'admin-onboarding', label: 'Onboarding', icon: 'clipboard', match: ['admin-onboarding'] },
];

function AdminSidebar() {
  const app = useApp();
  return (
    <div style={{ width: 232, flexShrink: 0, background: '#1a1a1a', height: '100%', display: 'flex', flexDirection: 'column', padding: '22px 14px' }}>
      <div style={{ padding: '0 8px 24px' }}><Logo height={26} mono style={{ filter: 'brightness(0) invert(1)', opacity: .95 }} /></div>
      <div style={{ flex: 1 }}>
        {ADMIN_NAV.map(n => {
          const on = n.match.includes(app.screen);
          return (
            <button key={n.id} onClick={() => app.go(n.id)} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              background: on ? 'var(--lavanda)' : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,.62)',
              padding: '11px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4,
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, transition: 'all .15s ease' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
              <Icon name={n.icon} size={20} /> {n.label}
            </button>
          );
        })}
      </div>
      <div className="row gap-10" style={{ alignItems: 'center', padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <Avatar name="Aura Maristany" size={36} lavanda />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13 }}>Aura Maristany</div>
          <button onClick={() => app.go('login')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}

function AdminShell({ children, scroll = true }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--gris-claro)' }}>
      <AdminSidebar />
      <div className={scroll ? 'scroll-y' : ''} style={{ flex: 1, height: '100%', overflow: scroll ? 'auto' : 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function AdminHeader({ title, sub, right }) {
  return (
    <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 24 }}>
      <div>
        <h1 className="t-display" style={{ fontSize: 30 }}>{title}</h1>
        {sub && <p className="t-small" style={{ marginTop: 4 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Gráfica de barras ----------
function AdminBarChart({ data, height = 220 }) {
  const [hover, setHover] = useStateAd(null);
  const max = Math.max(...data.map(d => d.valor));
  const niceMax = Math.ceil(max / 5000) * 5000;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height, position: 'relative', padding: '20px 0 0' }}>
        {[0.25, 0.5, 0.75, 1].map(g => (
          <div key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: `${24 + g * (height - 44)}px`, borderTop: '1px solid #efe9e8' }}>
            <span style={{ position: 'absolute', left: 0, top: -8, fontSize: 10, color: 'var(--gris-suave)', fontFamily: 'var(--font-body)', background: '#fff', paddingRight: 4 }}>{Math.round(niceMax * g / 1000)}K</span>
          </div>
        ))}
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div style={{ position: 'absolute', top: -6, background: 'var(--negro)', color: '#fff', padding: '5px 9px', borderRadius: 7, fontSize: 11.5, fontFamily: 'var(--font-body)', fontWeight: 600, whiteSpace: 'nowrap', zIndex: 2 }}>
                {d.mes} · MX${d.valor.toLocaleString('es-MX')}
              </div>
            )}
            <div style={{ width: '100%', maxWidth: 46, height: `${(d.valor / niceMax) * (height - 44)}px`, background: hover === i ? 'var(--lavanda-dark)' : 'var(--lavanda)', borderRadius: '6px 6px 0 0', transition: 'all .2s ease' }} />
            <span style={{ marginTop: 8, fontSize: 12, color: 'var(--gris-texto)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{d.mes}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Donut ----------
function AdminDonut({ data, size = 150 }) {
  const total = data.reduce((s, d) => s + d.valor, 0);
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="row gap-20" style={{ alignItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        {data.map((d, i) => {
          const frac = d.valor / total;
          const dash = frac * C;
          const seg = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="20"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />;
          acc += frac;
          return seg;
        })}
      </svg>
      <div className="col gap-10">
        {data.map((d, i) => (
          <div key={i} className="row gap-8" style={{ alignItems: 'center' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span className="t-small" style={{ fontWeight: 600, color: 'var(--negro)' }}>{d.nombre}</span>
            <span className="t-small">· MX${d.valor.toLocaleString('es-MX')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { AdminShell, AdminHeader, AdminBarChart, AdminDonut, ADMIN_NAV });
