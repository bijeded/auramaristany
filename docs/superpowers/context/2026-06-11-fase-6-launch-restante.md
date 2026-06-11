# Contexto — Fase 6: lo que falta (Launch) — arranque en chat nuevo

**Fecha de preparación:** 11 de junio de 2026
**Estado:** Fases 0–5 mergeadas. **Fase 6 EN CURSO**: 4 sub-bloques mergeados a `main` (Gestión de Clientes, Página de Pagos + lenguaje neutro, Constructor de Onboarding, Núm. Celular en registro). Migraciones **001–008** aplicadas en Supabase. Lo que queda es **mayormente ops/launch** (credenciales/decisiones de Aura) + una limpieza de código.
**Cómo arrancar:** lee este bloque + `SPEC.md` (Variables de Entorno; Integración Stripe) + `handoff.md` (secciones 9, 10, 12, 13). La memoria del proyecto (`project_aura.md`) tiene el detalle por sub-bloque. Por cada sub-bloque que ataques: **brainstorm → plan → ejecución subagent-driven en worktree** (preferencia fija del usuario, ver más abajo). Respeta: discutir antes de implementar, separar data de presentación, respetar scope.

---

## Lo ya hecho en Fase 6 (referencia)

| Sub-bloque | Merge | Qué entregó |
|---|---|---|
| 1 — Gestión de Clientes | `0d23c5e` | `/admin/clients` lista (filtros, paginación 10, CSV) + ficha 6 tabs (incl. borrado admin de fotos) + borrado total de cliente (guard 409, **migr. 007** ON DELETE CASCADE) |
| 3 — Página de Pagos | `d52f224` | `/admin/payments` + "Ver todos →" en dashboard; extrae `paginate`/`STATUS_LABEL`; **lenguaje neutro** ('cliente') en toda la UI |
| 4b — Constructor de Onboarding | `9477a8c` | `/admin/onboarding-settings` CRUD de `onboarding_questions` (modal 4 tipos, reordenar drag, activar/desactivar) |
| 4a — Núm. Celular en registro | `bdb4e83` | Campo obligatorio con lada en `/auth/register` → **migr. 008** (`handle_new_user` copia phone a `profiles.phone`); activa el botón WhatsApp admin→cliente |

Gates actuales en `main`: **159/159 tests**, `tsc` limpio, build verde.

---

## Lo que FALTA de Fase 6 (proponer orden en el brainstorm)

### A. Auditoría de seguridad + edge cases (código — NO necesita credenciales)
Es el único bloque grande que se puede hacer **sin** esperar a Aura. Pasada de **RLS en todas las tablas** (confirmar que cliente solo ve lo suyo, admin todo vía `is_admin()`), revisar **middleware** (orden de gates en `middleware.ts`), edge cases del modelo semanal (semana 5 ya resuelto), y revisar los endpoints/server-actions admin (que todos verifiquen rol). Buen candidato para arrancar el chat nuevo si no hay credenciales todavía.

### B. Conectar Resend (prerequisito de lanzamiento)
Poner `RESEND_API_KEY` válida + `RESEND_FROM_EMAIL` y **verificar el dominio** en Resend. Hoy `lib/email/` es **no-op sin key** (best-effort, nunca rompe). Al conectarlo se activan: emails de mensajería (mensaje nuevo) y de ciclo de vida (bienvenida/pago-fallido/cancelación, ya cableados en `lib/webhooks/stripe-handlers.ts`). **Necesita:** cuenta Resend + dominio verificado (depende de P5).

### C. Deploy a Vercel + envs de producción
Configurar el proyecto en Vercel con TODAS las env vars de prod (ver `SPEC.md` §Variables de Entorno / handoff §9), incluyendo:
- **`CRON_SECRET`** → activa el Vercel Cron de retención de mensajes 180d (Fase 4, hoy inactivo; `app/api/cron/purge-messages` + `vercel.json`).
- **`STRIPE_WEBHOOK_SECRET`** de prod (el webhook de prod tiene su propio signing secret).
- **Remover `DEV_DATE`** (es gitignored, no llega a Vercel, pero confirmar que ningún código de prod dependa de él).
- `NEXT_PUBLIC_APP_URL=https://app.auramaristany.com` (depende de P5).

### D. Stripe live + precios reales (P1)
Los 10 Products/Prices están en **test mode** ($999 c/u). Antes del lanzamiento: crear los Prices reales en **live mode** y actualizar `stripe_price_id`/`price_mxn` en `program_variants` vía SQL. **Aura debe definir los precios.** Cambiar también las keys de Stripe a live en Vercel.

