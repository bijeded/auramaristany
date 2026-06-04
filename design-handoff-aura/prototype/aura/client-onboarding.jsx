// ============================================================
// AURA — Onboarding · Cuestionario de bienvenida (wizard)
// ============================================================
const DO = window.DATA;

function ProgressTop({ idx, total, onBack }) {
  return (
    <div style={{ flexShrink: 0, padding: '14px 20px 4px' }}>
      <div className="row gap-12" style={{ marginBottom: 10 }}>
        {idx > 0 && (
          <button className="btn-ghost" style={{ padding: 4, minHeight: 0, borderRadius: 8 }} onClick={onBack}>
            <Icon name="arrow-left" size={20} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div className="track" style={{ background: 'var(--rosa)' }}>
            <div className="fill" style={{ width: `${(idx / total) * 100}%` }} />
          </div>
        </div>
        <span className="t-tiny" style={{ color: 'var(--gris-texto)', whiteSpace: 'nowrap' }}>{idx} de {total}</span>
      </div>
    </div>
  );
}

function SelectCard({ selected, onClick, children, multi }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', cursor: 'pointer',
      background: selected ? 'var(--lavanda-tint)' : '#fff',
      border: '1.5px solid', borderColor: selected ? 'var(--lavanda)' : 'var(--gris-linea)',
      borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, transition: 'all .15s ease', marginBottom: 10 }}>
      <span className="font-body" style={{ fontSize: 15.5, fontWeight: 600, color: selected ? 'var(--lavanda-dark)' : 'var(--negro)' }}>{children}</span>
      <span style={{ width: 24, height: 24, borderRadius: multi ? 6 : '50%', flexShrink: 0,
        border: '2px solid', borderColor: selected ? 'var(--lavanda)' : 'var(--gris-linea)',
        background: selected ? 'var(--lavanda)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <Icon name="check-sm" size={14} strokeWidth={3} color="#fff" />}
      </span>
    </button>
  );
}

function OnboardingScreen() {
  const app = useApp();
  const preguntas = DO.onboardingPreguntas;
  const total = preguntas.length;
  const step = app.store.onboardingStep;      // 0 = bienvenida, 1..total = preguntas, total+1 = final
  const ans = app.store.onboardingAns;
  const setStep = (s) => app.update(() => ({ onboardingStep: Math.max(0, Math.min(total + 1, s)) }));
  const setAns = (id, v) => app.update(st => ({ onboardingAns: { ...st.onboardingAns, [id]: v } }));

  // ----- Bienvenida -----
  if (step === 0) {
    return (
      <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '32px 26px', textAlign: 'center', background: 'var(--rosa-soft)' }}>
        <div style={{ margin: '0 auto 22px', borderRadius: '50%', overflow: 'hidden', width: 116, height: 116, boxShadow: 'var(--shadow-card)' }}>
          <ImgPh label="foto de Aura" w={116} h={116} radius={0} />
        </div>
        <h1 className="t-display" style={{ marginBottom: 14 }}>¡Hola! Soy Aura</h1>
        <p className="t-body text-pretty" style={{ fontSize: 16, color: '#5e3d38', maxWidth: 320, margin: '0 auto 28px' }}>
          Antes de comenzar, necesito conocerte un poco mejor para poder acompañarte de la mejor manera posible. Son solo unos minutos.
        </p>
        <button className="btn btn-primary btn-lg" style={{ alignSelf: 'center', minWidth: 220 }} onClick={() => setStep(1)}>
          Comenzar <Icon name="arrow-right" size={18} color="#fff" />
        </button>
      </div>
    );
  }

  // ----- Final -----
  if (step === total + 1) {
    return (
      <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '32px 26px', textAlign: 'center', background: 'var(--rosa-soft)' }}>
        <div className="pop-in" style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--lavanda)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
          <Icon name="heart" size={42} color="#fff" />
        </div>
        <h1 className="t-display" style={{ marginBottom: 14 }}>¡Todo listo!</h1>
        <p className="t-body text-pretty" style={{ fontSize: 16, color: '#5e3d38', maxWidth: 320, margin: '0 auto 28px' }}>
          Voy a revisar tus respuestas para personalizar tu acompañamiento. Tu programa comienza hoy.
        </p>
        <button className="btn btn-primary btn-lg" style={{ alignSelf: 'center', minWidth: 240 }} onClick={() => app.go('today')}>
          Ver mi programa de hoy <Icon name="arrow-right" size={18} color="#fff" />
        </button>
      </div>
    );
  }

  // ----- Pregunta -----
  const q = preguntas[step - 1];
  const val = ans[q.id];
  const answered = q.tipo === 'multiple' ? (val && val.length) : (val !== undefined && val !== '');
  const canNext = !q.obligatoria || answered;

  const toggleMulti = (op) => {
    const cur = val || [];
    setAns(q.id, cur.includes(op) ? cur.filter(x => x !== op) : [...cur, op]);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <ProgressTop idx={step} total={total} onBack={() => setStep(step - 1)} />
      <div className="scroll-y fade-up" key={q.id} style={{ flex: 1, padding: '14px 24px 20px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>{step} de {total}</div>
        <h2 className="t-h1" style={{ marginBottom: q.tipo === 'multiple' ? 4 : 22, lineHeight: 1.15 }}>{q.texto}</h2>
        {q.tipo === 'multiple' && <p className="t-small" style={{ marginBottom: 18 }}>Puedes elegir varias opciones</p>}

        {q.tipo === 'unica' && q.opciones.map(op => (
          <SelectCard key={op} selected={val === op} onClick={() => setAns(q.id, op)}>{op}</SelectCard>
        ))}
        {q.tipo === 'multiple' && q.opciones.map(op => (
          <SelectCard key={op} multi selected={(val || []).includes(op)} onClick={() => toggleMulti(op)}>{op}</SelectCard>
        ))}
        {q.tipo === 'numero' && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12, padding: '20px 0' }}>
            <input inputMode="numeric" value={val || ''} onChange={e => setAns(q.id, e.target.value.replace(/\D/g, ''))}
              placeholder="00" style={{ width: 130, textAlign: 'center', fontFamily: 'var(--font-head)', fontSize: 56, fontWeight: 600,
              border: 'none', borderBottom: '2.5px solid var(--lavanda)', outline: 'none', background: 'transparent', color: 'var(--negro)' }} />
            <span className="t-h2" style={{ color: 'var(--gris-texto)' }}>{q.unidad}</span>
          </div>
        )}
        {q.tipo === 'libre' && (
          <>
            <textarea className="textarea" style={{ minHeight: 140 }} value={val || ''} onChange={e => setAns(q.id, e.target.value)}
              placeholder="Escribe aquí lo que quieras compartir (lesiones, miedos, metas, lo que sea)..." />
            {!q.obligatoria && <p className="t-small" style={{ marginTop: 8 }}>Esta respuesta es opcional</p>}
          </>
        )}
      </div>
      <div style={{ flexShrink: 0, padding: '12px 24px', borderTop: '1px solid var(--gris-linea)' }}>
        <button className="btn btn-primary btn-block btn-lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
          {step === total ? 'Finalizar' : 'Siguiente'} <Icon name="arrow-right" size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
}

window.OnboardingScreen = OnboardingScreen;
