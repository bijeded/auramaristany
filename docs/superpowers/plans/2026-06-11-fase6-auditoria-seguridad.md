# Auditoría de Seguridad Fase 6 — Plan de Ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Producir un reporte de hallazgos de seguridad clasificados por severidad sobre el código de `main`, sin modificar código.

**Architecture:** Auditoría read-only. 4 subagentes paralelos auditan áreas agrupadas (A1 RLS+service-role, A2 middleware+edge-cases, A3 storage, A4 admin-handlers+input). Cada uno devuelve hallazgos en formato estándar como texto. Un paso de consolidación los unifica en el reporte final. El único archivo escrito es el reporte `.md`.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + RLS + Storage), TypeScript. Auditoría con Read/Grep/Glob/Bash de consulta.

---

## Notas de ejecución

- **Read-only:** ningún agente de auditoría escribe código ni migraciones. Los agentes A1–A4 **devuelven su salida como texto** (no escriben archivos); el orquestador la recolecta. Solo el paso de consolidación (Task 6) escribe el reporte `.md`.
- **Paralelismo:** A1–A4 (Tasks 2–5) son independientes y se pueden despachar en paralelo. Tasks 1 y 6–7 son secuenciales (antes/después).
- **Sin worktree** (es read-only; el único artefacto es el reporte en `docs/`).
- **Formato de hallazgo estándar** (todos los agentes lo usan):
  ```
  ### [IDarea-N] Título corto
  - **Área:** (1–7)
  - **Severidad:** Crítico | Medio | Bajo
  - **Ubicación:** file.ts:line
  - **Descripción:** qué es
  - **Impacto:** qué se expone/rompe
  - **Fix sugerido:** dirección (sin implementar)
  - **Confianza:** Alta | Media | Baja
  ```
  IDs por área: A1 RLS→`RLS-n`, service-role→`SVC-n`; A2 middleware→`MW-n`, edge→`EDGE-n`; A3 storage→`STG-n`; A4 admin→`ADM-n`, input→`INP-n`.
- **Severidad:** Crítico = exposición/escritura de datos entre clientes, bypass de auth/rol, service-role sin verificación previa. Medio = edge-case poco probable, falta de `with check`, validación débil sin impacto confirmado. Bajo = defensa en profundidad / higiene.
- Si un agente **no encuentra hallazgos** en una checklist, lo reporta explícitamente como "✓ sin hallazgos: <item>" para que la consolidación deje constancia de cobertura.

---

### Task 1: Esqueleto del reporte

**Files:**
- Create: `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`

- [ ] **Step 1: Crear el archivo del reporte con la estructura base**

```markdown
# Reporte de Auditoría de Seguridad — Fase 6

**Fecha:** 11 de junio de 2026
**Alcance:** Código de `main` (Fases 0–5 + Fase 6 sub-bloques 1/3/4a/4b, migraciones 001–008)
**Tipo:** Revisión estática read-only. Sin cambios de código.
**Spec:** docs/superpowers/specs/2026-06-11-fase6-auditoria-seguridad-design.md

> Estado: EN PROGRESO — se completa en la consolidación (Task 6).

## Tabla resumen
_(pendiente — Task 6)_

## Lista priorizada de fixes
_(pendiente — Task 6)_

## Hallazgos por área
_(pendiente — Task 6)_

## Cobertura
_(pendiente — Task 6)_
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md
git commit -m "docs: esqueleto del reporte de auditoría de seguridad (Fase 6 A)"
```

---

### Task 2: Agente A1 — RLS + Service-role

**Tipo:** subagente read-only. **Devuelve hallazgos como texto** (no escribe archivos).

**Archivos a leer:**
- `supabase/migrations/001_initial_schema.sql` (políticas RLS + `is_admin()`)
- `supabase/migrations/005_progress_photos.sql`, `006_messaging.sql`, `007_cascade_on_profile_delete.sql`, `008_handle_new_user_phone.sql`
- Los 10 usos de `createServiceClient`: `lib/supabase/service.ts`, `lib/admin/clients-queries.ts`, `lib/webhooks/stripe-handlers.ts`, `app/api/admin/clients/[clientId]/route.ts`, `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`, `app/api/admin/upload/route.ts`, `app/api/portal/photos/route.ts`, `app/api/portal/photos/[id]/route.ts`, `app/api/subscriptions/create-checkout/route.ts`, `app/api/cron/purge-messages/route.ts`

- [ ] **Step 1: Auditar RLS por tabla (invariante cliente-solo-lo-suyo / admin-vía-is_admin)**

