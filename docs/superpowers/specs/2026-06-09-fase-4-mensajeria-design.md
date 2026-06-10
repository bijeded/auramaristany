# Diseño — Fase 4: Mensajería + Email (Aura → clientas)

**Fecha:** 9 de junio de 2026
**Rama objetivo:** `feature/fase-4-mensajeria`
**Estado previo:** Fases 0–3 completas y en `main`. Migración 005 aplicada.
**Contexto de arranque:** `docs/superpowers/context/2026-06-09-fase-4-mensajeria.md`

---

## 1. Objetivo y alcance

Comunicación **unidireccional Aura (admin) → clientas**, más la **infraestructura de email** (Resend + React Email) que el proyecto aún no tiene, y un canal de respuesta ligero vía **WhatsApp** (en lugar de mensajería bidireccional).

### Dentro de alcance (Fase 4)
1. **Mensajería in-app** Aura → clientas (individual + broadcast), bandeja read-only en el portal, marcar leído, badge de no-leídos.
2. **`lib/email/`**: cliente Resend + plantillas React Email + helpers best-effort. Email de "mensaje nuevo" a la destinataria.
3. **WhatsApp**: botón `wa.me` a Aura desde el portal, y a la clienta desde el admin (1-a-1).
4. **Emails de ciclo de vida** conectados a los webhooks de Stripe ya existentes: bienvenida, pago fallido, cancelación/baja.

### Fuera de alcance (follow-ups, no se construyen aquí)
- **CSV export de clientas → Fase 5** (movido a propósito; **NO olvidar**: alimentar newsletter / win-back de no-activas).
- Mensajería **bidireccional** (clienta responde dentro de la app) — WhatsApp la sustituye en v1.
- **Borradores** de mensajes (el prototipo los muestra; el schema real no los soporta).
- **Realtime** (Supabase Realtime) para el badge — se usa server render.
- **Zapier on-subscribe** (webhook saliente a newsletter al suscribirse).
- Email de **recibo de pago** (`invoice.paid`) — Stripe ya envía recibos nativos; OFF por defecto.
- **Recordatorio pre-cobro** — delegado a Stripe (dunning/recordatorios nativos), sin código.
- Confirmación de **registro/auth** — se queda en **Supabase Auth** (no se duplica).
- Regenerar `lib/supabase/types.ts` (incluir `messages`/`message_recipients`, quitar `as any`).
- Notas de admin sobre el registro del día (follow-up arrastrado de Fase 3; no es mensajería).

---

## 2. Esquema de datos y migración 006

La tabla real (migración 001) ya soporta el modelo elegido (**snapshot**, sin `broadcast_filter`):

```sql
messages (
  id, sender_id (→profiles), subject text NOT NULL, body text NOT NULL,
  is_broadcast boolean default false, created_at
)
message_recipients (
  id, message_id (→messages), recipient_id (→profiles), read_at  -- null = no leído
)
```

> ⚠ El SPEC original listaba columnas inexistentes (`recipient_id`/`broadcast_filter` en `messages`, `profile_id`/`created_at`/`unique` en `message_recipients`). Ya corregido en `SPEC.md` (9-jun, pre-Fase 4).

### Migración `006_messaging.sql` (solo lo faltante)
- **RLS — SELECT de `messages` para clientas** (gap crítico de 001):
  ```sql
  create policy "messages_select_recipient_or_admin"
    on messages for select using (
      is_admin() or exists (
        select 1 from message_recipients mr
        where mr.message_id = messages.id and mr.recipient_id = auth.uid()
      )
    );
  ```
- **RLS — UPDATE de `message_recipients` por la dueña** (marcar `read_at` sin service role):
  ```sql
  create policy "message_recipients_own_update"
    on message_recipients for update
    using (recipient_id = auth.uid())
    with check (recipient_id = auth.uid());
  ```
- **Índices**: `message_recipients(recipient_id, read_at)` (inbox + badge), `message_recipients(message_id)` ("leídos de N").
- **No** se agrega `broadcast_filter`, estado `draft`, ni `unique` (snapshot no genera duplicados; no hay borradores).

**Decisión de modelado (snapshot):** individual y broadcast crean 1 fila en `messages` + N filas en `message_recipients` (una por destinataria activa) expandidas **al enviar**. No se guarda el filtro. Consecuencia aceptada: quien se suscriba *después* de un broadcast **no** lo recibe.

---

## 3. `lib/email/` — infraestructura compartida

Centraliza todo el envío de email del proyecto (lo usan los canales de mensajería y de ciclo de vida).

