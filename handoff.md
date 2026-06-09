════════════════════════════════════════════════════════════════
DOCUMENTO DE TRASPASO — PLATAFORMA WEB AURA MARISTANY
Fecha: 4 de junio de 2026 · Actualizado: 9 de junio de 2026
Estado: Fase 3 COMPLETADA y smoke-tested (Historial) — Fases 0-3 en main; pendiente deploy
════════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. OBJETIVO DEL PROYECTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plataforma web independiente para Aura Maristany (coach de salud integral,
mujeres 40+) que permita:
  - Vender programas de bienestar como suscripciones mensuales recurrentes (Stripe)
  - Entregar contenido diario (video + texto + PDF + imágenes + ejercicios)
  - Que las clientas registren su progreso (reps, peso, notas) sin salir de la pantalla
  - Que Aura gestione todo desde un panel de admin (CMS, clientes, mensajes, finanzas)

El sitio de marketing es WordPress independiente (https://demo.studiosdmm.com.mx/aura/)
y NO se toca. La app vive en un subdominio (app.auramaristany.com).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. STACK TECNOLÓGICO (ya decidido, no reabrir)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Framework:        Next.js 14 (App Router)
  Base de datos:    Supabase — PostgreSQL + RLS + Auth + Storage + Real-time
  Pagos:            Stripe — 10 Prices en MXN (suscripciones recurrentes)
  UI:               shadcn/ui + Tailwind CSS
  Editor CMS:       Tiptap (MIT, gratuito — núcleo open-source)
  Video:            react-lite-youtube-embed (minimiza UI de YouTube)
  Email:            Resend + React Email
  Gráficas:         Recharts
  Drag & drop:      dnd-kit (para reordenar bloques en el CMS)
  Deploy:           Vercel + Supabase Cloud

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. IDENTIDAD VISUAL (ya decidido, no reabrir)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Encabezados/botones:  Oswald (Google Fonts)
  Texto corrido:        Hind (Google Fonts)
  Color primario:       #eddbd8 (rosa polvoso cálido — fondos, cards suaves)
  Color secundario:     #9982f4 (lavanda — botones de acción, badges, acentos)
  Base:                 Negro #1a1a1a y blanco #ffffff
  Tono:                 Minimalista, cálido, sofisticado — NO estética deportiva agresiva
  Mobile-first:         Clientas usan la app durante el entrenamiento

  Los diseños UI ya fueron generados con Claude Design. Los archivos están en:
  /Users/franciscovenegas/Desktop/Cowork/Aura/design-handoff-aura/prototype/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. PROGRAMAS Y VARIANTES (ya decidido)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGLA GLOBAL: La clienta NUNCA elige su variante. El quiz en WordPress
determina la variante y redirige a /checkout/[variantSlug].

── PROGRAMA 1: CuarentaMás ──────────────────────────────────
  Duración: 6 meses fijos, facturación mensual
  Stripe Prices: 5

  Variantes (slug → nivel × tiempo):
    cuarenta-mas-principiante-poco   Principiante, < 45 min
    cuarenta-mas-principiante-suf    Principiante, 45-80 min
    cuarenta-mas-intermedio-poco     Intermedio,   < 45 min
    cuarenta-mas-intermedio-suf      Intermedio,   45-80 min
    cuarenta-mas-avanzado-suf        Avanzado,     45-80 min

  Acceso: solo mes actual (months_elapsed). Dentro del mes: solo hasta
  la semana actual y el día de hoy (no puede adelantarse).
  Al completar mes 6: completed_at → desbloquea CuarentaMás Extra Intermedio.

── PROGRAMA 2: CuarentaMás Extra ───────────────────────────
  Stripe Prices: 2
  Prerequisitos con lógica OR (tabla program_variant_prerequisites):

  Extra Intermedio (6 meses fijos):
    Prerequisito: CuarentaMás completado (cualquier nivel)

  Extra Avanzado (indefinido, mensual rolling):
    Prerequisito: Extra Intermedio completado
    OR: CuarentaMás Intermedio/Avanzado completado (acceso directo)

  Progresión completa:
    CuarentaMás (cualquier) → Extra Intermedio (6 meses) → Extra Avanzado
    CuarentaMás Intermedio/Avanzado ────────────────────→ Extra Avanzado directo

  Acceso: SOLO el mes actual. Sin acceso a meses anteriores ni futuros.
  Los prerequisitos usan tabla program_variant_prerequisites con
  prerequisite_group (mismo grupo = AND, grupos distintos = OR).

── PROGRAMA 3: Strong & Fit ─────────────────────────────────
  Duración: indefinida, mensual rolling
  Stripe Prices: 3 (principiante / intermedio / avanzado)

  Acceso ACUMULATIVO pero controlado:
    Mes N → Series 1 a N visibles
    Series anteriores a la actual: acceso completo
    Serie actual (la más reciente): solo hasta (semana_actual, día_de_hoy)
  Aura puede agregar nuevas series en cualquier momento.

── TOTAL STRIPE PRICES: 10 ──────────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DECISIONES ARQUITECTÓNICAS CRÍTICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A) CAMPO months_elapsed
   Entero en tabla subscriptions. Se incrementa +1 en cada invoice.paid
   de Stripe. NUNCA se calcula desde fechas. Es el árbitro inmutable de
   qué contenido puede ver cada clienta. Resistente a reintentos de cobro,
   prorratas y edge cases de Stripe.

