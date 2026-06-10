# Contexto — Fase 6: Pulido + Launch (arranque en chat nuevo)

**Fecha de preparación:** 10 de junio de 2026
**Estado del proyecto:** Fases 0–5 COMPLETAS y mergeadas a `main`. Migraciones 001–006 aplicadas en Supabase. Backfill de invoices ejecutado. Esta es la última fase del roadmap (semanas 14–15).
**Cómo arrancar:** lee este bloque + `SPEC.md` (Panel de Administración → Gestión de Clientes; Integración Stripe; Variables de Entorno) y el `handoff.md` (secciones 9, 10, 12, 13). Luego, por cada sub-bloque que decidas atacar, haz un **brainstorm** (superpowers:brainstorming) para fijar alcance, escribe un **plan** (writing-plans) y ejecútalo (subagent-driven, sobre una rama `feature/fase-6-...`). Respeta la forma de colaborar: **discutir antes de implementar, separar data de presentación, respetar scope**.

---

## Qué es la Fase 6 (entregable global)

"App lista para producción": completar las pantallas de admin que quedaron como stub, pulir edge cases, hacer una pasada de seguridad/limpieza y **desplegar a producción**. Es la fase más heterogénea: conviene **descomponerla en sub-proyectos** y brainstormear/planear cada uno por separado (cada uno = su propio spec → plan → ejecución).

### Sub-bloques candidatos (proponer orden en el brainstorm)

1. **Gestión de Clientes (`/admin/clients` + `/admin/clients/[clientId]`)** — hoy son **stubs**.
   - **Lista:** clientas con filtros (programa, estado de pago, fecha de inscripción) y estado de pago visible. El card "Requieren atención → Ver clientes" del dashboard apunta aquí (`/admin/clients`).
   - **Ficha individual:** respuestas de onboarding, progreso de ejercicios, pagos, mensajes. (Métricas corporales no se capturan — `body_metrics` vacío.) Aquí también va la **UI de admin para borrar fotos** de clientas (RLS ya lo permite; falta UI — follow-up de Fase 3).
   - Patrón a reusar: `lib/admin/queries.ts` (server-only, RLS admin), layout admin (sidebar).

2. **CSV export de clientas** (arrastrado desde Fase 4) — para newsletter/win-back de no-activas. Decidir si va en la lista de clientas o como acción aparte. Exporta clientas + estado/programa/email.

3. **Página de pagos `/admin/payments` + botón "Ver todos"** — el dashboard (Fase 5) dejó la tabla de "Pagos recientes" sin enlace; el botón "Ver todos" del prototipo (`admin-dashboard.jsx`) apunta a esta página (listado completo de `invoices`). Reusar `getRecentPayments`/los helpers de `lib/admin/finance-*`.

4. **Pedir TELÉFONO en onboarding/checkout** — hoy `profiles.phone` casi siempre es null, así que el botón de WhatsApp admin→clienta (Fase 4) no aparece. Capturar el teléfono al onboarding (o checkout) para que la mensajería por WhatsApp sea útil.

5. **Conectar Resend (prerequisito de lanzamiento)** — poner `RESEND_API_KEY` válida + `RESEND_FROM_EMAIL` y **verificar el dominio** en Resend. Hoy la infra de email (`lib/email/`) es no-op sin key. Activa los emails de mensajería y de ciclo de vida (bienvenida/pago-fallido/cancelación).

6. **Deploy a Vercel + envs de producción** — configurar el proyecto en Vercel con todas las env vars de prod (ver `SPEC.md` / handoff §9), incluyendo **`CRON_SECRET`** (activa el Vercel Cron de retención de mensajes 180d de Fase 4, hoy inactivo) y `STRIPE_WEBHOOK_SECRET` de prod. **Remover `DEV_DATE`** (es gitignored, no llega a Vercel, pero confirmar).

7. **Stripe live + precios reales (P1)** — los 10 Products/Prices están en **test mode** ($999 c/u). Antes del lanzamiento: crear los Prices reales en **live mode** y actualizar `stripe_price_id`/`price_mxn` en `program_variants` vía SQL. Aura debe definir los precios.

