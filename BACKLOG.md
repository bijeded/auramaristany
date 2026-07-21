# Backlog — Aura Maristany

Lista viva de trabajo pendiente. **Cada item tiene un ID estable** para lanzarlo directo al loop de OpenSpec.

```
/opsx:propose "A2 — descanso en minutos"     # cuando el alcance ya está claro
/opsx:explore "A6 — sistema de reservas"     # cuando falta definir
```

**Al cerrar un item:** `/opsx:archive` → marcar aquí como `✅ Hecho` → re-indexar codebase-memory en modo `fast`.

**Fuentes:** feedback de Aura (2026-07-18) + pendientes de `handoff.md`/`SPEC.md`.
**Tamaño:** `S` ≈ horas · `M` ≈ ~1 día · `L` ≈ varios días.

---

## Índice

| ID | Item | Tam. | Estado |
|----|------|:----:|--------|
| **A2** | Descanso en minutos | S | Pendiente |
| **A3** | Checkbox de ejercicio más visible | S | Falta decisión visual |
| **A10** | Barras en "Ingresos por programa" | S | Pendiente |
| **A11** | 5ª stat card: vencen en 7 días | S | Pendiente |
| **A1** | Selector kg / lb | M | Pendiente |
| **A5** | Filtro "Sin actividad" en Clientes | M | Pendiente |
| **A8** | Color y fondo en el editor de texto | M | Falta decidir paleta |
| **A9** | Cancelación + encuesta de salida | M | Pendiente |
| **A12** | Calendario de 7 días en el portal | M | Pendiente |
| **A6** | Sistema de reservas (WordPress) | L | Pendiente |
| **A7** | Bloque "Agendar" en el editor | M | Bloqueado por A6 |
| **A4** | Mensajes automáticos | L | Hacer después de A5 |
| **L1** | Stripe LIVE + precios reales | M | Bloqueado (precios de Aura) |
| **L2** | Extra → cobro mensual recurrente | L | Pendiente |
| **L3** | Set de preguntas de onboarding | S | Bloqueado (Aura las define) |
| **L4** | Smoke E2E con Aura | S | Pendiente |
| **L5** | WhatsApp real | S | Bloqueado (número de Aura) |
| **L6** | Limpieza de datos demo | S | Pendiente |
| **L7** | Correcciones menores del demo | S | Falta detallar |
| **L8** | production-checklist | M | Al final |
| **L9** | ¿UI de admin para planes/precios? | L | Falta decidir |
| **L10** | Env vars de Preview en Vercel | S | Pendiente |
| **D1–D7** | Diferidos / deuda técnica | — | Ver abajo |

---

## A · Solicitudes de Aura

### A2 · Descanso en minutos — `S`
Mostrar `1 min` / `1:30 min` en vez de `60 seg`. **Solo la etiqueta**; `rest_seconds` no cambia.
- **Toca:** helper puro nuevo (+ tests, patrón AAA) · tarjeta de ejercicio en `/portal/today` · `components/portal/blocks/ExerciseListLogged.tsx` (historial read-only) · revisar preview del editor admin.
- **Ojo:** puramente presentacional — no migrar datos ni tocar el JSON de `exercise_list`.

### A3 · Checkbox de ejercicio más visible — `S`
Hacer más notorio el control de "ejercicio hecho" en `/portal/today`.
- **Toca:** tarjeta de ejercicio del portal (patrón `CheckRound` del prototipo: borde `rosa-deep` → relleno lavanda + check).
- **Falta decidir:** tamaño / contraste / si toda la tarjeta se vuelve táctil. Presentar 2–3 opciones antes de implementar.
- **Ojo:** respetar áreas táctiles ≥44px y los tokens de marca.

### A10 · Barras en "Ingresos por programa" — `S`
Cambiar la dona por barras en el dashboard.
- **Toca:** `components/admin/ProgramRevenueDonut.tsx` → barras (reusar patrón de `components/admin/RevenueBarChart.tsx`).
- **Ojo:** los datos no cambian (`groupRevenueByProgram` en `lib/admin/finance-helpers.ts`). Aplica el skill `dataviz`.

### A11 · 5ª stat card: vencen en 7 días — `S`
KPI con suscripciones que expiran en ≤7 días.
- **Decidido:** se **agrega** una quinta card; NO reemplaza "Renuevan este mes" (≤30d).
- **Toca:** `lib/admin/finance-helpers.ts` (generalizar `computeRenewalsThisMonth` a N días, puro + TDD) · `app/admin/dashboard/page.tsx`.
- **Ojo:** revisar el layout responsivo del KPI row al pasar de 4 a 5 cards.

