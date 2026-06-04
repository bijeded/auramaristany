// ============================================================
// AURA — App shell · navegación, store, riel de revisión
// ============================================================
const { useState, useRef, useCallback } = React;

const SCREENS = {
  cliente: [
    { id: 'checkout', label: 'Checkout / Programa', ruta: '/checkout' },
    { id: 'login', label: 'Iniciar sesión', ruta: '/auth/login' },
    { id: 'register', label: 'Registro', ruta: '/auth/register' },
    { id: 'reset', label: 'Recuperar contraseña', ruta: '/auth/reset' },
    { id: 'onboarding', label: 'Onboarding', ruta: '/onboarding' },
  ],
  portal: [
    { id: 'today', label: 'Hoy', ruta: '/portal/today' },
    { id: 'progress', label: 'Mi Progreso', ruta: '/portal/history' },
    { id: 'messages', label: 'Mensajes', ruta: '/portal/messages' },
    { id: 'settings', label: 'Mi Cuenta', ruta: '/portal/settings' },
  ],
  admin: [
    { id: 'admin-dashboard', label: 'Dashboard', ruta: '/admin/dashboard' },
    { id: 'admin-clients', label: 'Clientes', ruta: '/admin/clients' },
    { id: 'admin-client', label: 'Detalle de cliente', ruta: '/admin/clients/:id' },
    { id: 'admin-content', label: 'Contenido', ruta: '/admin/content' },
    { id: 'admin-program', label: 'Contenido · Programa', ruta: '/admin/content/:id' },
    { id: 'admin-editor', label: 'Editor de día (CMS)', ruta: '/admin/.../day' },
    { id: 'admin-messages', label: 'Mensajes', ruta: '/admin/messages' },
    { id: 'admin-onboarding', label: 'Config. onboarding', ruta: '/admin/onboarding' },
  ],
};

const CLIENT_SCREENS = new Set(['checkout', 'login', 'register', 'reset', 'onboarding', 'today', 'progress', 'messages', 'settings', 'today-compare']);

const STATE_OPTIONS = {
  checkout: [['normal', 'Normal'], ['error', 'Error de prerequisito']],
  login: [['normal', 'Normal'], ['error', 'Credenciales inválidas']],
  register: [['normal', 'Formulario'], ['exito', 'Revisa tu correo']],
  reset: [['paso1', 'Paso 1 · Solicitar'], ['paso2', 'Paso 2 · Confirmación'], ['paso3', 'Paso 3 · Nueva clave']],
};

function Placeholder({ label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gris-suave)',
      flexDirection: 'column', gap: 10, padding: 40, textAlign: 'center' }}>
      <Icon name="sparkle" size={30} color="var(--rosa-deep)" />
      <div className="t-small">Pantalla «{label}» — en construcción</div>
    </div>
  );
}

// Mapa de renderers (se rellena conforme se construyen las pantallas)
function ScreenRouter({ screen }) {
  const R = window.AURA_SCREENS || {};
  const Comp = R[screen];
  if (Comp) return <Comp />;
  return <Placeholder label={screen} />;
}

