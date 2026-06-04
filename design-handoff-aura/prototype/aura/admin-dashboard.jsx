// ============================================================
// AURA — Admin · Dashboard financiero
// ============================================================
const DD = window.DATA.admin;

function KpiCard({ label, value, badge, badgeUp, sub, danger, onClick }) {
  return (
    <div className="card" style={{ flex: 1, padding: 20 }}>
      <div className="t-small" style={{ fontWeight: 500, fontSize: 12.5, marginBottom: 10 }}>{label}</div>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <span className="font-head" style={{ fontSize: 30, fontWeight: 600, color: danger ? 'var(--error)' : 'var(--negro)' }}>{value}</span>
        {badge && <span className="badge" style={{ background: badgeUp ? 'rgba(76,175,125,.14)' : 'var(--error-tint)', color: badgeUp ? 'var(--exito-deep)' : 'var(--error)' }}>{badge}</span>}
      </div>
      {sub && <div className="t-tiny" style={{ marginTop: 8, fontWeight: 400, color: danger ? 'var(--error)' : 'var(--gris-texto)', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>{sub}</div>}
    </div>
  );
}

function AdminDashboard() {
  const app = useApp();
  const k = DD.kpis;
  return (
    <AdminShell>
      <div style={{ padding: '28px 32px 40px', maxWidth: 1000 }}>
        <AdminHeader title="Dashboard" sub="Junio 2026" />

        {/* KPIs */}
        <div className="row gap-16" style={{ marginBottom: 18, alignItems: 'stretch' }}>
          <KpiCard label="Ingreso mensual recurrente" value={k.mrr} badge={k.mrrDelta} badgeUp={k.mrrUp} sub="vs. mes anterior" />
          <KpiCard label="Total suscripciones activas" value={k.activas} sub={k.activasNuevas} />
          <KpiCard label="Renuevan esta semana" value={k.porVencer} sub={k.porVencerMonto} />
          <KpiCard label="Requieren atención" value={k.fallidos} danger sub="Ver clientes →" onClick={() => app.go('admin-clients')} />
        </div>

        {/* Ingresos por mes */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 className="t-h2">Ingresos por mes</h3>
            <div className="row gap-8">
              <button className="pill active">6 meses</button>
              <button className="pill">12 meses</button>
            </div>
          </div>
          <AdminBarChart data={DD.ingresos} />
        </div>

        {/* Distribución */}
        <div className="row gap-16" style={{ marginBottom: 18, alignItems: 'stretch' }}>
          <div className="card" style={{ flex: 1 }}>
            <h3 className="t-h3" style={{ marginBottom: 16 }}>Clientes por programa</h3>
            <div className="col gap-16">
              {DD.porPrograma.map((p, i) => {
                const maxC = Math.max(...DD.porPrograma.map(x => x.clientes));
                return (
                  <div key={i}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span className="t-small" style={{ fontWeight: 600, color: 'var(--negro)' }}>{p.nombre}</span>
                      <span className="t-small" style={{ fontWeight: 600 }}>{p.clientes}</span>
                    </div>
                    <div className="track track-gris"><div className="fill" style={{ width: `${(p.clientes / maxC) * 100}%`, background: p.color === '#eddbd8' ? 'var(--rosa-deep)' : p.color }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card" style={{ flex: 1 }}>
            <h3 className="t-h3" style={{ marginBottom: 16 }}>Ingresos por programa</h3>
            <AdminDonut data={DD.ingresoPrograma} />
          </div>
        </div>

        {/* Pagos recientes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: '18px 22px 12px' }}>
            <h3 className="t-h2">Pagos recientes</h3>
            <button className="btn-link">Ver todos →</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gris-claro)' }}>
                {['Fecha', 'Clienta', 'Programa', 'Monto', 'Estado'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Monto' ? 'right' : 'left', padding: '10px 22px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--gris-texto)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DD.pagos.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--gris-linea)' }}>
                  <td style={{ padding: '13px 22px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--gris-texto)' }}>{p.fecha}</td>
                  <td style={{ padding: '13px 22px', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600 }}>{p.cliente}</td>
                  <td style={{ padding: '13px 22px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--gris-texto)' }}>{p.programa}</td>
                  <td style={{ padding: '13px 22px', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, textAlign: 'right' }}>{p.monto}</td>
                  <td style={{ padding: '13px 22px' }}>
                    <span className={'badge ' + (p.estado === 'pagado' ? 'badge-activa' : p.estado === 'fallido' ? 'badge-vencida' : 'badge-porvencer')}>
                      {p.estado === 'pagado' ? 'Pagado' : p.estado === 'fallido' ? 'Fallido' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

window.AdminDashboard = AdminDashboard;
