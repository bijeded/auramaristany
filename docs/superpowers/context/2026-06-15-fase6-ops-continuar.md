# Contexto de arranque — Fase 6 bloque Ops (A2/A3/A4)

Fecha de corte: **2026-06-15**  
Archivo: `docs/superpowers/context/2026-06-15-fase6-ops-continuar.md`

---

## Estado del proyecto al entrar a esta sesión

**Plataforma:** Aura Maristany — coaching de salud integral, mujeres 40+.  
**Stack:** Next.js 14 App Router + Supabase + Stripe + shadcn/ui + Resend + Vercel  
**Repo local:** `/Users/franciscovenegas/Desktop/Cowork/Aura`  
**Branch activo:** `main` (HEAD `8dd90eb`)  
**Tests:** 247 passing (Vitest). tsc limpio, build verde. Working tree limpio (solo `.claude/` untracked).

### Fases completadas (todas mergeadas a main)
- **Fases 0–5 ✓** (fundación, suscripción, contenido, historial, mensajería, financiero)
- **Fase 6 sub-bloques ✓:**  
  - 1 Gestión de Clientes (`0d23c5e`, migr. 007)  
  - 3 Página de Pagos (`d52f224`)  
  - 4b Constructor de Onboarding (`9477a8c`)  
  - 4a Núm. Celular en registro (`bdb4e83`, migr. 008)  
  - A Auditoría de seguridad (`bb05894`, migr. 009)  
  - A1/G4 Fix first-invoice race condition (`1e838d7`)  
  - B1 Logout en UI (`0dde433`)  
  - B2 `/portal/settings` completo (`4271c85`, migr. 010)  
  - C+D Pulido auditoría + limpieza de tipos (`b32f0c5`, SIN migración)  
  - Consistencia docs (`8dd90eb`)

**Migraciones aplicadas en Supabase:** 001–010 (la siguiente sería 011).

---

## Por qué estamos aquí

Se esperaba la respuesta de **Aura Maristany** a dos preguntas bloqueantes:

### P1 — Precios reales en MXN
Hay 10 `program_variants` en Stripe (test mode) con precios de prueba. Para pasar a producción hay que:
1. Crear 10 Prices en Stripe **live mode** con los precios reales en MXN.
2. Actualizar `stripe_price_id` y `price_mxn` en la tabla `program_variants` de Supabase producción.
3. Cambiar las keys de Stripe a live en Vercel.

Los 10 productos son:
- **CuarentaMás** (6 meses): 5 variantes (Principiante poco tiempo / Principiante suficiente / Intermedio poco / Intermedio suficiente / Avanzado)
- **CuarentaMás Extra** (6 meses / indefinida): 2 variantes (Intermedio / Avanzado)
- **Strong & Fit** (indefinida): 3 variantes (Principiante / Intermedio / Avanzado)

### P5 — Dominio
Confirmar si `app.auramaristany.com` (o el subdominio elegido) está comprado y disponible para configurar en Vercel + Resend.

---

## Bloque Ops A2/A3/A4 — Lo que queda por implementar

### A2 — Resend + confirmación de email
- Setear `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en Vercel (ya hay código para ello, en modo no-op sin la key).
- Verificar dominio en Resend (requiere P5).
- Activar SMTP en Supabase Auth → Dashboard > Auth > SMTP Settings → apuntar a Resend SMTP.
- Resultado: el registro envía correo de confirmación; los emails de ciclo de vida (bienvenida, pago fallido, cancelación) se envían de verdad.

### A3 — Deploy a Vercel
Variables de entorno que hay que configurar:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_live_...         ← live, no test
STRIPE_WEBHOOK_SECRET=whsec_...       ← nuevo, del endpoint webhook de Vercel
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@[dominio verificado]
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com
NEXT_PUBLIC_AURA_WHATSAPP=[número real de WhatsApp de Aura]
CRON_SECRET=[generar con: openssl rand -hex 32]
# NO incluir DEV_DATE (solo existe en .env.local de desarrollo)
```

Pasos:
1. Conectar repo en Vercel.
2. Setear todas las env vars de producción.
3. Registrar endpoint de webhook en Stripe live: `https://app.auramaristany.com/api/webhooks/stripe` — eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copiar el `STRIPE_WEBHOOK_SECRET` nuevo a Vercel.
5. Deploy.

### A4 — Stripe live + precios reales (requiere P1)
1. Crear los 10 Products + Prices en Stripe live mode con los precios en MXN que dé Aura.
2. Actualizar `program_variants` en Supabase producción:
   - `stripe_price_id` → nuevo ID de Price live (`price_live_...`)
   - `price_mxn` → precio real
3. Verificar que el checkout funcione de extremo a extremo en producción.

---

## Archivos clave que tocaremos en este bloque

```
.env.local                          ← solo local; NO a producción; quitar DEV_DATE
vercel.json                         ← cron job ya definido (purge-messages, 3am)
lib/email/                          ← templates + Resend client (ya implementado)
lib/webhooks/stripe-handlers.ts     ← handlers ya implementados
app/api/webhooks/stripe/route.ts    ← endpoint webhook
app/api/cron/purge-messages/        ← cron de retención (activo en Vercel con CRON_SECRET)
```

No se necesitan migraciones de base de datos nuevas para este bloque (solo actualizaciones de datos en `program_variants`).

---

## Datos de acceso / cuentas

- **Supabase proyecto:** `bgvxaagfnzvzamtxqbkg`
- **Stripe cuenta test:** `acct_1TeeqvRx0tAq6bwG` — las 10 variantes de prueba ya existen aquí
- **NEXT_PUBLIC_AURA_WHATSAPP actual (prueba):** `525512620404` — cambiar al número real de Aura en producción

---

## Convenciones del proyecto

- **Idioma de la UI:** español neutro ('cliente', no 'clienta')
- **Workflow de código:** siempre subagent-driven en worktree (skill `superpowers`)
- **Flujo acordado:** brainstorm → spec → plan → ejecución con subagente
- **Tests:** Vitest, patrón AAA, puras separadas de queries de DB
- **Sin `as any`:** `lib/supabase/types.ts` completado en C+D; `Relationships: []` en todas las tablas
- **Supabase Management API:** enviar SQL en una sola línea (el pipeline `jq` come saltos de línea)
- **Siguiente migración:** sería `011_...sql`

---

## Resumen ejecutivo para empezar la sesión

> "Continuamos Fase 6 bloque final. Ya tenemos los precios MXN de Aura [pegar tabla aquí] y el dominio confirmado es [pegar dominio]. Necesitamos implementar A2 (Resend + SMTP), A3 (deploy Vercel con todas las envs) y A4 (Stripe live + precios reales). El código ya está listo; esto es configuración + actualización de datos."
