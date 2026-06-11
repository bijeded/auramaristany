# Reporte de Auditoría de Seguridad — Fase 6

**Fecha:** 11 de junio de 2026
**Alcance:** Código de `main` (Fases 0–5 + Fase 6 sub-bloques 1/3/4a/4b, migraciones 001–008)
**Tipo:** Revisión estática read-only. Sin cambios de código.
**Spec:** docs/superpowers/specs/2026-06-11-fase6-auditoria-seguridad-design.md
**Plan:** docs/superpowers/plans/2026-06-11-fase6-auditoria-seguridad.md
**Método:** 4 auditores read-only en paralelo (A1 RLS+service-role · A2 middleware+edge-cases · A3 storage · A4 admin-handlers+input) + consolidación.

> **Veredicto general:** **Cero hallazgos Críticos explotables.** El modelo de autorización es sólido en lo esencial: RLS bien aplicada en las 18 tablas, verificación de firma en el webhook de Stripe y de `CRON_SECRET` en el cron, y validación de propiedad en el código de las rutas de Storage (que usan service-role y por tanto bypasean RLS). Los hallazgos son de **defensa en profundidad, robustez, UX/negocio e higiene**.

---

## Tabla resumen

| Área | Crítico | Medio | Bajo | Total |
|---|---|---|---|---|
| 1 · RLS | 0 | 1 | 1 | 2 |
| 2 · Service-role | 0 | (en DEF-1) | 1 | 1 |
| 3 · Middleware/gates | 0 | (en DEF-1/SUB-1) | 1 | 1 |
| 4 · Handlers admin | 0 | 1 (DEF-1) | 0 | 1 |
| 5 · Storage/fotos | 0 | 0 | 2 | 2 |
| 6 · Edge-cases semanales | 0 | 1 (SUB-1) | 2 | 3 |
| 7 · Input/auth | 0 | 2 | 3 | 5 |
| **Total** | **0** | **5** | **10** | **15** |

---

## Lista priorizada de fixes

Ordenada por severidad y, dentro de cada nivel, por impacto/confianza. Esfuerzo: S (<1h) · M (medio día) · L (varios días).

### Medios
1. **[DEF-1] Verificación de rol admin no replicada server-side** — esfuerzo **M**. El de mayor valor: introduce un helper `requireAdmin()` uniforme. Su instancia de más impacto (fotos vía service-role) lo hace prioritario.
2. **[SUB-1] Gate de suscripción solo reconoce `status='active'`** — esfuerzo **M**. Tiene cara de UX/negocio (clientes en `past_due`/`trialing` expulsados); requiere decidir la política de estados con Aura.
3. **[INP-3] Enumeración de cuentas + validación de phone solo client-side en registro** — esfuerzo **S–M**.
4. **[INP-2] Sin validación de input server-side en actions de contenido** — esfuerzo **M**. Relevante por el posible XSS al renderizar `content` arbitrario en el portal (verificar el render).
5. **[RLS-1] Políticas `for all` sin `with check` explícito** — esfuerzo **S** (migración idempotente). Mitigado hoy por Postgres, pero conviene cerrarlo.

### Bajos (higiene / defensa en profundidad)
6. **[INP-1]** Errores crudos de Postgres/Supabase devueltos al cliente — **S**.
7. **[EDGE-5]** `/api/portal/progress` confía en `subscriptionId` del body — **S**.
8. **[EDGE-3]** `getDay()` local vs cómputo en UTC (off-by-one si runtime no-UTC) — **S**.
9. **[MW-3]** El `matcher` cubre `/api/*` (webhook/cron pagan `getUser()` innecesario) — **S**.
10. **[RLS-2]** `messages_admin_write` sin `with check` — **S**.
11. **[SVC-2]** `create-checkout` usa service-role de más — **S**.
12. **[STG-2]** Signed URLs de fotos con expiración de 1h (considerar bajar a 5–10 min) — **S**.
13. **[INP-4]** Guardado de onboarding client-side, validación solo client — **M**.
14. **[INP-5]** `sendMessage` sin tope de longitud en subject/body — **S**.
15. **[HYG-1]** `is_admin()` no fija `search_path` explícito — **S**.

---

## Hallazgos por área

### Medios