### Limpieza de código arrastrada (entra aquí, no bloquea)
- **Regenerar `lib/supabase/types.ts`** para incluir las tablas que faltan (`progress_photos`/`body_metrics`/`invoices`/`onboarding_*`) y **quitar los `as any` / `as unknown as`** (clients-queries, finance-queries, endpoints de fotos, webhooks, onboardingActions, dayActions, etc.). Es la mejora de calidad más transversal.
- `try/catch` en `stripe.subscriptions.retrieve` (`lib/webhooks/stripe-handlers.ts`).
- Unificar `formatDate` duplicado (TodayView / pilares).
- `saveBlocks`/`savePillarBlocks`/`reorderQuestions` no son transaccionales (loops de update).
- Tests de `cloneDay`/`cloneWeek`.
- Guard de borrado en la **lista** de clientes usa solo el estado de la sub primaria (el endpoint revalida todas → ok, pero falso-positivo de UI posible). Header de ficha sin avatar/badge. Borrado de foto sin toast de error.

---

## Preguntas abiertas (resolver con Aura)

- **P1 — Precios reales en MXN** de cada variante (hoy $999 simulado en test). Bloquea D.
- **P5 — Dominio** `app.auramaristany.com`: ¿comprado/configurado? Necesario para Vercel (B/C) + verificación de dominio en Resend.
- Alcance del launch: ¿soft-launch con datos reales o pruebas finales primero?

---

## Forma de trabajo (preferencias FIJAS del usuario)

1. **Flujo por sub-bloque:** brainstorm (superpowers:brainstorming) → spec en `docs/superpowers/specs/` → plan (writing-plans) en `docs/superpowers/plans/` → **ejecución subagent-driven** (un subagente por unidad de tarea + review de spec + review de calidad + review final integral antes de mergear).
2. **Worktree siempre:** usar `EnterWorktree` (nativo). Como el repo **no tiene remoto**, setear primero `git config worktree.baseRef head` (si no, `EnterWorktree` falla intentando ramificar de origin). Cerrar con `ExitWorktree(remove)`.
3. **Merge:** `--no-ff` a `main` local (estilo de fases anteriores), tras smoke manual del usuario. Luego actualizar SPEC.md + handoff.md + memoria.
4. **Tests desde main contaminados:** `vitest.config` excluye `**/.claude/**`, pero si un worktree está vivo, correr `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'` para evitar escanear el worktree anidado.
5. **Build en worktree:** copiar `.env.local` del repo principal al worktree (gitignored) o el build falla con `STRIPE_SECRET_KEY is not set`.

## Gotchas técnicos verificados

- **Aplicar migraciones SQL** (no hay Supabase CLI instalada): vía **Management API** `POST https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query` con `Authorization: Bearer <access-token>` (el usuario lo provee; puede estar rotado → pedir uno nuevo). ⚠ **El pipeline come saltos de línea** → enviar el SQL en **UNA SOLA LÍNEA** (con espacios). SQL multilínea con comentarios `--` se autocomenta entero y devuelve `[]` silencioso sin aplicar. Verificar SIEMPRE el resultado con una consulta de control (p.ej. `pg_get_functiondef`, `confdeltype` de `pg_constraint`).
- **Trigger `handle_new_user`** (migr. 008) ya copia `full_name` + `phone` desde `raw_user_meta_data`, con `security definer` + `set search_path = public`. Si se toca de nuevo, preservar ese `search_path`.
- **Stripe API 2026:** apiVersion `"2026-05-27.dahlia"`; `invoice.parent.subscription_details.subscription`; `current_period_start/end` desde `subscription.items.data[0]`.
- **RLS:** el admin lee/escribe todo vía `is_admin()`. Queries admin usan `createClient()` admin-context (no service-role); el service-role (`createServiceClient`) se usa solo para Storage + `auth.admin.*`.

---

## Esquema/archivos clave para el trabajo restante

- **Email:** `lib/email/client.ts` (no-op sin key), `lib/email/send.ts`, `lib/email/templates/*`, cableado en `lib/webhooks/stripe-handlers.ts`.
- **Cron retención:** `app/api/cron/purge-messages/route.ts` + `vercel.json` (Bearer `CRON_SECRET`).
- **Middleware:** `middleware.ts` (orden de gates auth/suscripción/onboarding/rol).
- **Stripe:** `app/api/webhooks/stripe/route.ts` + `lib/webhooks/stripe-handlers.ts`; precios en `program_variants` (`stripe_price_id`/`price_mxn`); seed `scripts/seed-stripe.ts`.
- **Env vars:** `SPEC.md` §Variables de Entorno / `handoff.md` §9.

Ver [[project_aura]], [[feedback_project_approach]], [[feedback_subagent_driven]].
