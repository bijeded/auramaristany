# Contexto — Fase 6: continuar (C pulido de auditoría + D limpieza) — arranque en chat nuevo

**Fecha de preparación:** 14 de junio de 2026
**Estado:** Fases 0–5 mergeadas. **Fase 6 EN CURSO.** Mergeados a `main`: sub-bloques 1, 3, 4a, 4b, **A** (auditoría + corrección), **B2** (`/portal/settings` completo), más los fixes **A1/G4** y **B1**. **Migraciones 001–010 aplicadas.** Gates en `main`: **216 tests**, `tsc` limpio, build verde, working tree limpio (solo `.claude/` sin trackear).
**Cómo arrancar:** lee este bloque + la memoria del proyecto (`project_aura.md`, secciones "Estado actual" y "Pendiente Fase 6") + `SPEC.md` (changelog 1.9 + §Variables de Entorno) + `handoff.md` (encabezado + secciones 8/10/11). El **reporte de auditoría** (fuente de los 8 bajos de C) vive en `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`.

---

## Preferencias FIJAS del usuario (respetar siempre)

1. **Idioma: español de México** (tú, no vos). NUNCA registro argentino. (memoria `feedback_language_mexican`)
2. **Flujo por sub-bloque:** brainstorm (superpowers:brainstorming) → spec en `docs/superpowers/specs/` → plan (writing-plans) en `docs/superpowers/plans/` → **ejecución subagent-driven en worktree**. No preguntar la opción de ejecución (es fija). (memorias `feedback_project_approach`, `feedback_subagent_driven`)
3. **Discutir antes de implementar**, separar data de presentación, respetar scope.
4. **Bugs → systematic-debugging** (no brainstorming): causa raíz con evidencia antes de tocar nada.
5. **Merge:** `--no-ff` a `main` local tras **smoke manual del usuario**. Luego actualizar SPEC.md + handoff.md + memoria.

---

## Lo recién hecho (B2, merge `4271c85`) — referencia rápida

`/portal/settings` pasó de solo-lectura a la pantalla "Mi cuenta": edición de nombre/teléfono + contraseña (server actions `lib/portal/settingsActions.ts`, identidad de `getUser()`, contraseña actual re-verificada con cliente *stateless* sin tocar la sesión), foto de perfil (route `app/api/portal/avatar/route.ts` → bucket público `avatars`, comprimida a ≤800px vía `lib/portal/photo-compress`), ficha de suscripción con barra "Mes X de Y" (`SubscriptionCard`), historial de pagos paginado 10/página (`PaymentHistory`). Lectura vía RLS de dueño. **Migración 010** (bucket público `avatars` + policy `avatars_public_read`) aplicada y verificada.

---

## Lo que SIGUE — bloques C y D (orden acordado)

> Sugerencia: C y D son pulido/refactor de bajo riesgo. Conviene tratarlos como **un solo sub-bloque** (un spec/plan) o, si prefieres, dos planes cortos. Brainstorm primero para acordar alcance y orden interno. Algunos son **bugs** (EDGE-3, EDGE-5) → para esos, `systematic-debugging` (causa raíz con evidencia), no brainstorming.

### C — 8 hallazgos BAJOS de la auditoría (pulido, no bloquean)
Del reporte `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`:
- **INP-1** — errores crudos de Postgres/Supabase devueltos al cliente → loggear server-side + mensaje genérico. (Transversal; B2 ya lo aplicó en `settingsActions`/avatar — replicar el patrón en los endpoints/queries que aún devuelven `error.message`.)
- **EDGE-5** — `/api/portal/progress` confía en `subscriptionId` del body → derivarlo del server (de la sub activa del `getUser()`).
- **EDGE-3** — `toDayOfWeek` usa `getDay()` (hora local) mientras el cómputo de semana es UTC → usar `getUTCDay()` para consistencia. (Bug sutil de zona horaria.)
- **MW-3** — el `matcher` del middleware cubre `/api/*` → excluir `api/webhooks` y `api/cron` (pagan `getUser()` + query innecesaria; riesgo de redirect en endpoints máquina-a-máquina).
- **SVC-2** — `create-checkout` usa service-role de más → acotar a lo mínimo.
- **STG-2** — signed URLs de fotos a 1h → bajar a 5–10 min (`lib/admin/clients-queries.ts` y `app/portal/history/page.tsx` usan `createSignedUrl(..., 3600)`).
- **INP-4** — onboarding se guarda client-side, validación solo cliente → mover a server action que revalide requeridas/forma contra `onboarding_questions` activas e ignore cualquier `profileId` del cliente (`getUser()`). (B2 ya siguió este patrón en settings.)
- **INP-5** — `sendMessage` sin tope de longitud → validar largo máximo de subject/body.