B) MODELO SEMANAL EN program_days (decisión v1.1)
   Los días de contenido NO son lineales (día 1, día 2... día 30).
   Se identifican por (week_number, day_of_week):

     week_number  INT   -- 1, 2, 3 o 4 (semana dentro del mes)
     day_of_week  TEXT  -- 'lunes' | 'martes' | 'miercoles' | 'jueves'
                        -- | 'viernes' | 'sabado' | 'domingo'
     workout_focus TEXT -- 'Tren Inferior', 'Tren Superior', etc. NULL = descanso

   UNIQUE(series_id, week_number, day_of_week)

   Si un día de la semana no tiene fila → el portal muestra card de descanso
   automáticamente (sin error, sin contenido requerido).

   Lógica de acceso:
     semana_actual = floor((today - current_period_start).days / 7) + 1
     La clienta puede ver: week_number < semana_actual (completas)
                        y: week_number = semana_actual AND day_of_week <= hoy

C) PROGRESO INTEGRADO EN LA VISTA DEL DÍA
   /portal/today muestra contenido + formulario de reps/peso/notas por
   ejercicio en UNA SOLA pantalla. Sin navegación adicional.
   Auto-guardado con debounce. Sin página separada de "registrar entrenamiento".

D) HISTORIAL DE DÍAS ANTERIORES (decisión v1.1)
   /portal/history incluye tab "Historial" con lista cronológica de
   entrenamientos pasados. Cada fila clickeable abre /portal/history/[logId]
   que renderiza el contenido del día + el registro de la clienta en modo
   SOLO LECTURA (misma estructura visual que /portal/today).

E) ONBOARDING CONFIGURABLE
   Aura define las preguntas desde el admin (onboarding_questions).
   Respuestas en JSONB (onboarding_responses). El middleware bloquea
   el portal hasta que onboarding_completed = true en profiles.
   Las respuestas son visibles en la ficha de cada clienta en el admin.

F) PREREQUISITOS CON LÓGICA OR
   Tabla program_variant_prerequisites con prerequisite_group INT.
   Mismo grupo = condiciones AND. Grupos distintos = OR entre grupos.
   Ejemplo Extra Avanzado:
     Grupo 1: CuarentaMás, levels ['intermedio','avanzado'], completado
     Grupo 2: Extra Intermedio, cualquier level, completado

G) YOUTUBE MINIMIZADO
   react-lite-youtube-embed: thumbnail propio + botón play custom.
   Al hacer clic carga el iframe con params rel=0, modestbranding=1,
   iv_load_policy=3. Los controles básicos del reproductor son inevitables
   por ToS de YouTube; la experiencia visual de YouTube se minimiza al máximo.
   Cada ejercicio también puede tener su propio video demo individual.

