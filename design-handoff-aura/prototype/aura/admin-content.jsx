// ============================================================
// AURA — Admin · Gestor de contenido (overview + programa + editor)
// ============================================================
const { useState: useStateCo } = React;
const DCo = window.DATA.admin;

// ---------- Overview ----------
function AdminContent() {
  const app = useApp();
  return (
    <AdminShell>
      <div style={{ padding: '28px 32px 40px', maxWidth: 920 }}>
        <AdminHeader title="Contenido" sub="Crea y edita el contenido de tus programas" />
        <div className="col gap-16">
          {DCo.programas.map(p => (
            <button key={p.id} onClick={() => { app.update(() => ({ adminProgramId: p.id })); app.go('admin-program'); }}
              className="card" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, border: '1px solid var(--gris-linea)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--lavanda-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={p.icono} size={26} color="var(--lavanda-dark)" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="row gap-10" style={{ alignItems: 'center', marginBottom: 4 }}>
                  <h3 className="t-h2">{p.nombre}</h3>
                  {p.alerta && <span className="badge badge-porvencer"><Icon name="warning" size={12} /> {p.alerta}</span>}
                </div>
                <p className="t-small" style={{ marginBottom: p.publicados ? 10 : 0 }}>{p.sub}</p>
                {p.publicados != null ? (
                  <>
                    <div className="row between" style={{ marginBottom: 5 }}><span className="t-tiny" style={{ color: 'var(--gris-texto)', fontWeight: 600 }}>Días publicados: {p.publicados} / {p.total}</span></div>
                    <Track value={(p.publicados / p.total) * 100} thin />
                  </>
                ) : <p className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>{p.nota}</p>}
              </div>
              <Icon name="chevron-right" size={20} color="var(--gris-suave)" />
            </button>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

// ---------- Vista de programa ----------
const CM_VARIANTS = ['Principiante (poco)', 'Principiante (suf.)', 'Intermedio', 'Avanzado', 'Élite'];

function AdminProgram() {
  const app = useApp();
  const p = DCo.programas.find(x => x.id === app.store.adminProgramId) || DCo.programas[0];
  const [variant, setVariant] = useStateCo(0);
  const [openSerie, setOpenSerie] = useStateCo(null);

  const cellState = (day) => day <= 60 ? 'publicado' : day <= 90 ? 'borrador' : 'vacio';

  return (
    <AdminShell>
      <div style={{ padding: '24px 32px 40px', maxWidth: 980 }}>
        <button className="btn-link" style={{ marginBottom: 12, paddingLeft: 0 }} onClick={() => app.go('admin-content')}>← Contenido</button>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 22 }}>
          <h1 className="t-display" style={{ fontSize: 30 }}>{p.nombre}</h1>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={16} color="#fff" /> Nueva serie / mes</button>
        </div>

        {p.tipo === 'grid' ? (
          <>
            <div className="scroll-x row gap-8" style={{ marginBottom: 22, paddingBottom: 4 }}>
              {CM_VARIANTS.map((v, i) => <button key={v} className={'pill ' + (variant === i ? 'active' : '')} onClick={() => setVariant(i)}>{v}</button>)}
            </div>
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                {Array.from({ length: 6 }, (_, m) => (
                  <div key={m}>
                    <div className="t-tiny" style={{ color: 'var(--gris-texto)', fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>Mes {m + 1}</div>
                    <div className="col gap-4">
                      {Array.from({ length: 30 }, (_, d) => {
                        const day = m * 30 + d + 1;
                        const s = cellState(day);
                        return (
                          <button key={d} onClick={() => app.go('admin-editor')} style={{ cursor: 'pointer',
                            padding: '4px 0', borderRadius: 5, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11,
                            background: s === 'publicado' ? 'rgba(153,130,244,.16)' : s === 'borrador' ? 'var(--gris-claro)' : '#fff',
                            border: s === 'publicado' ? '1px solid var(--lavanda)' : s === 'borrador' ? '1px dashed var(--gris-suave)' : '1px solid var(--gris-linea)',
                            color: s === 'vacio' ? 'var(--gris-suave)' : 'var(--negro)' }}>{day}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="row gap-16" style={{ marginTop: 18 }}>
                {[['rgba(153,130,244,.16)', 'var(--lavanda)', 'Publicado'], ['var(--gris-claro)', 'var(--gris-suave)', 'Borrador'], ['#fff', 'var(--gris-linea)', 'Vacío']].map(([bg, bd, l]) => (
                  <span key={l} className="row gap-6 t-tiny" style={{ alignItems: 'center', color: 'var(--gris-texto)', fontWeight: 400 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `1px ${l === 'Borrador' ? 'dashed' : 'solid'} ${bd}` }} /> {l}</span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="col gap-14">
            {DCo.series.map(s => (
              <div key={s.id} className="card">
                <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 className="t-h2">Mes {s.mes} — «{s.titulo}»</h3>
                    <p className="t-small" style={{ marginTop: 2 }}>Variante: {s.variante} · {s.dias} días · {s.publicados} publicados</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setOpenSerie(openSerie === s.id ? null : s.id)}>
                    {openSerie === s.id ? 'Cerrar' : 'Editar →'}
                  </button>
                </div>
                <div className="row gap-12" style={{ alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><Track value={(s.publicados / s.dias) * 100} thin /></div>
                  <span className="t-tiny" style={{ fontWeight: 600, color: 'var(--gris-texto)' }}>{Math.round((s.publicados / s.dias) * 100)}%</span>
                </div>
                {openSerie === s.id && (
                  <div className="fade-up" style={{ marginTop: 16, borderTop: '1px solid var(--gris-linea)', paddingTop: 12 }}>
                    {DCo.diasSerie.map(d => (
                      <div key={d.n} className="row between" style={{ padding: '10px 4px', borderBottom: '1px solid #f4efee', alignItems: 'center' }}>
                        <span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>Día {d.n} — {d.titulo}</span>
                        <div className="row gap-12" style={{ alignItems: 'center' }}>
                          <span className={'badge ' + (d.estado === 'publicado' ? 'badge-publicado' : d.estado === 'borrador' ? 'badge-borrador' : 'badge-cancelada')}>
                            {d.estado === 'publicado' ? 'Publicado' : d.estado === 'borrador' ? 'Borrador' : 'Vacío'}
                          </span>
                          <button className="btn-link" onClick={() => app.go('admin-editor')}>Editar →</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

// ============================================================
//   EDITOR DE DÍA (CMS)
// ============================================================
const PALETTE = [
  { t: 'texto', icon: 'text-icon', label: 'Texto' },
  { t: 'youtube', icon: 'youtube', label: 'Video YouTube' },
  { t: 'pdf', icon: 'pdf', label: 'PDF' },
  { t: 'imagen', icon: 'image', label: 'Imagen' },
  { t: 'ejercicios', icon: 'dumbbell', label: 'Ejercicios' },
];

function BlockShell({ tipo, onRemove, children }) {
  return (
    <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
      <div className="row between" style={{ padding: '10px 14px', background: 'var(--gris-claro)', borderBottom: '1px solid var(--gris-linea)' }}>
        <div className="row gap-8" style={{ alignItems: 'center', color: 'var(--gris-texto)' }}>
          <Icon name="drag" size={16} /><span className="t-tiny" style={{ textTransform: 'uppercase', letterSpacing: '.5px' }}>{tipo}</span>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gris-suave)' }}><Icon name="x" size={16} /></button>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function AdminEditor() {
  const app = useApp();
  const [blocks, setBlocks] = useStateCo([
    { id: 1, tipo: 'texto' }, { id: 2, tipo: 'youtube' }, { id: 3, tipo: 'ejercicios' },
  ]);
  const [published, setPublished] = useStateCo(false);
  const [title, setTitle] = useStateCo('Piernas y Glúteos');
  const [dayType, setDayType] = useStateCo('entrenamiento');
  const addBlock = (t) => setBlocks(b => [...b, { id: Date.now(), tipo: t }]);
  const removeBlock = (id) => setBlocks(b => b.filter(x => x.id !== id));

  return (
    <AdminShell scroll={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top bar editor */}
        <div className="row between" style={{ padding: '14px 24px', borderBottom: '1px solid var(--gris-linea)', background: '#fff', flexShrink: 0 }}>
          <div className="row gap-12" style={{ alignItems: 'center' }}>
            <button className="btn-link" style={{ paddingLeft: 0 }} onClick={() => app.go('admin-program')}>← Serie 1</button>
            <span className="t-h3">Día 12</span>
            <span className={'badge ' + (published ? 'badge-publicado' : 'badge-borrador')}>{published ? 'Publicado' : 'Borrador'}</span>
            <span className="t-tiny" style={{ color: 'var(--gris-suave)', fontWeight: 400 }}>· Guardado hace 5 seg</span>
          </div>
          <div className="row gap-8">
            <button className="btn btn-secondary btn-sm" onClick={() => app.toast('Guardado')}>Guardar</button>
            <button className={'btn btn-sm ' + (published ? 'btn-secondary' : 'btn-primary')} onClick={() => { setPublished(!published); app.toast(published ? 'Despublicado' : '¡Publicado! 💜'); }}>
              {published ? 'Despublicar' : 'Publicar'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Editor */}
          <div className="scroll-y" style={{ flex: '1 1 58%', padding: '22px 24px', borderRight: '1px solid var(--gris-linea)' }}>
            {/* Campos básicos */}
            <div className="row gap-12" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Título del día</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 18 }} />
              </div>
              <div>
                <label className="field-label">Duración (min)</label>
                <input className="input" defaultValue="40" style={{ width: 100 }} />
              </div>
            </div>
            <div className="row gap-8" style={{ marginBottom: 22 }}>
              {[['entrenamiento', 'Entrenamiento', 'dumbbell'], ['descanso', 'Descanso', 'moon'], ['evaluacion', 'Evaluación', 'chart']].map(([v, l, ic]) => (
                <button key={v} className={'pill ' + (dayType === v ? 'active' : '')} onClick={() => setDayType(v)}><Icon name={ic} size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{l}</button>
              ))}
            </div>

            {/* Bloques */}
            {blocks.map(b => (
              <BlockShell key={b.id} tipo={b.tipo} onRemove={() => removeBlock(b.id)}>
                {b.tipo === 'texto' && (
                  <div>
                    <div className="row gap-4" style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--gris-linea)' }}>
                      {['B', 'I', 'H2', 'H3', '• Lista', '1. Lista'].map(t => <button key={t} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--gris-texto)', padding: '4px 7px', fontFamily: t.length > 2 ? 'var(--font-body)' : 'serif' }}>{t}</button>)}
                    </div>
                    <div className="t-body" contentEditable suppressContentEditableWarning style={{ outline: 'none', minHeight: 60 }}>
                      Hoy trabajamos tren inferior con enfoque en fuerza. Recuerda: a cada serie le ganas resistencia.
                    </div>
                  </div>
                )}
                {b.tipo === 'youtube' && (
                  <div>
                    <input className="input" placeholder="Pega la URL de YouTube..." defaultValue="https://youtu.be/calentamiento" style={{ marginBottom: 12 }} />
                    <div className="row gap-12">
                      <div style={{ width: 140, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}><ImgPh label="thumbnail" h="100%" radius={0} /></div>
                      <div style={{ flex: 1 }}>
                        <input className="input" placeholder="Título (opcional)" defaultValue="Calentamiento — 8 min" style={{ minHeight: 40 }} />
                      </div>
                    </div>
                  </div>
                )}
                {b.tipo === 'pdf' && (
                  <div>
                    <div style={{ border: '1.5px dashed var(--gris-suave)', borderRadius: 10, padding: '18px', textAlign: 'center', marginBottom: 10, color: 'var(--gris-texto)' }} className="t-small">
                      <Icon name="file" size={22} color="var(--gris-suave)" style={{ display: 'block', margin: '0 auto 6px' }} />
                      Arrastra tu PDF aquí o haz clic para seleccionar
                    </div>
                    <input className="input" placeholder="Etiqueta del PDF" defaultValue="Plan de alimentación día 12" style={{ minHeight: 40 }} />
                  </div>
                )}
                {b.tipo === 'imagen' && (
                  <div style={{ border: '1.5px dashed var(--gris-suave)', borderRadius: 10, padding: '24px', textAlign: 'center', color: 'var(--gris-texto)' }} className="t-small">
                    <Icon name="image" size={24} color="var(--gris-suave)" style={{ display: 'block', margin: '0 auto 6px' }} />
                    Arrastra una imagen o haz clic para seleccionar
                  </div>
                )}
                {b.tipo === 'ejercicios' && (
                  <div>
                    {['Sentadilla con mancuerna', 'Peso muerto rumano'].map((ex, i) => (
                      <div key={i} style={{ border: '1px solid var(--gris-linea)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                        <div className="row between" style={{ marginBottom: 8 }}>
                          <div className="row gap-6" style={{ alignItems: 'center', color: 'var(--gris-suave)' }}><Icon name="drag" size={14} /><span className="t-tiny">Ejercicio {i + 1}</span></div>
                          <Icon name="x" size={14} color="var(--gris-suave)" />
                        </div>
                        <input className="input" defaultValue={ex} style={{ minHeight: 38, marginBottom: 8 }} />
                        <div className="row gap-8" style={{ marginBottom: 8 }}>
                          <input className="input" defaultValue="3" style={{ width: 54, minHeight: 36, textAlign: 'center' }} />
                          <span className="t-small" style={{ alignSelf: 'center' }}>×</span>
                          <input className="input" defaultValue="12" style={{ width: 54, minHeight: 36, textAlign: 'center' }} />
                          <span className="t-small" style={{ alignSelf: 'center' }}>reps · descanso</span>
                          <input className="input" defaultValue="60" style={{ width: 54, minHeight: 36, textAlign: 'center' }} />
                          <span className="t-small" style={{ alignSelf: 'center' }}>seg</span>
                        </div>
                        <div className="row gap-8" style={{ marginBottom: 10, alignItems: 'center' }}>
                          <Icon name="youtube" size={18} color="var(--error)" />
                          <input className="input" defaultValue={i === 0 ? 'https://youtu.be/sentadilla-demo' : 'https://youtu.be/peso-muerto-demo'} placeholder="Video del ejercicio (YouTube)" style={{ minHeight: 36, flex: 1 }} />
                        </div>
                        <div className="row gap-6" style={{ alignItems: 'center', color: 'var(--gris-texto)' }}>
                          <Icon name="info" size={14} color="var(--lavanda)" />
                          <span className="t-tiny" style={{ fontWeight: 500 }}>La clienta registrará reps y peso en cada una de las 3 series.</span>
                        </div>
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm btn-block">+ Agregar ejercicio</button>
                  </div>
                )}
              </BlockShell>
            ))}

            {/* Paleta */}
            <div style={{ marginTop: 8 }}>
              <div className="t-tiny" style={{ color: 'var(--gris-suave)', marginBottom: 8 }}>AGREGAR BLOQUE</div>
              <div className="row gap-8 wrap">
                {PALETTE.map(p => (
                  <button key={p.t} className="btn btn-secondary btn-sm" onClick={() => addBlock(p.t)} style={{ borderColor: 'var(--gris-linea)', color: 'var(--negro)' }}>
                    <Icon name={p.icon} size={16} color="var(--lavanda-dark)" /> {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="scroll-y" style={{ flex: '1 1 42%', background: 'var(--gris-claro)', padding: 22 }}>
            <div className="t-tiny" style={{ color: 'var(--gris-suave)', marginBottom: 12, textAlign: 'center' }}>VISTA PREVIA · PORTAL DE LA CLIENTA</div>
            <div style={{ background: '#fff', borderRadius: 18, padding: 20, boxShadow: 'var(--shadow-card)', maxWidth: 340, margin: '0 auto' }}>
              <div className="t-eyebrow" style={{ marginBottom: 6 }}>HOY · DÍA 12</div>
              <h2 className="t-h1" style={{ marginBottom: 12 }}>{title}</h2>
              <TypeTag type={dayType} />
              <div style={{ marginTop: 16 }}>
                {blocks.map(b => (
                  <div key={b.id} style={{ marginBottom: 16 }}>
                    {b.tipo === 'texto' && <p className="t-small" style={{ color: 'var(--negro)' }}>Hoy trabajamos tren inferior con enfoque en fuerza...</p>}
                    {b.tipo === 'youtube' && <div style={{ aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', position: 'relative' }}><ImgPh label="video" h="100%" radius={0} /><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={18} color="var(--lavanda)" /></div></div></div>}
                    {b.tipo === 'pdf' && <div className="card-gris row gap-10" style={{ padding: 10 }}><Icon name="pdf" size={20} color="var(--error)" /><span className="t-tiny" style={{ fontWeight: 600 }}>Plan de alimentación</span></div>}
                    {b.tipo === 'imagen' && <ImgPh label="imagen" h={120} />}
                    {b.tipo === 'ejercicios' && (
                      <div style={{ border: '1px solid var(--rosa)', borderRadius: 10, padding: 12 }}>
                        <div className="t-h3" style={{ fontSize: 14, marginBottom: 8 }}>Ejercicios de hoy</div>
                        {['Sentadilla con mancuerna', 'Peso muerto rumano'].map(e => (
                          <div key={e} className="row gap-8" style={{ marginBottom: 6, alignItems: 'center' }}><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--rosa-deep)' }} /><span className="t-tiny" style={{ fontWeight: 600 }}>{e}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

Object.assign(window, { AdminContent, AdminProgram, AdminEditor });