Para cada una de las 18 tablas con RLS, verificar:
- ¿La política de SELECT restringe a `profile_id/id = auth.uid() or is_admin()`? (catálogo `*_public_read using(true)` es lectura intencional — confirmar que no expone datos de clientes).
- **Políticas `for all ... using(...)` SIN `with check(...)`**: revisar específicamente `progress_logs_own_or_admin`, `body_metrics_own_or_admin`, `onboarding_responses_own_or_admin`, `messages_admin_write`. Una `for all` sin `with check` no restringe INSERT/UPDATE → un cliente podría escribir filas con `profile_id` ajeno. Patrón correcto de referencia: `progress_photos_own_or_admin` (migr. 005) que SÍ define `with check`.
- `invoices_own_or_admin`: el subquery invoice→subscription→profile no debe permitir ver invoices ajenas.
- `is_admin()`: confirmar `security definer` + `search_path` fijado; no spoofeable.

- [ ] **Step 2: Auditar los 10 usos de service-role (bypass RLS)**

Para cada uso: ¿se verifica rol admin o propiedad del recurso **server-side ANTES** de usar el service client? ¿El recurso accedido (`profile_id`, path, id) se valida contra el usuario autenticado o se confía en un parámetro de la request?
- **Prioridad `lib/admin/clients-queries.ts`**: la memoria del proyecto afirma que las queries admin usan contexto admin (no service-role). Confirmar si es service-role real; si lo es, ¿está protegido por verificación de rol aguas arriba (página/layout admin) o es un hueco?
- `stripe-handlers.ts` / `cron/purge-messages`: sin sesión de usuario — confirmar que están protegidos por verificación de firma de webhook / `CRON_SECRET`.

- [ ] **Step 3: Emitir hallazgos**

Devolver todos los hallazgos en formato estándar (IDs `RLS-n` / `SVC-n`), más líneas `✓ sin hallazgos:` para cada item de checklist sin problemas. NO escribir archivos.

---

### Task 3: Agente A2 — Middleware/gates + Edge-cases del modelo semanal

**Tipo:** subagente read-only. Devuelve hallazgos como texto.

**Archivos a leer:**
- `middleware.ts`, `lib/middleware-utils.ts` (`getRedirectPath`)
- Lógica de cómputo de semana/día actual (buscar con grep: `getCurrentWeek`, `getCurrentDay`, `DEV_DATE`, cálculo de fecha de inicio de suscripción)
- Vistas del portal que dependen del estado de suscripción / semana

- [ ] **Step 1: Auditar middleware + gates**

- Orden de gates en `getRedirectPath`: secuencia esperada auth → onboarding → suscripción → rol. ¿Un orden incorrecto deja pasar a una vista protegida?
- `matcher` del middleware (excluye `_next` + imágenes): ¿alguna ruta sensible queda fuera del matcher?
- El middleware lee rol/suscripción con el anon client (sesión del usuario): confirmar que es correcto y que **no es la única barrera** (las server-actions/endpoints deben revalidar — cruzar con hallazgos de A4).
- ¿Se puede alcanzar `/admin/*` o `/portal/*` saltándose un gate?

- [ ] **Step 2: Auditar edge-cases del modelo semanal**

- Semana 5 (reportada resuelta): confirmar la corrección en el código.
- Cómputo de semana/día: límites (día 0, semana > duración del programa, fin de programa), zona horaria, dependencia de `DEV_DATE` (no debe afectar prod).
- Estados intermedios de suscripción (`past_due`, `canceled`, `incomplete`): qué ve el cliente; coherencia con el gate de suscripción.

- [ ] **Step 3: Emitir hallazgos**

Formato estándar (IDs `MW-n` / `EDGE-n`) + líneas `✓ sin hallazgos:`. NO escribir archivos.

---

### Task 4: Agente A3 — Storage / fotos de progreso

**Tipo:** subagente read-only. Devuelve hallazgos como texto.

**Archivos a leer:**
- `supabase/migrations/005_progress_photos.sql` (bucket `progress` + políticas storage)
- `app/api/portal/photos/route.ts`, `app/api/portal/photos/[id]/route.ts`
- `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`, `app/api/admin/upload/route.ts`
- Buscar dónde se generan signed/public URLs (grep `createSignedUrl`, `getPublicUrl`)

- [ ] **Step 1: Auditar políticas y rutas de Storage**

- Bucket `progress` privado (`public=false`): confirmar. Políticas `progress_owner_read/insert/delete` (`(storage.foldername(name))[1] = auth.uid()` o `is_admin()`).
- En las rutas de fotos: ¿el path del objeto se construye con el `auth.uid()` del **servidor** o con un parámetro de la request (riesgo de leer/borrar carpeta ajena)?
- Signed URLs: expiración razonable; rutas no adivinables. `getPublicUrl` solo en el bucket `content`.
- Bucket `content` (público): confirmar que no contiene datos sensibles de clientes.

- [ ] **Step 2: Emitir hallazgos**

