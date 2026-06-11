# Spec — Fase 6 · Ciclo de corrección de seguridad (5 medios + bonus)

**Fecha:** 11 de junio de 2026
**Fase:** 6 (Launch) · Ciclo de corrección post-auditoría
**Origen:** Reporte `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`
**Alcance:** Corregir los 5 hallazgos de severidad **Media** (DEF-1, SUB-1, INP-3, INP-2, RLS-1) + bonus barato (RLS-2, HYG-1) que cae en la misma migración. Los 10 bajos restantes quedan fuera.

---

## Decisiones de diseño tomadas en brainstorm

1. **DEF-1 → Opción A (cobertura completa en capas).** Helper compartido aplicado en server-actions, queries con service-role y páginas admin. Defensa en profundidad: middleware + RLS + check explícito en cada superficie.
2. **SUB-1 → refactor + default sensato.** `active`, `trialing` y `past_due` conceden acceso; `past_due` muestra banner "pago pendiente". Sin temporizador de gracia propio: `past_due` concede acceso mientras Stripe lo mantenga (Stripe lo transiciona a `canceled`/`unpaid` al agotar reintentos).
3. **INP-2 → validación de input + sanitización HTML.** Cierra el vector XSS del HTML de Tiptap (autor admin, riesgo bajo, defensa en profundidad).
4. **Migración 009 unificada** con: `with check` de RLS-1, normalización de phone de INP-3, y bonus RLS-2 + HYG-1.

---

## Unidades

### Unidad 1 — DEF-1 · Verificación de rol admin uniforme

**Problema (del reporte):** páginas, queries (`getClientDetail` usa service-role para firmar URLs de fotos) y server-actions admin (`dayActions`/`pillarActions`/`onboardingActions`) confían solo en middleware + RLS, sin check de rol explícito server-side. Inconsistente y frágil ante regresiones del middleware.

**Solución:**
- **Crear `lib/admin/auth.ts`:**
  - `requireAdmin()` — mueve la implementación actual de `lib/admin/messageActions.ts:37-46`. Devuelve `{ ok: true, supabase, user } | { ok: false, error: string }`. Usa `createClient()` + `auth.getUser()` + lee `profiles.role`.
  - `requireAdminPage()` — para Server Components: si no es admin, `redirect('/portal/today')` (no devuelve error visible). Reutiliza la lógica de `requireAdmin()`.
- **`messageActions.ts`** importa `requireAdmin` desde el módulo (elimina la copia local).
- **Aplicar `requireAdmin()`** al inicio de cada action en `dayActions.ts` (saveDay, saveBlocks, deleteDay, cloneDay, cloneWeek), `pillarActions.ts` (savePillar, savePillarBlocks), `onboardingActions.ts` (saveQuestion, reorderQuestions, setQuestionActive). Si `!ok` → `return { error }`.
- **Aplicar `requireAdmin()`** en `lib/admin/clients-queries.ts` `getClientDetail`/`getClientsList`: si no es admin, lanzar (las páginas ya redirigen vía guard, así que un throw aquí es defensa de último recurso).
- **`requireAdminPage()`** al inicio de cada Server Component de página admin: `app/admin/dashboard/page.tsx`, `app/admin/clients/page.tsx`, `app/admin/clients/[clientId]/page.tsx`, `app/admin/payments/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/onboarding-settings/page.tsx`.

**Nota:** las rutas `app/api/admin/*` ya verifican rol inline — no se tocan.

### Unidad 2 — SUB-1 · Acceso por suscripción unificado

**Problema:** la definición "suscripción activa = `status='active'`" está duplicada en 3 sitios y excluye `past_due`/`trialing`, expulsando a clientes con suscripción real.

**Solución:**
- **Crear `lib/content/subscription-access.ts`:**
  - `const ACCESS_STATES = ['active', 'trialing', 'past_due'] as const;`
  - `subscriptionGrantsAccess(status: string): boolean` → `ACCESS_STATES.includes(status)`.
- **Reemplazar** los `.eq("status","active")` por `.in("status", ACCESS_STATES)` en:
  - `middleware.ts:51-56`
  - `lib/content/queries.ts:112-113` (`getTodayContent`)
  - `lib/content/history.ts:127-128` (`getPerformanceData`)
- **Banner "Pago pendiente":** componente server `components/portal/PaymentPendingBanner.tsx`; `app/portal/layout.tsx` consulta si la sub del usuario está en `past_due` y, de ser así, renderiza el banner (link a contacto/portal de pago). El banner NO bloquea el acceso.

**Detalle:** la página `/portal/sin-suscripcion` sigue para `canceled`/`unpaid`/sin-sub. El gate del middleware ahora deja pasar `past_due`/`trialing` a `/portal/today`.

### Unidad 3 — INP-3 · Registro

**Problema:** `RegisterForm.tsx:58-61` muestra `error.message` crudo (enumeración de cuentas); validación de phone solo client-side.

