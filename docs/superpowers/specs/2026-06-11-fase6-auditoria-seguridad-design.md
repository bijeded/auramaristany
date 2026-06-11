# Spec — Fase 6 · Auditoría de seguridad + edge cases

**Fecha:** 11 de junio de 2026
**Fase:** 6 (Launch) · Sub-bloque A
**Tipo:** Auditoría de seguridad read-only — **el único entregable es un reporte de hallazgos**. No se modifica código ni migraciones en este sub-bloque.

---

## 1. Objetivo y entregable

Realizar una pasada de seguridad **estática y read-only** sobre el código actual de `main` (Fases 0–5 + Fase 6 sub-bloques 1/3/4a/4b, migraciones 001–008) para verificar que el modelo de autorización es sólido antes del lanzamiento.

**Entregable único:** un reporte de hallazgos clasificados por severidad en:

```
docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md
```

**Fuera de alcance de este sub-bloque:** cualquier cambio de código, migración o configuración. Los fixes que el usuario elija a partir del reporte serán su **propio ciclo** brainstorm/spec → plan → ejecución subagent-driven en worktree.

Como la auditoría es read-only y su único artefacto es un documento, **no se usa worktree** para esta fase (se trabaja sobre `main`, solo se añade el reporte en `docs/`).

---

## 2. Áreas auditadas (7) y checklist por área

### Área 1 — RLS por tabla
Confirmar que las 18 tablas con RLS habilitada cumplen el invariante **"cliente solo ve/escribe lo suyo; admin todo vía `is_admin()`"**.

- Revisar cada política en `001_initial_schema.sql`, `005_progress_photos.sql`, `006_messaging.sql`.
- **Foco en `for all ... using(...)` sin `with check(...)`**: una política `for all` que solo define `using` no restringe la columna en INSERT/UPDATE → un cliente podría insertar/actualizar una fila con `profile_id` ajeno. Candidatos detectados: `progress_logs_own_or_admin`, `body_metrics_own_or_admin`, `messages_admin_write`, `onboarding_responses_own_or_admin`. (`progress_photos_own_or_admin` sí tiene `with check` desde la migr. 005 — usar como patrón correcto de referencia.)
- Verificar `invoices_own_or_admin` (subquery que liga invoice→subscription→profile): que el subquery no permita ver invoices ajenas.
- Confirmar que `is_admin()` es `security definer` con `search_path` fijado y no es spoofeable.
- Tablas `*_public_read using (true)` (programs, variants, prerequisites, variant_series_map): confirmar que es lectura intencional de catálogo y que no exponen datos sensibles.

### Área 2 — Uso de service-role (bypass de RLS)
`createServiceClient` bypasea RLS por completo. Auditar los **10 usos** y confirmar que cada uno verifica rol/propiedad **server-side antes** de usarlo, y que nunca cruza al cliente:

- `app/api/admin/clients/[clientId]/route.ts`
- `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`
- `app/api/admin/upload/route.ts`
- `app/api/portal/photos/route.ts`
- `app/api/portal/photos/[id]/route.ts`
- `app/api/subscriptions/create-checkout/route.ts`
- `app/api/cron/purge-messages/route.ts`
- `lib/admin/clients-queries.ts`  ← **prioridad**: la memoria del proyecto afirma que las queries admin usan contexto admin (no service-role); confirmar si es service-role real y si está justificado/protegido por verificación de rol aguas arriba.
- `lib/supabase/service.ts` (definición)
- `lib/webhooks/stripe-handlers.ts` (contexto webhook, sin sesión de usuario — confirmar que está protegido por verificación de firma)

Para cada uso: ¿hay verificación de rol/propiedad antes? ¿el `profile_id`/recurso accedido se valida contra el usuario autenticado, o se confía en un parámetro de la request?

### Área 3 — Middleware + gates
- Orden de gates en `middleware.ts` + `lib/middleware-utils.ts` (`getRedirectPath`): secuencia esperada auth → onboarding → suscripción → rol.
- Rutas no cubiertas por el `matcher` (excluye `_next`, imágenes): confirmar que ninguna ruta sensible queda fuera.
- ¿Se puede llegar a una vista admin/portal saltándose un gate por orden incorrecto de chequeos o por una ruta no listada?
- El middleware lee rol/suscripción con el **anon client** (sesión del usuario) → confirmar que es correcto y que las server-actions/endpoints **revalidan** rol por su cuenta (defensa en profundidad: el middleware no debe ser la única barrera).

### Área 4 — Endpoints / server-actions admin
Confirmar verificación de rol admin **server-side dentro de cada handler** (no delegada solo al middleware):