Formato estándar (IDs `STG-n`) + líneas `✓ sin hallazgos:`. NO escribir archivos.

---

### Task 5: Agente A4 — Endpoints/Server-actions admin + Validación input/auth

**Tipo:** subagente read-only. Devuelve hallazgos como texto.

**Archivos a leer:**
- Server-actions: `lib/admin/dayActions.ts`, `lib/admin/messageActions.ts`, `lib/admin/onboardingActions.ts`, `lib/admin/pillarActions.ts`, `lib/portal/messageActions.ts`
- Rutas admin: `app/api/admin/clients/[clientId]/route.ts`, `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`, `app/api/admin/upload/route.ts`
- Auth/input: `app/auth/register`, flujo de onboarding, server-actions de mensajería; buscar manejo de errores (grep `catch`, `throw`, mensajes de error)

- [ ] **Step 1: Auditar verificación de rol server-side en handlers admin**

Para cada server-action `"use server"` y ruta `app/api/admin/*`: ¿valida que el caller es admin **dentro del handler** (no solo confía en el middleware)? Las actions del portal (`lib/portal/messageActions.ts`): ¿validan que el recurso pertenece al usuario autenticado?

- [ ] **Step 2: Auditar validación de input y fugas en errores**

- Registro, onboarding, mensajería: validación server-side de datos mal formados / payloads inesperados.
- Mensajes de error: ¿filtran existencia de cuentas, stack traces, detalles internos? (foco en auth).

- [ ] **Step 3: Emitir hallazgos**

Formato estándar (IDs `ADM-n` / `INP-n`) + líneas `✓ sin hallazgos:`. NO escribir archivos.

---

### Task 6: Consolidación del reporte

**Files:**
- Modify: `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`

- [ ] **Step 1: Volcar todos los hallazgos de A1–A4 en "Hallazgos por área"**

Pegar cada hallazgo en formato estándar bajo su área. Deduplicar hallazgos que distintos agentes hayan reportado (ej. middleware-no-es-única-barrera ↔ handler-sin-revalidar-rol → un solo hallazgo con referencias cruzadas). Reconciliar severidad si dos agentes discrepan (quedarse con la más alta y anotar el porqué).

- [ ] **Step 2: Construir la tabla resumen (severidad × área)**

```markdown
| Área | Crítico | Medio | Bajo | Total |
|---|---|---|---|---|
| 1 RLS | … | … | … | … |
| 2 Service-role | … | … | … | … |
| … | | | | |
| **Total** | | | | |
```

- [ ] **Step 3: Construir la lista priorizada de fixes**

Ordenar por severidad (Crítico → Bajo) y dentro de cada nivel por confianza. Cada entrada: `[ID] — título — esfuerzo estimado (S/M/L)`. Esta lista es la que el usuario usará para elegir qué entra al ciclo de corrección.

- [ ] **Step 4: Llenar la sección "Cobertura"**

Listar las checklists recorridas por área con las líneas `✓ sin hallazgos:` de cada agente, para dejar constancia de qué se revisó y salió limpio.

- [ ] **Step 5: Quitar el banner "EN PROGRESO" y marcar el reporte como COMPLETO**

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md
git commit -m "docs: reporte de auditoría de seguridad Fase 6 (hallazgos consolidados)"
```

---

### Task 7: Revisión final integral

- [ ] **Step 1: Verificar que el diff es solo el reporte (cero cambios de código)**

```bash
git diff main --stat
```
Esperado: únicamente `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md` (+ spec/plan).

- [ ] **Step 2: Revisar el reporte con ojos frescos**

Confirmar: las 7 áreas presentes en Cobertura; cada hallazgo tiene ubicación `file:line` real; la tabla resumen cuadra con el número de hallazgos; la lista priorizada es accionable. Corregir inconsistencias inline.

- [ ] **Step 3: Presentar el reporte al usuario**

Resumir conteo por severidad y los top hallazgos críticos; preguntar qué fixes entran al siguiente ciclo (spec→plan→worktree).

---

## Self-Review (writing-plans)

- **Cobertura del spec:** las 7 áreas del spec → Tasks 2–5 (A1: áreas 1+2; A2: 3+6; A3: 5; A4: 4+7). Reporte/tabla/lista priorizada → Task 6. Criterio de completitud (cero cambios de código) → Task 7 Step 1. ✓
- **Placeholders:** los `_(pendiente — Task 6)_` del esqueleto son intencionales (se llenan en Task 6), no placeholders de plan. Cada tarea de auditoría tiene checklist concreta con archivos y nombres de políticas reales. ✓
- **Consistencia:** formato de hallazgo y prefijos de ID (`RLS/SVC/MW/EDGE/STG/ADM/INP`) usados consistentemente entre Tasks 2–5 y la consolidación en Task 6. ✓