**Solución:**
- **`components/auth/RegisterForm.tsx`:** en el catch del signUp, mostrar un mensaje **genérico** ("No se pudo completar el registro. Verifica tus datos o intenta más tarde.") en lugar de `error.message`. Conservar los mensajes de validación client-side propios (password corta, phone inválido) que NO revelan existencia de cuentas.
- **Normalización de phone server-side:** en el trigger `handle_new_user` (migración 009), normalizar `raw_user_meta_data->>'phone'` a solo dígitos (`regexp_replace(..., '[^0-9]', '', 'g')`) y guardar `null` si no cumple 11–15 dígitos. Defensa contra un `signUp` directo que salte la validación client-side.

### Unidad 4 — INP-2 · Validación de input + sanitización HTML

**Problema:** actions de contenido sin validación server-side; HTML de Tiptap renderizado con `dangerouslySetInnerHTML` ([TextBlock.tsx:10](components/portal/blocks/TextBlock.tsx#L10)).

**Solución:**
- **Validación (helpers puros, TDD) en `lib/admin/content-validation.ts`:**
  - `validateDayInput(input)` — `title` no vacío y ≤ 200 chars; `weekNumber` entero 1–4; `dayType` en enum permitido; `durationMinutes` entero 0–600; `workoutFocus` ≤ 120 chars.
  - `validateBlock(block)` — `block_type` en enum permitido; `content` con forma mínima según tipo; HTML de texto ≤ 50000 chars; otros strings ≤ 2000 chars.
  - Aplicar al inicio de `saveDay`/`saveBlocks` (dayActions) y `savePillar`/`savePillarBlocks` (pillarActions); si inválido → `return { error }`.
- **Sanitización HTML (TDD) en `lib/admin/sanitize-html.ts`:**
  - `sanitizeRichText(html: string): string` — whitelist de tags/atributos que produce Tiptap (p/strong/em/u/s/h1-3/ul/ol/li/a[href]/br), elimina `<script>`, handlers `on*`, `javascript:` URLs. Usar una librería establecida (p.ej. `sanitize-html` o `dompurify` server-side via `isomorphic-dompurify`).
  - Aplicar en `saveBlocks` al guardar bloques de tipo texto: `content.html = sanitizeRichText(content.html)` antes del insert. El origen se limpia una vez; `TextBlock` no cambia.

### Unidad 5 — RLS-1 + bonus (RLS-2, HYG-1) · Migración 009

**Archivo:** `supabase/migrations/009_security_hardening.sql`.

Contenido (todo idempotente, `drop policy if exists` + `create`):
1. **RLS-1:** `with check (profile_id = auth.uid() or is_admin())` en `progress_logs_own_or_admin`, `body_metrics_own_or_admin`, `onboarding_responses_own_or_admin` (recrear con el `using` actual + el nuevo `with check`).
2. **RLS-2 (bonus):** `with check (is_admin())` en `messages_admin_write`.
3. **HYG-1 (bonus):** recrear `is_admin()` con `set search_path = public` (preservar `security definer stable` y el cuerpo actual).
4. **INP-3 phone (Unidad 3):** recrear `handle_new_user()` con la normalización de phone, **preservando** `security definer` + `set search_path = public` + la copia de `full_name`.

**Aplicación:** vía Management API `POST .../database/query` en **UNA SOLA LÍNEA** (el pipeline come saltos de línea). Verificar después con: `pg_get_functiondef` de `is_admin` y `handle_new_user`, y `pg_policy.with_check` de las 4 políticas.

---

## Manejo de errores

- Server-actions: `requireAdmin()` falla → `{ error: "No autorizado" }`. No se filtran internals (alinea con INP-1, aunque INP-1 no está en este ciclo).
- Páginas admin: `requireAdminPage()` → `redirect`, sin error visible.
- Validación INP-2 inválida → `{ error: "<mensaje legible no técnico>" }`.
- Registro: mensaje genérico (no `error.message`).

## Testing

**TDD (helpers puros):**
- `subscriptionGrantsAccess` — `active`/`trialing`/`past_due` → true; `canceled`/`unpaid`/`incomplete`/desconocido → false.
- `validateDayInput`/`validateBlock` — casos válidos + cada rama de rechazo.
- `sanitizeRichText` — elimina `<script>`, `onerror=`, `javascript:`; preserva tags de formato legítimos.
- (Phone ya tiene `lib/auth/phone.ts` con tests; la normalización del trigger se verifica post-migración, no en vitest.)

**Ramas de auth:**
- `requireAdmin()`/`requireAdminPage()` — admin pasa; no-admin/anónimo rechaza/redirige.

**Migración 009:** verificación post-aplicación con consultas de control (no test unitario).

**Gate:** suite completa (159 actuales + nuevos) + `tsc` limpio + build verde. Smoke manual del usuario antes del merge.

## Fuera de alcance

- Bajos restantes: INP-1, EDGE-3, EDGE-5, MW-3, SVC-2, STG-2, INP-4, INP-5.
- Stripe live, Resend, deploy a Vercel.
- Limpieza de `types.ts`/`as any` (sub-bloque de calidad aparte).

## Criterio de completitud

- Las 5 unidades implementadas; migración 009 aplicada y verificada.
- Suite verde, tsc limpio, build OK.
- Smoke: (a) no-admin no alcanza vistas/actions admin; (b) cliente `past_due` ve `/portal/today` con banner; (c) registro con email existente muestra mensaje genérico; (d) bloque de texto con `<script>` se guarda sanitizado.
