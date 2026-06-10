# Spec — Fase 5: Dashboard Financiero

**Fecha:** 10 de junio de 2026
**Rama de trabajo:** `feature/fase-5-financiero`
**Estado base:** Fases 0–4 mergeadas a `main`. Migraciones 001–006 aplicadas. `/admin/dashboard` es hoy un stub de 12 líneas.
**Referencias:** `docs/superpowers/context/2026-06-09-fase-5-financiero.md`, `SPEC.md` ("Dashboard Financiero"), prototipo `design-handoff-aura/prototype/aura/admin-dashboard.jsx`.

---

## 1. Objetivo y alcance

Construir el panel **`/admin/dashboard`** con métricas financieras reales, leídas de Supabase (RLS admin). Además, corregir el bug que impide registrar el primer pago de cada suscripción en `invoices` y hacer backfill de los pagos faltantes.

**Dentro de alcance (Fase 5):**
- Dashboard financiero completo en `/admin/dashboard`.
- Fix del bug del primer invoice (`subscription_create`) + backfill.
- Funciones puras de agregación (TDD) y queries server-only.

**Fuera de alcance (→ Fase 6):**
- Pantallas `/admin/clients` y `/admin/clients/[clientId]` (siguen como stubs).
- CSV export de clientas.
- Página "ver todos los pagos".

---

## 2. Entregable visual (según prototipo)

Layout en `app/admin/dashboard/page.tsx`, `maxWidth ~1000`, header "Dashboard" + subtítulo con el mes actual. Cuatro secciones:

1. **KPIs (4 cards):**
   - **Ingreso mensual recurrente (MRR)** — sin badge delta (ver §3).
   - **Total suscripciones activas** — conteo.
   - **Renuevan este mes** — conteo de subs que vencen en ≤30 días + monto sumado.
   - **Requieren atención** — conteo de subs `past_due` (estilo `danger`); sub-link "Ver clientes →" a `/admin/clients` (stub existente, no rompe).
2. **Ingresos por mes** — gráfica de barras (Recharts), ventana fija de **12 meses** (sin selector).
3. **Distribución (2 cards lado a lado):**
   - **Clientes por programa** — barras horizontales (conteo).
   - **Ingresos por programa** — donut (Recharts).
4. **Pagos recientes** — tabla (Fecha, Clienta, Programa, Monto, Estado), últimas 10 filas de `invoices`. Sin link "Ver todos" en v1 (no hay página destino; se agrega en Fase 6 junto con la página de pagos).

Estilo: tokens de marca / inline-style del admin (mismo patrón que el resto de `/admin`). Las gráficas reusan **Recharts** (ya instalado; ver `components/portal/PerformanceChart.tsx`).

---

## 3. Definición de métricas

Separación deliberada entre **MRR predictivo** (estado actual de suscripciones) e **ingresos reales** (de `invoices`).

| Métrica | Fuente | Cálculo |
|---|---|---|
| **MRR** | `subscriptions` (status=`active`) × `program_variants.price_mxn` | Suma de precio de variante de cada sub activa. Predictivo. **Sin badge delta** (no hay snapshots históricos de MRR; sería deshonesto). |
| **Suscripciones activas** | `subscriptions` | `count(status='active')`. |
| **Renuevan este mes** | `subscriptions` activas | Subs con `current_period_end` dentro de los próximos 30 días; card muestra conteo + suma de `price_mxn`. |
| **Requieren atención** | `subscriptions` | `count(status='past_due')`. |
| **Ingresos por mes** | `invoices.amount_paid` | Agrupado por mes de `invoice_date`, ventana fija de 12 meses. Real cobrado. |
| **Ingresos por programa (donut)** | `invoices` join subs→variants→programs | Suma `amount_paid` por programa, ventana 12 meses. |
| **Clientes por programa** | `subscriptions` activas join variants→programs | Conteo por programa. |
| **Pagos recientes** | `invoices` join subs→profiles/variants | Últimas 10 por `invoice_date desc`: fecha, nombre clienta, programa, monto (MXN), estado. |

