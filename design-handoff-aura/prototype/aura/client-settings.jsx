// ============================================================
// AURA — Portal Cliente · Mi Cuenta / Configuración
// ============================================================
const { useState: useStateS } = React;
const DS2 = window.DATA;

function SettingsRow({ icon, label, danger, onClick, value }) {
  return (
    <button onClick={onClick} style={{ width: '100%', background: '#fff', border: 'none', borderTop: '1px solid var(--gris-linea)',
      padding: '15px 4px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
      <Icon name={icon} size={20} color={danger ? 'var(--error)' : 'var(--gris-texto)'} />
      <span className="font-body" style={{ flex: 1, fontWeight: 600, fontSize: 15, color: danger ? 'var(--error)' : 'var(--negro)' }}>{label}</span>
      {value && <span className="t-small">{value}</span>}
      {!danger && <Icon name="chevron-right" size={16} color="var(--gris-suave)" />}
    </button>
  );
}

function Section({ title, children, style }) {
  return (
    <div style={{ marginBottom: 24, ...style }}>
      <div className="t-eyebrow" style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function SettingsScreen() {
  const app = useApp();
  const c = DS2.cliente;
  const [editProfile, setEditProfile] = useStateS(false);
  const [changePwd, setChangePwd] = useStateS(false);

  return (
    <>
      <PortalTopBar center={<div className="t-h3">Mi Cuenta</div>} right={null} />
      <div className="scroll-y" style={{ flex: 1, padding: '22px 18px 30px', background: 'var(--gris-claro)' }}>

        {/* Perfil */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 14px' }}>
            <Avatar name={c.nombre} size={96} style={{ fontSize: 32 }} />
            <button style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: 'var(--lavanda)', border: '3px solid var(--gris-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="camera" size={15} color="#fff" />
            </button>
          </div>
          <h1 className="t-h2">{c.nombre}</h1>
          <p className="t-small">{c.correo}</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setEditProfile(true)}>Editar perfil</button>
        </div>

        {/* Mi programa */}
        <Section title="Mi programa">
          <div className="card">
            <div className="row between" style={{ marginBottom: 14 }}>
              <span className="t-small">Programa actual</span>
              <span className="badge badge-lavanda">{c.programa} · {c.variante}</span>
            </div>
            <div className="row between" style={{ marginBottom: 14 }}><span className="t-small">Fecha de inicio</span><span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{c.inicio}</span></div>
            <div className="row between" style={{ marginBottom: 16 }}><span className="t-small">Estado</span><StatusBadge status={c.estado} /></div>
            <div className="hr-soft" style={{ marginBottom: 14 }} />
            <div className="row between" style={{ marginBottom: 8 }}><span className="t-small" style={{ fontWeight: 600 }}>Mes {c.mes} de {c.totalMeses}</span><span className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>Día {c.dia} de {c.totalDias}</span></div>
            <Track value={(c.dia / c.totalDias) * 100} thin />
          </div>
        </Section>

        {/* Pago */}
        <Section title="Pago y suscripción">
          <div className="card">
            <div className="row between" style={{ marginBottom: 14 }}><span className="t-small">Próximo cobro</span><span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{c.proximoCobro} · {c.monto}</span></div>
            <div className="row between" style={{ marginBottom: 18 }}>
              <span className="t-small">Método de pago</span>
              <span className="row gap-6" style={{ alignItems: 'center' }}><Icon name="card" size={18} color="var(--gris-texto)" /><span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{c.tarjeta}</span></span>
            </div>
            <button className="btn btn-secondary btn-block btn-sm">Gestionar suscripción y pagos →</button>
          </div>
        </Section>

        {/* Seguridad */}
        <Section title="Seguridad">
          <div className="card" style={{ padding: '0 20px' }}>
            <SettingsRow icon="lock" label="Cambiar contraseña" onClick={() => setChangePwd(true)} />
          </div>
        </Section>

        <button className="btn btn-block" style={{ background: 'var(--error-tint)', color: 'var(--error)', marginTop: 6 }} onClick={() => app.go('login')}>
          <Icon name="logout" size={18} color="var(--error)" /> Cerrar sesión
        </button>
      </div>
      <BottomTabs active="settings" unread={2} />

      {/* Modal editar perfil */}
      <Sheet open={editProfile} onClose={() => setEditProfile(false)}>
        <h2 className="t-h2" style={{ marginBottom: 18 }}>Editar perfil</h2>
        <Field label="Nombre completo" defaultValue={c.nombre} />
        <Field label="Teléfono" defaultValue={c.telefono} />
        <Field label="Fecha de nacimiento" type="date" defaultValue={c.nacimiento} />
        <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => { setEditProfile(false); app.toast('¡Perfil actualizado! 💜'); }}>Guardar cambios</button>
      </Sheet>

      {/* Modal cambiar contraseña */}
      <Sheet open={changePwd} onClose={() => setChangePwd(false)}>
        <h2 className="t-h2" style={{ marginBottom: 18 }}>Cambiar contraseña</h2>
        <Field label="Contraseña actual" type="password" placeholder="••••••••" />
        <Field label="Nueva contraseña" type="password" placeholder="Mínimo 8 caracteres" />
        <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => { setChangePwd(false); app.toast('¡Contraseña actualizada!'); }}>Guardar contraseña</button>
      </Sheet>
    </>
  );
}

window.SettingsScreen = SettingsScreen;
