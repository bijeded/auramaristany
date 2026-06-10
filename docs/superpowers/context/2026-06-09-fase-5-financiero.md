# Contexto — Fase 5: Dashboard Financiero (arranque en chat nuevo)

**Fecha de preparación:** 9 de junio de 2026
**Estado del proyecto:** Fases 0–4 COMPLETAS y mergeadas a `main`. Migraciones 001–006 aplicadas en Supabase. Esta es la siguiente fase del roadmap.
**Cómo arrancar:** lee este bloque + `SPEC.md` (§"Panel de Administración → Dashboard Financiero", §"Base de Datos → invoices/subscriptions", §rutas) y el `handoff.md`. Luego haz un **brainstorm** (superpowers:brainstorming) para fijar alcance/decisiones, escribe un **plan** (writing-plans) y ejecútalo (subagent-driven, sobre una rama `feature/fase-5-financiero`). Respeta la forma de colaborar: **discutir antes de implementar, separar data de presentación, respetar scope de fases**.

---

## Qué es la Fase 5 (entregable)

Panel **`/admin/dashboard`** con métricas financieras (hoy es un **stub** de 12 líneas). Según SPEC §"Dashboard Financiero" + prototipo `design-handoff-aura/prototype/aura/admin-dashboard.jsx`:
1. **KPIs (cards):** MRR (con delta vs mes anterior), total suscripciones activas, renuevan-esta-semana (monto), "requieren atención" (pagos fallidos / `past_due`).
2. **Ingresos por mes** — gráfica de barras (Recharts), 6/12 meses.
3. **Distribución:** clientes por programa (barras horizontales) + ingresos por programa (donut, opcional).
4. **Pagos recientes** — tabla (fecha, clienta, programa, monto, estado).

Prototipo de referencia: `admin-dashboard.jsx`. La gráfica reusa **Recharts** (ya instalado y usado en Fase 3, ver `components/portal/PerformanceChart.tsx`).

---

## Esquema REAL relevante (verificado en migración 001)

⚠ **DRIFT corregido (9-jun, pre-Fase 5):** el SPEC §schema de `invoices` listaba `amount_mxn`/`paid_at`/`invoice_date DATE`, que **NO existen** en la tabla real. Ya corregido en `SPEC.md`. La tabla aplicada (y lo que escribe `recordInvoice` en `lib/webhooks/stripe-handlers.ts`) es:

```sql
invoices (
  id, subscription_id (→subscriptions), stripe_invoice_id text unique not null,
  amount_paid numeric(10,2) not null,   -- monto del pago (NO 'amount_mxn')
  currency text default 'mxn',
  status text not null,                 -- 'paid' | 'open' | 'void' | 'uncollectible'
  invoice_date timestamptz not null,    -- (NO 'DATE'; NO existe 'paid_at')
  created_at
)
```

Otras tablas que alimentan el dashboard:
```sql
subscriptions ( profile_id, program_variant_id, status, current_period_start,
  current_period_end, cancel_at_period_end, months_elapsed, ... )
  -- status: 'active' | 'past_due' | 'canceled' | 'unpaid'
program_variants ( id, program_id, name, level, price_mxn, ... )   -- precio para MRR
programs ( id, name, ... )
profiles ( id, full_name, email, ... )  -- para "clienta" en pagos recientes
```

**RLS:** `invoices_own_or_admin` (SELECT) y `subscriptions_own_or_admin` permiten al admin leer todo vía `is_admin()`. El dashboard usa `createClient()` admin-context (mismo patrón que el resto de `lib/admin/queries.ts`); no requiere service-role.

---

## ⚠ Bug a resolver SÍ o SÍ en Fase 5 (afecta los números)

**El primer pago NO se registra en `invoices`.** En `lib/webhooks/stripe-handlers.ts`, `handleInvoicePaid` para `billing_reason === 'subscription_create'` llama `recordInvoice(invoice)` **sin** `subscriptionDbId`, y `recordInvoice` hace `if (!subscriptionDbId) return;` → **no inserta nada**. Resultado: el ingreso del **primer mes de cada clienta nunca entra a la tabla `invoices`**, así que el dashboard (que lee de `invoices`) subreporta ingresos.

**Fix sugerido (validar en el brainstorm):** en el caso `subscription_create`, buscar la suscripción por `stripe_subscription_id` (ya creada por `checkout.session.completed`) y registrar el invoice con su `id`. Considerar también backfill de los pagos ya ocurridos en test, o asumir datos limpios.

