// ============================================================
// AURA — Portal Cliente · Mensajes
// ============================================================
const DM = window.DATA;

function MessagesScreen() {
  const app = useApp();
  const openId = app.store.msgOpen;
  const msg = DM.mensajes.find(m => m.id === openId);
  const unread = DM.mensajes.filter(m => !m.leido).length;

  if (msg) {
    return (
      <>
        <PortalTopBar onBack={() => app.update(() => ({ msgOpen: null }))} center={<div className="t-small" style={{ fontWeight: 600 }}>Mensaje</div>} />
        <div className="scroll-y fade-up" style={{ flex: 1, padding: '20px 20px 30px' }}>
          <h1 className="t-h1" style={{ marginBottom: 14 }}>{msg.asunto}</h1>
          <div className="row gap-10" style={{ alignItems: 'center', marginBottom: 16 }}>
            <Avatar name="Aura Maristany" size={40} lavanda />
            <div>
              <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>Aura Maristany</div>
              <div className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>{msg.fechaCompleta}</div>
            </div>
          </div>
          <div className="hr" style={{ marginBottom: 16 }} />
          <p className="t-body" style={{ whiteSpace: 'pre-line', fontSize: 15.5 }}>{msg.cuerpo}</p>
        </div>
        <BottomTabs active="messages" unread={unread} />
      </>
    );
  }

  return (
    <>
      <PortalTopBar center={<div className="t-h3">Mensajes</div>}
        right={unread > 0 ? <span className="badge badge-lavanda">{unread} nuevos</span> : null} />
      <div className="scroll-y" style={{ flex: 1, padding: '12px 14px 24px' }}>
        {DM.mensajes.length === 0 ? (
          <EmptyState icon="chat" title="Aún no tienes mensajes" text="Cuando Aura te envíe algo, aparecerá aquí." />
        ) : DM.mensajes.map(m => (
          <button key={m.id} onClick={() => app.update(() => ({ msgOpen: m.id }))} style={{ width: '100%', textAlign: 'left', cursor: 'pointer',
            background: m.leido ? 'var(--gris-claro)' : '#fff', border: '1px solid', borderColor: m.leido ? 'transparent' : 'var(--gris-linea)',
            boxShadow: m.leido ? 'none' : 'var(--shadow-soft)', borderRadius: 12, padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar name="Aura Maristany" size={42} lavanda />
              {!m.leido && <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderRadius: '50%', background: 'var(--lavanda)', border: '2px solid #fff' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between" style={{ marginBottom: 2 }}>
                <span className="font-head" style={{ fontWeight: 600, fontSize: 15, color: m.leido ? 'var(--gris-texto)' : 'var(--negro)' }}>{m.asunto}</span>
              </div>
              <div className="t-small" style={{ color: m.leido ? 'var(--gris-suave)' : 'var(--gris-texto)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.preview}</div>
              <div className="row between" style={{ marginTop: 6 }}>
                <span className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>{m.fecha}</span>
                <Icon name="chevron-right" size={15} color="var(--gris-suave)" />
              </div>
            </div>
          </button>
        ))}
      </div>
      <BottomTabs active="messages" unread={unread} />
    </>
  );
}

window.MessagesScreen = MessagesScreen;