H) MÉTRICAS SON DE DESEMPEÑO, NO CORPORALES
   /portal/history tiene tab "Desempeño" con gráficas de reps/peso por
   ejercicio (Recharts). NO es peso corporal ni talla. Las medidas
   corporales (cintura, cadera, peso) son opcionales y van en tab separado
   con galería de fotos de progreso.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ESQUEMA SQL — TABLAS CLAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

profiles               — usuarios (clientes + admin), stripe_customer_id, onboarding_completed
onboarding_questions   — preguntas configurables por Aura
onboarding_responses   — respuestas en JSONB por clienta
programs               — catálogo de programas (3)
program_variants       — variantes con stripe_price_id (10)
program_variant_prerequisites — prerequisitos con lógica AND/OR por grupo
program_series         — meses/series de contenido (series_number)
program_days           — días: (series_id, week_number, day_of_week) + workout_focus
program_day_blocks     — bloques de contenido JSONB (text/youtube/pdf/image/exercise_list)
variant_series_map     — mapeo N:N variante↔serie (permite reutilizar contenido)
subscriptions          — suscripción activa de cada clienta, months_elapsed aquí
subscription_events    — auditoría de todos los webhooks de Stripe
progress_logs          — registro diario: program_day_id + exercises_done JSONB
body_metrics           — peso/cintura/cadera (opcionales, por fecha)
progress_photos        — fotos de progreso vinculadas a body_metrics
messages               — mensajes Aura→clientas (individual o broadcast)
message_recipients     — destinatarios + read_at
invoices               — historial de pagos (fuente del dashboard financiero)

exercises_done JSONB estructura (v1.1 — por serie):
  { "exercise-uuid": { "completed": true,
                        "series": [{ "reps_done": 12, "weight_kg": 15.0 }, ...] } }
  (N objetos en series = N sets; campos null si no se llenaron)

exercise_list block JSONB estructura:
  { "exercises": [{ "id": "uuid", "name": "...", "sets": 3, "reps": "12",
     "rest_seconds": 60, "notes": "...", "video_url": "...",
     "metrics": ["reps_done", "weight_kg"] }] }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. RUTAS DE LA APLICACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/(marketing)
  /checkout/[variantSlug]        — landing de conversión (viene del quiz WordPress)

/auth
  /login  /register  /callback  /reset-password

/onboarding
  /questionnaire                 — guard: suscripción activa + onboarding=false

/portal                          — guard: suscripción activa + onboarding=true
  /today                         — contenido del día + registro integrado
  /history                       — desempeño, fotos, historial de días
  /history/[logId]               — día pasado en modo lectura
  /messages                      — solo lectura (Aura → clienta)
  /settings                      — perfil + Stripe Customer Portal

/admin                           — guard: role='admin'
  /dashboard                     — MRR, clientes activas, ingresos
  /clients                       — lista de clientas
  /clients/[clientId]            — ficha completa
  /content                       — overview de programas
  /content/[programId]           — grilla semanal de la serie
  /content/[programId]/series/[seriesId]/days/[dayId] — editor de día
  /messages                      — composición y enviados
  /onboarding-settings           — gestión de preguntas del cuestionario

/api
  /webhooks/stripe
  /subscriptions/create-checkout
  /subscriptions/customer-portal
  /admin/upload