---

## Piezas ya construidas para REUSAR

- **`app/admin/layout.tsx`** — sidebar admin (ítem "Dashboard" ya existe y es la home del admin por middleware).
- **`lib/admin/queries.ts`** — patrón de queries server-only admin (RLS). Aquí van `getDashboardMetrics`/`getMonthlyRevenue`/`getRecentPayments`/etc.
- **Recharts** — ya instalado; `components/portal/PerformanceChart.tsx` es ejemplo de uso (línea); para Fase 5 será barra/donut.
- **Patrón de funciones puras + TDD** (`lib/content/history-helpers.ts`, `lib/admin/message-helpers.ts`): poner aquí la agregación (MRR, agrupar ingresos por mes, por programa) como funciones puras testeables, separadas de las queries.
- **Tokens de marca / estilo inline** del admin.

---

## Decisiones / preguntas a resolver en el brainstorm

1. **Definición de MRR:** ¿suma de **suscripciones activas × `program_variants.price_mxn`** (lo que dice el SPEC: "MRR = suma de activas × precio")? ¿O derivado de `invoices`? Recomendado: MRR = activas × precio (predictivo); "Ingresos por mes" = `invoices.amount_paid` agrupado por mes (real cobrado). Definir y separar ambos conceptos.
2. **Alcance v1 de KPIs:** ¿los 4 cards del prototipo (MRR + delta, activas, renuevan-esta-semana, requieren-atención)? ¿O un subconjunto? El "delta vs mes anterior" requiere comparar dos meses de `invoices` (afectado por el bug del primer pago).
3. **Gráfica de ingresos:** ¿6 y 12 meses? Recharts barras. Fuente `invoices` por `invoice_date`/mes.
4. **Distribución por programa:** clientes por programa (de `subscriptions` activas join `program_variants`→`programs`) + ingresos por programa (donut). ¿Donut en v1 o follow-up?
5. **Pagos recientes:** últimas N filas de `invoices` join `subscriptions`→`profiles`/`program_variants`. ¿Cuántas? ¿link a "ver todos"?
6. **Bug del primer invoice:** confirmar el fix (registrar invoice en `subscription_create`) y si se hace backfill.
7. **Moneda/centavos:** `recordInvoice` guarda `amount_paid = invoice.amount_paid / 100` (ya en pesos). Formatear MXN en presentación.
8. **CSV export de clientas (arrastrado de Fase 4):** se difirió a Fase 5 — ¿se hace aquí (en la ficha/lista de clientas) o como parte del dashboard? Para newsletter/win-back de no-activas. NO olvidar.
9. **Ficha/lista de clientas (`/admin/clients` y `/admin/clients/[clientId]`):** hoy son **stubs**. El card "Requieren atención → Ver clientes" del dashboard apunta ahí. ¿Entra en Fase 5 (al menos la lista con estado de pago) o queda para Fase 6? Definir el límite.

---

## Verificación al cerrar Fase 5 (E2E)
- MRR del dashboard = suma manual de suscripciones activas × `price_mxn` de su variante.
- "Ingresos por mes" cuadra con la suma de `invoices.amount_paid` por mes (incluyendo el **primer pago**, ya corregido).
- Clientes por programa = conteo de `subscriptions` activas por programa.
- Pagos recientes refleja las últimas filas reales de `invoices`.
- Un pago fallido (`past_due`) aparece en "requieren atención".
- RLS: un cliente no-admin no puede leer el dashboard ni `invoices` ajenas.

---

## Follow-ups arrastrados (no bloquean Fase 5, pero relevantes)
- **CSV export de clientas** (ver decisión 8) — para newsletter/win-back.
- **Pedir teléfono en onboarding/checkout** (Fase 4: hoy `profiles.phone` casi siempre null → botón WhatsApp admin no aparece).
- **Conectar Resend** (API key válida + `RESEND_FROM_EMAIL=onboarding@resend.dev`) para activar emails de mensajería/ciclo de vida.
- **Deploy a Vercel** + envs de prod (incluye `CRON_SECRET` para activar la retención de mensajes de Fase 4) + verificar dominio en Resend.
- Regenerar `lib/supabase/types.ts` (quitar `as any`); unificar `formatDate` duplicado; try/catch en `stripe.subscriptions.retrieve`.

Ver [[project-aura-maristany]], [[feedback_project_approach]]. Prototipo: `design-handoff-aura/prototype/aura/admin-dashboard.jsx`.
