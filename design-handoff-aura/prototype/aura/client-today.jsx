// ============================================================
// AURA — Portal Cliente · Pantalla HOY (la más importante)
// Incluye 3 variaciones de lista de ejercicios + estados
// ============================================================
const { useState, useEffect, useRef } = React;
const D = window.DATA;

// ---------- Top bar del portal ----------
function PortalTopBar({ center, right, onBack }) {
  const app = useApp();
  return (
    <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', borderBottom: '1px solid var(--gris-linea)', background: '#fff', zIndex: 6 }}>
      <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: 8 }}>
        {onBack ?
        <button className="btn-ghost" style={{ padding: 6, minHeight: 0, borderRadius: 8 }} onClick={onBack}><Icon name="arrow-left" size={21} /></button> :
        <WordMark size={19} />}
      </div>
      <div style={{ flex: 1, textAlign: 'center' }}>{center}</div>
      <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>{right}</div>
    </div>);

}

// ---------- Banner de progreso del programa ----------
function ProgramBanner({ dimmed }) {
  const { dia, totalDias, programa, variante } = D.cliente;
  return (
    <div className="card-rosa" style={{ opacity: dimmed ? 0.5 : 1, marginBottom: 18, backgroundColor: "rgb(242, 242, 242)" }}>
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="t-tiny" style={{ color: '#a87b73', letterSpacing: '.6px' }}>TU PROGRESO</div>
          <div className="font-head" style={{ fontSize: 24, fontWeight: 600, color: '#5e3d38', marginTop: 2, whiteSpace: 'nowrap' }}>
            Día {dia} <span style={{ fontSize: 16, color: '#a87b73', fontWeight: 400 }}>de {totalDias}</span>
          </div>
        </div>
        <span className="badge" style={{ background: 'rgba(255,255,255,.7)', color: '#7a5048', padding: '6px 11px', fontSize: 11.5 }}>
          {programa} · {variante}
        </span>
      </div>
      <div className="track" style={{ background: 'rgba(168,123,115,.3)' }}>
        <div className="fill" style={{ width: `${dia / totalDias * 100}%` }} />
      </div>
    </div>);

}

// ---------- Encabezado del día ----------
function DayHeader() {
  const { titulo, tipo, duracion, dia } = D.hoy;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>HOY · DÍA {dia}</div>
      <h1 className="t-display" style={{ marginBottom: 14 }}>{titulo}</h1>
      <div className="row gap-8 wrap">
        <TypeTag type={tipo} />
        <span className="badge" style={{ background: 'var(--gris-claro)', color: 'var(--gris-texto)', padding: '6px 12px', fontSize: 12.5 }}>
          <Icon name="timer" size={14} /> {duracion} minutos
        </span>
      </div>
    </div>);

}

// ---------- Bloque: texto enriquecido ----------
function RichTextBlock() {
  return (
    <div style={{ marginBottom: 26 }}>
      <p className="t-body" style={{ marginTop: 0, marginBottom: 14 }}>{D.hoy.intro}</p>
      <h3 className="t-h3" style={{ marginBottom: 10 }}>Antes de empezar</h3>
      <ul style={{ margin: 0, paddingLeft: 20 }} className="t-body">
        <li style={{ marginBottom: 7 }}>Ten a la mano tus <strong>mancuernas</strong> y una botella de agua.</li>
        <li style={{ marginBottom: 7 }}>Haz el calentamiento completo — <strong>hoy no nos lo saltamos</strong>.</li>
        <li>Si algo te molesta, baja el peso o descansa. Tu seguridad es primero.</li>
      </ul>
    </div>);

}

