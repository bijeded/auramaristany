# Diseño — Gestión de Clientes (`/admin/clients` + ficha) · Fase 6

**Fecha:** 10 de junio de 2026
**Fase:** 6 (Pulido + Launch), sub-bloque 1 (+ CSV export, sub-bloque 2)
**Estado de partida:** `/admin/clients` es un stub. Fases 0–5 mergeadas; migraciones 001–006 aplicadas.

## Objetivo

Convertir el stub `/admin/clients` en una herramienta funcional de gestión de clientas para la admin (Aura): una **lista filtrable** con export CSV y una **ficha individual** con 6 tabs (Resumen, Onboarding, Progreso, Fotos, Pagos, Mensajes). Cierra además dos follow-ups arrastrados: el **CSV export** (Fase 4) y la **UI admin para borrar fotos** (Fase 3).

Referencia visual: `design-handoff-aura/prototype/aura/admin-clients.jsx`. Patrón de datos: `lib/admin/finance-queries.ts` + `finance-helpers.ts`.

---

## 1. Rutas y estructura

- **`app/admin/clients/page.tsx`** — server component. Llama `getClientsList()` y pasa las filas a un client component `ClientsTable` que maneja búsqueda, filtros (programa / estado) y export CSV en el navegador. Dataset chico + single-admin → sin paginación server-side (la paginación del prototipo era stub; se omite o se deja como "Mostrando N de N").
- **`app/admin/clients/[clientId]/page.tsx`** — server component. Llama `getClientDetail(clientId)` (todo el detalle resuelto en server) y renderiza la ficha. Las tabs viven en un client component `ClientDetailTabs`; los datos llegan ya resueltos por props.
- **`app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`** — endpoint **DELETE** admin. Verifica sesión + `is_admin()`, borra el objeto de Storage y la fila de `progress_photos` con el **service client** (sin restringir al owner, a diferencia de `/api/portal/photos/[id]`). Cierra el follow-up de Fase 3.

El ítem "Clientes" del sidebar admin (`app/admin/layout.tsx`) ya apunta a `/admin/clients`; el card "Requieren atención" del dashboard también. No requieren cambios.

---

## 2. Capa de datos

### `lib/admin/clients-queries.ts` (server-only, RLS admin `is_admin()`)

Patrón idéntico a `finance-queries.ts`: `import "server-only"` + `createClient()` (admin-context, no service-role) + casting `as unknown as`.

- **`getClientsList(): Promise<ClientListRow[]>`**
  Fuente: `subscriptions` join `profiles` + `program_variants` + `programs`. **Una fila por clienta** (agrupada por `profile_id`): si la clienta tiene varias suscripciones, se elige la **más relevante** = primera `active` por `current_period_end` desc; si no hay activa, la más reciente por `enrollment_date`/`created_at`. La agrupación se hace con un helper puro (`pickPrimarySubscription`) para poder testearla.
  Campos por fila: `profile_id`, `full_name`, `email`, `phone`, `program_name`, `variant_name`, `enrollment_date`, `current_period_end`, `price_mxn`, `status`.

- **`getClientDetail(clientId): Promise<ClientDetail | null>`**
  Resuelve todo lo de la ficha en server:
  - **perfil**: `profiles` (full_name, email, phone, avatar_url).
  - **suscripciones**: todas las de la clienta (con variante/programa, status, fechas, months_elapsed, price_mxn) — normalmente una; la ficha las lista todas en Resumen.
  - **onboarding**: `onboarding_questions` (activas, ordenadas) + `onboarding_responses.responses` (jsonb keyed by question id).
  - **progreso**: `progress_logs` de la clienta (log_date, completed, exercises_done, day title/focus vía join a `program_days`), orden desc.
  - **fotos**: `progress_photos` de la clienta + **signed URLs** (bucket `progress`, service client) → `PhotoItem[]` (id, url, photoDate, caption).
  - **pagos**: `invoices` de las suscripciones de la clienta (invoice_date, amount_paid, status, período).
  - **mensajes**: `message_recipients` donde `recipient_id = clientId` → `messages` (subject, created_at, read_at).

### `lib/admin/clients-helpers.ts` (funciones puras, TDD)

- `pickPrimarySubscription(subs): SubLike | null` — regla de "suscripción más relevante".
- `filterClients(rows, { query, program, status }): ClientListRow[]` — búsqueda por nombre/email (case-insensitive) + filtro por programa + filtro por estado.
- `clientsToCSV(rows): string` — serializa a CSV (con escaping de comas/comillas).
- `subscriptionProgressLabel(sub, program): string` — `"Mes N de 6"` para `fixed_term_monthly` (CuarentaMás / Extra), etiqueta rolling (p.ej. `"Mes N"` / `"Activa desde …"`) para `rolling_monthly` (Strong & Fit). Sin "de 180" inventado salvo que exista base real.
- Reusa `formatMXN` de `finance-helpers.ts`.

### `lib/admin/date-helpers.ts` (nuevo, compartido)