- **`lib/email/client.ts`**: instancia Resend desde `RESEND_API_KEY`/`RESEND_FROM_EMAIL`. Si falta la key → **no-op con `console.warn`** (no rompe dev/test ni el webhook).
- **`lib/email/send.ts`**: helpers de alto nivel, todos `async` y **best-effort** (try/catch interno, devuelven `{ ok, error? }`, nunca lanzan):
  - `sendNewMessageEmail({ to, subject })`
  - `sendWelcomeEmail({ to, name })`
  - `sendPaymentFailedEmail({ to, name, portalUrl })`
  - `sendSubscriptionEndedEmail({ to, name })`
  - Para broadcast: `sendNewMessageEmailBatch(recipients[])` usando el **batch endpoint** de Resend (≤100 por request) para respetar rate limits; trocea en lotes de 100.
- **`lib/email/templates/*.tsx`**: React Email. Una plantilla base (`Layout`) con branding Aura (rosa `#eddbd8` / lavanda `#9982f4`, Oswald/Hind, logo/encabezado AURA) + una plantilla por tipo. Botón CTA a `NEXT_PUBLIC_APP_URL` (portal o Customer Portal según el caso).

**Pruebas:** las plantillas se renderizan a HTML con la utilidad de React Email en un test puro (no se manda email real). Los helpers se prueban con el cliente mockeado (verifican payload y que un fallo no lanza).

---

## 4. Admin — `/admin/messages`

### 4.1 Server page
Reemplaza el stub. Carga `getSentMessages()` y monta el cliente.

- **`getSentMessages()`** (`lib/admin/queries.ts`, server-only): lista de `messages` (orden `created_at` desc) con, por cada uno: `is_broadcast`, conteo total de `message_recipients` y conteo de leídos (`read_at not null`), y un **destino legible** (individual → nombre de la clienta; broadcast → "Todas" o los grupos/conteo). El agregado leídos/total se computa en una query sobre `message_recipients` agrupada por `message_id`.

### 4.2 Composer (client component — sheet, según `admin-messages.jsx`)
- Toggle **Individual / Broadcast**.
- **Individual**: buscador/selector de clientas activas (reusa un listado de clientas; ver `getRecipientGroups`/`getActiveClients`).
- **Broadcast**: checkboxes de **programa + variante/nivel** con conteo de clientas activas por grupo, más opción **"Todas las clientas activas"**. Muestra "Se enviará a N clientas".
- Campos **Asunto** + **Mensaje** (textarea) + **confirmación** antes de enviar (modal "¿Enviar a N clientas?").

### 4.3 Server Action `sendMessage` (`lib/admin/messageActions.ts`)
Corre en servidor con `createServiceClient` (inserción en lote saltando RLS de escritura), tras validar que el actor es admin (`is_admin()` / sesión).
1. **Expandir destinatarias** (función pura testeable, ver §7): a partir del modo (individual/broadcast) y filtro (grupos programa+variante / "todas"), resolver el conjunto de `recipient_id` de suscripciones **activas**, deduplicado. Una clienta con varias suscripciones aparece **una sola vez**.
2. Insertar 1 fila en `messages` (`sender_id` = admin, `is_broadcast`, `subject`, `body`).
3. Insertar N filas en `message_recipients` (`message_id`, `recipient_id`).
4. Disparar emails best-effort (`sendNewMessageEmailBatch`) — un fallo de email **no** revierte el mensaje.
5. `revalidatePath('/admin/messages')`.

**Definición de "activa":** suscripción con `status = 'active'`. (Las `past_due`/`canceled` **no** reciben in-app; las `past_due` siguen accediendo al portal por middleware pero quedan fuera del público de mensajería por defecto. Si Aura quiere incluir `past_due`, es un ajuste de un predicado — anotado, no se implementa en v1.)

---

## 5. Portal — `/portal/messages`

### 5.1 Lista (server page, reemplaza el stub)
- **`getInboxMessages(userId)`** (`lib/content/messages.ts`, server-only): join `message_recipients` (del usuario) + `messages`, orden `created_at` desc, devuelve `{ id, subject, preview, created_at, read }`. RLS garantiza que solo ve los suyos (policy nueva §2).
- UI según `client-messages.jsx`: lista con avatar de Aura, estados leído/no-leído, badge "N nuevos", empty state.
- **Botón WhatsApp a Aura**: enlace `https://wa.me/<NEXT_PUBLIC_AURA_WHATSAPP>?text=...` (número fijo en env var). Visible en la pantalla de lista.

### 5.2 Detalle `/portal/messages/[id]` (server page)
- **`getMessageDetail(userId, messageId)`**: valida pertenencia (fila propia en `message_recipients`); si no es suya → `notFound()` (404).
- Al cargar, **marca `read_at`** vía server action `markMessageRead(messageId)` (idempotente: solo escribe si `read_at is null`; usa la policy de UPDATE de la dueña).
- UI de detalle según prototipo (asunto, avatar Aura, fecha, cuerpo con `whiteSpace: pre-line`).