// ---------- Bloque: video de YouTube ----------
function YouTubeBlock({ titulo, dur }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', aspectRatio: '16/9', background: '#1a1a1a' }}>
        {!playing ?
        <>
            <ImgPh label="thumbnail del video" h="100%" radius={0} />
            <button onClick={() => setPlaying(true)} aria-label="Reproducir"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(26,26,26,0.12)', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}>
                <Icon name="play" size={26} color="var(--lavanda)" />
              </div>
            </button>
          </> :

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,.85)' }}>
            <Icon name="youtube" size={42} color="#fff" />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>Reproduciendo · {titulo}</span>
          </div>
        }
      </div>
      <div className="t-small" style={{ marginTop: 8 }}>{titulo} — {dur}</div>
    </div>);

}

// ---------- Bloque: PDF ----------
function PdfBlock({ archivo, tam }) {
  return (
    <div className="card-gris row between" style={{ marginBottom: 22, padding: '14px 16px' }}>
      <div className="row gap-12">
        <div style={{ width: 42, height: 42, borderRadius: 9, background: 'rgba(224,92,92,.12)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pdf" size={22} color="var(--error)" />
        </div>
        <div>
          <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{archivo}</div>
          <div className="t-small">PDF · {tam}</div>
        </div>
      </div>
      <button className="btn-link" style={{ fontFamily: 'var(--font-head)', fontWeight: 500 }}>Abrir</button>
    </div>);

}

// ---------- Video por ejercicio (uno por ejercicio) ----------
function ExerciseVideo({ ex }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ borderRadius: 10, overflow: 'hidden', position: 'relative', aspectRatio: '16/9', background: '#1a1a1a' }}>
        {!playing ?
        <>
            <ImgPh label={'demo · ' + ex.nombre.toLowerCase()} h="100%" radius={0} />
            <button onClick={() => setPlaying(true)} aria-label="Reproducir demostración"
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,26,26,0.12)', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.25)' }}>
                <Icon name="play" size={22} color="var(--lavanda)" />
              </div>
            </button>
            <span style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(26,26,26,.6)', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, fontFamily: 'var(--font-body)' }}>Ver demostración</span>
          </> :

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,.85)' }}>
            <Icon name="youtube" size={34} color="#fff" />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>Reproduciendo demostración</span>
          </div>
        }
      </div>
    </div>);

}

// ---------- Input pequeño de captura ----------
function SmallInput({ value, onChange, placeholder, unit }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" placeholder={placeholder}
      style={{ width: '100%', padding: '8px 10px', paddingRight: unit ? 28 : 10, border: '1.5px solid var(--gris-linea)', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: 14, background: '#fff', outline: 'none', textAlign: 'center' }}
      onFocus={(e) => e.target.style.borderColor = 'var(--lavanda)'}
      onBlur={(e) => e.target.style.borderColor = 'var(--gris-linea)'} />
      {unit && <span style={{ position: 'absolute', right: 8, top: 9, fontSize: 11, color: 'var(--gris-suave)', fontFamily: 'var(--font-body)' }}>{unit}</span>}
    </div>);

}

