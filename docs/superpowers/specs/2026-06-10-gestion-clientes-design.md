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
- **`app/api/admin/clients/[clientId]/route.ts`** — endpoint **DELETE** admin para **eliminar la clienta y toda su información** (ver §8). Verifica `is_admin()`, **bloquea** (409) si la clienta tiene alguna suscripción no cancelada, borra los objetos de Storage de sus fotos y luego elimina el `auth.user` (que cascadea el resto vía la migración 007).

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
- `canDeleteClient(subs): { ok: boolean; reason?: string }` — `false` si la clienta tiene alguna suscripción **no cancelada** (`active` / `past_due` / `unpaid`); `true` si todas están `canceled` o no tiene ninguna. Lo usan tanto la UI (deshabilitar botón) como el endpoint (guard 409).
- `paginate(rows, page, pageSize=10): { items, totalPages }` — paginación de la lista (sobre las filas ya filtradas).
- Reusa `formatMXN` de `finance-helpers.ts`.

### `lib/admin/date-helpers.ts` (nuevo, compartido)

Extrae `monthKey(iso)`, `monthLabel(key)`, `dayLabel(iso)` que hoy viven duplicados en `components/portal/PhotosTab.tsx`, para reusarlos en el filtro por mes de la galería admin sin duplicar (en línea con el follow-up de unificar `formatDate`). `PhotosTab` se actualiza para importarlos.

---

## 3. Lista de clientas (`ClientsTable`, client component)

Basada en el prototipo `admin-clients.jsx`:
- Encabezado: título "Clientes (N activas)" + buscador (nombre/correo).
- Filtros pill: programa (`Todas` / nombres de programa) **`|` (separador visible)** y estado (`Activas` / `Vencidas` / `Con pago fallido`), con `filterClients`. El separador `|` deja claro que son dos grupos de filtros distintos (el prototipo ya tenía un divisor; se hace explícito).
- Tabla: Clienta (avatar + nombre + correo), Programa·variante (badge), Inscripción, Próximo cobro + monto, Estado (badge), acción "Ver" → `/admin/clients/[clientId]`.
- **Paginación cada 10 clientas** (`paginate`, client-side sobre la lista filtrada): controles Anterior/Siguiente + "Mostrando A–B de N". Al cambiar filtros/búsqueda se vuelve a la página 1.
- **Eliminar**: cada fila tiene una acción de eliminar (ícono papelera, label "Eliminar") que abre un **diálogo de confirmación** (nombre + advertencia "se borrarán todos los datos, fotos y registros; es irreversible"). Deshabilitada (con tooltip explicativo) si `canDeleteClient` es `false`. Al confirmar: `DELETE /api/admin/clients/[clientId]` + `router.refresh()`. Si el endpoint responde 409, se muestra el motivo (suscripción activa).
- Estado vacío con botón "Limpiar filtros".
- **Botón "Exportar CSV"** (encabezado): genera el CSV con `clientsToCSV(filasFiltradas)` (respeta filtros activos) y dispara descarga vía `Blob` + `<a download>`. Columnas: nombre, email, programa, variante, estado, inscripción.

---

## 4. Ficha individual — 6 tabs (`ClientDetailTabs`)

Header: botón "← Clientes" (vuelve a la lista, como el prototipo) + avatar + nombre + correo + badge de estado. Tabs: Resumen · Onboarding · Progreso · Fotos · Pagos · Mensajes.

| Tab | Contenido |
|-----|-----------|
| **Resumen** | Card de programa: programa·variante, fecha de inicio, etiqueta de progreso (`subscriptionProgressLabel`), próximo cobro + monto. Si la clienta tiene >1 suscripción, se listan todas. Card lateral con CTA "Enviar mensaje" → `/admin/messages`. **Botón "Eliminar"** (estilo destructivo, al pie del Resumen) con el mismo diálogo de confirmación y guard que en la lista (`canDeleteClient`); al confirmar el borrado redirige a `/admin/clients`. |
| **Onboarding** | Cada pregunta activa con su respuesta (`responses[question.id]`); arrays se muestran unidos por `·`; "—" si sin respuesta. |
| **Progreso** | **Lista** de días registrados (similar a `/portal/history`): fecha, título/enfoque del día, estado completo/parcial según `progress_logs.completed` + conteo de ejercicios hechos. Reusa helpers de `lib/content/history-helpers.ts` donde aplique. Estado vacío si no hay registros. |
| **Fotos** | Galería con **filtro por mes** (pills `Todas` + meses, mismo UX que el cliente en su historial, usando `monthKey`/`monthLabel`). Lightbox para ver. **Botón borrar** por foto con confirmación → `DELETE /api/admin/clients/[clientId]/photos/[photoId]` + `router.refresh()`. Sin botón de subir (la admin no sube fotos). Estado vacío si no hay fotos. |
| **Pagos** | Tabla de `invoices` de la clienta: fecha, período, monto (`formatMXN`), estado (badge pagado/fallido). Estado vacío si no hay pagos. |
| **Mensajes** | Lista de mensajes enviados a la clienta (asunto, fecha, leído/no leído). Botón "+ Nuevo mensaje" → `/admin/messages`. **Botón "Enviar WhatsApp"** cuando `profiles.phone` no es null (usa `whatsappUrl(normalizeWhatsappNumber(phone))` de `message-helpers.ts`); si es null, no se muestra. |