#### [DEF-1] Verificación de rol admin recae solo en middleware + RLS, no replicada server-side en páginas, queries y server-actions admin
- **Área:** 2/3/4 (consolida SVC-1, MW-2, ADM-1, ADM-2, ADM-3)
- **Severidad:** Medio
- **Ubicación:**
  - Instancia de más impacto: lib/admin/clients-queries.ts:175-178 (`getClientDetail` firma URLs de fotos de cualquier cliente con `createServiceClient()`, que **bypasea RLS de Storage**), invocada desde app/admin/clients/[clientId]/page.tsx sin guard de rol inline.
  - app/admin/layout.tsx:1 (`"use client"`, sin check de rol), app/admin/dashboard/page.tsx, app/admin/clients/page.tsx (server components sin guard).
  - Server-actions sin check de rol: lib/admin/dayActions.ts:18,51,74,86,138; lib/admin/pillarActions.ts:6,22; lib/admin/onboardingActions.ts:12,53,68.
- **Descripción:** Las **rutas API admin** (`app/api/admin/*`) SÍ revalidan rol explícitamente antes de usar el service client — defensa en profundidad correcta. En cambio las **páginas** admin, la query `getClientDetail` y las **server-actions de contenido** confían únicamente en (a) el middleware (`role==='client' && /admin → redirige`) y (b) la RLS (`*_admin_write using(is_admin())` sobre el cliente RLS-aware). Hoy esto **no permite escalada de privilegios**: un cliente que invoque una action es rechazado por RLS. Pero la garantía es de una sola capa e inconsistente (unas actions chequean rol — `messageActions` sí —, otras no).
- **Impacto:** Sin bypass confirmado hoy. El riesgo es de mantenibilidad: la instancia de fotos ya usa service-role (salta RLS), así que **una regresión del middleware** (cambio de matcher, nueva forma de invocación) expondría fotos privadas de todas las clientas vía URLs firmadas. Y si alguien añade una server-action admin con service-role sin replicar el check, queda totalmente abierta.
- **Fix sugerido:** Crear un helper `requireAdmin()` reutilizable (ya existe el patrón en lib/admin/messageActions.ts:37-46) y aplicarlo al inicio de cada página admin, `getClientDetail`/`getClientsList`, y cada server-action admin. No depender del middleware como única barrera.
- **Confianza:** Alta

#### [SUB-1] El gate de suscripción solo reconoce `status='active'`; estados intermedios (`past_due`, `trialing`, `incomplete`) expulsan al cliente
- **Área:** 3/6 (consolida MW-1, EDGE-4)
- **Severidad:** Medio
- **Ubicación:** middleware.ts:51-56, lib/middleware-utils.ts:43-44, lib/content/queries.ts:112-113, lib/content/history.ts:127-128, lib/webhooks/stripe-handlers.ts:230
- **Descripción:** `hasActiveSubscription` se calcula con `.eq("status","active")`. El webhook `handlePaymentFailed` pone la suscripción en `past_due` (un reintento normal de Stripe); Stripe también puede dejarla en `trialing`/`incomplete`. En todos esos casos el cliente es redirigido a `/portal/sin-suscripcion`. La definición de "active" está **duplicada en tres sitios** (middleware, `getTodayContent`, `getPerformanceData`) — son coherentes entre sí, pero el conjunto es demasiado estrecho.
- **Impacto:** No es bypass de seguridad (el lado restrictivo es correcto). Es UX rota / posible doble cobro: un cliente con suscripción real en `past_due` ve "no tienes suscripción" y podría iniciar un segundo checkout, mientras el email `sendPaymentFailedEmail` asume que sigue siendo cliente.
- **Fix sugerido:** Unificar "suscripción que concede acceso" en **una sola constante/función compartida** por los tres sitios; decidir con Aura qué estados conceden acceso (p.ej. `active`, `trialing`, y `past_due` durante la ventana de gracia) y mostrar un banner de "pago pendiente" en lugar de expulsar.
- **Confianza:** Alta

#### [INP-3] Enumeración de cuentas y validación de phone solo client-side en el registro
- **Área:** 7 (input/auth)
- **Severidad:** Medio
- **Ubicación:** components/auth/RegisterForm.tsx:58-61
- **Descripción:** El registro es client-side (`supabase.auth.signUp`) y al fallar muestra `error.message` crudo, que puede distinguir "email ya registrado" → enumeración de cuentas. La validación de password (≥8) y de phone es solo client-side; llamando a `signUp` directamente se puede dejar `profiles.phone` con un valor no normalizado (la migr. 008 copia lo que venga en metadata).
- **Impacto:** Enumeración de usuarios (saber qué correos tienen cuenta) y phone no normalizado en perfiles.
- **Fix sugerido:** Mensaje genérico de registro; validar/normalizar phone server-side (trigger o action) además del cliente.
- **Confianza:** Media

