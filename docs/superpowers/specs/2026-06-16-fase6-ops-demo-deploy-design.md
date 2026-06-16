# Diseño — Fase 6 bloque Ops: Demo en línea (A2 + A3 + A4-parcial)

Fecha: **2026-06-16**
Archivo: `docs/superpowers/specs/2026-06-16-fase6-ops-demo-deploy-design.md`

---

## Objetivo

Publicar un **demo en línea funcional** de Aura Maristany en `app.auramaristany.com` para que Aura Maristany lo explore (como admin y como cliente), lo pruebe y dé retroalimentación. **No es un lanzamiento productivo:** no hay cobros reales, los datos de clientes son simulados, y el desarrollo continúa después sobre Vercel (Preview/Production).

## Decisiones tomadas (brainstorming 2026-06-16)

| Tema | Decisión |
|------|----------|
| Modo Stripe | **Test mode** ahora (checkout funciona con tarjetas de prueba, sin cobros). Flip a live cuando Aura defina precios. |
| Proyecto Supabase prod | **Mismo proyecto** `bgvxaagfnzvzamtxqbkg` (ya tiene migraciones 001–010 y contenido). |
| Email (A2) | **Completo**: dominio verificado en Resend + SMTP en Supabase + **confirmación de email activada** + emails de ciclo de vida. |
| Datos demo | **Se conservan** (no se limpian). Aura debe ver 20 clientes simulados + contenido real de programas. |
| Workflow Vercel | `main` → Production (lo que ve Aura). Ramas de feature → Preview URLs para desarrollo continuo sin romper el demo. |
| Precios | Pendientes de Aura. Quedan en placeholder ($999 test). A4-live es trabajo futuro. |

## Naturaleza del bloque

Mayormente **configuración en dashboards externos** (ejecutada por Francisco con sus credenciales) + dos correcciones de código pequeñas + verificación. No amerita worktree/subagent-driven (eso es para features); es un runbook de despliegue.

---

## Componentes

### 1. Correcciones de código (previas al deploy)

**1.1 — Foco 1: Secreto filtrado en `scripts/seed-demo.ts`**
- Problema: `MGMT_TOKEN` hardcodeado en texto plano (línea 17). El archivo está untracked (aún no commiteado).
- Fix:
  - Leer el token desde `process.env.SUPABASE_MGMT_TOKEN` (o equivalente), con guard si falta.
  - **Rotar** el token actual en Supabase (acción manual de Francisco), ya que estuvo en disco.
  - Documentar la variable en `.env.local` (solo local; nunca a producción).

**1.2 — Foco 2: Seed aditivo (opción a)**
- Problema: `seed-demo.ts` hace `DELETE` de las tablas de catálogo (`program_series`, `program_days`, `program_*_blocks`, `variant_series_map`, `programs`, `program_variants`, `onboarding_questions`, …) y solo re-inserta programas + variantes + 1 pregunta. Esto borraría el contenido real (incluida la serie creada hoy) y dejaría el portal sin contenido.
- Fix: el seed **NO toca las tablas de catálogo**. Solo:
  - Elimina usuarios de auth.
  - Limpia las tablas de datos de usuario (`profiles`, `subscriptions`, `invoices`, `progress_*`, `onboarding_responses`, `messages`, etc.).
  - Re-crea admin + 20 clientes + suscripciones + invoices + respuestas de onboarding.
  - Para las respuestas de onboarding: **busca una pregunta activa existente** en `onboarding_questions` en lugar de crear/borrar la pregunta. Si no hay ninguna activa, omite las respuestas (o crea una sin borrar las demás).
  - No re-inserta `programs` / `program_variants` / `program_variant_prerequisites` (ya existen en el proyecto).
- Resultado: el contenido real se conserva; el seed solo superpone los clientes demo.

### 2. A2 — Resend + confirmación de email

