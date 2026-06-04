// ============================================================
// AURA — Flujo de autenticación
// Checkout · Login · Registro · Recuperar contraseña
// ============================================================
const { useState: useStateA } = React;
const DA = window.DATA;

// Contenedor de auth: logo SIEMPRE fijo a la misma altura arriba
function AuthWrap({ children, bg = 'var(--rosa-soft)', center = false }) {
  return (
    <div className="scroll-y" style={{ flex: 1, background: bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, textAlign: 'center', padding: '32px 22px 16px' }}>
        <Logo height={32} mono />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: center ? 'center' : 'flex-start', padding: '4px 22px 36px' }}>
        {children}
      </div>
    </div>
  );
}

function AuthFooter() {
  return (
    <div className="t-tiny" style={{ textAlign: 'center', color: 'var(--gris-suave)', marginTop: 24, fontWeight: 400 }}>
      © Aura Maristany · <span style={{ textDecoration: 'underline' }}>Términos</span> · <span style={{ textDecoration: 'underline' }}>Privacidad</span>
    </div>
  );
}

// ============================================================
//   1 · CHECKOUT
// ============================================================
function IconRow({ icon, children }) {
  return (
    <div className="row gap-12" style={{ padding: '11px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--lavanda-tint)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={19} color="var(--lavanda-dark)" />
      </div>
      <span className="t-body" style={{ fontSize: 15 }}>{children}</span>
    </div>
  );
}

function CheckoutScreen() {
  const app = useApp();
  const error = app.demoState.checkout === 'error';

  if (error) {
    return (
      <AuthWrap center>
        <div style={{ background: 'var(--error-tint)', border: '1px solid rgba(224,92,92,.25)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(224,92,92,.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Icon name="lock" size={26} color="var(--error)" />
          </div>
          <h2 className="t-h2" style={{ marginBottom: 10 }}>Aún no puedes acceder a este programa</h2>
          <p className="t-small text-pretty" style={{ marginBottom: 20 }}>
            CuarentaMás Extra está disponible cuando termines tu programa CuarentaMás. ¡Ya casi lo logras!
          </p>
          <button className="btn btn-primary btn-block" onClick={() => app.go('today')}>Ver mis programas activos</button>
        </div>
        <AuthFooter />
      </AuthWrap>
    );
  }

  return (
    <AuthWrap>
      {/* Hero */}
      <div style={{ marginBottom: 4 }}>
        <h1 className="t-display" style={{ fontSize: 38, textAlign: 'center' }}>CuarentaMás</h1>
        <p className="t-small" style={{ textAlign: 'center', marginTop: 4 }}>Nivel Principiante · Hasta 45 minutos por día</p>
      </div>
      <div style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', margin: '16px 0' }}>
        <ImgPh label="mujer 40+ activa · lifestyle" h={200} radius={16} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(94,61,56,.32), transparent 55%)' }} />
      </div>

      {/* Card resumen */}
      <div className="card" style={{ padding: '8px 22px 22px' }}>
        <IconRow icon="calendar">Programa de <strong>6 meses</strong>, día a día</IconRow>
        <div className="hr-soft" />
        <IconRow icon="weight">Nivel <strong>Principiante</strong> · CuarentaMás</IconRow>
        <div className="hr-soft" />
        <IconRow icon="check">Ejercicios · Alimentación · Hábitos</IconRow>
        <div className="hr-soft" />
        <IconRow icon="lock-open">Acceso a contenido nuevo cada día</IconRow>
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--gris-linea)', textAlign: 'center' }}>
          <div className="font-head" style={{ fontSize: 36, fontWeight: 600 }}>MX$799 <span style={{ fontSize: 18, color: 'var(--gris-texto)', fontWeight: 400 }}>/ mes</span></div>
          <div className="t-small" style={{ marginTop: 2 }}>Facturación mensual · Cancela cuando quieras</div>
        </div>
      </div>

      {/* Testimonial */}
      <div className="card-rosa row gap-12" style={{ marginTop: 16, alignItems: 'center' }}>
        <Avatar name="Roxana P" size={48} />
        <div style={{ flex: 1 }}>
          <p className="t-body" style={{ fontSize: 14.5, fontStyle: 'italic', margin: 0, color: '#5e3d38' }}>
            «A los 52 me siento más fuerte que a los 40. Aura me devolvió la confianza.»
          </p>
          <div className="t-tiny" style={{ color: '#a87b73', marginTop: 6 }}>— Roxana, clienta desde 2025</div>
        </div>
      </div>

      {/* CTA */}
      <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} onClick={() => app.go('register')}>
        Comenzar ahora
      </button>
      <p className="t-tiny" style={{ textAlign: 'center', color: 'var(--gris-suave)', marginTop: 10, fontWeight: 400, lineHeight: 1.5 }}>
        Serás redirigida a una página segura de pago.<br />Regresarás aquí para completar tu registro.
      </p>
      <AuthFooter />
    </AuthWrap>
  );
}

// ============================================================
//   2 · LOGIN
// ============================================================
function LoginScreen() {
  const app = useApp();
  const error = app.demoState.login === 'error';
  return (
    <AuthWrap center bg="#fff">
      <div className="card" style={{ padding: 28 }}>
        <h1 className="t-h1" style={{ textAlign: 'center' }}>Bienvenida de vuelta</h1>
        <p className="t-small" style={{ textAlign: 'center', marginTop: 4, marginBottom: 22 }}>Ingresa con tu correo electrónico</p>

        <Field label="Correo electrónico" icon="mail" type="email" placeholder="tucorreo@ejemplo.com" defaultValue="mariaelena.g@gmail.com" error={error ? ' ' : null} />
        <Field label="Contraseña" icon="lock" type="password" placeholder="••••••••" defaultValue="123456" error={error ? 'Correo o contraseña incorrectos. Intenta de nuevo.' : null} />
        <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 14 }}>
          <button className="btn-link" onClick={() => app.go('reset')}>¿Olvidaste tu contraseña?</button>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => app.go('today')}>Ingresar</button>

        <div className="row center gap-12" style={{ margin: '18px 0' }}>
          <div className="hr" style={{ flex: 1 }} /><span className="t-small">o</span><div className="hr" style={{ flex: 1 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <span className="t-small">¿No tienes cuenta? </span>
          <button className="btn-link" onClick={() => app.go('checkout')}>Regístrate aquí</button>
        </div>
      </div>
      <AuthFooter />
    </AuthWrap>
  );
}

