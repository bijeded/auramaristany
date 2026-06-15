# Spec — Fase 6 · Sub-bloque C+D: Pulido de auditoría & Limpieza de tipos

**Fecha:** 15 de junio de 2026
**Estado:** Diseño aprobado — pendiente de plan de implementación
**Fase:** 6 (en curso). Mergeados previos: 1, 3, 4a, 4b, A, B2, A1/G4, B1. Migraciones 001–010 aplicadas.
**Baseline gates en `main`:** 216 tests verdes · `tsc` limpio · `next build` verde · working tree limpio (solo `.claude/`).

## Fuentes
- Reporte de auditoría: `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md` (origen de los 8 bajos).
- Contexto de arranque: `docs/superpowers/context/2026-06-14-fase6-cd-continuar.md`.

---

## Objetivo

Cerrar los 8 hallazgos **bajos** de la auditoría (defensa en profundidad, robustez, higiene) y saldar la deuda de tipos (85 `as any`/`as unknown as`), sin cambiar funcionalidad visible salvo los dos fixes de flujo (INP-4 onboarding, EDGE-5 progreso) que mejoran la validación server-side.

**No incluye:** ningún hallazgo crítico/medio (ya cerrados en sub-bloque A), ni migraciones nuevas (ningún fix las requiere).

---

## Estructura: un sub-bloque, dos fases internas

Un solo worktree, un solo merge `--no-ff` a `main` tras smoke manual del usuario. Dos fases secuenciales; cada una cierra con gate verde antes de la siguiente.

- **Fase C** — comportamiento/seguridad: cambia lógica, lleva tests nuevos.
- **Fase D** — refactor de tipos: **no debe cambiar comportamiento**; los tests de C deben seguir verdes sin tocarlos.

El orden C→D es deliberado: C estabiliza comportamiento con tests; D solo debe mantenerlos verdes (cero cambios de runtime). El smoke final separa "¿cambió algo?" (C) de "¿compila y pasa?" (D).

---

## Fase C — 8 fixes

Decisiones por defecto confirmadas: **STG-2 = 600s (10 min)**; **INP-5 = subject ≤ 200, body ≤ 5000 chars**.

### INP-1 — Errores crudos de Postgres/Supabase al cliente
- **Patrón a replicar:** `GENERIC_ERROR` + `console.error(...)` de `lib/portal/settingsActions.ts` y `app/api/portal/avatar/route.ts`.
- **Ubicaciones** (de la auditoría): `lib/admin/dayActions.ts:35,42,57,67,124`; `lib/admin/pillarActions.ts:18,27,32`; `lib/admin/onboardingActions.ts:29,48,62,73`; `lib/admin/messageActions.ts:72,77,131,135`; `app/api/admin/upload/route.ts:34`; `app/api/admin/clients/[clientId]/route.ts:48`.
- **Comportamiento:** loggear el error completo server-side; devolver mensaje genérico al cliente. No filtrar `error.message` de Postgres.
- **Test:** unit — el action devuelve el mensaje genérico, no el de Postgres (mock de error de DB).

### EDGE-5 — `/api/portal/progress` confía en `subscriptionId` del body
- **Ubicación:** `app/api/portal/progress/route.ts:16-36`, `lib/content/queries.ts:209-217`.
- **Comportamiento:** derivar el `subscriptionId` en el servidor desde la suscripción que concede acceso del `getUser()`; ignorar cualquier `subscriptionId` del body.
- **Test:** unit — body con `subscriptionId` ajeno → se persiste el del server. Si no hay sub activa → error controlado.

### EDGE-3 — `getDay()` local vs cómputo de semana en UTC
- **Ubicación:** `lib/content/access.ts:42` (`toDayOfWeek`).
- **Comportamiento:** usar `getUTCDay()` para que día-de-semana y semana usen el mismo reloj (UTC).
- **Test:** unit — fecha cerca de medianoche en runtime no-UTC no produce off-by-one en `day_of_week`.

### MW-3 — matcher cubre `/api/*` incluidos webhook/cron
- **Ubicación:** `middleware.ts:90-94`.
- **Comportamiento:** excluir `api/webhooks` y `api/cron` del matcher para que no paguen `getUser()` + query a `profiles` ni corran riesgo de redirect en endpoints máquina-a-máquina.
- **Test:** unit del patrón de matcher si es testeable; si no, verificación manual de que webhook/cron siguen respondiendo sin pasar por el middleware.

### SVC-2 — `create-checkout` usa service-role de más
- **Ubicación:** `app/api/subscriptions/create-checkout/route.ts:35-87`.
- **Comportamiento:** usar `createClient()` RLS-aware donde sea posible (lectura de catálogo `public_read`, escritura del propio perfil); reservar service-role solo para lo que lo necesite (si algo). Verifica sesión antes igual que hoy.
- **Test:** los tests existentes de create-checkout siguen verdes (sin regresión de flujo).

