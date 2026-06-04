// ============================================================
// AURA — Admin · Lista de clientes + Detalle
// ============================================================
const { useState: useStateC } = React;
const DC = window.DATA.admin;

const PROG_FILTERS = ['Todas', 'CuarentaMás', 'CuarentaMás Extra', 'Strong & Fit'];
const STATE_FILTERS = ['Activas', 'Vencidas', 'Con pago fallido'];

function AdminClients() {
  const app = useApp();
  const [q, setQ] = useStateC('');
  const [prog, setProg] = useStateC('Todas');
  const [estado, setEstado] = useStateC(null);

  let list = DC.clientes.filter(c => c.estado !== 'cancelada' || estado === null);
  if (q) list = list.filter(c => (c.nombre + c.correo).toLowerCase().includes(q.toLowerCase()));
  if (prog !== 'Todas') list = list.filter(c => c.programa === prog);
  if (estado === 'Activas') list = list.filter(c => c.estado === 'activa');
  if (estado === 'Vencidas') list = list.filter(c => c.estado === 'vencida' || c.estado === 'past_due');
  if (estado === 'Con pago fallido') list = list.filter(c => c.estado === 'past_due');

  const activas = DC.clientes.filter(c => c.estado === 'activa').length;

  return (
    <AdminShell>
      <div style={{ padding: '28px 32px 40px', maxWidth: 1040 }}>
        <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
          <h1 className="t-display" style={{ fontSize: 30 }}>Clientes <span style={{ fontSize: 18, color: 'var(--gris-texto)', fontWeight: 400 }}>({activas} activas)</span></h1>
          <div style={{ position: 'relative', width: 280 }}>
            <span style={{ position: 'absolute', left: 13, top: 12 }}><Icon name="search" size={18} color="var(--gris-suave)" /></span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o correo..." className="input has-icon" style={{ minHeight: 42 }} />
          </div>
        </div>

        {/* Filtros */}
        <div className="row gap-8 wrap" style={{ marginBottom: 20 }}>
          {PROG_FILTERS.map(f => <button key={f} className={'pill ' + (prog === f ? 'active' : '')} onClick={() => setProg(f)}>{f}</button>)}
          <div style={{ width: 1, background: 'var(--gris-linea)', margin: '0 4px' }} />
          {STATE_FILTERS.map(f => <button key={f} className={'pill ' + (estado === f ? 'active' : '')} onClick={() => setEstado(estado === f ? null : f)}>{f}</button>)}
        </div>

        {/* Tabla */}
        {list.length === 0 ? (
          <EmptyState icon="users" title="No se encontraron clientes" text="No hay clientes con esos filtros."
            action={<button className="btn btn-secondary btn-sm" onClick={() => { setQ(''); setProg('Todas'); setEstado(null); }}>Limpiar filtros</button>} />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gris-claro)' }}>
                  {['Clienta', 'Programa', 'Inscripción', 'Próximo cobro', 'Estado', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '12px 20px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--gris-texto)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--gris-linea)', cursor: 'pointer' }}
                    onClick={() => { app.update(() => ({ adminClientId: c.id, adminClientTab: 'resumen' })); app.go('admin-client'); }}>
                    <td style={{ padding: '12px 20px' }}>
                      <div className="row gap-10" style={{ alignItems: 'center' }}>
                        <Avatar name={c.nombre} size={36} />
                        <div>
                          <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}</div>
                          <div className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>{c.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}><span className="badge badge-lavanda">{c.programa} · {c.variante}</span></td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--gris-texto)' }}>{c.inscripcion}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--gris-texto)' }}>{c.proximo} · {c.monto}</td>
                    <td style={{ padding: '12px 20px' }}><StatusBadge status={c.estado} /></td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}><span className="btn-link">Ver</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.length > 0 && (
          <div className="row between" style={{ marginTop: 16 }}>
            <span className="t-small">Mostrando 1–{list.length} de {activas}</span>
            <div className="row gap-8">
              <button className="btn btn-secondary btn-sm" disabled>Anterior</button>
              <button className="btn btn-secondary btn-sm">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

// ============================================================
//   DETALLE DE CLIENTE
// ============================================================
const CLIENT_TABS = [['resumen', 'Resumen'], ['onboarding', 'Onboarding'], ['progreso', 'Progreso'], ['fotos', 'Fotos'], ['pagos', 'Pagos'], ['mensajes', 'Mensajes']];

function AdminClientDetail() {
  const app = useApp();
  const c = DC.clientes.find(x => x.id === app.store.adminClientId) || DC.clientes[0];
  const tab = app.store.adminClientTab;
  const setTab = t => app.update(() => ({ adminClientTab: t }));

  return (
    <AdminShell>
      <div style={{ padding: '24px 32px 40px', maxWidth: 920 }}>
        <button className="btn-link" style={{ marginBottom: 14, paddingLeft: 0 }} onClick={() => app.go('admin-clients')}>← Clientes</button>
        <div className="row gap-16" style={{ alignItems: 'center', marginBottom: 22 }}>
          <Avatar name={c.nombre} size={64} style={{ fontSize: 24 }} />
          <div style={{ flex: 1 }}>
            <h1 className="t-h1">{c.nombre}</h1>
            <p className="t-small">{c.correo}</p>
          </div>
          <StatusBadge status={c.estado} />
        </div>

        <div className="tabs" style={{ marginBottom: 22 }}>
          {CLIENT_TABS.map(([v, l]) => <button key={v} className={'tab ' + (tab === v ? 'active' : '')} onClick={() => setTab(v)}>{l}</button>)}
        </div>

        {tab === 'resumen' && (
          <div className="row gap-16" style={{ alignItems: 'stretch' }}>
            <div className="card" style={{ flex: 1 }}>
              <h3 className="t-h3" style={{ marginBottom: 16 }}>Programa</h3>
              {[['Programa', `${c.programa} · ${c.variante}`], ['Fecha de inicio', c.inscripcion], ['Mes actual', 'Mes 1 de 6'], ['Próximo cobro', `${c.proximo} · ${c.monto}`]].map(([k, v]) => (
                <div key={k} className="row between" style={{ marginBottom: 12 }}><span className="t-small">{k}</span><span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{v}</span></div>
              ))}
              <div className="hr-soft" style={{ margin: '8px 0 12px' }} />
              <div className="row between" style={{ marginBottom: 8 }}><span className="t-small" style={{ fontWeight: 600 }}>Día {c.dia} de 180</span></div>
              <Track value={(c.dia / 180) * 100} thin />
            </div>
            <div className="card" style={{ width: 240, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
              <Icon name="chat" size={28} color="var(--lavanda)" style={{ margin: '0 auto' }} />
              <p className="t-small">Envía un mensaje directo a {c.nombre.split(' ')[0]}.</p>
              <button className="btn btn-primary btn-sm" onClick={() => app.go('admin-messages')}>Enviar mensaje</button>
            </div>
          </div>
        )}

        {tab === 'onboarding' && (
          <div className="card">
            {window.DATA.onboardingPreguntas.map(qq => {
              const r = window.DATA.onboardingRespuestas[qq.id];
              return (
                <div key={qq.id} style={{ marginBottom: 18 }}>
                  <div className="t-small" style={{ marginBottom: 4 }}>{qq.texto}</div>
                  <div className="font-body" style={{ fontWeight: 600, fontSize: 15 }}>{Array.isArray(r) ? r.join(' · ') : (r || '—')}{qq.tipo === 'numero' ? ` ${qq.unidad}` : ''}</div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'progreso' && (
          <div className="card">
            <h3 className="t-h3" style={{ marginBottom: 16 }}>Registro de entrenamientos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 10 }}>
              {Array.from({ length: 30 }, (_, i) => {
                const t = i < 18 ? 'full' : i < 23 ? 'partial' : 'empty';
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%',
                      background: t === 'full' ? 'var(--lavanda)' : '#fff',
                      border: t === 'full' ? 'none' : t === 'partial' ? '2px dashed var(--lavanda)' : '1.5px solid var(--gris-linea)' }} />
                    <span className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400, fontSize: 9 }}>{i + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="row gap-16" style={{ marginTop: 18 }}>
              <span className="row gap-6 t-tiny" style={{ alignItems: 'center', color: 'var(--gris-texto)', fontWeight: 400 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--lavanda)' }} /> Completo</span>
              <span className="row gap-6 t-tiny" style={{ alignItems: 'center', color: 'var(--gris-texto)', fontWeight: 400 }}><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed var(--lavanda)' }} /> Parcial</span>
              <span className="row gap-6 t-tiny" style={{ alignItems: 'center', color: 'var(--gris-texto)', fontWeight: 400 }}><span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--gris-linea)' }} /> Sin registro</span>
            </div>
          </div>
        )}

        {tab === 'fotos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {window.DATA.fotos.map(f => (
              <div key={f.id} style={{ borderRadius: 10, overflow: 'hidden', position: 'relative', aspectRatio: '1' }}>
                <ImgPh label={f.angulo.toLowerCase()} h="100%" radius={0} />
                <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(26,26,26,.6)', color: '#fff', fontSize: 9.5, fontWeight: 600, padding: '2px 6px', borderRadius: 5, fontFamily: 'var(--font-body)' }}>{f.fecha}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'pagos' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--gris-claro)' }}>{['Fecha', 'Período', 'Monto', 'Estado'].map(h => <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--gris-texto)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {[['1 jun 2026', 'Jun 2026', c.monto, 'pagado'], ['1 may 2026', 'May 2026', c.monto, 'pagado'], ['1 abr 2026', 'Abr 2026', c.monto, 'pagado'], ['1 mar 2026', 'Mar 2026', c.monto, 'fallido']].map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--gris-linea)' }}>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-body)', fontSize: 13.5 }}>{r[0]}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--gris-texto)' }}>{r[1]}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600 }}>{r[2]}</td>
                    <td style={{ padding: '12px 20px' }}><span className={'badge ' + (r[3] === 'pagado' ? 'badge-activa' : 'badge-vencida')}>{r[3] === 'pagado' ? 'Pagado' : 'Fallido'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'mensajes' && (
          <div>
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 className="t-h3">Mensajes enviados</h3>
              <button className="btn btn-primary btn-sm" onClick={() => app.go('admin-messages')}>+ Nuevo mensaje</button>
            </div>
            <div className="col gap-8">
              {window.DATA.mensajes.map(m => (
                <div key={m.id} className="card-flat">
                  <div className="font-head" style={{ fontWeight: 600, fontSize: 15 }}>{m.asunto}</div>
                  <div className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400, marginTop: 2 }}>{m.fechaCompleta}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

Object.assign(window, { AdminClients, AdminClientDetail });