// ---------- Riel de revisión ----------
function NavGroup({ title, items, screen, go }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 11, letterSpacing: '1.2px',
        textTransform: 'uppercase', color: '#9a8f8d', padding: '0 14px 7px' }}>{title}</div>
      {items.map(it => {
        const on = screen === it.id;
        return (
          <button key={it.id} onClick={() => go(it.id)} style={{ width: '100%', textAlign: 'left', border: 'none',
            background: on ? 'var(--lavanda)' : 'transparent', color: on ? '#fff' : '#3a3a3a', cursor: 'pointer',
            padding: '8px 14px', borderRadius: 9, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 1,
            transition: 'background .15s ease' }}
            onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#efe9e8'; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5 }}>{it.label}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, opacity: on ? 0.8 : 0.5 }}>{it.ruta}</span>
          </button>
        );
      })}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: '#efe9e8', borderRadius: 9, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, border: 'none', cursor: 'pointer',
          background: value === o.value ? '#fff' : 'transparent', color: value === o.value ? 'var(--negro)' : '#8a7f7d',
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, padding: '7px 4px', borderRadius: 7,
          boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,.1)' : 'none', transition: 'all .15s ease' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ReviewRail() {
  const app = useApp();
  const { screen, go } = app;
  const onToday = screen === 'today';
  return (
    <div style={{ width: 264, flexShrink: 0, background: '#faf7f6', borderRight: '1px solid #ece5e4',
      height: '100vh', overflowY: 'auto', padding: '20px 12px', position: 'sticky', top: 0 }}>
      <div style={{ padding: '0 8px 18px' }}>
        <Logo height={26} />
        <div className="t-tiny" style={{ color: '#a89c9a', marginTop: 8, letterSpacing: '.4px' }}>PROTOTIPO INTERACTIVO · 17 PANTALLAS</div>
      </div>

      <NavGroup title="Flujo de cliente" items={SCREENS.cliente} screen={screen} go={go} />
      <NavGroup title="Portal cliente" items={SCREENS.portal} screen={screen} go={go} />
      <NavGroup title="Panel admin" items={SCREENS.admin} screen={screen} go={go} />

      {STATE_OPTIONS[screen] && (
        <div style={{ background: '#fff', border: '1px solid #ece5e4', borderRadius: 12, padding: 14, margin: '4px 6px 0' }}>
          <div className="t-tiny" style={{ color: 'var(--lavanda-dark)', marginBottom: 10, letterSpacing: '.5px' }}>ESTADO DE LA PANTALLA</div>
          <div className="col gap-6">
            {STATE_OPTIONS[screen].map(([v, l]) => (
              <button key={v} onClick={() => app.setDemo(screen, v)} style={{ textAlign: 'left', border: '1px solid',
                borderColor: app.demoState[screen] === v ? 'var(--lavanda)' : 'var(--gris-linea)', background: app.demoState[screen] === v ? 'var(--lavanda-tint)' : '#fff',
                color: app.demoState[screen] === v ? 'var(--lavanda-dark)' : 'var(--gris-texto)', borderRadius: 8, padding: '8px 12px',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5 }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {onToday && (
        <div style={{ background: '#fff', border: '1px solid #ece5e4', borderRadius: 12, padding: 14, margin: '4px 6px 0' }}>
          <div className="t-tiny" style={{ color: 'var(--lavanda-dark)', marginBottom: 10, letterSpacing: '.5px' }}>ESTADO DE LA PANTALLA</div>
          <div className="col gap-6">
            {[['normal', 'Normal'], ['descanso', 'Día de descanso'], ['nodisp', 'No disponible aún'], ['pastdue', 'Suscripción vencida']].map(([v, l]) => (
              <button key={v} onClick={() => app.setTodayState(v)} style={{ textAlign: 'left', border: '1px solid',
                borderColor: app.todayState === v ? 'var(--lavanda)' : 'var(--gris-linea)', background: app.todayState === v ? 'var(--lavanda-tint)' : '#fff',
                color: app.todayState === v ? 'var(--lavanda-dark)' : 'var(--gris-texto)', borderRadius: 8, padding: '8px 12px',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5 }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Comparador de 3 estilos (pantalla Hoy) ----------
function TodayCompare() {
  const app = useApp();
  const labels = { a: 'Editorial · checklist', b: 'Tarjetas apiladas', c: 'Compacto · acordeón' };
  return (
    <div style={{ display: 'flex', gap: 40, padding: '20px 8px', alignItems: 'flex-start' }}>
      {['a', 'b', 'c'].map(v => (
        <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 16, color: '#3a3a3a' }}>Opción {v.toUpperCase()}</div>
            <div className="t-small">{labels[v]}</div>
          </div>
          <Phone>
            <TodayScreenScoped variant={v} />
          </Phone>
        </div>
      ))}
    </div>
  );
}
// Versión de Today fijada a una variante (para el comparador)
function TodayScreenScoped({ variant }) {
  const app = useApp();
  const prev = app.exStyle;
  // renderiza Today forzando exStyle vía override temporal del contexto
  return (
    <AppCtx.Provider value={{ ...app, exStyle: variant, todayState: 'normal' }}>
      <TodayScreen />
    </AppCtx.Provider>
  );
}

// ============================================================
//   APP
// ============================================================
function App() {
  const [screen, setScreen] = useState('today');
  const [store, setStore] = useState({
    checked: {}, exVals: {}, notas: '', saved: false,
    onboardingStep: 0, onboardingAns: {},
    msgOpen: null, progressTab: 'metricas', metric: 'peso', period: 'todo',
    adminClientId: 'c1', adminClientTab: 'resumen', adminProgramId: 'p1',
  });
  const [toastMsg, setToastMsg] = useState(null);
  const [exStyle, setExStyle] = useState('b');
  const [todayState, setTodayState] = useState('normal');
  const [demoState, setDemoState] = useState({ checkout: 'normal', login: 'normal', register: 'normal', reset: 'paso1' });
  const setDemo = useCallback((k, v) => setDemoState(s => ({ ...s, [k]: v })), []);

  const toastTimer = useRef(null);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const update = useCallback((fn) => setStore(s => ({ ...s, ...fn(s) })), []);
  const go = useCallback((id) => { setScreen(id); }, []);

  const ctx = { screen, go, store, update, toast, exStyle, setExStyle, todayState, setTodayState, setStore, demoState, setDemo };

  const isClient = CLIENT_SCREENS.has(screen);
  const compare = screen === 'today-compare';

  return (
    <AppCtx.Provider value={ctx}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#ece7e6' }}>
        <ReviewRail />
        <div style={{ flex: 1, overflow: 'auto', height: '100vh' }}>
          <div style={{ minHeight: '100%', minWidth: 'min-content', display: 'flex', alignItems: compare ? 'flex-start' : 'center',
            justifyContent: 'center', padding: compare ? '24px' : '32px 24px', boxSizing: 'border-box' }}>
            {compare ? (
              <TodayCompare />
            ) : isClient ? (
              <Phone>
                <ToastHost toast={toastMsg} />
                <ScreenRouter screen={screen} />
              </Phone>
            ) : (
              <Browser url={'app.auramaristany.com' + (SCREENS.admin.find(s => s.id === screen)?.ruta || '')}>
                <ToastHost toast={toastMsg} />
                <ScreenRouter screen={screen} />
              </Browser>
            )}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  );
}

// Registro de pantallas conocidas
window.AURA_SCREENS = Object.assign(window.AURA_SCREENS || {}, {
  checkout: window.CheckoutScreen,
  login: window.LoginScreen,
  register: window.RegisterScreen,
  reset: window.ResetScreen,
  onboarding: window.OnboardingScreen,
  today: window.TodayScreen,
  progress: window.ProgressScreen,
  messages: window.MessagesScreen,
  settings: window.SettingsScreen,
  'today-compare': TodayCompare,
  'admin-dashboard': window.AdminDashboard,
  'admin-clients': window.AdminClients,
  'admin-client': window.AdminClientDetail,
  'admin-content': window.AdminContent,
  'admin-program': window.AdminProgram,
  'admin-editor': window.AdminEditor,
  'admin-messages': window.AdminMessages,
  'admin-onboarding': window.AdminOnboarding,
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
