// ============================================================
// AURA — Componentes compartidos. Export a window.
// ============================================================
const { useState, useEffect, useRef, useContext, createContext, useCallback } = React;
const Icon = window.Icon;

// ---- Contexto global de la app (navegación + store) --------
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ---- Logo --------------------------------------------------
function Logo({ height = 30, mono = false, style = {} }) {
  return (
    <img src="aura/assets/logo.png" alt="Aura Maristany"
      style={{ height, width: 'auto', display: 'block',
        filter: mono ? 'grayscale(1) brightness(0)' : 'none', ...style }} />
  );
}
// Wordmark compacto en Oswald (para top bars pequeñas)
function WordMark({ size = 17, color = 'var(--negro)' }) {
  return <span className="font-head" style={{ fontWeight: 600, fontSize: size, letterSpacing: '.5px', color }}>Aura</span>;
}

// ---- Avatar ------------------------------------------------
function Avatar({ name = '', src, size = 38, lavanda = false, style = {} }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className={'avatar' + (lavanda ? ' avatar-lavanda' : '')}
      style={{ width: size, height: size, fontSize: size * 0.4,
        backgroundImage: src ? `url(${src})` : undefined, ...style }}>
      {!src && initials}
    </div>
  );
}

// ---- Badge de estado ---------------------------------------
const STATUS = {
  activa: { cls: 'badge-activa', label: 'Activa' },
  vencida: { cls: 'badge-vencida', label: 'Vencida' },
  past_due: { cls: 'badge-vencida', label: 'Pago fallido' },
  porvencer: { cls: 'badge-porvencer', label: 'Por vencer' },
  cancelada: { cls: 'badge-cancelada', label: 'Cancelada' },
};
function StatusBadge({ status, dot = true }) {
  const s = STATUS[status] || STATUS.activa;
  return <span className={`badge ${s.cls} ${dot ? 'badge-dot' : ''}`}>{s.label}</span>;
}

// ---- Placeholder de imagen ---------------------------------
function ImgPh({ label = 'foto', w = '100%', h = 180, radius = 12, style = {}, children }) {
  return (
    <div className="img-ph" style={{ width: w, height: h, borderRadius: radius, ...style }}>
      {children || <span className="img-ph-label">{label}</span>}
    </div>
  );
}