// ============================================================
//   3 · REGISTRO
// ============================================================
function RegisterScreen() {
  const app = useApp();
  const [terms, setTerms] = useStateA(false);
  const exito = app.demoState.register === 'exito';

  if (exito) {
    return (
      <AuthWrap center bg="#fff">
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="pop-in" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--lavanda-tint)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="mail" size={34} color="var(--lavanda)" />
          </div>
          <h1 className="t-h1" style={{ marginBottom: 10 }}>¡Ya casi! Revisa tu correo</h1>
          <p className="t-body text-pretty" style={{ fontSize: 15, marginBottom: 24 }}>
            Te enviamos un enlace de confirmación a <strong>mariaelena.g@gmail.com</strong>. Haz clic en él para activar tu cuenta y continuar.
          </p>
          <button className="btn btn-secondary btn-block" onClick={() => app.toast('Correo reenviado')}>Reenviar correo</button>
          <button className="btn-link" style={{ marginTop: 14 }} onClick={() => app.go('today')}>Ya confirmé, continuar →</button>
        </div>
        <AuthFooter />
      </AuthWrap>
    );
  }

  return (
    <AuthWrap center bg="#fff">
      <div className="card" style={{ padding: 28 }}>
        <h1 className="t-h1" style={{ textAlign: 'center' }}>Crea tu cuenta</h1>
        <p className="t-small" style={{ textAlign: 'center', marginTop: 4, marginBottom: 20 }}>Para acceder a tu programa de Aura</p>

        <Field label="Nombre completo" icon="user" placeholder="María Elena García" />
        <Field label="Correo electrónico" icon="mail" type="email" placeholder="tucorreo@ejemplo.com" />
        <Field label="Contraseña" icon="lock" type="password" placeholder="Mínimo 8 caracteres" hint="Usa 8 o más caracteres" />
        <Field label="Confirmar contraseña" icon="lock" type="password" placeholder="Repite tu contraseña" />

        <div className="row gap-10" style={{ alignItems: 'flex-start', margin: '6px 0 18px', cursor: 'pointer' }} onClick={() => setTerms(t => !t)}>
          <CheckSq checked={terms} onChange={setTerms} />
          <span className="t-small" style={{ lineHeight: 1.45 }}>Acepto los <span style={{ textDecoration: 'underline', color: 'var(--lavanda-dark)' }}>Términos y Condiciones</span> y la <span style={{ textDecoration: 'underline', color: 'var(--lavanda-dark)' }}>Política de Privacidad</span></span>
        </div>
        <button className="btn btn-primary btn-block" disabled={!terms} onClick={() => app.setDemo('register', 'exito')}>Crear mi cuenta</button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span className="t-small">¿Ya tienes cuenta? </span>
          <button className="btn-link" onClick={() => app.go('login')}>Inicia sesión</button>
        </div>
      </div>
      <AuthFooter />
    </AuthWrap>
  );
}

