# Contexto — Fase 6: continuar (B2 + pulido + launch) — arranque en chat nuevo

**Fecha de preparación:** 11 de junio de 2026
**Estado:** Fases 0–5 mergeadas. **Fase 6 EN CURSO.** Mergeados a `main`: sub-bloques 1, 3, 4a, 4b, **A (auditoría de seguridad + ciclo de corrección)**, más los fixes **A1/G4** (pago no se registraba) y **B1** (logout en UI). **Migraciones 001–009 aplicadas.** Gates en `main`: **197 tests**, `tsc` limpio, build verde, working tree limpio.
**Cómo arrancar:** lee este bloque + la memoria del proyecto (`project_aura.md`, sección "Estado actual" y "Pendiente Fase 6 — ORDEN ACORDADO") + `SPEC.md` (changelog 1.7/1.8 y §Variables de Entorno) + `handoff.md` (encabezado + secciones 11 y PENDIENTE). El **reporte de auditoría** vive en `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md` (los 8 bajos pendientes salen de ahí).

---

## Preferencias FIJAS del usuario (respetar siempre)

1. **Idioma: español de México** (tú, no vos). NUNCA registro argentino. (memoria `feedback_language_mexican`)
2. **Flujo por sub-bloque:** brainstorm (superpowers:brainstorming) → spec en `docs/superpowers/specs/` → plan (writing-plans) en `docs/superpowers/plans/` → **ejecución subagent-driven en worktree**. No preguntar la opción de ejecución (es fija). (memorias `feedback_project_approach`, `feedback_subagent_driven`)
3. **Discutir antes de implementar**, separar data de presentación, respetar scope.
4. **Bugs → systematic-debugging** (no brainstorming): causa raíz con evidencia antes de tocar nada.
5. **Merge:** `--no-ff` a `main` local tras **smoke manual del usuario**. Luego actualizar SPEC.md + handoff.md + memoria.

---

## Lo ya hecho hoy (referencia rápida)

| Bloque | Merge | Qué entregó |
|---|---|---|
| **A — Auditoría + corrección** | `bb05894` | Reporte read-only (0 críticos, 15 hallazgos). Corregidos los 5 medios + bonus: DEF-1 (`lib/admin/auth.ts` requireAdmin/requireAdminPage), SUB-1 (`subscription-access.ts` acceso = active/trialing/past_due + banner WhatsApp + pilares), INP-2 (validación zod + sanitize-html), INP-3 (msg genérico registro + phone normalizado), RLS-1/2+HYG-1 (**migración 009**). + G3 (re-login bloqueado en /auth). |
| **A1 / G4** | `1e838d7` | Bug: el pago no se registraba en `invoices`. Causa: Stripe emite `invoice.paid` ~1s antes que `checkout.session.completed` (único creador de la fila de sub) → invoice descartado. Fix: registrar el primer invoice en `handleCheckoutCompleted` (expand `latest_invoice`) + `recordInvoice` idempotente (upsert onConflict). Backfill de 2 subs huérfanas aplicado. |
| **B1 — logout** | `0dde433` | LogoutButton en sidebar admin (quitado link roto "Ver portal de cliente") + `/portal/settings` MÍNIMO (datos de cuenta solo-lectura + logout; arregla la pestaña "Configuración" que era 404). |

---

## Lo que FALTA — ORDEN ACORDADO con el usuario

### B2 — `/portal/settings` con EDICIÓN (SIGUIENTE · necesario para el MVP)
El esqueleto ya existe (`app/portal/settings/page.tsx`, hoy solo lectura). Falta la **edición** de datos de cuenta del cliente: nombre, teléfono (reusar `lib/auth/phone.ts` para validar/normalizar), posiblemente contraseña/email. Brainstorm primero: definir qué campos son editables, si email/password entran, y cómo se guardan (server action que revalide propiedad vía `getUser()`, NO confiar en props del cliente — ver hallazgo INP-4 del reporte). Sin migración esperada.

### C — 8 hallazgos BAJOS de la auditoría (pulido, no bloquean)
Del reporte `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`:
- **INP-1** — errores crudos de Postgres/Supabase devueltos al cliente (loggear server-side + msg genérico).
- **EDGE-5** — `/api/portal/progress` confía en `subscriptionId` del body (derivarlo del server).
- **EDGE-3** — `toDayOfWeek` usa `getDay()` (hora local) vs cómputo de semana en UTC (usar `getUTCDay()`).
- **MW-3** — el `matcher` del middleware cubre `/api/*` (excluir `api/webhooks`, `api/cron`).
- **SVC-2** — `create-checkout` usa service-role de más.
- **STG-2** — signed URLs de fotos a 1h (bajar a 5–10 min).
- **INP-4** — onboarding se guarda client-side (mover a server action que revalide).
- **INP-5** — `sendMessage` sin tope de longitud.