#### [INP-2] Ausencia de validación de input server-side en las actions de contenido (días/pilares)
- **Área:** 7 (input/auth)
- **Severidad:** Medio
- **Ubicación:** lib/admin/dayActions.ts:18-44,46-72,86; lib/admin/pillarActions.ts:6-20,22-36
- **Descripción:** `saveDay`/`saveBlocks`/`savePillar`/`savePillarBlocks` insertan `title`, `dayType`, `block_type` y `content: Record<string, unknown>` arbitrario sin validar tipos, rangos, longitud ni enum (solo lo limita el CHECK de la BD). Contraste: `messageActions`/`onboardingActions` sí validan.
- **Impacto:** Acotado a actores admin por RLS (no es escalada). Pero el `content` arbitrario se **renderiza luego en el portal del cliente** → **verificar que el render escapa** (riesgo de XSS almacenado si no).
- **Fix sugerido:** Validar tipos/rangos/longitud y enum server-side (p.ej. zod) antes del insert; definir un esquema para `content`. Confirmar el escapado en el render del portal.
- **Confianza:** Media

#### [RLS-1] Políticas `for all ... using(...)` sin `with check` explícito en tablas de datos de cliente
- **Área:** 1 (RLS)
- **Severidad:** Medio
- **Ubicación:** supabase/migrations/001_initial_schema.sql:382-385 (`progress_logs_own_or_admin`, `body_metrics_own_or_admin`), :334-335 (`onboarding_responses_own_or_admin`)
- **Descripción:** Son `for all using (profile_id = auth.uid() or is_admin())` sin `with check`. En Postgres, una política `FOR ALL` sin `WITH CHECK` **reutiliza el `USING` como check** para INSERT/UPDATE, así que hoy un cliente no-admin no puede escribir filas con `profile_id` ajeno (`is_admin()` es false → exige `profile_id = auth.uid()`). El riesgo es de robustez: depender del check implícito es frágil (un futuro split en política `FOR INSERT` separada perdería la garantía). Patrón correcto de referencia: `progress_photos_own_or_admin` (005:39-42) que SÍ declara `with check`.
- **Impacto:** Bajo riesgo de explotación actual (mitigado por Postgres); inconsistencia con el patrón explícito.
- **Fix sugerido:** Añadir `with check (profile_id = auth.uid() or is_admin())` explícito (migración idempotente drop+create, como en 005).
- **Confianza:** Media

### Bajos

#### [INP-1] Errores crudos de Postgres/Supabase devueltos al cliente
- **Área:** 7 · **Severidad:** Bajo
- **Ubicación:** lib/admin/dayActions.ts:35,42,57,67,124; lib/admin/pillarActions.ts:18,27,32; lib/admin/onboardingActions.ts:29,48,62,73; lib/admin/messageActions.ts:72,77,131,135; app/api/admin/upload/route.ts:34; app/api/admin/clients/[clientId]/route.ts:48
- **Descripción/Impacto:** `return { error: error.message }` filtra internals del esquema (tablas, columnas, constraints, mensajes de RLS) al cliente. Útil para reconnaissance; superficie mayormente admin-only.
- **Fix sugerido:** Loggear el error completo server-side y devolver un mensaje genérico al cliente.
- **Confianza:** Alta

#### [EDGE-5] `/api/portal/progress` confía en un `subscriptionId` provisto por el cliente sin validar pertenencia
- **Área:** 6 · **Severidad:** Bajo
- **Ubicación:** app/api/portal/progress/route.ts:16-36, lib/content/queries.ts:209-217
- **Descripción/Impacto:** El `subscriptionId` del body se escribe en `progress_logs.subscription_id`; la RLS valida `profile_id = auth.uid()` pero **no** que el `subscription_id` sea del usuario. No expone datos ajenos (el `profile_id` sigue siendo el del atacante), solo corrompe la atribución `log↔subscription` de sus propios logs (podría ensuciar reportes/finanzas que agreguen por `subscription_id`).
- **Fix sugerido:** Derivar `subscriptionId` en el servidor desde la suscripción activa del usuario; no confiar en el body.
- **Confianza:** Alta