Middleware (orden):
  1. No autenticado → /auth/login
  2. Sin suscripción activa → preserva URL, redirige a checkout
  3. Suscripción activa + onboarding_completed=false → /onboarding/questionnaire
  4. Admin visitando /portal → /admin/dashboard
  5. Cliente visitando /admin → /portal/today

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. ARCHIVOS CRÍTICOS DEL SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/supabase/migrations/001_initial_schema.sql — esquema completo + RLS
/lib/content/access.ts              — lógica de acceso para los 3 programas
/lib/content/queries.ts             — getTodayContent + DEV_DATE override
/app/api/webhooks/stripe/route.ts   — ciclo de vida de suscripciones
/middleware.ts                      — protección por rol/suscripción/onboarding
/hooks/useProgressForm.ts           — estado del formulario + auto-guardado (debounce 1.5s)
/components/portal/TodayView.tsx    — vista del día + progreso integrado
/app/portal/layout.tsx              — layout con nav inferior y max-width 640px (desktop)
/app/admin/layout.tsx               — sidebar de navegación admin (desktop-first, 220px)
/lib/admin/queries.ts               — consultas de datos del panel admin
/components/admin/WeeklyGrid.tsx    — grilla 4×7 (semanas × días) del CMS
/components/admin/SeriesAccordion.tsx — acordeón por serie con WeeklyGrid integrado
/app/admin/content/page.tsx         — lista de programas (CMS overview)
/app/admin/content/[programId]/page.tsx — series de un programa
-- Subsistema E/F (COMPLETADOS):
/components/admin/DayEditorForm.tsx — editor de día (metadata + bloques dnd)
/components/admin/BlockListEditor.tsx — lista de bloques arrastrables (compartido día/pilar)
/components/admin/blocks/*          — 6 editores de bloque (incl. CardioZone2)
/components/admin/PillarEditorForm.tsx — editor de pilar (reusa BlockListEditor)
/components/admin/DayCellMenu.tsx + CloneWeekButton.tsx — clonar/eliminar en la grilla
/lib/admin/dayActions.ts            — saveDay/saveBlocks/cloneDay/cloneWeek/deleteDay
/lib/admin/pillarActions.ts         — savePillar/savePillarBlocks
/lib/content/pillars.ts             — getCurrentMonthPillars (gate CuarentaMás/Extra)
/lib/content/cardio.ts              — cardioZone2(edad)
/app/api/admin/upload/route.ts      — upload a Supabase Storage (bucket 'content')
/components/portal/PortalHeader.tsx — header AURA+fecha (today + pilares)
/components/portal/PillarsView.tsx + /app/portal/pilares — sección de pilares
/app/admin/content/[programId]/series/[seriesId]/days/{new,[dayId]}/page.tsx
/app/admin/content/[programId]/series/[seriesId]/pillars/{,[pillarKey]}/page.tsx
/supabase/migrations/004_editor_pilares.sql — day_type, cardio_zone2, tablas de pilares, bucket

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. VARIABLES DE ENTORNO REQUERIDAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          (solo servidor)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL=noreply@auramaristany.com
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. ESTADO ACTUAL DEL PROYECTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPLETADO:
  ✓ Arquitectura completamente definida y aprobada
  ✓ SPEC.md v1.1 en /Users/franciscovenegas/Desktop/Cowork/Aura/SPEC.md
  ✓ Diseños UI generados con Claude Design (17 pantallas)
  ✓ Archivos de diseño en /Users/franciscovenegas/Desktop/Cowork/Aura/
    design-handoff-aura/prototype/ (JSX + CSS + datos mock)

  ✓ FASE 0 — FUNDACIÓN (completada 4 de junio de 2026)
    ✓ Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui (Radix, estilo "default")
    ✓ Brand tokens aplicados: Oswald/Hind, rosa/lavanda, CSS custom properties
    ✓ Supabase configurado: proyecto bgvxaagfnzvzamtxqbkg.supabase.co
    ✓ Schema SQL completo aplicado (18 tablas + RLS + triggers)
    ✓ Middleware de protección de rutas con TDD (8/8 tests passing)
    ✓ Auth completo: registro, confirmación por email, login, logout, reset password
    ✓ Flujo verificado en local: registro → email → login → portal → logout
    ✓ 0 errores TypeScript · build limpio
    Plan detallado: docs/superpowers/plans/2026-06-04-fase-0-fundacion.md

    Nota técnica — fix aplicado post-migración:
    La función handle_new_user() requirió SET search_path = public por un
    cambio de seguridad en versiones recientes de Supabase. Ya corregido
    en la función activa del proyecto (no en el archivo SQL de migración).

  ✓ FASE 1 — SUSCRIPCIÓN MVP (completada 5 de junio de 2026)
    ✓ 10 Stripe Products/Prices creados en test mode ($999 MXN c/u)
      Cuenta Stripe test: acct_1TeeqvRx0tAq6bwG
      Script de seed: scripts/seed-stripe.ts
      IDs actualizados en program_variants vía SQL en Supabase
    ✓ /checkout/[variantSlug] — landing de conversión con CheckoutButton
    ✓ /api/subscriptions/create-checkout — crea Stripe Checkout Session
      con validación de prerequisitos y creación de customer
    ✓ Webhook /api/webhooks/stripe — maneja ciclo de vida completo:
      checkout.session.completed → crea suscripción (months_elapsed=1)
      invoice.paid → incrementa months_elapsed (solo subscription_cycle)
      customer.subscription.updated/deleted → actualiza status
      invoice.payment_failed → status=past_due
    ✓ /portal/activando — página de polling post-pago (resuelve race condition
      entre redirect de Stripe y llegada asíncrona del webhook)
    ✓ /onboarding/questionnaire — cuestionario dinámico desde DB
    ✓ /portal/sin-suscripcion — página de acceso denegado con logout
    ✓ Middleware actualizado: gate de suscripción + fix de usuarios sin rol
    ✓ Login/Register preservan ?next= para redirigir al checkout tras auth
    ✓ 25/25 tests passing
    Flujo smoke-tested end-to-end en local:
      checkout → pago → /portal/activando → onboarding → /portal/today

    Notas técnicas — fixes aplicados durante desarrollo:
    - Stripe SDK v22.x requiere apiVersion "2026-05-27.dahlia" (no "2024-04-10")
    - Stripe API 2026: invoice.subscription movido a
      invoice.parent.subscription_details.subscription
    - Stripe API 2026: subscription.current_period_start/end eliminados
    - Race condition post-pago resuelta con /portal/activando (polling 2s × 15)
    - Usuarios autenticados sin fila en profiles ahora bloqueados en middleware
    Plan detallado: docs/superpowers/plans/2026-06-04-fase-1-subscripcion-mvp.md

  ◑ FASE 2 — CONTENIDO (en progreso — iniciada 5 de junio de 2026)

    ✓ Subsistema A — /portal/today funcional:
      ✓ Vista real del día con contenido desde DB (5 tipos de bloques)
      ✓ Formulario de progreso integrado: reps + peso por serie (N filas = N sets)
      ✓ Auto-guardado con debounce 1.5s (hook useProgressForm)
      ✓ exercises_done JSONB estructura por serie (ver sección 6)
      ✓ DEV_DATE: override de fecha para testing local (.env.local, server-only)
        Nota: remover antes de producción (es gitignored, no llega a Vercel)

    ✓ Subsistema B — UI/UX portal:
      ✓ Capitalización de fecha: charAt(0).toUpperCase() — no CSS capitalize
      ✓ Fecha efectiva: viene del servidor (effectiveDate en TodayContent)
        para que DEV_DATE se refleje en el UI correctamente
      ✓ Video: playsinline=1 en URL del iframe de YouTube
      ✓ Portal max-width 640px centrado en desktop (background #e8e0e0)

    ✓ Subsistema C — Admin layout:
      ✓ app/admin/layout.tsx: sidebar sticky 220px, íconos Lucide
      ✓ Nav: Dashboard / Clientes / Contenido / Mensajes / Onboarding
      ✓ Estado activo: pathname.startsWith(href), fondo lavanda-tint
      ✓ Stubs creados: /admin/dashboard, /clients, /messages, /onboarding-settings
      ✓ Middleware ya enrutaba admin→/admin/dashboard (sin cambios)

    ✓ Subsistema D — Admin CMS overview + grilla semanal:
      ✓ /admin/content: lista de programas con billing model, duración, conteo
      ✓ /admin/content/[programId]: acordeón de series con grilla 4×7
      ✓ WeeklyGrid: celdas publicadas (lavanda), borrador (gris), vacías (dashed)
      ✓ Bug doble título "Mes 1 — Mes 1" corregido: SeriesAccordion prepende
        "Mes {N} —" y el seed ya NO incluye ese prefijo en el título
      ✓ SQL a correr en Supabase Dashboard para sincronizar live DB:
        UPDATE program_series SET title = 'Actividad Física'
        WHERE id = '00000000-0000-0000-0003-000000000001';
        (El seed ya tiene el título correcto para futuras instalaciones)

    ✓ Subsistema E — Editor de día (implementado, rama feature/fase-2-editor-pilares):
      ✓ DayEditorForm (metadata + bloques arrastrables dnd-kit), 6 block editors
        (texto Tiptap, youtube, pdf, imagen, lista de ejercicios, cardio_zone2)
      ✓ /api/admin/upload (Storage, bucket 'content', admin-gated)
      ✓ Rutas new/[dayId]; getDayWithBlocks; saveDay/saveBlocks
      ✓ Portal: bloque cardio_zone2, día de descanso editable, badges
      ✓ Migración 004 aplicada (day_type, cardio_zone2, tablas de pilares, bucket)

    ✓ Subsistema F — Gestión + Pilares (implementado, misma rama):
      ✓ cloneDay/cloneWeek/deleteDay + acciones en la grilla
      ✓ Pilares mensuales: editor admin (reusa BlockListEditor) + /portal/pilares
        (gated a CuarentaMás/Extra, mes actual)
      ✓ Gates verdes: vitest 64/64, tsc limpio, npm run build OK
      ✓ Fix pre-existente de activando TypeScript resuelto (+ 2 bloqueos de build de main)

    ✓ Ronda de ajustes post-smoke (completada 9-jun, re-smoke OK):
      Plan: docs/superpowers/plans/2026-06-09-ajustes-post-smoke-editor-portal.md
      ✓ Editor rediseñado (top bar, estado dropdown, sin selector de tipo → todo
        "Actividad Física" + Enfoque libre; paleta de bloques con íconos; back link)
      ✓ Texto: H3/H4 + listas (instalado @tailwindcss/typography) + espaciado
      ✓ Imagen: preview; Ejercicios: labels; /today fondo blanco; /pilares header + rosa
      ✓ Calculadora Cardio Zona 2: validación 18-110 + rediseño (rango grande + barra)
      ✓ Editor/pilar: breadcrumb + botón de regreso
      Bugs corregidos en esta ronda:
        - current_period_start/end nunca se seteaban (Stripe 2026 los movió a
          subscription.items) → portal siempre mostraba descanso. Fix en stripe-handlers.
        - "Error al guardar": progress_logs usa columna 'notes' (no 'general_notes')
          y onConflict debía ser (profile_id, program_day_id). Fix en queries.ts.
      Gates verdes: vitest 67/67, tsc limpio, build OK, lint limpio.

  ✓ FASE 3 — HISTORIAL (completada 9 de junio de 2026, rama feature/fase-3-historial)
    Plan: docs/superpowers/plans/2026-06-09-fase-3-historial.md
    Diseño: docs/superpowers/specs/2026-06-09-fase-3-historial-design.md
    ✓ /portal/history "Mi Progreso" con 2 tabs (siguiendo el prototipo, NO 3 tabs):
      - Desempeño: gráfica Recharts por ejercicio (solo mes corriente,
        log_date >= current_period_start), selector de ejercicio (pills),
        toggle de métrica dinámico (reps/peso/otras), SIN selector de periodo,
        SIN stat cards. Debajo: lista "Historial de ejercicios" (días con
        progress_log, reciente primero) → /portal/history/[logId].
      - Fotos: bucket privado 'progress' + signed URLs (1h), grid 3 col,
        filtro por mes, subir con comentario opcional + compresión cliente
        (1280px, JPEG), visor con navegación + borrar. SIN métricas corporales.
    ✓ /portal/history/[logId]: detalle read-only (reusa BlockView con prop
      loggedExercises; ExerciseListLogged muestra valores por serie). Badge 📅.
    ✓ Límites de fotos: 5MB/archivo, máx 30, reducción a 1280px (validación pura).
    ✓ lib/content/history.ts (getHistoryList/getPerformanceData/getHistoryLog) +
      history-helpers.ts (puras, TDD). Endpoints propios del cliente:
      POST/DELETE /api/portal/photos.
    ✓ Migración 005_progress_photos.sql: bucket privado + RLS de Storage por
      prefijo {profile_id}/ + columna caption. ⚠ APLICAR MANUALMENTE en Supabase.
    ✓ Gates: vitest 85/85, tsc limpio, lint limpio, build OK.
    Decisiones (P3): registro pasado es SOLO LECTURA (no editable).
    Bug corregido en review final: la columna real de progress_photos es
    'taken_at' (NO 'photo_date' como decían SPEC/contexto). Código ya usa taken_at.
    ✓ Migración 005 YA APLICADA en Supabase (vía CLI/Management API) y verificada:
      bucket privado 'progress', columna caption, policies de storage + tabla.
    ✓ Smoke manual hecho (cliente bije001@yahoo.com.mx, DEV_DATE): gráfica con
      línea de 2 puntos, detalle read-only, fotos (subir/borrar/filtro mes/signed URL).
    Ajustes post-smoke (mergeados a main):
      - Gráfica relaciona ejercicios por NOMBRE normalizado (no uuid) → conecta el
        mismo ejercicio aunque Aura cree cada día desde cero. (history-helpers.ts)
      - Tope de fotos 30 → 250 (~1/día x 6 meses) + badge [N/250] en tab Fotos.
      - Pill del historial sin la palabra "ejercicios" (evita salto de línea móvil).
      - upsertProgressLog respeta DEV_DATE en log_date (antes usaba fecha real, lo que
        colapsaba días simulados en la misma fecha). Producción sin cambios.
      - Límite de 5MB: la compresión cliente deja la foto pequeña, comportamiento OK.
    Follow-ups Fase 3 (no bloquean): regenerar lib/supabase/types.ts para incluir
    progress_photos/body_metrics y quitar los `as any` de los endpoints de fotos;
    tope de 250 fotos no es race-safe (aceptable single-user); UI de admin para
    eliminar fotos de clientas (RLS ya lo permite, falta UI — futura ficha de cliente);
    notas de admin sobre el registro del día (diferido, evaluar en Fase 4).

PENDIENTE:
  ○ Configurar Vercel + variables de entorno de producción
  ○ Aplicar migración 005_progress_photos.sql en el dashboard de Supabase
  ○ Follow-ups menores (no bloquean): try/catch en stripe.subscriptions.retrieve;
    unificar formatDate duplicado; alinear SPEC/types.ts (dicen general_notes) con la
    columna real 'notes'; saveBlocks/savePillarBlocks no transaccionales; tests de
    cloneDay/cloneWeek.
  ○ Setup local: correr `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
    para probar checkout (ver sección 12).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. FASES DE DESARROLLO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fase 0 — Fundación         (sem 1-2)   Next.js + Supabase + Stripe test + Vercel  ✓ COMPLETADA
Fase 1 — Suscripción MVP   (sem 3-5)   Quiz→pago→onboarding→portal básico          ✓ COMPLETADA
Fase 2 — Contenido         (sem 6-9)   CMS grilla semanal + portal del día + progreso  ◑ EN PROGRESO
  ✓ Sub A: portal/today funcional     ✓ Sub B: UI/UX portal
  ✓ Sub C: Admin layout + sidebar     ✓ Sub D: CMS overview + grilla semanal
  ✓ Sub E: Editor de día             ✓ Sub F: Gestión de días + Pilares
  ✓ Ronda de ajustes post-smoke (rediseño editor + fixes) — FASE 2 COMPLETADA
Fase 3 — Historial         (sem 10-11) Gráficas desempeño + fotos + historial de días  ✓ COMPLETADA
Fase 4 — Mensajería        (sem 12)    Comunicación Aura↔clientas
Fase 5 — Financiero        (sem 13)    Dashboard MRR e ingresos
Fase 6 — Pulido + Launch   (sem 14-15) Edge cases + auditoría seguridad + producción

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. LIMITACIONES Y RESTRICCIONES CONOCIDAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUTUBE: Los controles básicos del reproductor son inevitables por ToS de
YouTube. No se puede ocultar la barra de controles completamente. Lo que
SÍ se puede hacer: suprimir sugerencias (rel=0), minimizar branding
(modestbranding=1), ocultar anotaciones (iv_load_policy=3), y usar
thumbnail propio antes de cargar el iframe (react-lite-youtube-embed).

TIPTAP: Solo el núcleo open-source (MIT). Las extensiones Pro de Tiptap
(collaborative editing, AI, etc.) son de pago. No se usan; no son necesarias.

STRIPE / MONEDA: Todas las suscripciones en MXN. Los 10 Prices deben
crearse manualmente en el dashboard de Stripe (no hay automatización de
eso en el código). Los precios exactos aún no están definidos por Aura.

PREREQUISITOS: La validación de prerequisitos (ej. verificar que CuarentaMás
esté completado antes de permitir checkout de Extra) ocurre en el servidor
al crear la Stripe Checkout Session. No se expone esta lógica al cliente.

MODELO SEMANAL — MESES DE 5 SEMANAS: RESUELTO. La semana calculada se clampa
a 4 (getCurrentDayKey en lib/content/access.ts), así la semana 5 reutiliza el
contenido de la semana 4. El límite con el mes siguiente lo da el período de
Stripe (invoice.paid → nuevo current_period_start).

STRIPE CLI EN LOCAL (setup obligatorio para probar checkout): el flujo de pago
necesita el reenvío de webhooks corriendo en una terminal aparte:
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
El comando imprime un signing secret (whsec_...) que debe coincidir con
STRIPE_WEBHOOK_SECRET en .env.local. Sin esto, checkout.session.completed nunca
llega, la suscripción no se crea, y /portal/activando hace timeout con "Algo
tardó más de lo esperado". NO es bug de código. Aplica incluso en test mode.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. PREGUNTAS PENDIENTES (sin resolver)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

P1: ¿Cuáles son los precios exactos en MXN de cada variante?
    RESUELTO TEMPORALMENTE: Se usarán precios simulados ($999 MXN) en Stripe
    test mode durante el desarrollo. Antes del lanzamiento se crean los
    Products/Prices reales en Stripe live mode y se actualizan los
    stripe_price_id en la tabla program_variants con un query SQL.

P2: ¿Qué pasa en semanas 5 de un mes? (ver Limitaciones arriba)
    Opciones: a) descanso automático  b) repetir contenido semana 4
              c) Aura crea contenido para semana 5 opcional en el CMS

P3: ¿La clienta puede EDITAR un registro pasado desde /portal/history/[logId]?
    Hoy definido como solo lectura. Decisión pendiente si se quiere permitir
    correcciones posteriores.

P4: ¿Cuáles son las preguntas del onboarding que Aura quiere hacer?
    RESUELTO TEMPORALMENTE: Se sembraron 3 preguntas de prueba en la
    migración 002. Aura podrá gestionar las preguntas definitivas desde
    el admin (/admin/onboarding-settings) cuando esté implementado en Fase 2+.

P5: ¿El nombre de dominio ya está comprado? ¿app.auramaristany.com o similar?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. ARCHIVOS DE REFERENCIA EN DISCO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEC técnico completo:
  /Users/franciscovenegas/Desktop/Cowork/Aura/SPEC.md

Diseño UI (prototipos JSX listos para implementar):
  /Users/franciscovenegas/Desktop/Cowork/Aura/design-handoff-aura/prototype/aura/
    app.jsx              — router del prototipo
    components.jsx       — componentes base reutilizables
    styles.css           — design tokens y clases utilitarias
    data.js              — datos mock (estructura de referencia para el código real)
    client-today.jsx     — portal: pantalla HOY (la más importante)
    client-progress.jsx  — portal: Mi Progreso (desempeño + fotos)
    client-onboarding.jsx
    client-messages.jsx
    client-settings.jsx
    client-auth.jsx
    admin-dashboard.jsx
    admin-clients.jsx
    admin-content.jsx    — CMS: overview + grilla de programa + editor de día
    admin-messages.jsx
    admin-shell.jsx      — sidebar + layout del admin

════════════════════════════════════════════════════════════════
FIN DEL DOCUMENTO DE TRASPASO
Para continuar: revisar los JSX del diseño en design-handoff-aura/prototype/
y comenzar con Fase 2 (CMS grilla semanal + portal del día + progreso).
════════════════════════════════════════════════════════════════