8. **Auditoría de seguridad + edge cases** — pasada de RLS en todas las tablas, revisar middleware, edge cases del modelo semanal (semana 5 ya resuelto), etc.

---

## Follow-ups técnicos arrastrados (limpieza, no bloquean pero entran aquí)

- **Regenerar `lib/supabase/types.ts`** — incluir `progress_photos`/`body_metrics`/`invoices`; quitar los `as any` / `as unknown as` de queries (incluye `lib/admin/finance-queries.ts`, endpoints de fotos, webhooks).
- **`try/catch` en `stripe.subscriptions.retrieve`** (`lib/webhooks/stripe-handlers.ts`).
- **Unificar `formatDate`** duplicado (TodayView / pilares) y `formatMXN` ya centralizado en `finance-helpers.ts`.
- **`saveBlocks`/`savePillarBlocks` no son transaccionales** (`lib/admin/dayActions.ts`/`pillarActions.ts`).
- **Tests de `cloneDay`/`cloneWeek`**.
- **`getSentMessages`** carga todos los `message_recipients` (escala; ok por ahora).
- **Alinear SPEC/types** sobre `progress_logs`: la columna real es **`notes`** (el código la expone como `general_notes` vía alias).
- Tope de 250 fotos no es race-safe (aceptable single-user).

---

## Preguntas abiertas (resolver con Aura)

- **P1 — Precios reales en MXN** de cada variante (hoy $999 simulado en test).
- **P5 — Dominio** `app.auramaristany.com`: ¿comprado/configurado? (necesario para Vercel + verificación de dominio en Resend).
- Alcance del launch: ¿soft-launch con datos reales o pruebas finales primero?

---

## Esquema/arquitectura relevante (verificado)

- **invoices** (Fase 5): `amount_paid numeric` + `currency` + `status` ('paid'|'open'|'void'|'uncollectible') + `invoice_date timestamptz`. NO existen `amount_mxn`/`paid_at`. El primer pago (`subscription_create`) **ya se registra** (fix de Fase 5) y hay backfill idempotente (`scripts/backfill-first-invoices.ts`).
- **subscriptions.status**: 'active'|'past_due'|'canceled'|'unpaid'. **profiles.phone** existe pero casi siempre null.
- **RLS**: el admin lee todo vía `is_admin()`. Las queries de admin usan `createClient()` admin-context (no service-role), patrón en `lib/admin/queries.ts` y `lib/admin/finance-queries.ts`.
- **Stripe API 2026:** apiVersion `"2026-05-27.dahlia"`; `invoice.parent.subscription_details.subscription`; `current_period_start/end` desde `subscription.items.data[0]`.

---

## Piezas ya construidas para REUSAR

- **`app/admin/layout.tsx`** — sidebar admin (ítem "Clientes" ya existe y apunta a `/admin/clients`).
- **`lib/admin/queries.ts`** + **`lib/admin/finance-queries.ts`** — patrón de queries server-only admin (RLS).
- **`lib/admin/finance-helpers.ts`** — `formatMXN`, agregaciones (reusables para `/admin/payments`).
- **Recharts** — ya instalado (dashboard Fase 5, portal Fase 3).
- **Patrón funciones puras + TDD** (`finance-helpers.ts`, `message-helpers.ts`, `history-helpers.ts`).
- **Mensajería / WhatsApp** (Fase 4): `lib/admin/message-helpers.ts` (`whatsappUrl`/`normalizeWhatsappNumber`) — se activa cuando `profiles.phone` tenga datos (sub-bloque 4).

---

## Prototipos UI de referencia

- `design-handoff-aura/prototype/aura/admin-clients.jsx` — lista/ficha de clientas.
- `design-handoff-aura/prototype/aura/admin-dashboard.jsx` — el botón "Ver todos →" de pagos.

Ver [[project_aura]], [[feedback_project_approach]].