Moneda: `amount_paid`/`price_mxn` ya están en pesos. Formatear como MXN en presentación (`formatMXN`).

---

## 4. Arquitectura (3 capas)

**Capa pura — `lib/admin/finance-helpers.ts`** (TDD, sin DB):
- `computeMRR(activeSubs): number`
- `groupRevenueByMonth(invoices, monthsBack=12): { month: string; total: number }[]` — rellena meses sin pagos con 0.
- `groupClientsByProgram(activeSubs): { program: string; count: number }[]`
- `groupRevenueByProgram(invoices): { program: string; total: number }[]`
- `computeRenewalsThisMonth(activeSubs, now): { count: number; amount: number }`
- `formatMXN(n): string`

**Capa de datos — `lib/admin/finance-queries.ts`** (`server-only`, `createClient()` admin-context, RLS `is_admin()`):
- `getActiveSubscriptions()` — subs activas con `current_period_end` y `program_variants(price_mxn, name, programs(name))`.
- `getInvoices(monthsBack)` — invoices `paid` con `invoice_date`, `amount_paid` y join a programa.
- `getPastDueCount()`
- `getRecentPayments(limit=10)` — join a `profiles(full_name)` y `program_variants(programs(name))`.

Devuelven filas crudas; la agregación vive en los helpers.

**Capa de presentación — `app/admin/dashboard/page.tsx`** (Server Component): llama queries → helpers → renderiza. Gráficas como Client Components:
- `components/admin/RevenueBarChart.tsx` — barras, 12 meses (sin selector).
- `components/admin/ProgramRevenueDonut.tsx` — donut.

---

## 5. Bug del primer invoice + backfill

**Bug:** en `lib/webhooks/stripe-handlers.ts`, `handleInvoicePaid` para `billing_reason === 'subscription_create'` llama `recordInvoice(invoice)` sin `subscriptionDbId`, y `recordInvoice` hace `if (!subscriptionDbId) return;` → el primer pago de cada clienta nunca entra a `invoices`.

**Fix:** en el caso `subscription_create`, buscar la suscripción por `stripe_subscription_id` (ya creada por `checkout.session.completed`) y pasar su `id` a `recordInvoice`. Cubrir con un test del handler (registra invoice en `subscription_create`).

**Backfill:** script idempotente `scripts/backfill-first-invoices.ts` que detecta suscripciones cuyo primer pago no está en `invoices` y lo inserta (idempotente vía `stripe_invoice_id unique`). Reconstruye históricos para que la gráfica de ingresos cuadre.

---

## 6. Testing

- **Helpers puros:** unit tests de `computeMRR`, `groupRevenueByMonth` (incl. meses vacíos → 0), `groupClientsByProgram`, `groupRevenueByProgram`, `computeRenewalsThisMonth`, `formatMXN`. Bordes: sin suscripciones, sin invoices, un solo programa.
- **Webhook:** test de `handleInvoicePaid` en `subscription_create` → inserta invoice con `subscription_id` correcto.
- **TDD:** escribir tests antes de la implementación de cada helper/fix.

---

## 7. Verificación E2E al cierre

1. MRR del dashboard = suma manual de subs activas × `price_mxn` de su variante.
2. "Ingresos por mes" cuadra con la suma de `invoices.amount_paid` por mes (incluyendo el primer pago, ya corregido + backfill).
3. Clientes por programa = conteo de subs activas por programa.
4. Pagos recientes refleja las últimas filas reales de `invoices`.
5. Una sub `past_due` aparece en "Requieren atención".
6. RLS: un cliente no-admin no puede leer el dashboard ni `invoices` ajenas.

---

## 8. Follow-ups (no bloquean Fase 5)

- Pantallas `/admin/clients` + ficha y CSV export → Fase 6.
- **Link "Ver todos" en Pagos recientes** → Fase 6, junto con la página de listado completo de pagos.
- Pedir teléfono en onboarding/checkout; conectar Resend; deploy a Vercel (+ `CRON_SECRET`).
- Regenerar `lib/supabase/types.ts` (quitar `as any`); unificar `formatDate` duplicado.

Ver [[project_aura]], [[feedback_project_approach]].
