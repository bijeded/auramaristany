# Contexto de arranque — Post-demo con Aura (cambios pre-lanzamiento)

Fecha de corte: **2026-06-16**
Archivo: `docs/superpowers/context/2026-06-16-post-demo-aura-continuar.md`

> **Cómo usar este archivo:** "Lee `docs/superpowers/context/2026-06-16-post-demo-aura-continuar.md` y continuemos. Estos son los comentarios de Aura tras revisar el demo: [pegar feedback]."

---

## Resumen ejecutivo

La app está **desplegada como DEMO en línea** en **https://app.auramaristany.com** (Vercel Production, Stripe en **test mode**, sin cobros reales) para que **Aura Maristany** la explore y dé retroalimentación. **No es el lanzamiento productivo.** El propósito de este chat es **procesar el feedback de Aura** y, según su complejidad, implementar correcciones/nuevas funcionalidades antes del lanzamiento real, o anotarlas para después.

- **Plataforma:** coaching de salud integral, mujeres 40+.
- **Stack:** Next.js 14 App Router + Supabase + Stripe + shadcn/ui + Resend + Vercel.
- **Repo local:** `/Users/franciscovenegas/Desktop/Cowork/Aura`
- **Repo remoto:** `github.com/bijeded/auramaristany` (privado) → Vercel `project-a24no`.
- **Branch:** `main` (HEAD `8937d54`). 252 tests passing, tsc/build verdes.

---

## Cómo está montado el demo (infra)

- **Producción:** push a `main` → Vercel **Production** en `app.auramaristany.com`. Ramas de feature → **Preview URLs** automáticas.
  - ⚠ **El email del commit DEBE ser `francisco.venegas.velasco@gmail.com`** (cuenta GitHub `bijeded`) o Vercel **bloquea** el git deploy. Ya está configurado **global**. Si un deploy de Git queda en estado UNKNOWN y no aliasa el dominio, revisar esto primero. Salida de emergencia: `vercel --prod` (CLI, buildea local).
- **Supabase:** mismo proyecto `bgvxaagfnzvzamtxqbkg` sirve como prod. Migraciones 001–010 aplicadas. SMTP de Auth → Resend; Confirm email activado; Site URL + Redirect URLs = `app.auramaristany.com`.
- **Stripe:** **test mode** (cuenta `acct_1TeeqvRx0tAq6bwG`). Webhook test `we_1Tj1aZ…` (4 eventos) → `app.auramaristany.com/api/webhooks/stripe`. 10 variantes con precios simulados ($999).
- **Resend:** dominio `auramaristany.com` verificado (DNS en IONOS). Remitente `no-reply@auramaristany.com`.
- **Env vars Vercel Production:** 11 seteadas (Stripe test). Falta poner las de **Preview** (al crear la 1ª rama de dev el CLI pide rama interactiva).
- **Datos demo en la DB:** admin `hola@auramaristany.com` / `09876543`; 20 clientes `…@test.aura.mx` / `12345678` (15 activos, 3 past_due, 2 cancelados). Seed: `scripts/seed-demo.ts` (aditivo, no toca el catálogo de contenido).

---

## Estado del producto (qué existe hoy)

**Fases 0–5 ✓ mergeadas** (fundación, suscripción, contenido, historial, mensajería, financiero).
**Fase 6 EN CURSO**, sub-bloques mergeados: Gestión de Clientes, Página de Pagos, Constructor de Onboarding, Núm. Celular en registro, Auditoría de seguridad + correcciones, B1/B2 logout y `/portal/settings`, C+D pulido, CRUD de Series, y el **bloque Ops del demo deploy** (este).

**Lo más reciente (commit `bf7216a`/`8937d54`) — correcciones pre-demo:**
- Dashboard admin: fecha con día ("16 de junio, 2026") + logo AURA centrado.
- Clientes: header alineado; pills de filtro = "Todas / Activas / Vencidas / **Canceladas**" (se quitó "Con pago fallido").
- Contenido: CuarentaMás Extra muestra **"Mensual recurrente"** (solo etiqueta).
- `/portal/settings`: fecha capitalizada como el resto del portal.