#### [EDGE-3] `toDayOfWeek` usa `getDay()` (hora local) mientras el cómputo de semana usa UTC
- **Área:** 6 · **Severidad:** Bajo
- **Ubicación:** lib/content/access.ts:42, :50-72; lib/content/queries.ts:99-100
- **Descripción/Impacto:** La semana se calcula con `Date.UTC(...)` pero el día-de-semana con `today.getDay()` (hora local del servidor). En Vercel (UTC) coinciden; si el runtime tuviera otra zona, posible off-by-one en `day_of_week` cerca de medianoche → el cliente ve/bloquea el día equivocado por unas horas.
- **Fix sugerido:** Usar `getUTCDay()` en `toDayOfWeek` (o forzar `TZ=UTC` en runtime) para que día y semana usen el mismo reloj.
- **Confianza:** Media

#### [MW-3] El `matcher` cubre todas las rutas `/api/*`, incluidos webhook y cron
- **Área:** 3 · **Severidad:** Bajo
- **Ubicación:** middleware.ts:90-94
- **Descripción/Impacto:** Sin gap de cobertura (ninguna ruta sensible queda fuera), pero cada hit a `/api/webhooks/stripe` y `/api/cron/purge-messages` ejecuta `getUser()` + query a `profiles` innecesariamente, y un redirect mal añadido en `getRedirectPath` podría interferir con endpoints máquina-a-máquina.
- **Fix sugerido:** Excluir `api/webhooks` y `api/cron` del matcher.
- **Confianza:** Media

#### [RLS-2] `messages_admin_write` es `for all using(is_admin())` sin `with check`
- **Área:** 1 · **Severidad:** Bajo
- **Ubicación:** supabase/migrations/001_initial_schema.sql:390-391
- **Descripción/Impacto:** Mismo patrón que RLS-1; Postgres hereda `is_admin()` como check, así que un no-admin no puede insertar. No maneja `profile_id` de cliente (la columna es `sender_id`, siempre admin) → sin riesgo de escritura cruzada. Higiene.
- **Fix sugerido:** Añadir `with check (is_admin())` explícito.
- **Confianza:** Media

#### [SVC-2] `create-checkout` usa service-role donde no aporta
- **Área:** 2 · **Severidad:** Bajo
- **Ubicación:** app/api/subscriptions/create-checkout/route.ts:35-87
- **Descripción/Impacto:** Verifica sesión antes de usar el service client y todas las queries filtran por `user.id` autenticado (sin IDOR). El service-role amplía la superficie sin necesidad (lee catálogo `public_read` y escribe en el propio perfil).
- **Fix sugerido:** Opcional — usar `createClient()` RLS-aware donde sea posible.
- **Confianza:** Alta

#### [STG-2] Signed URLs de fotos con expiración de 1 hora
- **Área:** 5 · **Severidad:** Bajo
- **Ubicación:** app/portal/history/page.tsx:38, lib/admin/clients-queries.ts:178
- **Descripción/Impacto:** Expiración `3600`s. La URL (con token firmado sobre un path con UUID no enumerable) queda en el HTML/RSC payload y es válida 1h para quien la intercepte. Para fotos corporales, conservadoramente podría bajarse. No da acceso a otras fotos.
- **Fix sugerido:** Reducir a 300–600s. No bloqueante.
- **Confianza:** Alta

#### [INP-4] Guardado de onboarding es client-side, validación solo en el cliente
- **Área:** 7 · **Severidad:** Bajo
- **Ubicación:** app/onboarding/questionnaire/QuestionnaireForm.tsx:57-74
- **Descripción/Impacto:** El upsert a `onboarding_responses` y el update de `profiles.onboarding_completed` se hacen desde el navegador. RLS confina todo a la propia fila (no afecta a terceros), pero un cliente puede saltarse la validación de "requeridas" y marcar su onboarding como completo sin responder, con `responses` de cualquier forma/tamaño.
- **Fix sugerido:** Mover el guardado a una server-action que revalide requeridas/forma contra `onboarding_questions` activas e ignore cualquier `profileId` del cliente (usar `getUser()`).
- **Confianza:** Media

#### [INP-5] `sendMessage` sin tope de longitud en subject/body
- **Área:** 7 · **Severidad:** Bajo
- **Ubicación:** lib/admin/messageActions.ts:56-58
- **Descripción/Impacto:** Valida no-vacío pero no longitud máxima. Acción admin-only (con `requireAdmin()` correcto) → impacto mínimo.
- **Fix sugerido:** Añadir límite de longitud razonable.
- **Confianza:** Media