// ---- Barra de progreso -------------------------------------
function Track({ value = 0, thin = false, gris = false, exito = false, style = {} }) {
  return (
    <div className={`track ${thin ? 'track-thin' : ''} ${gris ? 'track-gris' : ''}`} style={style}>
      <div className={`fill ${exito ? 'fill-exito' : ''}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ---- Checkbox redondo --------------------------------------
function CheckRound({ checked, onChange, size = 26 }) {
  return (
    <button className={'check-round' + (checked ? ' checked' : '')} style={{ width: size, height: size }}
      onClick={(e) => { e.stopPropagation(); onChange && onChange(!checked); }} aria-pressed={checked} aria-label="Completar">
      <Icon name="check-sm" size={size * 0.62} strokeWidth={2.6} />
    </button>
  );
}
function CheckSq({ checked, onChange }) {
  return (
    <button className={'check-sq' + (checked ? ' checked' : '')}
      onClick={(e) => { e.stopPropagation(); onChange && onChange(!checked); }} aria-pressed={checked}>
      {checked && <Icon name="check-sm" size={13} strokeWidth={3} />}
    </button>
  );
}

// ---- Campo de input con label e ícono ----------------------
function Field({ label, icon, trailing, error, hint, type = 'text', as, children, ...props }) {
  const [show, setShow] = useState(false);
  const isPwd = type === 'password';
  const realType = isPwd ? (show ? 'text' : 'password') : type;
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <div style={{ position: 'relative' }}>
        {icon && <span className="field-icon" style={{ top: '50%', transform: 'translateY(-50%)' }}><Icon name={icon} size={19} /></span>}
        {as === 'textarea'
          ? <textarea className={'textarea' + (error ? ' input-error' : '')} {...props} />
          : children
            ? children
            : <input className={'input' + (icon ? ' has-icon' : '') + (error ? ' input-error' : '')} type={realType} {...props} />}
        {isPwd && (
          <button type="button" className="field-trailing" style={{ top: '50%', transform: 'translateY(-50%)' }} onClick={() => setShow(s => !s)} aria-label="Mostrar contraseña">
            <Icon name={show ? 'eye-off' : 'eye'} size={19} />
          </button>
        )}
        {trailing && !isPwd && <span className="field-trailing" style={{ top: '50%', transform: 'translateY(-50%)' }}>{trailing}</span>}
      </div>
      {error && <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>}
      {hint && !error && <div className="field-hint">{hint}</div>}
    </div>
  );
}

// ---- Toast (host) ------------------------------------------
function ToastHost({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast-wrap">
      <div className="toast"><Icon name="check" size={17} strokeWidth={2.6} color="#fff" /> {toast}</div>
    </div>
  );
}

// ---- Skeleton ----------------------------------------------
function Sk({ w = '100%', h = 14, r = 8, style = {} }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ---- Modal / Drawer ----------------------------------------
function Sheet({ open, onClose, children, drawer = false, maxW = 460, padded = true, contain = true }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: contain ? 'absolute' : 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(26,26,26,0.42)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: drawer ? 'flex-end' : 'center', justifyContent: 'center',
      padding: drawer ? 0 : 16, animation: 'fade-up .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxWidth: drawer ? '100%' : maxW,
        borderRadius: drawer ? '22px 22px 0 0' : 18,
        maxHeight: drawer ? '92%' : '90%', overflowY: 'auto',
        boxShadow: 'var(--shadow-pop)', padding: padded ? 24 : 0,
        animation: drawer ? 'sheet-up .32s cubic-bezier(.2,.8,.2,1)' : 'pop-in .26s cubic-bezier(.2,.9,.3,1.1)',
      }}>
        {drawer && <div style={{ width: 40, height: 4, borderRadius: 3, background: 'var(--gris-linea)', margin: '0 auto 18px' }} />}
        {children}
      </div>
    </div>
  );
}

// ---- Marco de teléfono -------------------------------------
function StatusBar({ dark = false }) {
  const c = dark ? '#fff' : '#1a1a1a';
  return (
    <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 26px 0 30px', flexShrink: 0, position: 'relative', zIndex: 5 }}>
      <span style={{ fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: c }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="6.5" width="3" height="4.5" rx=".6" fill={c}/><rect x="4.5" y="4.3" width="3" height="6.7" rx=".6" fill={c}/><rect x="9" y="2.2" width="3" height="8.8" rx=".6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx=".6" fill={c}/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 3C10.1 3 12 3.8 13.4 5.1L14.4 4C12.7 2.4 10.5 1.4 8 1.4S3.3 2.4 1.6 4l1 1.1C4 3.8 5.9 3 8 3z" fill={c}/><path d="M8 6.3c1.1 0 2.1.4 2.8 1.1l1-1.1C12 5.2 10.1 4.4 8 4.4S4 5.2 3.2 6.3l1 1.1C5 6.7 6 6.3 8 6.3z" fill={c} opacity=".9"/><circle cx="8" cy="9.3" r="1.3" fill={c}/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={c} strokeOpacity=".4" fill="none"/><rect x="2" y="2" width="16" height="8" rx="1.8" fill={c}/><path d="M23 4v4c.7-.3 1.2-1 1.2-2S23.7 4.3 23 4z" fill={c} opacity=".5"/></svg>
      </div>
    </div>
  );
}

function Phone({ children, dark = false, width = 390 }) {
  const screenH = 800;
  return (
    <div style={{ width: width + 22, padding: 11, background: 'linear-gradient(160deg,#2a2a2c,#161617)',
      borderRadius: 52, boxShadow: '0 50px 90px rgba(26,26,26,0.28), 0 0 0 1px rgba(0,0,0,0.2)', flexShrink: 0 }}>
      <div style={{ width, height: screenH, background: dark ? '#1a1a1a' : '#fff', borderRadius: 42,
        overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* isla dinámica */}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          width: 110, height: 31, borderRadius: 20, background: '#000', zIndex: 40 }} />
        <StatusBar dark={dark} />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </div>
        {/* home indicator */}
        <div style={{ height: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
          background: dark ? '#1a1a1a' : 'transparent', position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 45, pointerEvents: 'none' }}>
          <div style={{ width: 128, height: 5, borderRadius: 3, background: dark ? 'rgba(255,255,255,.5)' : 'rgba(26,26,26,.22)' }} />
        </div>
      </div>
    </div>
  );
}

// ---- Bottom tabs (cliente) ---------------------------------
function BottomTabs({ active, unread = 0 }) {
  const app = useApp();
  const tabs = [
    { id: 'today', label: 'Hoy', icon: 'home' },
    { id: 'progress', label: 'Progreso', icon: 'chart' },
    { id: 'messages', label: 'Mensajes', icon: 'chat', badge: unread },
    { id: 'settings', label: 'Mi Cuenta', icon: 'gear' },
  ];
  return (
    <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)',
      borderTop: '1px solid var(--gris-linea)', display: 'flex', padding: '8px 6px 24px' }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => app.go(t.id)} style={{ flex: 1, background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: on ? 'var(--lavanda-dark)' : 'var(--gris-suave)', position: 'relative', padding: '4px 0' }}>
            {on && <div style={{ position: 'absolute', top: -8, width: 26, height: 3, borderRadius: 2, background: 'var(--lavanda)' }} />}
            <div style={{ position: 'relative' }}>
              <Icon name={t.icon} size={23} strokeWidth={on ? 2 : 1.7} />
              {t.badge > 0 && <span style={{ position: 'absolute', top: -3, right: -6, minWidth: 15, height: 15, padding: '0 4px',
                borderRadius: 8, background: 'var(--error)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>{t.badge}</span>}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Marco de navegador (admin) ----------------------------
function Browser({ children, url = 'app.auramaristany.com', width = 1080, height = 720 }) {
  return (
    <div style={{ width, background: '#fff', borderRadius: 14, overflow: 'hidden', flexShrink: 0,
      boxShadow: '0 40px 90px rgba(26,26,26,0.2), 0 0 0 1px rgba(0,0,0,0.06)' }}>
      <div style={{ height: 46, background: '#f0eeee', borderBottom: '1px solid #e2dede', display: 'flex',
        alignItems: 'center', padding: '0 16px', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['#ec6a5e', '#f4bf4f', '#61c554'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, maxWidth: 520, height: 28, background: '#fff', borderRadius: 8, border: '1px solid #e2dede',
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', margin: '0 auto' }}>
          <Icon name="lock" size={12} color="#9a9a9a" />
          <span style={{ fontSize: 12.5, color: '#6b6b6b', fontFamily: 'var(--font-body)' }}>{url}</span>
        </div>
        <div style={{ width: 52 }} />
      </div>
      <div style={{ height, overflow: 'hidden', display: 'flex' }}>{children}</div>
    </div>
  );
}

// ---- Píldora de tipo de día --------------------------------
function TypeTag({ type }) {
  const map = {
    entrenamiento: { label: 'Entrenamiento', icon: 'dumbbell', bg: 'var(--lavanda-tint)', c: 'var(--lavanda-dark)' },
    descanso: { label: 'Descanso activo', icon: 'moon', bg: 'var(--rosa)', c: '#8a5a52' },
    evaluacion: { label: 'Evaluación', icon: 'chart', bg: 'rgba(76,175,125,.14)', c: 'var(--exito-deep)' },
  };
  const t = map[type] || map.entrenamiento;
  return (
    <span className="badge" style={{ background: t.bg, color: t.c, padding: '6px 12px', fontSize: 12.5 }}>
      <Icon name={t.icon} size={14} /> {t.label}
    </span>
  );
}

// ---- Estado vacío ------------------------------------------
function EmptyState({ icon = 'sparkle', title, text, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--rosa-soft)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Icon name={icon} size={28} color="var(--lavanda)" />
      </div>
      <div className="t-h3" style={{ marginBottom: 8 }}>{title}</div>
      <div className="t-small text-pretty" style={{ maxWidth: 280, marginBottom: action ? 20 : 0 }}>{text}</div>
      {action}
    </div>
  );
}

Object.assign(window, {
  AppCtx, useApp, Logo, WordMark, Avatar, StatusBadge, STATUS, ImgPh, Track,
  CheckRound, CheckSq, Field, ToastHost, Sk, Sheet, Phone, StatusBar, BottomTabs,
  Browser, TypeTag, EmptyState,
});