### A1 · Selector kg / lb — `M`
La clienta elige unidad de peso; el histórico debe quedar consistente.
- **Decidido (recomendación):** guardar **siempre canónico en kg**; convertir solo al capturar/mostrar. Nunca guardar unidades mezcladas.
- **Toca:** captura de ejercicios + `hooks/useProgressForm.ts` · `ExerciseListLogged` · `lib/content/history-helpers.ts` (`aggregateDayValue`/`buildPerformanceSeries` promedian peso) · `components/portal/PerformanceChart.tsx` (etiqueta de eje) · preferencia del usuario en `/portal/settings` (`lib/portal/settingsActions.ts`, `account-queries.ts`).
- **Ojo:** la clave del JSON es literalmente `weight_kg` y `metrics: ["reps_done","weight_kg"]` — decidir si se conserva el nombre (recomendado) y solo se convierte en la vista. Probable **migración 011** para la preferencia en `profiles`.

### A5 · Filtro "Sin actividad" en Clientes — `M`
Pill nueva junto a Activas/Vencidas/Canceladas: sin `progress_logs` en 10 días.
- **Toca:** `lib/admin/clients-queries.ts` (`getClientsList` → agregar última actividad, máx `progress_logs.log_date`) · `lib/admin/clients-helpers.ts` (`filterClients`, `STATE_FILTERS`, puros + TDD) · `components/admin/ClientsTable.tsx`.
- **Ojo:** 🔗 **la señal "última actividad" la reusa A4.** Construirla aquí y dejarla reutilizable.

### A8 · Color y fondo en el editor de texto — `M`
Color de letra y de fondo en el bloque de Texto (Tiptap).
- **Toca:** deps MIT `@tiptap/extension-text-style` + `@tiptap/extension-color` + `@tiptap/extension-highlight` · editor del bloque de texto en `components/admin/blocks/`.
- **⚠ Gotcha:** `lib/admin/sanitize-html.ts` **borra los estilos** si no se amplía el whitelist (`allowedStyles` con `color` / `background-color`). Sin esto el color se pierde al guardar y parece "bug".
- **Falta decidir:** paleta acotada a tokens de marca (recomendado) vs. selector libre.

### A9 · Cancelación + encuesta de salida — `M`
Cancelar desde la cuenta + preguntar motivo (radios).
- **Decidido:** **fin del periodo ya pagado, sin reembolsos.** Verificado en `scripts/seed-stripe.ts`: los 10 precios son `recurring: { interval: "month" }` → todo es cobro mensual (CuarentaMás = 6 ciclos mensuales, **no** un pago en parcialidades) → **no existe caso de reembolso**.
- **Toca:** `components/portal/settings/SubscriptionCard.tsx` + `lib/portal/settingsActions.ts` · `lib/webhooks/stripe-handlers.ts` (`customer.subscription.updated`) · almacenamiento del motivo (tabla nueva o JSONB → **migración**).
- **Ojo:** `subscriptions.cancel_at_period_end` **ya existe** y el webhook ya lo maneja; hoy se cancela vía Customer Portal de Stripe.

### A12 · Calendario de 7 días en el portal — `M`
Pestaña nueva: títulos de las actividades de los próximos 7 días, **sin poder entrar**.
- **Decidido:** ventana de 7 días **cortada al periodo actual**. Si cruza al mes siguiente, **no** mostrar esas actividades (aún no están pagadas).
- **Toca:** `components/portal/PortalNav.tsx` (4 → 5 tabs; revisar layout móvil) · ruta nueva en `app/portal/` · lectura de títulos apoyada en `lib/content/access.ts` / `lib/content/queries.ts`.
- **⚠ Ojo:** roza la regla "sin acceso a días futuros". Se respeta porque son **solo títulos** y no hay navegación a la actividad. No filtrar contenido no publicado. Definir si la ventana incluye hoy.

### A6 · Sistema de reservas (WordPress) — `L`
Llamadas quincenales por Zoom/Meet.
- **Decidido:** vive en **WordPress con TheBooking**; la app manda un **enlace firmado** que prueba suscripción activa. Las reglas (1 llamada / 15 días, ≥1 día de anticipación) las controla WordPress.
- **Toca:** endpoint que genere el enlace firmado (HMAC + secreto compartido, **env var nueva**) · gate con `subscriptionGrantsAccess` (`lib/content/subscription-access.ts`) · configuración del lado WP (fuera del repo).
- **Ojo:** el enlace debe caducar y no ser reutilizable por terceros. La identidad sale de `getUser()` en el servidor, nunca del cliente.

### A7 · Bloque "Agendar" en el editor — `M` · bloqueado por A6
Nuevo tipo de bloque que lleva al sistema de reservas.
- **Toca:** nuevo `block_type` en `program_day_blocks` · paleta y editor en `components/admin/blocks/` · zod en `lib/admin/content-validation.ts` · render en `components/portal/blocks/BlockView.tsx`.
- **Ojo:** si WP impone las reglas, el bloque es prácticamente un CTA con enlace firmado (`S`); si se movieran a la app, crece.