#### [HYG-1] `is_admin()` no fija `search_path` explícito
- **Área:** 1 · **Severidad:** Bajo (higiene)
- **Ubicación:** supabase/migrations/001_initial_schema.sql:307-312
- **Descripción/Impacto:** Es `security definer stable` y no toma input (no spoofeable), pero a diferencia de `handle_new_user` (migr. 008, que sí fija `set search_path = public`), `is_admin()` no lo hace. Riesgo bajo por ser un `select` simple sobre `profiles`.
- **Fix sugerido:** Añadir `set search_path = public` por robustez.
- **Confianza:** Media

---

## Cobertura (revisado y limpio)

**RLS / autorización de datos:**
- `is_admin()` (001:307-312): `security definer stable`, no spoofeable (no toma input). _(ver HYG-1 sobre search_path)_
- `profiles_select_own_or_admin` / `profiles_update_own` (001:315-323): el `with check` ancla `role` al valor actual → **previene auto-escalado cliente→admin**.
- `invoices_own_or_admin` (001:398-404): el subquery invoice→subscription→profile ata correctamente la propiedad; no expone invoices ajenas.
- `subscriptions_own_or_admin`, `progress_photos_own_or_admin` (con `with check`), `message_recipients_own_update` / `messages_select_recipient_or_admin`: correctas.
- Tablas de catálogo `*_public_read using(true)`: solo datos de catálogo, sin columnas de cliente. Lectura intencional.

**Service-role (bypass RLS) — todos protegidos por verificación previa:**
- Webhook Stripe (app/api/webhooks/stripe/route.ts:16-26): verifica `stripe-signature` con `STRIPE_WEBHOOK_SECRET` antes de cualquier handler; los `profile_id` vienen del payload firmado.
- cron/purge-messages (route.ts:13-17): exige `Authorization: Bearer <CRON_SECRET>` antes del service client.
- app/api/admin/clients/[clientId]/route.ts y .../photos/[photoId]/route.ts y .../upload/route.ts: verifican sesión + `role==='admin'` server-side ANTES del service client; el photo-delete ata `photoId`↔`clientId` (sin IDOR).
- app/api/portal/photos/route.ts y .../[id]/route.ts: el path de Storage y el `profile_id` se atan a `user.id` autenticado, no a input de request (sin IDOR).

**Middleware / gates:**
- middleware.ts:30-32 usa `getUser()` (valida el JWT), no `getSession()`.
- middleware.ts:74-83 propaga cookies de sesión refrescadas al redirect.
- Traza completa de `getRedirectPath` (middleware-utils.ts:11-52): no hay forma de alcanzar `/portal/today` sin (sesión + rol client + suscripción activa + onboarding completo), ni `/admin/*` sin rol admin. Excepción `sin-suscripcion`/`activando` acotada con `===` (no abre subrutas).

**Modelo semanal:**
- Edge-case **semana 5 RESUELTO**: `Math.min(Math.floor(daysElapsed/7)+1, 4)` (access.ts:69), cubierto por tests (content-access.test.ts:56-66).
- Límites día 0 / semana negativa / fin de programa: `Math.max(0, ...)` + retorno `null` sin crash.
- `DEV_DATE` solo se lee si la env var existe (ausente en prod). _(ver EDGE-3 sobre el día-de-semana en local time)_

**Storage:**
- Bucket `progress` privado (`public=false`, 005:8-10); políticas owner-folder/admin en read/insert/delete.
- `getPublicUrl` no se usa en ningún lado; todo acceso a `progress` es vía `createSignedUrl`. Bucket `content` (público) solo recibe `images/`/`pdfs/` de contenido del programa, gateado por admin.

**Handlers / input:**
- `requireAdmin()` (messageActions.ts:37-46): obtiene identidad con `getUser()` server-side, consulta `profiles.role`, exige admin. Aplicado en sendMessage/getSentMessageDetail/deleteMessage.
- `markMessageRead` (portal): scopea por `recipient_id = user.id` + RLS; no toca mensajes ajenos.
- `validateQuestion` (onboarding-helpers.ts:31-52): valida texto requerido y limpia opciones.

---

## Notas para el ciclo de corrección

- **DEF-1** es el fix de mayor retorno y agrupa 5 hallazgos originales (SVC-1/MW-2/ADM-1/2/3) bajo un solo helper `requireAdmin()`.
- **SUB-1** requiere una **decisión de negocio de Aura** (qué estados de suscripción conceden acceso) antes de implementar.
- **INP-2** tiene una dependencia a verificar fuera de esta auditoría: confirmar que el render del `content` en el portal escapa correctamente (riesgo XSS).
- Hallazgos puramente informativos sin acción (STG-1, STG-3, MW-4, EDGE-1/2): documentados en la sección de Cobertura.

> Estado: **COMPLETO**.