### D — Limpieza de código arrastrada (no bloquea)
- **Regenerar `lib/supabase/types.ts`** y quitar los `as any`/`as unknown as` (transversal; incluye clients-queries, finance-queries, stripe-handlers, dayActions, account-queries, settingsActions, avatar route, etc.). **La de más valor** y la que toca más archivos.
- `try/catch` en `stripe.subscriptions.retrieve` (`lib/webhooks/stripe-handlers.ts`).
- Unificar `formatDate` duplicado (hoy hay copias en TodayView, pilares, y los nuevos `SubscriptionCard`/`PaymentHistory` de B2 → buen momento para un helper compartido).
- `saveBlocks`/`savePillarBlocks` no transaccionales (loops de delete+insert).
- Tests de `cloneDay`/`cloneWeek`.

### En paralelo — DECISIONES de Aura (desbloquean el bloque ops)
- **P1** — precios reales en MXN por variante (hoy $999 simulado en test). Bloquea A4 (Stripe live).
- **P5** — dominio `app.auramaristany.com`: ¿comprado/configurado? Bloquea A2 (Resend) y A3 (Vercel).
- **Config Stripe Smart Retries** — cuánto mantiene acceso un `past_due` antes del corte.
- **Alcance del launch** — ¿soft-launch con datos reales o pruebas finales primero?

### Bloque OPS — A2/A3/A4 (cuando haya credenciales/decisiones)
- **A2 — Resend:** `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + **verificar dominio**. Activa emails de mensajería/ciclo de vida **y el SMTP de confirmación de correo**. `lib/email/` es no-op sin key.
- **A3 — Deploy a Vercel:** todas las env vars de prod (ver `SPEC.md` §Variables de Entorno): **`CRON_SECRET`** (activa el Vercel Cron de retención 180d), **`STRIPE_WEBHOOK_SECRET`** de prod, `NEXT_PUBLIC_APP_URL`, **remover `DEV_DATE`**.
- **A4 — Stripe live + precios reales:** crear los 10 Prices en live, actualizar `stripe_price_id`/`price_mxn` en `program_variants` vía SQL, cambiar keys a live. Depende de P1.

---

## Gotchas técnicos verificados

- **Aplicar migraciones SQL** (no hay Supabase CLI): vía **Management API** `POST https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query` con `Authorization: Bearer <access-token>` (el usuario lo provee; puede estar rotado → pedir uno nuevo). ⚠ **Enviar cada statement en UNA SOLA LÍNEA** (el pipeline come saltos de línea → comentarios `--` autocomentan todo → `[]` silencioso). Verificar SIEMPRE con consulta de control. (C/D probablemente NO necesiten migración nueva.)
- **Worktree:** el repo NO tiene remoto → `git config worktree.baseRef head` antes de `EnterWorktree`. El `node_modules` del worktree nace **vacío** → symlinkear al del repo principal (`rm -rf node_modules && ln -s <repo>/node_modules node_modules`). Copiar `.env.local` o el build falla con `STRIPE_SECRET_KEY is not set`. Para mergear: `ExitWorktree(keep)` → `git merge --no-ff <rama>` en main → `git worktree remove --force` + `git branch -d`.
- **Tests:** `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'` (evita escanear worktrees anidados). Baseline actual **216**.
- **Next 14:** `searchParams`/`params` de páginas son **objetos planos** (NO Promises; no se hace `await`). Server client `createClient()` SÍ es async (custom).
- **Stripe webhooks (para smoke de pagos):** `npm run dev` + `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Diagnóstico: API de Stripe con la `STRIPE_SECRET_KEY` del `.env.local`.

---

## Esquema/archivos clave (para C/D)

- **Progreso/portal:** `app/api/portal/progress/route.ts` (EDGE-5), `lib/content/access.ts` / `queries.ts` (`toDayOfWeek`/`getCurrentDayKey`, EDGE-3).
- **Middleware:** `middleware.ts` + `lib/middleware-utils.ts` (MW-3, matcher).
- **Checkout:** `app/api/subscriptions/create-checkout/route.ts` (SVC-2).
- **Storage/signed URLs:** `lib/admin/clients-queries.ts`, `app/portal/history/page.tsx` (STG-2).
- **Onboarding:** `app/onboarding/questionnaire/*` + (a crear) server action (INP-4).
- **Mensajería:** `lib/admin/messageActions.ts` (`sendMessage`, INP-5).
- **Errores genéricos (patrón a replicar):** `lib/portal/settingsActions.ts` (`GENERIC_ERROR` + `console.error`) y `app/api/portal/avatar/route.ts`.
- **Tipos:** `lib/supabase/types.ts` (regenerar, D) — buscar `as any`/`as unknown as` con grep.

Ver memorias [[project_aura]], [[feedback_project_approach]], [[feedback_subagent_driven]], [[feedback_language_mexican]].