Extrae `monthKey(iso)`, `monthLabel(key)`, `dayLabel(iso)` que hoy viven duplicados en `components/portal/PhotosTab.tsx`, para reusarlos en el filtro por mes de la galería admin sin duplicar (en línea con el follow-up de unificar `formatDate`). `PhotosTab` se actualiza para importarlos.

---

## 3. Lista de clientas (`ClientsTable`, client component)

Basada en el prototipo `admin-clients.jsx`:
- Encabezado: título "Clientes (N activas)" + buscador (nombre/correo).
- Filtros pill: programa (`Todas` / nombres de programa) y estado (`Activas` / `Vencidas` / `Con pago fallido`), con `filterClients`.
- Tabla: Clienta (avatar + nombre + correo), Programa·variante (badge), Inscripción, Próximo cobro + monto, Estado (badge), acción "Ver" → `/admin/clients/[clientId]`.
- Estado vacío con botón "Limpiar filtros".
- **Botón "Exportar CSV"** (encabezado): genera el CSV con `clientsToCSV(filasFiltradas)` (respeta filtros activos) y dispara descarga vía `Blob` + `<a download>`. Columnas: nombre, email, programa, variante, estado, inscripción.

---

## 4. Ficha individual — 6 tabs (`ClientDetailTabs`)

Header: avatar + nombre + correo + badge de estado + botón "← Clientes". Tabs: Resumen · Onboarding · Progreso · Fotos · Pagos · Mensajes.

| Tab | Contenido |
|-----|-----------|
| **Resumen** | Card de programa: programa·variante, fecha de inicio, etiqueta de progreso (`subscriptionProgressLabel`), próximo cobro + monto. Si la clienta tiene >1 suscripción, se listan todas. Card lateral con CTA "Enviar mensaje" → `/admin/messages`. |
| **Onboarding** | Cada pregunta activa con su respuesta (`responses[question.id]`); arrays se muestran unidos por `·`; "—" si sin respuesta. |
| **Progreso** | **Lista** de días registrados (similar a `/portal/history`): fecha, título/enfoque del día, estado completo/parcial según `progress_logs.completed` + conteo de ejercicios hechos. Reusa helpers de `lib/content/history-helpers.ts` donde aplique. Estado vacío si no hay registros. |
| **Fotos** | Galería con **filtro por mes** (pills `Todas` + meses, mismo UX que el cliente en su historial, usando `monthKey`/`monthLabel`). Lightbox para ver. **Botón borrar** por foto con confirmación → `DELETE /api/admin/clients/[clientId]/photos/[photoId]` + `router.refresh()`. Sin botón de subir (la admin no sube fotos). Estado vacío si no hay fotos. |
| **Pagos** | Tabla de `invoices` de la clienta: fecha, período, monto (`formatMXN`), estado (badge pagado/fallido). Estado vacío si no hay pagos. |
| **Mensajes** | Lista de mensajes enviados a la clienta (asunto, fecha, leído/no leído). Botón "+ Nuevo mensaje" → `/admin/messages`. **Botón "Enviar WhatsApp"** cuando `profiles.phone` no es null (usa `whatsappUrl(normalizeWhatsappNumber(phone))` de `message-helpers.ts`); si es null, no se muestra. |

---

## 5. Edge cases

- **Clienta con múltiples suscripciones**: lista muestra la primaria; ficha las lista todas; pagos agregan invoices de todas.
- **Strong & Fit (rolling)**: etiqueta de progreso sin "de 6".
- **`clientId` inexistente**: `getClientDetail` devuelve null → `notFound()`.
- **Estados vacíos** por tab (sin progreso / sin fotos / sin pagos / sin mensajes).
- **`phone` null**: sin botón WhatsApp (hoy es lo común; sub-bloque 4 lo poblará).
- **Signed URLs**: expiran; se generan en cada render del server component (no se cachean entre requests).

---

## 6. Testing

- **TDD en helpers puros** (`clients-helpers.ts`): `pickPrimarySubscription`, `filterClients`, `clientsToCSV`, `subscriptionProgressLabel` — incluyendo casos de Strong & Fit, multi-suscripción, filtros combinados y escaping CSV.
- **`date-helpers.ts`**: tests de `monthKey`/`monthLabel`/`dayLabel` (al extraerlos del componente).
- Verificación manual del flujo admin: lista → filtros → CSV → ficha → cada tab → borrar foto.
- `npm run build` limpio + 0 errores TypeScript (criterio de fases anteriores).

---

## 7. Fuera de alcance (follow-ups, no en este spec)

- Regenerar `lib/supabase/types.ts` para quitar los `as unknown as` (follow-up global de Fase 6).
- Paginación real de la lista (no necesaria al volumen actual).
- Edición de respuestas de onboarding / registros de progreso desde admin (solo lectura aquí).
- Métricas corporales (`body_metrics` no se captura; tab no incluida).

Ver [[project_aura]], [[feedback_project_approach]].