// ---------- Captura por serie (una fila por serie) ----------
function SeriesCapture({ ex, vals, setSerie }) {
  const usaPeso = ex.metricas.includes('peso');
  return (
    <div style={{ marginTop: 12, background: 'var(--gris-claro)', borderRadius: 10, padding: '12px 12px 14px' }}>
      <div className="t-tiny" style={{ color: 'var(--gris-texto)', marginBottom: 8, letterSpacing: '.4px' }}>MI REGISTRO · {ex.series} SERIES DE {ex.reps} REPS</div>
      <div className="row gap-8" style={{ marginBottom: 6 }}>
        <span style={{ width: 52, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--gris-texto)', fontFamily: 'var(--font-body)', textAlign: 'center' }}>Reps</span>
        {usaPeso && <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--gris-texto)', fontFamily: 'var(--font-body)', textAlign: 'center' }}>Peso (kg)</span>}
      </div>
      <div className="col gap-6">
        {Array.from({ length: ex.series }).map((_, i) =>
        <div key={i} className="row gap-8" style={{ alignItems: 'center' }}>
            <span style={{ width: 52, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--negro)', fontFamily: 'var(--font-body)' }}>Serie {i + 1}</span>
            <SmallInput value={vals?.[i]?.reps || ''} onChange={(v) => setSerie(ex.id, i, 'reps', v)} placeholder={String(ex.reps)} />
            {usaPeso && <SmallInput value={vals?.[i]?.peso || ''} onChange={(v) => setSerie(ex.id, i, 'peso', v)} placeholder="0" />}
          </div>
        )}
      </div>
    </div>);

}

// ============================================================
//   LISTA DE EJERCICIOS — 3 VARIACIONES
// ============================================================
function ExerciseList() {
  const variant = 'b';
  const app = useApp();
  const { checked, exVals } = app.store;
  const ejercicios = D.ejercicios;
  const allDone = ejercicios.every((e) => checked[e.id]);
  const doneCount = ejercicios.filter((e) => checked[e.id]).length;

  const setCheck = (id, v) => app.update((s) => ({ checked: { ...s.checked, [id]: v } }));
  const setSerie = (id, idx, field, v) => app.update((s) => {
    const arr = s.exVals[id] ? [...s.exVals[id]] : [];
    arr[idx] = { ...(arr[idx] || {}), [field]: v };
    return { exVals: { ...s.exVals, [id]: arr } };
  });

  const metricInputs = (e) =>
  <>
      <ExerciseVideo ex={e} />
      <SeriesCapture ex={e} vals={exVals[e.id]} setSerie={setSerie} />
    </>;


  const celebra = allDone &&
  <div className="fade-up" style={{ marginTop: 16, background: 'rgba(76,175,125,.12)', borderRadius: 12,
    padding: '16px 18px', textAlign: 'center' }}>
      <div className="font-head" style={{ fontSize: 17, fontWeight: 600, color: 'var(--exito-deep)' }}>¡Excelente trabajo hoy! 🎉</div>
      <div className="t-small" style={{ color: 'var(--exito-deep)', marginTop: 2 }}>Completaste todos tus ejercicios. Sigue así.</div>
    </div>;


  // ----- Header común -----
  const header =
  <div className="row between" style={{ marginBottom: 4 }}>
      <h3 className="t-h2" style={{ whiteSpace: 'nowrap' }}>Ejercicios de hoy</h3>
      <span className="t-small" style={{ fontWeight: 600, color: allDone ? 'var(--exito-deep)' : 'var(--gris-texto)' }}>
        {doneCount}/{ejercicios.length}
      </span>
    </div>;


  // ===== VARIANTE A — Editorial checklist =====
  if (variant === 'a') {
    return (
      <div style={{ marginBottom: 24 }}>
        {header}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
          {ejercicios.map((e, i) => {
            const done = checked[e.id];
            return (
              <div key={e.id} style={{ padding: '18px 18px', borderTop: i ? '1px solid #f1eae9' : 'none',
                opacity: done ? 0.55 : 1, transition: 'opacity .25s ease' }}>
                <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                  <CheckRound checked={done} onChange={(v) => setCheck(e.id, v)} />
                  <div style={{ flex: 1 }}>
                    <div className="font-head" style={{ fontSize: 16.5, fontWeight: 600,
                      textDecoration: done ? 'line-through' : 'none' }}>{e.nombre}</div>
                    <div className="t-small" style={{ marginTop: 2 }}>{e.series} series × {e.reps} reps · Descanso {e.descanso}s</div>
                    <div className="row gap-6" style={{ marginTop: 6, alignItems: 'flex-start' }}>
                      <Icon name="info" size={13} color="var(--lavanda)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span className="t-small" style={{ color: 'var(--lavanda-dark)', fontStyle: 'italic' }}>{e.nota}</span>
                    </div>
                    {!done && metricInputs(e)}
                  </div>
                </div>
              </div>);

          })}
        </div>
        {celebra}
      </div>);

  }

  // ===== VARIANTE B — Card stack (cada ejercicio su tarjeta) =====
  if (variant === 'b') {
    return (
      <div style={{ marginBottom: 24 }}>
        {header}
        <div className="col gap-12" style={{ marginTop: 12 }}>
          {ejercicios.map((e, i) => {
            const done = checked[e.id];
            return (
              <div key={e.id} className="card" style={{ padding: 18,
                borderColor: done ? 'rgba(76,175,125,.4)' : 'var(--gris-linea)',
                background: done ? 'rgba(76,175,125,.05)' : '#fff', transition: 'all .25s ease' }}>
                <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                  <div className="row gap-10" style={{ alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: done ? 'var(--exito)' : 'var(--lavanda-tint)',
                      color: done ? '#fff' : 'var(--lavanda-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{i + 1}</div>
                    <div className="font-head" style={{ fontSize: 16.5, fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{e.nombre}</div>
                  </div>
                  <CheckRound checked={done} onChange={(v) => setCheck(e.id, v)} size={28} />
                </div>
                <div className="row gap-8 wrap" style={{ marginBottom: done ? 0 : 4 }}>
                  <span className="badge badge-lavanda">{e.series} × {e.reps}</span>
                  <span className="badge" style={{ background: 'var(--gris-claro)', color: 'var(--gris-texto)' }}>Descanso {e.descanso}s</span>
                </div>
                <div className="t-small" style={{ color: 'var(--lavanda-dark)', fontStyle: 'italic', marginTop: 8 }}>{e.nota}</div>
                {!done && metricInputs(e)}
              </div>);

          })}
        </div>
        {celebra}
      </div>);

  }

  // ===== VARIANTE C — Compacta con acordeón =====
  return (
    <div style={{ marginBottom: 24 }}>
      {header}
      <div className="card" style={{ padding: 6, marginTop: 12 }}>
        {ejercicios.map((e, i) => {
          const done = checked[e.id];
          return <AccordionExercise key={e.id} e={e} done={done} setCheck={setCheck} metricInputs={metricInputs} first={i === 0} />;
        })}
      </div>
      {celebra}
    </div>);

}

function AccordionExercise({ e, done, setCheck, metricInputs, first }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid #f1eae9' }}>
      <div className="row gap-12" style={{ padding: '12px 10px', cursor: 'pointer', opacity: done ? 0.55 : 1 }}
      onClick={() => setOpen((o) => !o)}>
        <CheckRound checked={done} onChange={(v) => setCheck(e.id, v)} size={24} />
        <div style={{ flex: 1 }}>
          <div className="font-head" style={{ fontSize: 15.5, fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{e.nombre}</div>
          <div className="t-small" style={{ fontSize: 12.5 }}>{e.series} × {e.reps} · {e.descanso}s</div>
        </div>
        <Icon name="chevron-down" size={18} color="var(--gris-suave)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
      </div>
      {open &&
      <div className="fade-up" style={{ padding: '0 10px 14px 46px' }}>
          <div className="t-small" style={{ color: 'var(--lavanda-dark)', fontStyle: 'italic', marginBottom: 4 }}>{e.nota}</div>
          {!done && metricInputs(e)}
        </div>
      }
    </div>);

}

// ---------- Notas generales ----------
function NotesField() {
  const app = useApp();
  return (
    <div style={{ marginBottom: 18 }}>
      <label className="field-label" style={{ marginBottom: 8 }}>Mis notas de hoy <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span></label>
      <textarea className="textarea" style={{ background: 'var(--gris-claro)', border: '1.5px solid transparent' }}
      placeholder="¿Cómo te sentiste? ¿Algo que quieras recordar?"
      value={app.store.notas} onChange={(e) => app.update(() => ({ notas: e.target.value }))} />
    </div>);

}

// ---------- Estados especiales ----------
function RestDayCard() {
  return (
    <div className="card-rosa fade-up" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 20 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon name="moon" size={28} color="var(--lavanda-dark)" />
      </div>
      <h2 className="t-h2" style={{ color: '#5e3d38', marginBottom: 8 }}>Hoy es día de descanso 💙</h2>
      <p className="t-body text-pretty" style={{ color: '#7a5048', margin: '0 auto', maxWidth: 300 }}>
        Tu cuerpo crece cuando descansa. Camina ligero, hidrátate y duerme bien. Mañana volvemos con todo.
      </p>
    </div>);

}

function NotAvailableCard() {
  return (
    <div className="card fade-up" style={{ textAlign: 'center', padding: '36px 24px', marginBottom: 20 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--lavanda-tint)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon name="clock" size={28} color="var(--lavanda)" />
      </div>
      <h2 className="t-h3" style={{ marginBottom: 8 }}>El contenido de hoy estará disponible pronto</h2>
      <p className="t-small text-pretty" style={{ margin: '0 auto', maxWidth: 280 }}>
        Aura está preparando tu programa. Vuelve en un ratito. 💜
      </p>
    </div>);

}

function PastDueBanner() {
  return (
    <div style={{ background: 'var(--error-tint)', borderRadius: 12, padding: '14px 16px', marginBottom: 18,
      display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Icon name="warning" size={20} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div className="font-body" style={{ fontWeight: 600, fontSize: 14, color: 'var(--error)' }}>Hubo un problema con tu pago</div>
        <div className="t-small" style={{ marginTop: 2 }}>Actualiza tu método de pago para no perder tu acceso.</div>
        <button className="btn btn-sm" style={{ background: 'var(--error)', color: '#fff', marginTop: 10 }}>Actualizar pago</button>
      </div>
    </div>);

}

// ---------- Barra de guardado sticky ----------
function SaveBar() {
  const app = useApp();
  const saved = app.store.saved;
  return (
    <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--gris-linea)',
      background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)' }}>
      <button className={'btn btn-block btn-lg ' + (saved ? 'btn-success' : 'btn-primary')}
      onClick={() => {app.update(() => ({ saved: true }));app.toast('¡Guardado! Sigue así 💜');}}
      style={{ opacity: saved ? 0.92 : 1 }}>
        {saved ? <><Icon name="check" size={18} strokeWidth={2.6} color="#fff" /> Progreso del día guardado</> : 'Guardar mi progreso de hoy'}
      </button>
    </div>);

}

// ============================================================
//   PANTALLA HOY
// ============================================================
function TodayScreen() {
  const app = useApp();
  const st = app.todayState; // normal | descanso | nodisp | pastdue
  const exStyle = app.exStyle; // a | b | c
  const scrollRef = useRef(null);

  return (
    <>
      <PortalTopBar
        center={<div className="t-small" style={{ fontWeight: 500 }}>{D.hoy.fecha}</div>}
        right={<Avatar name={D.cliente.nombre} size={34} />} />

      <div ref={scrollRef} className="scroll-y" style={{ flex: 1, padding: '18px 18px 28px' }}>
        {st === 'pastdue' && <PastDueBanner />}
        <ProgramBanner dimmed={st === 'pastdue'} />

        {st === 'nodisp' ?
        <NotAvailableCard /> :

        <div style={{ opacity: st === 'pastdue' ? 0.55 : 1, pointerEvents: st === 'pastdue' ? 'none' : 'auto' }}>
            <DayHeader />
            {st === 'descanso' ?
          <RestDayCard /> :

          <>
                <RichTextBlock />
                <YouTubeBlock titulo={D.hoy.bloques[1].titulo} dur={D.hoy.bloques[1].dur} />
                <ExerciseList variant={exStyle} />
                <PdfBlock archivo={D.hoy.bloques[3].archivo} tam={D.hoy.bloques[3].tam} />
                <YouTubeBlock titulo={D.hoy.bloques[4].titulo} dur={D.hoy.bloques[4].dur} />
              </>
          }
            <NotesField />
          </div>
        }
      </div>

      {st !== 'nodisp' && st !== 'pastdue' && <SaveBar />}
      <BottomTabs active="today" unread={2} />
    </>);

}

window.TodayScreen = TodayScreen;
window.PortalTopBar = PortalTopBar;