### A4 · Mensajes automáticos — `L` · después de A5
Disparos automáticos: día 12 → recordar agendar videollamada; 10 días sin progreso → "¿todo bien?".
- **Decidido:** el **recordatorio de cobro NO** se implementa — lo envía Stripe (decisión de Fase 4).
- **Toca:** cron(s) nuevos en `app/api/cron/` siguiendo el patrón de `purge-messages/route.ts` (Bearer `CRON_SECRET`) + `crons` en `vercel.json` · envío vía `lib/admin/messageActions.ts` / `message_recipients` + `lib/email/send.ts`.
- **Ojo:** necesita **dedupe** (no reenviar el mismo aviso) → marca persistente por clienta+regla. Reusa la señal de última actividad de **A5**. El aviso de videollamada depende de **A6**.

---

## L · Antes de abrir a clientes reales

### L1 · Stripe LIVE + precios reales — `M` · bloqueado
Crear 10 Products/Prices en live (`scripts/seed-stripe.ts` en modo live) → actualizar `stripe_price_id`/`price_mxn` en `program_variants` → flip de keys a `sk_live`/`pk_live` en Vercel → registrar **webhook live** + nuevo `STRIPE_WEBHOOK_SECRET`.
**Bloqueado:** faltan los precios de Aura (P1).

### L2 · Extra → cobro mensual recurrente — `L`
`programs.billing_model` de `cuarenta-mas-extra`: `fixed_term_monthly` → `rolling_monthly` (migración) + ajustar acceso/`completed_at`/checkout.
- **Toca:** `lib/webhooks/stripe-handlers.ts` · `lib/admin/clients-helpers.ts` (`subscriptionProgressLabel`) · `lib/content/access.ts` · revisar prerequisitos de Extra Avanzado (hoy dependen de "Extra Intermedio completado").
- **Ojo:** hoy solo se cambió la **etiqueta** en el admin; el fondo sigue pendiente.

### L3 · Set de preguntas de onboarding — `S` · bloqueado
Aura carga sus preguntas reales desde `/admin/onboarding-settings`. Hoy quedan 3 seed de prueba (migración 002).

### L4 · Smoke E2E con Aura — `S`
Login admin/cliente demo + registro real → confirmación de email → onboarding → checkout test (`4242 4242 4242 4242`) → webhook crea sub → portal.

### L5 · WhatsApp real — `S` · bloqueado
Cambiar `NEXT_PUBLIC_AURA_WHATSAPP` (hoy `525512620404`, de prueba) por el número real.

### L6 · Limpieza de datos demo — `S`
Borrar solo datos de clientes (perfiles/subs/invoices/fotos) conservando admin y catálogo. Base: `scripts/seed-demo.ts` (ya es aditivo y sin secretos).

### L7 · Correcciones menores del demo — `S` · falta detallar
Ajustes UI detectados en la verificación de navegador; nunca se detallaron. **Primer paso: enumerarlos.**

### L8 · production-checklist — `M`
Correr el skill `production-checklist` antes de abrir a clientes reales (incluye el gate de vulnerabilidades de `npm audit`).

### L9 · ¿UI de admin para planes/precios? — `L` · falta decidir
Decidir si se construye UI para gestionar variantes/precios o se mantiene script + SQL.

### L10 · Env vars de Preview en Vercel — `S`
Setear las 11 vars para Preview (el CLI pide rama interactiva; hacerlo al crear la 1ª rama de dev).

---

## D · Diferidos / deuda técnica

| ID | Item | Tam. | Nota |
|----|------|:----:|------|
| **D1** | Notas de admin sobre el registro del día | M | Diferido desde Fase 3. |
| **D2** | Transaccionalidad `saveBlocks`/`savePillarBlocks` | M | Guardado no atómico → posible estado parcial. Registrado fuera de scope de C+D. |
| **D3** | Zapier on-subscribe | M | Diferido desde Fase 4. |
| **D4** | Tope de 250 fotos no race-safe | S | Aceptable single-user. |
| **D5** | `getSentMessages` carga todos los `message_recipients` | S | Escala; bien por ahora. |
| **D6** | Typo en `.env.example` | S | `noreply@auramristany.com` → `no-reply@auramaristany.com`. |
| **D7** | Verificar CI + gitleaks en el 1er PR | S | El gate `ci` nunca se ha ejercido. |

---

## Secuencia sugerida

1. **Batch rápido:** `A2` · `A3` · `A10` · `A11` — poco riesgo, muy visible, estrena el gate de CI.
2. **Medianas:** `A1` · `A5` · `A8` · `A9` · `A12` (`A5` antes que `A4`).
3. **Proyectos:** `A6` → `A7` → `A4`.
4. **En paralelo (depende de Aura):** `L1` precios · `L5` WhatsApp · `L3` preguntas de onboarding.
5. **Cierre de lanzamiento:** `L2` · `L4` · `L6` · `L7` · `L10` → `L8` production-checklist.