Pasos (Francisco, en dashboards):
1. Verificar dominio `auramaristany.com` en Resend (registros DNS: SPF, DKIM, DMARC en el proveedor DNS).
2. Crear API key en Resend → `RESEND_API_KEY`.
3. Definir `RESEND_FROM_EMAIL` (sugerido: `no-reply@auramaristany.com`; evitar reusar `hola@auramaristany.com` que es el login admin demo).
4. Supabase Auth → SMTP Settings → apuntar a Resend SMTP → activar.
5. Supabase Auth → activar "Confirm email".

Resultado: registro envía correo de confirmación; emails de ciclo de vida (bienvenida, pago fallido, cancelación) se envían de verdad. Los clientes demo se siembran con `email_confirm: true`, así que Aura entra con ellos sin necesidad de confirmar.

### 3. A3 — Deploy a Vercel

Variables de entorno (Production), Stripe en **test**:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_test_...          ← test, no live (demo)
STRIPE_WEBHOOK_SECRET=whsec_...        ← del endpoint webhook de Vercel (test)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=no-reply@auramaristany.com
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com
NEXT_PUBLIC_AURA_WHATSAPP=[número real de Aura]
CRON_SECRET=[openssl rand -hex 32]
# NO incluir DEV_DATE ni SUPABASE_MGMT_TOKEN en producción
```

Pasos:
1. Conectar repo en Vercel (si no lo está). `main` → Production.
2. Setear env vars de producción.
3. Verificación previa (Claude): build verde, `tsc` limpio, 252 tests passing, confirmar que `.env.local` no filtra secretos a producción.
4. Deploy de `main`.
5. Registrar webhook en Stripe **test**: `https://app.auramaristany.com/api/webhooks/stripe` — eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`. Copiar `STRIPE_WEBHOOK_SECRET` (test) a Vercel.

### 4. A4-parcial — Stripe test en prod + datos demo

1. Correr el seed demo corregido contra el proyecto (genera 20 clientes + admin, conservando contenido).
2. Las 10 variantes conservan sus `stripe_price_id` de test → checkout funciona con tarjetas de prueba (4242…).
3. Smoke test end-to-end en producción:
   - Login admin demo → ver listas de clientes/pagos/contenido/series.
   - Login cliente demo → ver portal con contenido del día.
   - Registro nuevo → recibir correo de confirmación → onboarding → checkout test → webhook crea suscripción → portal.

---

## Flujo de datos

- **Demo en línea:** Aura → `app.auramaristany.com` (Vercel Production) → Supabase `bgvxaagfnzvzamtxqbkg` (datos reales de contenido + clientes demo) + Stripe **test**.
- **Desarrollo continuo:** rama de feature → push → Vercel Preview URL (mismo Supabase) → revisión → merge a `main` → Production.

## Manejo de errores / riesgos

- **Secreto rotado:** tras rotar el `MGMT_TOKEN`, actualizar `.env.local` local. Verificar que el seed sigue corriendo.
- **Confirmación de email:** si el SMTP de Resend no está bien configurado, el registro real fallaría al enviar. Los clientes demo no dependen de esto (entran ya confirmados).
- **Webhook test:** el secret del webhook de test es distinto al de live; al hacer flip a live habrá que re-registrar y re-copiar.
- **Mismo proyecto dev/prod:** correr el seed demo es destructivo para datos de usuario. Coordinar para no borrar datos que Aura haya generado durante sus pruebas.

## Pruebas

- Verificación de código: `npm run build`, `tsc --noEmit`, `vitest` (252 tests).
- Smoke E2E manual en producción (lista arriba).
- No se agregan tests automatizados nuevos (bloque de configuración); los cambios al seed se validan corriéndolo.

## Fuera de alcance (trabajo futuro)

- **A4-live:** crear Products/Prices en Stripe live con precios reales de Aura → actualizar `program_variants` → flip keys test→live → re-registrar webhook live.
- **UI de admin para gestión de planes/precios** (hoy se hace por script + SQL).
- Limpieza de datos demo (explícitamente NO se hace; se conservan).

## Migraciones

Ninguna nueva. Solo cambios de código en `scripts/seed-demo.ts` y configuración.