### 5.3 Badge de no-leídos
- **`getUnreadCount(userId)`** (server-only): `count` de `message_recipients` con `recipient_id = userId and read_at is null`.
- Se calcula en `app/portal/layout.tsx` (ya es server) y se pasa a **`PortalNav`** como prop nueva `unreadMessages: number` → puntito/número sobre el ícono "Mensajes". El badge se refresca al navegar (server render), sin realtime.

---

## 6. Emails de ciclo de vida (canal B)

Additivo sobre los handlers de Stripe **ya existentes y probados** (`app/api/webhooks/stripe/route.ts` → `lib/webhooks/stripe-handlers.ts`). Regla dura: **el email es best-effort y nunca altera el resultado del webhook** (envuelto en try/catch; un fallo se loguea y el webhook responde 200 igual).

| Evento Stripe | Helper | Contenido |
|---|---|---|
| `checkout.session.completed` (primer pago) | `sendWelcomeEmail` | Bienvenida + link al portal |
| `invoice.payment_failed` | `sendPaymentFailedEmail` | Aviso amable + link al Customer Portal para actualizar tarjeta |
| `customer.subscription.deleted` | `sendSubscriptionEndedEmail` | Aviso de baja |

`invoice.paid` (recibo) queda **OFF** (Stripe envía recibos nativos). El email de bienvenida resuelve el "stub de Fase 1".

---

## 7. Testing

**Unitarias puras (vitest, TDD) — `lib/admin/message-helpers.ts` y afines:**
- Expansión de destinatarias: dedup (clienta con 2 subs → 1 fila); solo `active`; filtro por grupos programa+variante; modo "Todas"; individual = 1.
- `getUnreadCount` / formato del agregado "leídos de N".
- **Destino legible** (individual → nombre; broadcast "Todas" vs lista de grupos).
- Normalización de teléfono para `wa.me` (solo dígitos, prefijo país).
- Render de plantillas React Email → HTML no vacío con asunto/CTA.
- Helpers de email best-effort: un fallo del cliente Resend **no** lanza.

**Smoke manual (con `DEV_DATE` / cuentas de prueba):**
- Admin envía individual → solo esa clienta lo ve en `/portal/messages`; las demás no.
- Admin envía broadcast (todas / por grupo) → todas las objetivo lo reciben; `read_at` se actualiza al abrir.
- RLS: una clienta no puede leer mensajes de otra (verificar query directa).
- Email de mensaje nuevo llega con branding correcto; emails de ciclo de vida disparan en los eventos de Stripe.
- Badge de no-leídos correcto; botón WhatsApp (portal y admin) abre el chat correcto.

**Gates verdes:** vitest, `tsc` limpio, lint limpio, `npm run build` OK.

---

## 8. Variables de entorno (nuevas/relevantes)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (ya en `.env.local`; **verificar dominio verificado en Resend** o los emails no salen).
- `NEXT_PUBLIC_AURA_WHATSAPP` (nueva) — número de WhatsApp de Aura en formato internacional solo-dígitos (ej. `52155...`).
- `NEXT_PUBLIC_APP_URL` (ya existe) — para los CTA de los emails.

---

## 9. Archivos (nuevos/tocados, estimado)

**Nuevos:**
- `supabase/migrations/006_messaging.sql`
- `lib/email/client.ts`, `lib/email/send.ts`, `lib/email/templates/*.tsx`
- `lib/admin/messageActions.ts`, `lib/admin/message-helpers.ts`
- `lib/content/messages.ts`
- `components/admin/MessageComposer.tsx`, `components/admin/SentMessagesList.tsx`
- `components/portal/MessagesList.tsx`, `components/portal/MessageDetail.tsx` (o pages directas)
- `app/portal/messages/[id]/page.tsx`
- Tests asociados (`*.test.ts`)

**Tocados:**
- `app/admin/messages/page.tsx` (reemplaza stub)
- `app/portal/messages/page.tsx` (reemplaza stub)
- `app/portal/layout.tsx` (pasa `unreadMessages` a `PortalNav`)
- `components/portal/PortalNav.tsx` (badge)
- `lib/admin/queries.ts` (`getSentMessages`, `getRecipientGroups`/clientas activas)
- `lib/webhooks/stripe-handlers.ts` (3 llamadas de email best-effort en los handlers existentes)
- Admin (lista/ficha de clientas): botón WhatsApp a la clienta

---

## 10. Verificación al cerrar Fase 4 (E2E)
- Individual y broadcast llegan a las clientas correctas; las no destinatarias no.
- Marcar leído actualiza `read_at`; badge refleja no-leídos.
- RLS: aislamiento entre clientas verificado.
- Emails (mensaje nuevo + 3 de ciclo de vida) llegan con branding; fallo de Resend no rompe webhooks ni el envío in-app.
- WhatsApp (portal→Aura, admin→clienta) abre el chat correcto.

Ver también `docs/superpowers/context/2026-06-09-fase-4-mensajeria.md`, `[[project-aura-maristany]]`, `[[feedback_project_approach]]`.
