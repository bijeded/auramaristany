# Diseño — Página de Pagos (`/admin/payments` + "Ver todos") · Fase 6

**Fecha:** 10 de junio de 2026
**Fase:** 6 (Pulido + Launch), sub-bloque 3
**Estado de partida:** El dashboard (Fase 5) muestra "Pagos recientes" (últimas 10 vía `getRecentPayments`) pero **sin** el botón "Ver todos" que tiene el prototipo. No existe `/admin/payments`.

## Objetivo

Cerrar el "Ver todos →" de pagos que quedó pendiente de Fase 5: agregar el enlace en la card del dashboard y crear `/admin/payments` con el **listado completo de `invoices`**, con filtro por estado y paginación. Reusa la capa `finance-*` y los patrones de `/admin/clients`.

Referencia visual: `design-handoff-aura/prototype/aura/admin-dashboard.jsx` (botón "Ver todos →").

## Enfoque

El server trae **todos** los invoices una vez; un client component hace filtro/paginación en el navegador (volumen bajo, single-admin), igual que `/admin/clients`. Se descarta la paginación server-side por innecesaria al volumen actual (se anota como follow-up si creciera).

---

## 1. Enlace "Ver todos" en el dashboard

En la card "Pagos recientes" de `app/admin/dashboard/page.tsx`, agregar un `<Link href="/admin/payments">Ver todos →</Link>` (estilo lavanda/`btn-link`) alineado a la derecha del título "Pagos recientes" (encabezado en `flex justify-between`). Sin otros cambios al dashboard.

---

## 2. Capa de datos

### `lib/admin/finance-queries.ts` (server-only, RLS admin)

- **`getAllPayments(): Promise<PaymentRow[]>`** — mismo patrón que `getRecentPayments` pero **sin límite**, ordenado por `invoice_date` desc, devolviendo además `profile_id` (para enlazar a la ficha) y `variant_name`.
  Query: `invoices` → `subscriptions(profile_id, profiles(full_name), program_variants(name, programs(name)))`.

### `lib/admin/finance-helpers.ts`

- **Nuevo tipo `PaymentRow`**: `{ invoice_date: string; profile_id: string | null; client_name: string; program_name: string; variant_name: string; amount_paid: number; status: string }`.
- **`filterPaymentsByStatus(rows, status): PaymentRow[]`** (función pura, TDD) — devuelve todas si `status === "todos"`, si no filtra por `status` exacto.

### `lib/admin/pagination.ts` (nuevo, compartido)

- Extraer `paginate<T>(rows, page, pageSize=10)` desde `clients-helpers.ts` a este módulo neutral; mover sus tests; actualizar el import en `clients-helpers.ts`/`ClientsTable.tsx` (re-export o import directo). Evita que `/admin/payments` se acople a `clients-helpers`.

### `lib/admin/payment-status.ts` (nuevo, compartido)

- Extraer el mapa `STATUS_LABEL` (hoy inline en `dashboard/page.tsx`) a este módulo: `Record<string, { text: string; bg: string; color: string }>` para `paid`/`open`/`void`/`uncollectible`. Lo consumen el dashboard y `PaymentsTable`. El dashboard pasa a importarlo (quita la copia local).

---

## 3. Página y componente

- **`app/admin/payments/page.tsx`** — server component: `const payments = await getAllPayments();` → `<PaymentsTable rows={payments} />`.
- **`components/admin/PaymentsTable.tsx`** — client component:
  - **Encabezado:** botón **"← Dashboard"** (`<Link href="/admin/dashboard">`, mismo patrón que "← Clientes" de la ficha) + título "Pagos" + conteo total (`(N pagos)`).
  - **Pills de filtro por estado:** Todos · Pagado · Pendiente · Anulado · Fallido (mapeadas a `todos`/`paid`/`open`/`void`/`uncollectible` vía `payment-status.ts`).
  - **Tabla:** Fecha · Clienta (**enlace a `/admin/clients/[clientId]`** si hay `profile_id`; si no, texto plano) · Programa·variante · Monto (`formatMXN`, alineado a la derecha) · Estado (badge con `STATUS_LABEL`).
  - **Paginación de 10** (`paginate`): Anterior/Siguiente + "Mostrando A–B de N"; al cambiar el filtro vuelve a página 1.
  - **Estado vacío:** "Aún no hay pagos registrados" (sin datos) / "No hay pagos con ese estado" (filtrado vacío).

---

## 4. Testing

- **TDD** de `filterPaymentsByStatus` (incluye estados, "todos", lista vacía).
- Los tests de `paginate` se mueven con el helper a `__tests__/pagination.test.ts` (sin pérdida de cobertura).
- Verificación: `npm run test:run` + `npx tsc --noEmit` + `npm run build` limpios.
- Smoke manual: dashboard "Ver todos →" → `/admin/payments`; filtro por estado; paginación; clic en clienta → su ficha; "← Dashboard" regresa.

---

## 5. Edge cases

- **Invoice sin clienta** (subscription/profile nulo): muestra "—" como nombre, sin enlace.
- **`invoice_date` timestamptz:** formatear con `.slice(0, 10)` antes de `dayLabel`/`toLocaleDateString` (lección de Gestión de Clientes — evitar "Invalid Date").
- **Filtro que deja la página fuera de rango:** `paginate` ya clampa; el reset a página 1 al filtrar lo evita.
- **Estado vacío** según haya datos o no.

---

## 6. Fuera de alcance (follow-ups)

- Búsqueda por nombre de clienta y CSV export de pagos (descartados en el brainstorm; se pueden añadir luego).
- Paginación server-side (solo si el volumen de invoices crece mucho).
- Regenerar `lib/supabase/types.ts` (follow-up global de Fase 6).

Ver [[project_aura]], [[feedback_project_approach]].