// ============================================================
//   4 · RECUPERAR CONTRASEÑA
// ============================================================
function ResetScreen() {
  const app = useApp();
  const paso = app.demoState.reset;
  return (
    <AuthWrap center bg="#fff">
      <div className="card" style={{ padding: 30 }}>
        {paso === 'paso1' && (
          <>
            <h1 className="t-h1" style={{ textAlign: 'center', marginBottom: 8 }}>¿Olvidaste tu contraseña?</h1>
            <p className="t-small text-pretty" style={{ textAlign: 'center', marginBottom: 22 }}>Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>
            <Field label="Correo electrónico" icon="mail" type="email" placeholder="tucorreo@ejemplo.com" />
            <button className="btn btn-primary btn-block" onClick={() => app.setDemo('reset', 'paso2')}>Enviar enlace</button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn-link" onClick={() => app.go('login')}>← Volver al inicio de sesión</button>
            </div>
          </>
        )}
        {paso === 'paso2' && (
          <div style={{ textAlign: 'center' }}>
            <div className="pop-in" style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(76,175,125,.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', position: 'relative' }}>
              <Icon name="mail" size={30} color="var(--exito)" />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%', background: 'var(--exito)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                <Icon name="check-sm" size={14} strokeWidth={3} color="#fff" />
              </div>
            </div>
            <h1 className="t-h1" style={{ marginBottom: 10 }}>Revisa tu correo</h1>
            <p className="t-body text-pretty" style={{ fontSize: 15, marginBottom: 22 }}>
              Si existe una cuenta con ese correo, recibirás instrucciones en los próximos minutos.
            </p>
            <button className="btn btn-secondary btn-block" onClick={() => app.go('login')}>Volver al inicio de sesión</button>
          </div>
        )}
        {paso === 'paso3' && (
          <>
            <h1 className="t-h1" style={{ textAlign: 'center', marginBottom: 8 }}>Crea una nueva contraseña</h1>
            <p className="t-small" style={{ textAlign: 'center', marginBottom: 22 }}>Que sea fácil de recordar para ti.</p>
            <Field label="Nueva contraseña" icon="lock" type="password" placeholder="Mínimo 8 caracteres" />
            <Field label="Confirmar nueva contraseña" icon="lock" type="password" placeholder="Repite tu contraseña" />
            <button className="btn btn-primary btn-block" onClick={() => { app.toast('¡Contraseña actualizada! 💜'); app.go('login'); }}>Guardar contraseña</button>
          </>
        )}
      </div>
      <AuthFooter />
    </AuthWrap>
  );
}

Object.assign(window, { CheckoutScreen, LoginScreen, RegisterScreen, ResetScreen });
