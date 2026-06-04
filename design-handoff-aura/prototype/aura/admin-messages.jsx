// ============================================================
// AURA — Admin · Mensajes + Configuración de onboarding
// ============================================================
const { useState: useStateAm } = React;
const DAm = window.DATA.admin;

// ============================================================
//   MENSAJES (admin)
// ============================================================
function NewMessageModal({ open, onClose }) {
  const app = useApp();
  const [tipo, setTipo] = useStateAm('broadcast');
  const [grupos, setGrupos] = useStateAm(['CuarentaMás Principiante']);
  const [confirm, setConfirm] = useStateAm(false);

  const groupOpts = [['CuarentaMás Principiante', 18], ['CuarentaMás Intermedio', 12], ['Strong & Fit', 8]];
  const count = tipo === 'individual' ? 1 : grupos.reduce((s, g) => s + (groupOpts.find(o => o[0] === g)?.[1] || 0), 0);
  const toggleGroup = g => setGrupos(gs => gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g]);

  return (
    <Sheet open={open} onClose={onClose} maxW={520}>
      <h2 className="t-h2" style={{ marginBottom: 18 }}>Nuevo mensaje</h2>

      <label className="field-label">Tipo de mensaje</label>
      <div className="row gap-8" style={{ marginBottom: 18 }}>
        <button className={'pill ' + (tipo === 'individual' ? 'active' : '')} onClick={() => setTipo('individual')} style={{ flex: 1 }}>👤 Individual</button>
        <button className={'pill ' + (tipo === 'broadcast' ? 'active' : '')} onClick={() => setTipo('broadcast')} style={{ flex: 1 }}>📢 Grupal (broadcast)</button>
      </div>

      {tipo === 'individual' ? (
        <div className="field">
          <label className="field-label">Buscar clienta</label>
          <div className="row gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-lavanda" style={{ padding: '6px 8px 6px 6px', gap: 7 }}><Avatar name="María Elena García" size={20} /> María Elena García <Icon name="x" size={13} /></span>
          </div>
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Destinatarios</label>
          <div className="col gap-8">
            {groupOpts.map(([g, n]) => (
              <button key={g} onClick={() => toggleGroup(g)} className="row gap-10" style={{ alignItems: 'center', textAlign: 'left', cursor: 'pointer',
                border: '1.5px solid', borderColor: grupos.includes(g) ? 'var(--lavanda)' : 'var(--gris-linea)', background: grupos.includes(g) ? 'var(--lavanda-tint)' : '#fff', borderRadius: 10, padding: '11px 14px' }}>
                <CheckSq checked={grupos.includes(g)} onChange={() => toggleGroup(g)} />
                <span className="font-body" style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{g}</span>
                <span className="t-small">{n} clientes</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Field label="Asunto" placeholder="Escribe el asunto..." />
      <Field label="Mensaje" as="textarea" placeholder="Escribe tu mensaje aquí..." style={{ minHeight: 120 }} />

      <div className="row between" style={{ alignItems: 'center', marginTop: 6 }}>
        <span className="t-small">Se enviará a <strong style={{ color: 'var(--negro)' }}>{count} cliente{count !== 1 ? 's' : ''}</strong></span>
        <div className="row gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); app.toast('Borrador guardado'); }}>Guardar borrador</button>
          <button className="btn btn-primary btn-sm" onClick={() => setConfirm(true)}>Enviar ahora</button>
        </div>
      </div>

      {confirm && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,.5)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setConfirm(false)}>
          <div className="card pop-in" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 320 }}>
            <h3 className="t-h2" style={{ marginBottom: 10 }}>¿Enviar este mensaje?</h3>
            <p className="t-small" style={{ marginBottom: 18 }}>Se enviará a {count} cliente{count !== 1 ? 's' : ''}. Esta acción no se puede deshacer.</p>
            <div className="row gap-10">
              <button className="btn btn-secondary btn-block btn-sm" onClick={() => setConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary btn-block btn-sm" onClick={() => { setConfirm(false); onClose(); app.toast('¡Mensaje enviado! 💜'); }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function AdminMessages() {
  const [tab, setTab] = useStateAm('enviados');
  const [modal, setModal] = useStateAm(false);
  return (
    <AdminShell>
      <div style={{ padding: '28px 32px 40px', maxWidth: 820 }}>
        <AdminHeader title="Mensajes" right={<button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Icon name="plus" size={16} color="#fff" /> Nuevo mensaje</button>} />
        <div className="tabs" style={{ marginBottom: 20 }}>
          {[['enviados', 'Enviados'], ['borradores', 'Borradores']].map(([v, l]) => <button key={v} className={'tab ' + (tab === v ? 'active' : '')} onClick={() => setTab(v)}>{l}</button>)}
        </div>

        {tab === 'borradores' ? (
          <EmptyState icon="edit" title="No tienes borradores" text="Cuando guardes un mensaje sin enviar, aparecerá aquí." />
        ) : (
          <div className="col gap-10">
            {DAm.mensajesEnviados.map(m => (
              <div key={m.id} className="card row gap-16" style={{ alignItems: 'center', padding: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: m.tipo === 'broadcast' ? 'var(--lavanda-tint)' : 'var(--rosa)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={m.tipo === 'broadcast' ? 'megaphone' : 'user'} size={20} color={m.tipo === 'broadcast' ? 'var(--lavanda-dark)' : '#8a5a52'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-head" style={{ fontWeight: 600, fontSize: 16 }}>{m.asunto}</div>
                  <div className="t-small">Para: {m.dest}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="t-tiny" style={{ color: 'var(--gris-texto)', fontWeight: 600 }}>{m.fecha}</div>
                  <div className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400, marginTop: 2 }}>{m.leidos} leídos de {m.total}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <NewMessageModal open={modal} onClose={() => setModal(false)} />
    </AdminShell>
  );
}

// ============================================================
//   CONFIGURACIÓN DE ONBOARDING
// ============================================================
const TIPO_LABEL = { libre: 'Texto libre', numero: 'Número', unica: 'Selección única', multiple: 'Selección múltiple' };

function QuestionModal({ open, onClose, pregunta }) {
  const [tipo, setTipo] = useStateAm(pregunta?.tipo || 'unica');
  const [opciones, setOpciones] = useStateAm(pregunta?.opciones || ['', '']);
  const [oblig, setOblig] = useStateAm(pregunta?.obligatoria ?? true);
  return (
    <Sheet open={open} onClose={onClose} maxW={520}>
      <h2 className="t-h2" style={{ marginBottom: 18 }}>{pregunta ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
      <Field label="Texto de la pregunta" defaultValue={pregunta?.texto} placeholder="¿Cuál es tu...?" />
      <label className="field-label">Tipo de respuesta</label>
      <div className="row gap-8 wrap" style={{ marginBottom: 18 }}>
        {Object.entries(TIPO_LABEL).map(([v, l]) => <button key={v} className={'pill ' + (tipo === v ? 'active' : '')} onClick={() => setTipo(v)}>{l}</button>)}
      </div>
      {(tipo === 'unica' || tipo === 'multiple') && (
        <div className="field">
          <label className="field-label">Opciones</label>
          <div className="col gap-8">
            {opciones.map((o, i) => (
              <div key={i} className="row gap-8">
                <input className="input" defaultValue={o} placeholder={`Opción ${i + 1}`} style={{ minHeight: 42 }} />
                <button className="btn-ghost" style={{ minHeight: 0, padding: 8 }} onClick={() => setOpciones(opciones.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
              </div>
            ))}
            <button className="btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => setOpciones([...opciones, ''])}>+ Agregar opción</button>
          </div>
        </div>
      )}
      <div className="row between" style={{ padding: '14px 0', marginBottom: 8 }}>
        <span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>Obligatoria</span>
        <button onClick={() => setOblig(o => !o)} style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: oblig ? 'var(--lavanda)' : 'var(--gris-linea)', position: 'relative', transition: 'background .2s ease' }}>
          <span style={{ position: 'absolute', top: 3, left: oblig ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s ease' }} />
        </button>
      </div>
      <div className="row gap-10">
        <button className="btn btn-secondary btn-block" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-block" onClick={onClose}>Guardar pregunta</button>
      </div>
    </Sheet>
  );
}

function AdminOnboarding() {
  const [modal, setModal] = useStateAm(false);
  const [edit, setEdit] = useStateAm(null);
  const preguntas = window.DATA.onboardingPreguntas;
  return (
    <AdminShell>
      <div style={{ padding: '28px 32px 40px', maxWidth: 760 }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="t-display" style={{ fontSize: 30 }}>Cuestionario de bienvenida</h1>
            <p className="t-small text-pretty" style={{ marginTop: 4, maxWidth: 420 }}>Las nuevas clientas responderán estas preguntas después de su primer pago.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEdit(null); setModal(true); }}><Icon name="plus" size={16} color="#fff" /> Agregar pregunta</button>
        </div>

        <div className="col gap-10">
          {preguntas.map((q, i) => (
            <div key={q.id} className="card row gap-14" style={{ alignItems: 'center', padding: 18 }}>
              <Icon name="drag" size={18} color="var(--gris-suave)" />
              <div style={{ flex: 1 }}>
                <div className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 600, marginBottom: 3 }}>Pregunta {i + 1}</div>
                <div className="font-body" style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{q.texto}</div>
                <div className="row gap-8">
                  <span className="badge badge-borrador">{TIPO_LABEL[q.tipo]}</span>
                  <span className="t-tiny" style={{ color: 'var(--gris-texto)', fontWeight: 400, alignSelf: 'center' }}>Obligatoria: {q.obligatoria ? 'Sí' : 'No'}</span>
                </div>
              </div>
              <button className="btn-ghost" style={{ minHeight: 0, padding: 8 }} onClick={() => { setEdit(q); setModal(true); }}><Icon name="edit" size={17} /></button>
              <button className="btn-ghost" style={{ minHeight: 0, padding: 8, color: 'var(--error)' }}><Icon name="trash" size={17} color="var(--error)" /></button>
            </div>
          ))}
        </div>

        <div className="card-gris" style={{ marginTop: 20, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color="var(--gris-texto)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span className="t-small">Este cuestionario se muestra una sola vez a cada clienta, inmediatamente después de su primer pago.</span>
        </div>
      </div>
      <QuestionModal open={modal} onClose={() => setModal(false)} pregunta={edit} />
    </AdminShell>
  );
}

Object.assign(window, { AdminMessages, AdminOnboarding });
