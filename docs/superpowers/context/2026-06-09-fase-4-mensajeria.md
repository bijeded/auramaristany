# Contexto — Fase 4: Mensajería (arranque en chat nuevo)

**Fecha:** 9 de junio de 2026
**Estado del proyecto:** Fases 0, 1, 2 y 3 COMPLETAS y mergeadas a `main`. Migración 005 aplicada en Supabase. Esta es la siguiente fase del roadmap.
**Cómo arrancar:** lee este bloque + `SPEC.md` (sección "Panel de Administración → Mensajería" y rutas) y el `handoff.md`. Luego haz un **brainstorm** (superpowers:brainstorming) para fijar alcance/decisiones, escribe un **plan** (writing-plans) y ejecútalo (subagent-driven, sobre una rama `feature/fase-4-mensajeria`). Respeta la forma de colaborar: discutir antes de implementar, separar data de presentación, respetar scope de fases.

---

## Qué es la Fase 4 (entregable)

Comunicación **Aura (admin) → clientas**. Según SPEC §Mensajería + handoff §5 (no es chat bidireccional en v1):
1. **Admin `/admin/messages`** — componer mensaje **individual** (a una clienta) o **broadcast** (a todas, o filtrado por programa). Historial de enviados. Hoy es un **stub** (`app/admin/messages/page.tsx`, 12 líneas).
2. **Portal `/portal/messages`** — bandeja **solo lectura** de la clienta: lista de mensajes recibidos + detalle, marcar como leído (`read_at`). Hoy es un **stub** (`app/portal/messages/page.tsx`).
3. **Notificación por email** al destinatario vía **Resend + React Email** (⚠ Resend aún NO está integrado en código — ver abajo).

Prototipos UI de referencia: `design-handoff-aura/prototype/aura/admin-messages.jsx` (12KB) y `client-messages.jsx` (3.6KB).

---

## Esquema REAL (verificado en migración 001 — difiere del SPEC §schema)

⚠ El SPEC §"Base de Datos" muestra columnas que **NO existen** en la tabla real (`recipient_id`, `broadcast_filter`, `unique(message_id, profile_id)`). El esquema realmente aplicado es:

```sql
messages (
  id, sender_id (→profiles), subject text not null, body text not null,
  is_broadcast boolean default false, created_at
)
-- NO tiene recipient_id ni broadcast_filter. El destino se modela vía message_recipients.

message_recipients (
  id, message_id (→messages), recipient_id (→profiles), read_at
)
-- 1 fila por (mensaje, destinataria). 'read_at' null = no leído.
-- NO tiene created_at ni unique declarado (considerar agregarlos en una migración 006 si se necesita).
```

**Decisión de modelado:** tanto individual como broadcast crean 1 fila en `messages` + N filas en `message_recipients` (una por destinataria). El filtro por programa se resuelve al EXPANDIR los destinatarios al enviar (no se guarda el filtro), o se agrega `broadcast_filter` en una migración si se quiere recomputar. Definir en el brainstorm.

**RLS (en 001 — VERIFICAR y completar):**
- `messages_admin_write` (admin escribe). `message_recipients_own_or_admin` (la dueña lee sus filas), `message_recipients_admin_write`.
- ⚠ **Falta confirmar una policy de SELECT sobre `messages` para clientas**: la clienta necesita leer `subject`/`body` de los mensajes donde tiene fila en `message_recipients`. Si no existe, agregarla en migración 006 (p.ej. `select` si `exists(select 1 from message_recipients mr where mr.message_id = messages.id and mr.recipient_id = auth.uid())` o `is_admin()`).

---

## Piezas ya construidas para REUSAR

- **Patrón de queries server-only** (`lib/content/queries.ts`, `lib/content/history.ts`) y de acciones admin (`lib/admin/dayActions.ts`): server actions/route handlers con `createClient` (RLS) o `createServiceClient` (service role) según corresponda.
- **`app/admin/layout.tsx`** — sidebar admin (ítem "Mensajes" ya existe). **`app/portal/` nav inferior** — ítem "Mensajes" ya existe (apunta a `/portal/messages`).
- **`lib/admin/queries.ts`** — patrón para listar clientas (para el selector de destinatario individual / filtro por programa).
- **`createServiceClient`** (`lib/supabase/service.ts`) — para insertar `message_recipients` en lote saltando RLS al enviar.
- **`PortalHeader`**, componentes de UI del portal, tokens de marca.
- **`DEV_DATE`** sigue disponible.

---

## Dependencia / integración a resolver
- **Resend NO está integrado en código todavía** (solo `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en `.env.local`). Hay que crear el cliente de Resend + plantillas con **React Email**. Verificar también si la Fase 1 dejó algún envío real de email de bienvenida/aviso de pago (los webhooks lo mencionan en el SPEC, pero `grep -ri resend lib app` no encontró referencias → probablemente quedó como stub/pendiente). Considerar centralizar el envío de email en un `lib/email/`.

---

## Decisiones / preguntas a resolver en el brainstorm
1. **Alcance v1:** ¿solo Aura→clientas (broadcast + individual) y bandeja read-only en el portal? ¿O se quiere respuesta de la clienta (bidireccional)? El SPEC dice unidireccional; confirmar.
2. **Broadcast por programa:** ¿filtro por programa/variante/estado? ¿Se expande a `message_recipients` al enviar (snapshot) o se guarda el filtro y se recomputa? (afecta si se necesita migración 006).
3. **Email:** ¿se envía email por cada mensaje (individual y broadcast)? ¿Plantilla única? ¿Rate limits de Resend para broadcasts grandes? ¿Envío async/cola?
4. **Notificación in-app:** ¿badge de no-leídos en la nav inferior del portal (el prototipo de progreso usa `unread`)? ¿Realtime de Supabase o conteo en server render?
5. **RLS:** confirmar/agregar policy de SELECT de `messages` para clientas (ver arriba).
6. **Migración 006:** ¿hace falta? (created_at/unique en message_recipients, broadcast_filter en messages, índices).
7. **SPEC drift:** alinear el SPEC §schema de `messages` con la tabla real, o migrar la tabla al SPEC. Decidir cuál es la verdad.

---

## Verificación al cerrar Fase 4 (E2E)
- Admin envía mensaje individual → la clienta destinataria lo ve en `/portal/messages`, las demás no.
- Admin envía broadcast (todas o por programa) → todas las clientas objetivo lo reciben; marcar leído actualiza `read_at`.
- Email llega al destinatario (Resend), con el branding correcto.
- RLS: una clienta no puede leer mensajes de otra.

---

## Follow-ups arrastrados (no bloquean Fase 4)
- **Deploy:** configurar Vercel + variables de entorno de producción.
- Regenerar `lib/supabase/types.ts` (incluir `progress_photos`/`body_metrics`/`messages`/`message_recipients`, quitar `as any`).
- UI de admin para borrar fotos de clientas (RLS ya lo permite) — encaja en la futura ficha de cliente.
- Notas de admin sobre el registro del día de la clienta (diferido desde Fase 3; evaluar aquí o como feature aparte).
- `stripe.subscriptions.retrieve` sin try/catch; `formatDate` duplicado → util; `saveBlocks`/`savePillarBlocks` no transaccionales → RPC; tests de `cloneDay`/`cloneWeek`.

Ver [[project-aura-maristany]], [[feedback_project_approach]].