Mapa completo de rutas, esquema y archivos clave: ver `SPEC.md` y `handoff.md` (ambos actualizados a 2026-06-16, versión SPEC 2.3).

---

## Cambios YA decididos, PENDIENTES de implementar

1. **CuarentaMás Extra → cobro mensual recurrente cancelable** (como Strong & Fit). Hoy solo se cambió la etiqueta en el admin. Falta lo de fondo:
   - `programs.billing_model` de `cuarenta-mas-extra`: `fixed_term_monthly` → `rolling_monthly`.
   - Ajustar lógica de acceso/`completed_at`/checkout: `lib/webhooks/stripe-handlers.ts`, `lib/admin/clients-helpers.ts` (`subscriptionProgressLabel`), prerequisitos, y revisar `lib/content/access.ts`.
   - Implica revisar el modelo de prerequisitos de Extra Avanzado (hoy depende de "Extra Intermedio completado").

---

## Trabajo pendiente para el LANZAMIENTO real (no demo)

- **Task 5 — Smoke E2E con Aura** (si no se hizo aún): login admin/cliente demo + registro real → confirmación de email → onboarding → checkout test (`4242 4242 4242 4242`) → webhook crea sub → portal.
- **Stripe LIVE + precios reales:** cuando Aura dé los precios MXN → crear 10 Products/Prices en live (`scripts/seed-stripe.ts` en modo live) → actualizar `stripe_price_id`/`price_mxn` en `program_variants` → flip de `STRIPE_SECRET_KEY`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` a `sk_live`/`pk_live` en Vercel → registrar **webhook live** + copiar nuevo `STRIPE_WEBHOOK_SECRET`.
- **WhatsApp real de Aura:** hoy `NEXT_PUBLIC_AURA_WHATSAPP=525512620404` (prueba) → poner el número real.
- **Limpieza de datos de clientes demo:** antes de abrir a clientes reales, borrar SOLO los datos de clientes (perfiles/subs/invoices/fotos), conservando admin y programas/series. El seed reescrito sirve de base.
- **Env vars de Preview** en Vercel (cuando se cree la 1ª rama de desarrollo).
- **Decidir:** ¿UI de admin para gestión de planes/precios, o se mantiene script+SQL? (según necesidades de Aura).
- **Registrado de antes (no bloquea):** transaccionalidad de `saveBlocks`/`savePillarBlocks`.

---

## Cómo trabajar (convenciones del proyecto)

- **Idioma UI:** español neutro de México ('cliente', no 'clienta'). Háblale al usuario en español de México (tú).
- **Flujo:** brainstorm → spec → plan → ejecución. Para features con código no trivial: **subagent-driven en worktree** (skill `superpowers`). Para correcciones pequeñas/UI puntuales, directo con verificación (tsc + vitest + build).
- **Tests:** Vitest, patrón AAA, funciones puras separadas de queries de DB. Mantener verde (hoy 252).
- **Sin `as any` injustificados** (`lib/supabase/types.ts` se mantiene a mano).
- **Antes de afirmar "listo":** correr verificación real (build/tests/curl/deploy) y reportar con evidencia.
- **Commits:** terminar con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Branch para features (no commitear features directo en `main` sin acuerdo). Push a `main` = deploy a Production que ve Aura → cuidado con romper el demo (usar ramas/Preview para WIP).
- **Supabase Management API:** enviar SQL en UNA sola línea (el pipeline come saltos de línea).
- **Memoria persistente** del proyecto en `~/.claude/projects/-Users-franciscovenegas-Desktop-Cowork-Aura/memory/` — ya tiene todo el detalle de fases y la infra del demo.

---

## Plantilla para abrir el próximo chat

> "Lee `docs/superpowers/context/2026-06-16-post-demo-aura-continuar.md`. Aura ya revisó el demo y estos son sus comentarios: **[pegar lista]**. Analicémoslos, decidamos cuáles son rápidos vs. cuáles ameritan spec/plan, y prioricemos qué entra antes del lanzamiento. Recuerda: cambios grandes en rama/Preview para no romper el demo en producción."