### STG-2 — signed URLs de fotos con expiración de 1h
- **Ubicación:** `lib/admin/clients-queries.ts:178`, `app/portal/history/page.tsx:38`.
- **Comportamiento:** bajar `createSignedUrl(..., 3600)` a `600` (10 min).
- **Test:** ajustar aserción si algún test fija 3600.

### INP-4 — Onboarding guardado client-side, validación solo cliente
- **Ubicación actual:** `app/onboarding/questionnaire/QuestionnaireForm.tsx:57-74` (upsert a `onboarding_responses` + update `profiles.onboarding_completed` desde el navegador).
- **Comportamiento:** nueva server action (p.ej. `lib/onboarding/responsesActions.ts` o ubicación análoga a la de B2) que:
  - obtiene identidad con `getUser()`; ignora cualquier `profileId` que venga del cliente;
  - revalida las requeridas y la forma de `responses` contra las `onboarding_questions` **activas**;
  - hace el upsert y marca `onboarding_completed` solo si pasa la validación.
  - El form deja de escribir a Supabase directo y llama la action.
- **Test:** unit — requeridas faltantes → rechaza; `profileId` ajeno → ignorado (se usa el de `getUser()`); forma válida → upsert correcto.

### INP-5 — `sendMessage` sin tope de longitud
- **Ubicación:** `lib/admin/messageActions.ts:56-58`.
- **Comportamiento:** validar `subject ≤ 200` y `body ≤ 5000` chars (además del no-vacío ya existente).
- **Test:** unit — subject/body que exceden → error de validación; dentro de límite → pasa.

**Ninguno de los 8 requiere migración nueva.**

---

## Fase D — completar tipos a mano + quitar casts

Estrategia elegida: **completar `lib/supabase/types.ts` a mano** (es bespoke, no autogenerado; no hay typegen). NO regenerar con typegen ni reformatear.

1. **Auditar** `types.ts` contra migraciones 001–010: identificar tablas/columnas faltantes o desfasadas (candidatos: lo añadido en 005–010 — `progress_photos`, `phone` en `profiles`, bucket/avatar, etc.).
2. **Completar** el archivo en su formato actual (preservar las uniones propias del encabezado: `UserRole`, `SubscriptionStatus`, `BillingModel`, `Json`). Sin cambiar el estilo a typegen.
3. **Quitar los 85 `as any`/`as unknown as` archivo por archivo**, de mayor a menor concentración. Tras cada archivo: `tsc` limpio + suite verde antes de pasar al siguiente. Orden por densidad:
   - `lib/admin/queries.ts` (12), `lib/admin/clients-queries.ts` (9), `lib/content/history.ts` (7), `lib/content/queries.ts` (6), `lib/admin/messageActions.ts` (6), `lib/admin/dayActions.ts` (6), `lib/content/pillars.ts` (5), `lib/admin/finance-queries.ts` (4), luego los de 3/2/1 (account-queries, onboardingActions, rutas de clients/photos, messages, pillarActions, create-checkout, photos, stripe-handlers, settingsActions, portal/messageActions, history page, activando page, QuestionnaireForm, photos route, avatar route, upload route, onboarding-settings page).
4. **Ítems D arrastrados** (en esta misma fase):
   - `try/catch` alrededor de `stripe.subscriptions.retrieve` en `lib/webhooks/stripe-handlers.ts`.
   - Helper compartido `formatDate`: unificar copias duplicadas (TodayView, pilares, `SubscriptionCard`, `PaymentHistory`) en un módulo común.
   - **Tests de `cloneDay`/`cloneWeek`** (cobertura faltante).

### Fuera de scope (registrado para más adelante)
- **Hacer transaccionales `saveBlocks`/`savePillarBlocks`** (hoy loops de delete+insert): cambio de robustez mayor, con riesgo propio → merece su propio sub-bloque. **Acordado dejarlo fuera de C+D.**

---

## Testing y gates

- Baseline **216 tests**. Fase C agrega unit tests por fix; Fase D no agrega comportamiento pero sí los tests de `cloneDay`/`cloneWeek`.
- Gate por fase: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'` verde · `tsc` limpio · `next build` verde.
- **Smoke manual del usuario** al final (antes del merge), enfocado en los flujos que C cambia: onboarding (INP-4) y registro de progreso (EDGE-5). El resto es defensa en profundidad / refactor sin cambio visible.

## Merge
`--no-ff` a `main` local tras smoke. Luego actualizar `SPEC.md` (changelog), `handoff.md` y la memoria `project_aura.md`. Marcar en el reporte de auditoría los 8 bajos como resueltos.

---

Ver memorias [[project_aura]], [[feedback_project_approach]], [[feedback_subagent_driven]], [[feedback_language_mexican]].