---

## 5. Eliminar clienta (borrado total)

Decisión: **bloquear el borrado si la clienta tiene una suscripción activa** (no se toca Stripe automáticamente).

- **Migración `007_cascade_on_profile_delete.sql`**: añade `ON DELETE CASCADE` a la cadena de dependencias de `profiles` para que borrar el `auth.user` (que ya cascadea a `profiles`) limpie todo en la base:
  `subscriptions.profile_id`, `progress_logs.profile_id` (+ `subscription_id`), `body_metrics.profile_id`, `progress_photos.profile_id` (+ `body_metrics_id`), `message_recipients.recipient_id`, `invoices.subscription_id`, `subscription_events.subscription_id`. (`messages.sender_id` es la admin, no se toca; `onboarding_responses` ya tiene cascade.)
- **Endpoint `DELETE /api/admin/clients/[clientId]`**:
  1. Verifica sesión + `is_admin()`.
  2. **Guard**: si la clienta tiene alguna suscripción no `canceled` (`canDeleteClient` = false) → responde **409** con el motivo. (Storage no se toca.)
  3. Borra los objetos de Storage de sus fotos (`progress` bucket, service client) — Storage no cascadea con la FK de BD.
  4. `admin.auth.admin.deleteUser(clientId)` → cascadea el resto de las filas vía la migración 007.
- **UI**: diálogo de confirmación que nombra a la clienta y advierte que es irreversible. El botón aparece deshabilitado (con tooltip) cuando hay suscripción activa, tanto en la fila de la lista como en el Resumen de la ficha.

---

## 6. Edge cases

- **Clienta con múltiples suscripciones**: lista muestra la primaria; ficha las lista todas; pagos agregan invoices de todas.
- **Strong & Fit (rolling)**: etiqueta de progreso sin "de 6".
- **`clientId` inexistente**: `getClientDetail` devuelve null → `notFound()`.
- **Estados vacíos** por tab (sin progreso / sin fotos / sin pagos / sin mensajes).
- **`phone` null**: sin botón WhatsApp (hoy es lo común; sub-bloque 4 lo poblará).
- **Signed URLs**: expiran; se generan en cada render del server component (no se cachean entre requests).
- **Borrado con suscripción activa**: bloqueado (409 + botón deshabilitado).
- **Paginación tras filtrar**: cambiar filtro/búsqueda resetea a página 1 para no quedar en una página vacía.

---

## 7. Testing

- **TDD en helpers puros** (`clients-helpers.ts`): `pickPrimarySubscription`, `filterClients`, `clientsToCSV`, `subscriptionProgressLabel`, `canDeleteClient`, `paginate` — incluyendo Strong & Fit, multi-suscripción, filtros combinados, escaping CSV, guard de borrado y límites de paginación.
- **`date-helpers.ts`**: tests de `monthKey`/`monthLabel`/`dayLabel` (al extraerlos del componente).
- Verificación manual del flujo admin: lista → filtros → paginación → CSV → ficha → cada tab → borrar foto → eliminar clienta (bloqueada con sub activa / exitosa sin sub).
- `npm run build` limpio + 0 errores TypeScript (criterio de fases anteriores).

---

## 8. Fuera de alcance (follow-ups, no en este spec)

- Regenerar `lib/supabase/types.ts` para quitar los `as unknown as` (follow-up global de Fase 6).
- Cancelar Stripe automáticamente al borrar (se descartó: el borrado se bloquea si hay sub activa).
- Edición de respuestas de onboarding / registros de progreso desde admin (solo lectura aquí).
- Métricas corporales (`body_metrics` no se captura; tab no incluida).

Ver [[project_aura]], [[feedback_project_approach]].