### D — Limpieza de código arrastrada (no bloquea)
- **Regenerar `lib/supabase/types.ts`** y quitar los `as any`/`as unknown as` (transversal; incluye clients-queries, finance-queries, stripe-handlers, dayActions, etc.). La de más valor.
- `try/catch` en `stripe.subscriptions.retrieve` (`lib/webhooks/stripe-handlers.ts`).
- Unificar `formatDate` duplicado (TodayView / pilares).
- `saveBlocks`/`savePillarBlocks` no transaccionales (loops de delete+insert).
- Tests de `cloneDay`/`cloneWeek`.

### En paralelo — DECISIONES de Aura (desbloquean el bloque ops)
- **P1** — precios reales en MXN por variante (hoy $999 simulado en test). Bloquea A4.
- **P5** — dominio `app.auramaristany.com`: ¿comprado/configurado? Bloquea A2 (Resend) y A3 (Vercel).
- **Config Stripe Smart Retries** — cuánto mantiene acceso un `past_due` antes del corte (hoy default de Stripe; el corte ya funciona solo vía webhook).
- **Alcance del launch** — ¿soft-launch con datos reales o pruebas finales primero?

### Bloque OPS — A2/A3/A4 (cuando haya credenciales/decisiones)
- **A2 — Resend:** `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + **verificar dominio**. Activa emails de mensajería/ciclo de vida **y el SMTP de confirmación de correo** (hoy el registro con correo nuevo no envía confirmación; con correo existente Supabase no da error a propósito = anti-enumeración, correcto). `lib/email/` es no-op sin key.
- **A3 — Deploy a Vercel:** todas las env vars de prod (ver `SPEC.md` §Variables de Entorno): **`CRON_SECRET`** (activa el Vercel Cron de retención 180d, `app/api/cron/purge-messages` + `vercel.json`), **`STRIPE_WEBHOOK_SECRET`** de prod, `NEXT_PUBLIC_APP_URL`, **remover `DEV_DATE`**.
- **A4 — Stripe live + precios reales:** crear los 10 Prices en live, actualizar `stripe_price_id`/`price_mxn` en `program_variants` vía SQL, cambiar keys a live. Depende de P1.

---

## Gotchas técnicos verificados

- **Aplicar migraciones SQL** (no hay Supabase CLI): vía **Management API** `POST https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query` con `Authorization: Bearer <access-token>` (el usuario lo provee; puede estar rotado → pedir uno nuevo). ⚠ **Enviar cada statement en UNA SOLA LÍNEA** (el pipeline come saltos de línea → comentarios `--` autocomentan todo → `[]` silencioso). Verificar SIEMPRE con consulta de control (`pg_policy.with_check`, `pg_get_functiondef`).
- **Worktree:** el repo NO tiene remoto → `git config worktree.baseRef head` antes de `EnterWorktree`. El `node_modules` del worktree nace **vacío** → symlinkear al del repo principal: `rm -rf node_modules && ln -s <repo>/node_modules node_modules`. Copiar `.env.local` o el build falla con `STRIPE_SECRET_KEY is not set`. Cerrar con `git worktree remove --force` + `git branch -d` (ExitWorktree es no-op si ya saliste con keep).
- **Tests:** `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'` (evita escanear worktrees anidados). Baseline actual **197**.
- **Stripe webhooks:** Stripe emite `invoice.paid`/`invoice.payment_succeeded` ANTES que `checkout.session.completed`. El primer invoice se registra en `handleCheckoutCompleted` (ya corregido en G4); `handleInvoicePaid` (subscription_create) es red de seguridad idempotente. Para smoke de pagos: `npm run dev` + `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Diagnóstico de eventos: API de Stripe con la `STRIPE_SECRET_KEY` del `.env.local` (`GET /v1/events`, `GET /v1/invoices?subscription=...`).
- **Backfill de invoices:** `npx tsx --env-file=.env.local scripts/backfill-first-invoices.ts [--dry-run]` (idempotente vía `stripe_invoice_id` UNIQUE).

---

## Esquema/archivos clave

- **Auth/guards:** `lib/admin/auth.ts` (requireAdmin/requireAdminPage), `middleware.ts` + `lib/middleware-utils.ts`.
- **Acceso suscripción:** `lib/content/subscription-access.ts` (`ACCESS_STATES`).
- **Webhooks/pagos:** `app/api/webhooks/stripe/route.ts` + `lib/webhooks/stripe-handlers.ts`; precios en `program_variants`; `scripts/backfill-first-invoices.ts`; seed `scripts/seed-stripe.ts`.
- **Settings (B2):** `app/portal/settings/page.tsx` (mínimo), `components/portal/PortalNav.tsx`, `lib/auth/phone.ts`.
- **Email/cron:** `lib/email/*` (no-op sin key), `app/api/cron/purge-messages/route.ts` + `vercel.json`.
- **Validación/sanitización:** `lib/admin/content-validation.ts`, `lib/admin/sanitize-html.ts`.
- **Env vars:** `SPEC.md` §Variables de Entorno / `handoff.md` §9.

Ver memorias [[project_aura]], [[feedback_project_approach]], [[feedback_subagent_driven]], [[feedback_language_mexican]].
