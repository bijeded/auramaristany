// ============================================================
// AURA — Portal Cliente · Mi Progreso
// Desempeño (reps y peso utilizado) + Fotos de progreso.
// NUNCA peso corporal ni medidas del cuerpo.
// ============================================================
const { useState: useStateP } = React;
const DP = window.DATA;

// ---------- Gráfica de línea (SVG) ----------
function LineChart({ data, color = '#9982f4', unit = '' }) {
  const [hover, setHover] = useStateP(null);
  const W = 318, H = 180, padX = 14, padY = 22;
  const vals = data.map(d => d.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = i => padX + (i / (data.length - 1 || 1)) * (W - padX * 2);
  const y = v => padY + (1 - (v - min) / range) * (H - padY * 2);
  const pts = data.map((d, i) => [x(i), y(d.v)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = `${line} L ${x(data.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={padX} x2={W - padX} y1={padY + g * (H - padY * 2)} y2={padY + g * (H - padY * 2)} stroke="#f0eae9" strokeWidth="1" />)}
        <path d={area} fill="url(#gradArea)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
            <circle cx={p[0]} cy={p[1]} r="11" fill="transparent" />
            <circle cx={p[0]} cy={p[1]} r={hover === i ? 6 : 4} fill="#fff" stroke={color} strokeWidth="2.5" />
          </g>
        ))}
        {hover !== null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={padY} y2={H - padY} stroke={color} strokeOpacity="0.3" strokeDasharray="3 3" />}
      </svg>
      {hover !== null && (
        <div style={{ position: 'absolute', left: `${(pts[hover][0] / W) * 100}%`, top: 0, transform: 'translateX(-50%)',
          background: 'var(--negro)', color: '#fff', padding: '5px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)',
          fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {data[hover].v}{unit} · {data[hover].fecha}
        </div>
      )}
      <div className="row between" style={{ padding: '4px 10px 0' }}>
        {data.map((d, i) => <span key={i} className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400, fontSize: 10 }}>{d.fecha}</span>)}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div className="card-flat" style={{ flex: 1, textAlign: 'center', padding: '16px 8px' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--lavanda-tint)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
        <Icon name={icon} size={19} color="var(--lavanda-dark)" />
      </div>
      <div className="font-head" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div className="t-tiny" style={{ color: 'var(--gris-texto)', fontWeight: 500, marginTop: 5 }}>{label}</div>
    </div>
  );
}

// ---------- Tab Desempeño ----------
function PerformanceTab() {
  const pr = DP.progreso;
  const ejercicios = pr.ejerciciosFuerza;
  const [ex, setEx] = useStateP(ejercicios[0]);
  const [period, setPeriod] = useStateP('todo');

  const full = pr.fuerza[ex];
  const periodCount = { '1mes': 2, '3meses': 3, 'todo': full.length };
  const chartData = full.slice(-Math.min(periodCount[period], full.length));
  const ultimo = full[full.length - 1].v, primero = full[0].v;
  const delta = ultimo - primero;

  return (
    <>
      <div className="t-eyebrow" style={{ marginBottom: 12 }}>ESTE MES</div>
      <div className="row gap-10" style={{ marginBottom: 24 }}>
        <StatCard icon="check" value={pr.resumen.entrenamientos} label="Entrenamientos" />
        <StatCard icon="heart" value={pr.resumen.racha} label="Días de racha" />
        <StatCard icon="refresh" value={pr.resumen.repsTotales} label="Reps totales" />
      </div>

      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 4 }}>
        <h3 className="t-h2">Peso que levantas</h3>
        <span className="badge" style={{ background: delta >= 0 ? 'rgba(76,175,125,.14)' : 'var(--gris-claro)', color: delta >= 0 ? 'var(--exito-deep)' : 'var(--gris-texto)' }}>
          {delta > 0 ? '+' : ''}{delta} kg
        </span>
      </div>
      <p className="t-small" style={{ marginBottom: 12 }}>Tu fuerza a lo largo del programa, ejercicio por ejercicio.</p>

      <div className="scroll-x row gap-8" style={{ marginBottom: 14, paddingBottom: 4 }}>
        {ejercicios.map(e => <button key={e} className={'pill ' + (ex === e ? 'active' : '')} onClick={() => setEx(e)}>{e.split(' ')[0]}</button>)}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{ex}</span>
          <span className="font-head" style={{ fontWeight: 600, fontSize: 20 }}>{ultimo} <span style={{ fontSize: 12, color: 'var(--gris-texto)', fontWeight: 400 }}>kg</span></span>
        </div>
        {chartData.length < 2
          ? <div style={{ textAlign: 'center', padding: '40px 10px' }} className="t-small">Registra al menos 2 entrenamientos para ver tu progreso</div>
          : <LineChart data={chartData} unit=" kg" />}
      </div>

      <div className="scroll-x row gap-8" style={{ marginBottom: 24, paddingBottom: 4 }}>
        {[['1mes', '1 mes'], ['3meses', '3 meses'], ['todo', 'Todo']].map(([v, l]) => (
          <button key={v} className={'pill ' + (period === v ? 'active-dark' : '')} onClick={() => setPeriod(v)}>{l}</button>
        ))}
      </div>

      <h3 className="t-h3" style={{ marginBottom: 12 }}>Historial de entrenamientos</h3>
      <div className="col gap-8">
        {pr.historial.map((h, i) => (
          <div key={i} className="card-flat row between" style={{ padding: '13px 16px', alignItems: 'center' }}>
            <div className="row gap-12" style={{ alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: h.tipo === 'cardio' ? 'var(--rosa)' : 'var(--lavanda-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={h.tipo === 'cardio' ? 'heart' : 'dumbbell'} size={17} color={h.tipo === 'cardio' ? '#8a5a52' : 'var(--lavanda-dark)'} />
              </div>
              <div>
                <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{h.dia}</div>
                <div className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>{h.fecha}</div>
              </div>
            </div>
            {h.done !== '—'
              ? <span className="badge" style={{ background: h.done === '5/5' ? 'rgba(76,175,125,.14)' : 'var(--gris-claro)', color: h.done === '5/5' ? 'var(--exito-deep)' : 'var(--gris-texto)' }}>{h.done} ejercicios</span>
              : <span className="badge badge-rosa">Completado</span>}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Tab Fotos ----------
function PhotosTab() {
  const [filter, setFilter] = useStateP('Todas');
  const [view, setView] = useStateP(null);
  const fotos = DP.fotos.filter(f => filter === 'Todas' || f.angulo === filter);
  return (
    <>
      <div className="scroll-x row gap-8" style={{ marginBottom: 16, paddingBottom: 4 }}>
        {['Todas', 'Frente', 'Lado', 'Espalda'].map(f => (
          <button key={f} className={'pill ' + (filter === f ? 'active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {fotos.length === 0 ? (
        <EmptyState icon="camera" title="Aún no tienes fotos de progreso" text="Empieza hoy registrando tu primera foto." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {fotos.map((f, i) => (
            <button key={f.id} onClick={() => setView(i)} style={{ border: 'none', padding: 0, borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: 'pointer', aspectRatio: '1' }}>
              <ImgPh label={f.angulo.toLowerCase()} h="100%" radius={0} />
              <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(26,26,26,.6)', color: '#fff', fontSize: 9.5, fontWeight: 600, padding: '2px 6px', borderRadius: 5, fontFamily: 'var(--font-body)' }}>{f.fecha}</span>
            </button>
          ))}
        </div>
      )}
      {view !== null && (
        <div onClick={() => setView(null)} style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(26,26,26,.92)', display: 'flex', flexDirection: 'column' }}>
          <div className="row between" style={{ padding: 16 }}>
            <span style={{ color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{fotos[view].fecha} · {fotos[view].angulo}</span>
            <button className="btn-ghost" style={{ color: '#fff', padding: 4, minHeight: 0 }} onClick={() => setView(null)}><Icon name="x" size={24} color="#fff" /></button>
          </div>
          <div className="row center" style={{ flex: 1, padding: '0 16px 60px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setView(v => Math.max(0, v - 1))} style={{ position: 'absolute', left: 8, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="chevron-left" size={22} color="#fff" /></button>
            <ImgPh label={fotos[view].angulo.toLowerCase()} w="100%" h={420} radius={12} />
            <button onClick={() => setView(v => Math.min(fotos.length - 1, v + 1))} style={{ position: 'absolute', right: 8, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="chevron-right" size={22} color="#fff" /></button>
          </div>
        </div>
      )}
    </>
  );
}

function ProgressScreen() {
  const app = useApp();
  const tab = app.store.progressTab === 'fotos' ? 'fotos' : 'desempeno';
  const setTab = t => app.update(() => ({ progressTab: t }));
  return (
    <>
      <PortalTopBar center={<div className="t-h3">Mi Progreso</div>}
        right={tab === 'fotos' ? <button className="btn-link" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => app.toast('Abriendo cámara…')}>+ Foto</button> : null} />
      <div style={{ flexShrink: 0, padding: '0 18px', borderBottom: '1px solid var(--gris-linea)' }}>
        <div className="tabs" style={{ border: 'none' }}>
          {[['desempeno', 'Desempeño'], ['fotos', 'Fotos']].map(([v, l]) => (
            <button key={v} className={'tab ' + (tab === v ? 'active' : '')} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="scroll-y" style={{ flex: 1, padding: '20px 18px 28px', position: 'relative' }}>
        {tab === 'desempeno' ? <PerformanceTab /> : <PhotosTab />}
      </div>
      <BottomTabs active="progress" unread={2} />
    </>
  );
}

window.ProgressScreen = ProgressScreen;