- Server-actions (`"use server"`): `lib/admin/dayActions.ts`, `lib/admin/messageActions.ts`, `lib/admin/onboardingActions.ts`, `lib/admin/pillarActions.ts`, `lib/portal/messageActions.ts`.
- Rutas `app/api/admin/*` (clients, clients/photos, upload).
- Para cada una: ¿valida que el caller es admin antes de mutar? ¿Las actions del portal validan que el recurso pertenece al usuario?

### Área 5 — Storage / fotos de progreso
- Bucket privado `progress` (NO público): políticas `progress_owner_read/insert/delete` (owner-folder `(storage.foldername(name))[1] = auth.uid()` o `is_admin()`).
- Que las rutas de fotos (`app/api/portal/photos/*`, `app/api/admin/clients/[clientId]/photos/*`) no permitan leer/borrar carpeta ajena: ¿el path se construye con el `auth.uid()` del servidor o con un parámetro de la request?
- URLs firmadas vs públicas: tiempo de expiración, que no se filtren rutas adivinables.
- Que el bucket `content` (público) no contenga datos sensibles de clientes.

### Área 6 — Edge cases del modelo semanal
- Semana 5 (reportada como resuelta): confirmar la corrección.
- Cómputo de semana/día actual: límites (día 0, semana > duración del programa, fin de programa), zonas horarias, `DEV_DATE`.
- Estados intermedios de suscripción (`past_due`, `canceled`, `incomplete`): qué ve el cliente en cada uno; coherencia con el gate de suscripción del middleware.

### Área 7 — Validación de input / auth
- Registro (`/auth/register`), onboarding, mensajería: validación server-side de datos mal formados.
- Mensajes de error que filtren información sensible (existencia de cuentas, stack traces, detalles internos).
- Manejo de payloads inesperados en server-actions y route handlers.

---

## 3. Formato de hallazgo y clasificación de severidad

Cada hallazgo en formato estándar:

```
### [ID] Título corto
- **Área:** (1–7)
- **Severidad:** Crítico | Medio | Bajo
- **Ubicación:** file.ts:line (clickable)
- **Descripción:** qué es
- **Impacto:** qué se rompe / qué se expone
- **Fix sugerido:** dirección de la corrección (sin implementarla)
- **Confianza:** Alta | Media | Baja
```

**Severidad:**
- **Crítico** — exposición o escritura de datos entre clientes, bypass de autenticación o de verificación de rol, service-role usado sin verificación de propiedad/rol previa.
- **Medio** — edge-case explotable solo bajo condiciones poco probables; falta de `with check` en política `for all`; validación débil sin impacto directo de datos confirmado.
- **Bajo** — defensa en profundidad, mensajes de error verbosos, higiene de seguridad.

El reporte cierra con:
1. **Tabla resumen** — conteo por severidad × área.
2. **Lista priorizada de fixes recomendados** — para que el usuario elija qué entra al ciclo de corrección posterior.

---

## 4. Ejecución (subagent-driven, read-only)

4 subagentes de auditoría en paralelo (tools de solo lectura: Read/Grep/Glob/Bash de consulta; sin Edit/Write salvo el reporte) + 1 consolidador:

| Agente | Áreas | Razón de agrupación |
|---|---|---|
| **A1** | RLS (1) + service-role (2) | El service-role bypasea RLS; auditarlas juntas evita fragmentar el hilo de razonamiento. |
| **A2** | Middleware/gates (3) + edge-cases semanales (6) | Ambas requieren visión cruzada del flujo de autorización y del modelo de negocio. |
| **A3** | Storage / fotos (5) | Autocontenida (bucket + rutas de fotos). |
| **A4** | Endpoints/actions admin (4) + validación input/auth (7) | Ambas recorren los mismos handlers desde ángulos complementarios. |
| **Consolidador** | — | Deduplica, reconcilia IDs y severidad, arma el reporte final + tabla resumen + lista priorizada. |

Ningún agente modifica código. El reporte consolidado se revisa antes de entregarlo al usuario.

---

## 5. Límites (qué NO incluye)

- **No** modifica código ni migraciones (solo el reporte en `docs/`).
- **No** cubre la limpieza de `lib/supabase/types.ts` / `as any` (sub-bloque de calidad aparte); el agente A1 puede señalar dónde un casting oculta un riesgo real de seguridad, pero no lo corrige.
- **No** hace pentesting dinámico/runtime ni auditoría de dependencias (`npm audit`) — es revisión estática de código + políticas.
- **No** toca el área de pagos live/Stripe (depende de credenciales, sub-bloque D).

---

## 6. Criterio de completitud

- Las 7 áreas recorridas, cada una con sus checklist cubiertos.
- Reporte escrito en `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md` con todos los hallazgos en formato estándar, tabla resumen y lista priorizada.
- Cero cambios de código en el diff (solo el `.md` del reporte).
