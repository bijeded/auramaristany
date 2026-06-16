════════════════════════════════════════════════════════════════
DOCUMENTO DE TRASPASO — PLATAFORMA WEB AURA MARISTANY
Fecha: 4 de junio de 2026 · Actualizado: 16 de junio de 2026
Estado: Fases 0-5 en main; Fase 6 (Pulido + Launch) EN CURSO con 8 sub-bloques + 2 fixes mergeados:
        1 Gestión de Clientes (0d23c5e), 3 Página de Pagos + lenguaje neutro (d52f224),
        4b Constructor de Onboarding (9477a8c), 4a Núm. Celular en registro (bdb4e83),
        A Auditoría de seguridad + ciclo de corrección (bb05894), B2 /portal/settings completo (4271c85),
        C+D pulido auditoría + limpieza de tipos (b32f0c5), CRUD de Series en admin (d2b3d70);
        + fixes A1/G4 (1e838d7) y B1 (0dde433).
        Migr. 001-010 aplicadas (007 = ON DELETE CASCADE; 008 = phone; 009 = endurecimiento
        seguridad: with check RLS + search_path is_admin + phone normalizado en trigger;
        010 = bucket público avatars + policy de lectura). C+D y CRUD de Series SIN migración nueva.
        backfill de invoices ejecutado; E2E validado. ✓ BUG G4 RESUELTO (1e838d7: primer invoice
        se registra en checkout.session.completed). ✓ B1 logout MERGEADO (0dde433).
        ✓ B2 /portal/settings COMPLETO MERGEADO (4271c85: edición nombre/teléfono + contraseña,
        foto de perfil comprimida a 800px en bucket público, ficha de suscripción con "Mes X de Y",
        historial de pagos paginado; 216 tests).
        ✓ C+D MERGEADO (b32f0c5): 8 bajos de auditoría cerrados (STG-2/INP-5/EDGE-3/MW-3/EDGE-5/
        INP-1/SVC-2/INP-4) + limpieza de tipos (types.ts completado a mano, 0 casts injustificados,
        Relationships:[] + "trialing"; try/catch en stripe.retrieve que re-lanza; formatDate unificado;
        tests cloneDay/cloneWeek) + bonus (fix BILLING_LABELS, dayLabel timestamptz, y fix pre-existente
        router.refresh() tras guardar progreso en /portal/today).
        ✓ CRUD de Series COMPLETO (HEAD d2b3d70, 10 commits): crear/editar/eliminar series en
        /admin/content/[programId]; server actions createSeries/updateSeries/deleteSeries; menú ⋯
        en SeriesAccordion; SeriesFormModal (variantes por checkbox) + SeriesDeleteDialog (cascade
        warning); getAdminProgram devuelve variants[] + variantIds[]. SIN migración nueva. 252 tests.
        ✓ DEMO EN LÍNEA DESPLEGADO (16-jun): app pública en https://app.auramaristany.com (Vercel
        Production), modo DEMO para feedback de Aura (NO lanzamiento productivo). Decisiones: Stripe
        TEST mode (flip a live cuando Aura dé precios — quiere ver el demo funcionando antes); mismo
        proyecto Supabase como prod; A2 completo (Resend dominio verificado + SMTP + Confirm email);
        datos demo se conservan (se borran solo clientes al lanzar). ✓ A2 (Resend): dominio
        auramaristany.com verificado (DNS en IONOS, registros en subdominio 'send' + DKIM, sin tocar
        correo IONOS); SMTP de Supabase Auth → Resend (smtp.resend.com:465, user 'resend'); Confirm
        email activado; RESEND_FROM_EMAIL=no-reply@auramaristany.com. ✓ A3 (deploy): repo PRIVADO
        github.com/bijeded/auramaristany; Vercel team "Aura Maristany's projects"/project-a24no
        conectado a GitHub (main→Production, ramas→Preview); framework nextjs en vercel.json; 11 env
        vars Production (Stripe TEST); webhook test we_1Tj1aZ… (4 eventos); vercel --prod aliased a
        app.auramaristany.com; Site URL + Redirect URLs ajustados en Supabase Auth. Seed corrido
        (admin hola@auramaristany.com/09876543 + 20 clientes demo /12345678) — seed-demo.ts reescrito
        ADITIVO y SIN secretos (borra solo datos de usuario vía service_role + vacía buckets, no toca
        catálogo). Fix de build roto en main (updateSeries seteaba updated_at a mano → TS2322).
        Pendiente Fase 6: Task 5 smoke E2E con Aura; luego (antes de lanzar) Stripe LIVE + precios
        reales de Aura, WhatsApp real, limpieza de datos demo, env vars de Preview.
        Registrado para después: transaccionalidad de saveBlocks/savePillarBlocks.
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
body_metrics           — peso/cintura/cadera (definido en schema; NO se captura en Fase 3)
progress_photos        — fotos de progreso (storage_path, taken_at, caption). Columna 'angle'
                         existe pero SIN uso; body_metrics_id queda null (fotos independientes)
messages               — mensajes Aura→clientas (individual o broadcast). subject NOT NULL,
                         is_broadcast; SIN recipient_id/broadcast_filter (destino vía message_recipients)
message_recipients     — destinatarios: message_id + recipient_id + read_at (snapshot al enviar)
invoices               — historial de pagos (fuente del dashboard financiero, Fase 5 ✓).
                         ⚠ columnas reales: amount_paid + currency + invoice_date(timestamptz) + status.
                         NO existen amount_mxn ni paid_at (el SPEC viejo los listaba — ya corregido).
                         ✓ Fase 5: corregido el bug que omitía el PRIMER pago (subscription_create);
                         backfill idempotente aplicado a los pagos previos.

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
  /pilares                       — pilares mensuales (gate CuarentaMás/Extra)
  /history                       — "Mi Progreso": tabs Desempeño + Fotos (Fase 3)
  /history/[logId]               — día pasado en modo lectura
  /messages                      — bandeja read-only (Aura→clienta) + WhatsApp a Aura  [Fase 4 ✓]
  /messages/[id]                 — detalle del mensaje (marca read_at)  [Fase 4 ✓]
  /settings                      — "Mi cuenta": edición nombre/teléfono + contraseña + avatar + ficha de suscripción ("Mes X de Y") + historial de pagos paginado  [Fase 6 ✓]
  /activando · /sin-suscripcion  — polling post-pago / acceso denegado

/admin                           — guard: role='admin'
  /dashboard                     — MRR, ingresos por mes, clientes por variante, pagos  [Fase 5 ✓]
  /clients                       — lista de clientes (filtros, paginación, CSV)  [Fase 6 ✓]
  /clients/[clientId]            — ficha de 6 tabs (incl. borrado admin de fotos)  [Fase 6 ✓]
  /payments                      — listado completo de pagos (filtro estado + paginación)  [Fase 6 ✓]
  /content                       — overview de programas
  /content/[programId]           — grilla semanal de la serie
  /content/[programId]/series/[seriesId]/days/[dayId] — editor de día
  /messages                      — composición y enviados
  /onboarding-settings           — constructor del cuestionario (CRUD preguntas)  [Fase 6 ✓]

/api
  /webhooks/stripe
  /subscriptions/create-checkout
  /subscriptions/customer-portal
  /admin/upload                  — upload admin a bucket público 'content'
  /admin/clients/[clientId]                  — DELETE clienta (guard 409 + cascade 007)  [Fase 6 ✓]
  /admin/clients/[clientId]/photos/[photoId] — DELETE foto de clienta (admin, service client)  [Fase 6 ✓]
  /portal/progress               — upsert del registro del día (auto-guardado)
  /portal/photos                 — POST subir foto (bucket privado 'progress')
  /portal/photos/[id]            — DELETE borrar foto propia
  /cron/purge-messages           — [Fase 4] Vercel Cron: borra mensajes >180 días (Bearer CRON_SECRET)

  Nota: onboarding (saveQuestion/reorderQuestions/setQuestionActive) y borrado de
  clienta usan endpoints/server-actions admin-gated; ver sección 8 (Fase 6).

  Nota: el envío/marcar-leído/eliminar de mensajes usan SERVER ACTIONS
  (lib/admin/messageActions.ts, lib/portal/messageActions.ts), no route handlers.

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
-- Fase 3 — Historial (COMPLETADA):
/lib/content/history.ts             — getHistoryList/getPerformanceData/getHistoryLog (server-only)
/lib/content/history-helpers.ts     — funciones puras (countCompleted, countExercisesInBlocks,
                                       aggregateDayValue, buildPerformanceSeries) — agrupa por NOMBRE
/lib/portal/photo-validation.ts     — validatePhotoUpload + computeResizedDimensions (puro). MAX_PHOTOS=250, 5MB, 1280px
/lib/portal/photo-compress.ts       — compressImage (canvas, cliente): reescala 1280px + JPEG 0.82
/app/api/portal/photos/route.ts     — POST upload (bucket privado 'progress', prefijo {userId}/)
/app/api/portal/photos/[id]/route.ts — DELETE (valida dueña + borra Storage y fila)
/app/portal/history/page.tsx        — server: carga lista+desempeño+fotos (signed URLs 600s, STG-2), monta ProgressView
/app/portal/history/[logId]/page.tsx — server: detalle read-only (getHistoryLog, notFound si no es suya)
/components/portal/ProgressView.tsx  — tabs Desempeño | Fotos (cliente)
/components/portal/PerformanceTab.tsx + PerformanceChart.tsx — pills de ejercicio + Recharts + lista "Historial de ejercicios"
/components/portal/PhotosTab.tsx     — grid 3col + filtro por mes + subir(comentario)/visor/borrar + badge [N/250]
/components/portal/HistoryDayView.tsx — render read-only del día (badge 📅, sin guardar)
/components/portal/blocks/ExerciseListLogged.tsx — ejercicios con valores registrados por serie
/components/portal/blocks/BlockView.tsx — +prop loggedExercises (dispatch a ExerciseListLogged)
/supabase/migrations/005_progress_photos.sql — bucket privado 'progress' + RLS storage + columna caption (APLICADA)
-- Fase 4 — Mensajería (COMPLETADA, en main):
/supabase/migrations/006_messaging.sql — RLS SELECT de messages para clientas + UPDATE de read_at por la dueña + índices (APLICADA)
/lib/admin/message-helpers.ts       — funciones puras (expandRecipients/buildRecipientGroups/formatDestination/whatsapp) — TDD
/lib/admin/queries.ts (+)           — getActiveSubscriberRows, getSentMessages
/lib/admin/messageActions.ts        — sendMessage, getSentMessageDetail, deleteMessage (admin-gated, RLS)
/lib/content/messages.ts            — getInboxMessages/getUnreadCount/getMessageDetail (portal, server-only)
/lib/portal/messageActions.ts       — markMessageRead (idempotente + revalidatePath layout)
/lib/email/client.ts                — cliente Resend no-op sin key + fromAddress/appUrl
/lib/email/send.ts                  — helpers best-effort + sendNewMessageEmailBatch (≤100) — TDD
/lib/email/templates/*.tsx          — Layout + NewMessage/Welcome/PaymentFailed/SubscriptionEnded (React Email)
/components/admin/MessagesAdmin.tsx  — composer (individual/difusión) + enviados + detalle (quién leyó)/clonar/eliminar
/components/portal/MessagesList.tsx + MarkReadOnView.tsx — lista + marca leído en cliente
/app/portal/messages/page.tsx + /[id]/page.tsx — lista (PortalHeader) + detalle read-only
/app/admin/messages/page.tsx        — server: getSentMessages + getActiveSubscriberRows → MessagesAdmin
/lib/webhooks/stripe-handlers.ts (+) — emails de ciclo de vida best-effort (welcome/payment_failed/canceled)
/app/api/cron/purge-messages/route.ts + vercel.json — retención 180 días (Vercel Cron, Bearer CRON_SECRET)
-- Fase 5 — Dashboard Financiero (COMPLETADA, en main):
/lib/admin/finance-helpers.ts       — funciones puras (computeMRR, groupRevenueByMonth,
                                       groupClientsByVariant, groupRevenueByProgram,
                                       computeRenewalsThisMonth, formatMXN) + tipos — TDD
/lib/admin/finance-queries.ts       — getActiveSubscriptions/getPaidInvoices/getPastDueCount/
                                       getRecentPayments (server-only, RLS admin)
/components/admin/RevenueBarChart.tsx — barras de ingresos 12m (Recharts, client)
/components/admin/ProgramRevenueDonut.tsx — donut de ingresos por programa (Recharts, client)
/app/admin/dashboard/page.tsx       — Server Component: ensambla queries→helpers→UI
/lib/webhooks/stripe-handlers.ts (+) — fix: registra el PRIMER invoice en subscription_create
/scripts/backfill-first-invoices.ts — backfill idempotente de invoices faltantes (tsx, env-file)
-- Fase 6 — Pulido + Launch (EN CURSO, en main):
/supabase/migrations/007_cascade_on_profile_delete.sql — ON DELETE CASCADE en la cadena de FKs de
                                       profiles/subscriptions (borrado total de cliente). APLICADA.
/lib/admin/clients-helpers.ts       — puras TDD (filterClients, pickPrimarySubscription,
                                       subscriptionProgressLabel, canDeleteClient, clientsToCSV)
/lib/admin/clients-queries.ts       — getClientsList (una fila por cliente) + getClientDetail (6 tabs)
/lib/admin/date-helpers.ts          — monthKey/monthLabel/dayLabel (compartido con el portal)
/lib/admin/pagination.ts            — paginate<T> genérico (compartido clientes/pagos)
/lib/admin/payment-status.ts        — STATUS_LABEL de invoices (compartido dashboard/pagos)
/lib/admin/finance-helpers.ts (+)   — PaymentRow + filterPaymentsByStatus (TDD)
/lib/admin/finance-queries.ts (+)   — getAllPayments
/lib/admin/onboarding-helpers.ts    — validateQuestion/reindexOrder + tipos (TDD)
/lib/admin/onboardingActions.ts     — saveQuestion/reorderQuestions/setQuestionActive (server actions)
/components/admin/ClientsTable.tsx · ClientDetailTabs.tsx · ClientPhotosTab.tsx — lista + ficha + fotos
/components/admin/PaymentsTable.tsx — listado de pagos (filtro estado + paginación)
/components/admin/OnboardingBuilder.tsx · OnboardingQuestionEditor.tsx — constructor + modal
/app/admin/clients/page.tsx · /clients/[clientId]/page.tsx · /payments/page.tsx · /onboarding-settings/page.tsx
/app/api/admin/clients/[clientId]/route.ts (+ /photos/[photoId]/route.ts) — borrado de cliente y fotos
/lib/auth/phone.ts                  — normalizePhone/validatePhone (registro, TDD)
/components/auth/RegisterForm.tsx (+) — campo Núm. Celular obligatorio (con lada) → signUp metadata
/supabase/migrations/008_handle_new_user_phone.sql — handle_new_user copia phone a profiles.phone. APLICADA.
/lib/admin/auth.ts                  — requireAdmin/requireAdminPage (+ decideAdminAccess puro). Guard de rol admin (DEF-1)
/lib/content/subscription-access.ts — ACCESS_STATES (active/trialing/past_due) + subscriptionGrantsAccess (SUB-1)
/lib/admin/content-validation.ts    — validateDayInput/validateBlock/validatePillarInput (zod, INP-2)
/lib/admin/sanitize-html.ts         — sanitizeRichText (whitelist Tiptap, INP-2)
/components/portal/PaymentPendingBanner.tsx — banner past_due con CTA WhatsApp (SUB-1)
/supabase/migrations/009_security_hardening.sql — with check RLS + search_path is_admin + phone normalizado en trigger. APLICADA y verificada.
-- Sub-bloque B2 — /portal/settings completo (merge 4271c85):
/lib/portal/settingsActions.ts      — updateAccount + updatePassword (server actions; identidad de getUser,
                                       contraseña actual re-verificada con cliente stateless sin cookies)
/lib/portal/account-queries.ts      — getAccountData (perfil+suscripción+invoices, RLS dueño) + mapSubscription/
                                       mapInvoices/progressLabel (puras, TDD)
/lib/portal/avatar-validation.ts    — validateAvatarUpload + avatarExtFor (puro, TDD)
/lib/portal/photo-compress.ts (+)   — compressImage ahora acepta maxDimension (avatar pasa 800; default 1280)
/app/api/portal/avatar/route.ts     — POST subir avatar (bucket público 'avatars', service-role, upsert, URL cache-busted)
/components/portal/settings/*       — ProfileHeader · AvatarUpload · AccountForm · PasswordForm · SecuritySection
                                       · SubscriptionCard ("Mes X de Y") · PaymentHistory (paginación 10/página)
/app/portal/settings/page.tsx (+)   — Server Component: header + 6 secciones (Next 14 searchParams plano)
/supabase/migrations/010_avatars_bucket.sql — bucket público 'avatars' + policy avatars_public_read. APLICADA y verificada.
-- CRUD de Series — /admin/content/[programId] (HEAD d2b3d70, SIN migración):
/lib/admin/seriesActions.ts         — "use server" · createSeries (INSERT + variant_series_map; 23505→inline) /
                                       updateSeries (UPDATE + DELETE/INSERT map; guard variantIds.length>0) /
                                       deleteSeries (borra variant_series_map PRIMERO, luego program_series;
                                       FK sin CASCADE); todas requieren requireAdmin + revalidatePath
/lib/admin/queries.ts (+)           — getAdminProgram ahora retorna { program, series, variants } donde
                                       cada serie incluye variantIds[]; guard seriesIds.length>0 antes de .in()
/components/admin/SeriesFormModal.tsx — "use client" · modal crear/editar: Mes#(create-only), Título,
                                       Descripción, Publicado(edit-only), checkboxes de variantes;
                                       error 23505 inline bajo Mes# con borde rojo; import type AdminVariant/
                                       AdminSeries (type-only import para evitar server-only en cliente)
/components/admin/SeriesDeleteDialog.tsx — "use client" · confirmación cascade: "días, bloques y pilares
                                       se eliminarán permanentemente"; botones Cancelar/Eliminar(rojo)
/components/admin/NewSeriesButton.tsx — "use client" · mantiene page.tsx como Server Component; abre
                                       SeriesFormModal en mode="create"
/components/admin/SeriesAccordion.tsx (+) — header convertido de <button> a <div> (HTML: no anidar buttons);
                                       menú ⋯ (useRef+useEffect click-outside, patrón DayCellMenu);
                                       dropdown "Editar"/"Eliminar"; modales montados en Fragment fuera del card

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. VARIABLES DE ENTORNO REQUERIDAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          (solo servidor)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY                      (prod: en Vercel; VACÍA en .env.local local → email no-op en dev)
RESEND_FROM_EMAIL=no-reply@auramaristany.com  (dev sin dominio verificado: onboarding@resend.dev)
NEXT_PUBLIC_AURA_WHATSAPP           (Fase 4: número de Aura, internacional solo dígitos; demo: 525512620404)
CRON_SECRET                         (Fase 4: secreto del Vercel Cron de retención; ya seteado en Vercel prod)
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com
DEV_DATE=YYYY-MM-DD                 (solo dev, server-only, gitignored; NO se puso en Vercel)

  Demo en Vercel (Production, 16-jun): las 11 vars están seteadas vía `vercel env add`. Stripe en
  TEST (sk_test/pk_test) por ser demo; STRIPE_WEBHOOK_SECRET = del endpoint test we_1Tj1aZ…; NO se
  copió DEV_DATE. Env vars de Preview pendientes (el CLI pide rama interactiva; se harán al crear la
  1ª rama de dev). Al pasar a LIVE: flip de keys Stripe a sk_live/pk_live + nuevo webhook live + secret.

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

  ✓ FASE 2 — CONTENIDO (COMPLETADA y mergeada a main, merge cc33f89)

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
      - Fotos: bucket privado 'progress' + signed URLs (600s desde STG-2; era 1h), grid 3 col,
        filtro por mes, subir con comentario opcional + compresión cliente
        (1280px, JPEG), visor con navegación + borrar. SIN métricas corporales.
    ✓ /portal/history/[logId]: detalle read-only (reusa BlockView con prop
      loggedExercises; ExerciseListLogged muestra valores por serie). Badge 📅.
    ✓ Límites de fotos: 5MB/archivo, máx 250 (badge [N/250]), reducción a 1280px.
    ✓ lib/content/history.ts (getHistoryList/getPerformanceData/getHistoryLog) +
      history-helpers.ts (puras, TDD). Endpoints propios del cliente:
      POST/DELETE /api/portal/photos.
    ✓ Migración 005_progress_photos.sql: bucket privado + RLS de Storage por
      prefijo {profile_id}/ + columna caption. APLICADA en Supabase (ver abajo).
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
    Follow-ups Fase 3: ✓ types.ts completado + `as any` quitados (C+D, b32f0c5); ✓ UI admin para
    eliminar fotos de clientas (sub-bloque 1, ficha de cliente). Pendientes: tope de 250 fotos no es
    race-safe (aceptable single-user); notas de admin sobre el registro del día (diferido, evaluar luego).

  ✓ FASE 4 — MENSAJERÍA (COMPLETA y MERGEADA A MAIN, merge dbdb432; migr. 006 aplicada; 2 smokes OK)
    Spec: docs/superpowers/specs/2026-06-09-fase-4-mensajeria-design.md
    Plan: docs/superpowers/plans/2026-06-09-fase-4-mensajeria.md
    Gates: vitest 102/102, tsc/lint/build OK. Review final sin bloqueantes.
    ✓ Mensajería in-app unidireccional Aura→clientas (individual + broadcast por
      programa/variante o "todas las activas"), modelo snapshot (expande a
      message_recipients al enviar; sin broadcast_filter).
      - Admin /admin/messages: composer + enviados ("leídos de N").
        lib/admin/messageActions.ts (sendMessage, cliente admin-context con RLS),
        getActiveSubscriberRows/getSentMessages, message-helpers.ts (puras, TDD).
      - Portal /portal/messages + /[id] read-only (marca read_at al abrir, 404 si
        no es suya). Badge de no-leídos en PortalNav (conteo server en layout).
        lib/content/messages.ts + lib/portal/messageActions.ts.
    ✓ Email lib/email/ (Resend + React Email): no-op sin RESEND_API_KEY, best-effort
      (nunca rompe webhook/envío), broadcast en batch ≤100. Plantillas con branding.
    ✓ Emails de ciclo de vida en webhooks (stripe-handlers.ts): bienvenida
      (checkout.completed), pago fallido (payment_failed), cancelación (sub.deleted).
      Recibo invoice.paid OFF (Stripe ya envía). Recordatorio pre-cobro → Stripe.
    ✓ WhatsApp: botón portal→Aura y admin→clienta (wa.me). Env NEXT_PUBLIC_AURA_WHATSAPP
      (prueba 525512620404; cambiar al de Aura en prod).
    ✓ Drift de SPEC §messages corregido (tabla real: subject NOT NULL; sin
      recipient_id/broadcast_filter; message_recipients.recipient_id, sin created_at/unique).
    ✓ Migración 006_messaging.sql aplicada en Supabase (policy SELECT de messages
      para clientas + UPDATE de read_at por la dueña + índices). 2 rondas de smoke
      OK. Mergeada a main (dbdb432).
    ✓ Ajustes post-smoke (1ra ronda):
      - Badge de no-leídos ahora se limpia al abrir el mensaje: markMessageRead corre
        en cliente (MarkReadOnView) + revalidatePath('/portal','layout') + router.refresh().
      - Quitado el emoji del texto pre-llenado de WhatsApp (se veía roto).
      - Admin: tarjeta de enviado clicable → detalle read-only con destinatarias y
        quién leyó; botones Clonar para reenviar (pre-llena composer) y Eliminar
        (borra message + message_recipients → también de la bandeja de las clientas;
        con confirmación). getSentMessageDetail/deleteMessage en messageActions.ts.
    Follow-ups Fase 4: CSV export de clientas → Fase 6 (newsletter/win-back de
      no-activas, NO olvidar); pedir TELÉFONO en onboarding/checkout para que el botón
      WhatsApp del admin sea útil (hoy profiles.phone casi siempre null → no aparece);
      RESEND no conectado en pruebas (poner API key válida + RESEND_FROM_EMAIL=
      onboarding@resend.dev; verificar dominio = prerequisito de lanzamiento);
      getSentMessages carga todos los message_recipients (escala, ok por ahora);
      Zapier on-subscribe diferido.
    ✓ Retención: cron de Vercel listo-pero-inactivo (corre al desplegar):
      app/api/cron/purge-messages (GET, service role, borra mensajes + recipients
      con >180 días; protegido por Authorization: Bearer CRON_SECRET) + vercel.json
      (schedule diario 3am). PENDIENTE en deploy: setear CRON_SECRET en env de Vercel.

  ✓ FASE 5 — DASHBOARD FINANCIERO (COMPLETA y MERGEADA A MAIN, merge a9ecb32)
    Spec: docs/superpowers/specs/2026-06-10-fase-5-financiero-design.md
    Plan: docs/superpowers/plans/2026-06-10-fase-5-financiero.md
    Gates: vitest 116/116, tsc limpio. Review holístico sin bloqueantes. E2E validado
    con 2 cuentas reales (MRR/ingresos cuadran).
    ✓ /admin/dashboard (antes stub) con:
      - KPIs: MRR ("*Estimado" = suscripciones active × program_variants.price_mxn,
        predictivo, SIN badge delta); total activas; "Renuevan este mes" (vencen en
        ≤30 días + monto sumado); "Requieren atención" (conteo past_due → /admin/clients).
      - Ingresos por mes: barras Recharts, ventana fija 12 meses (invoices.amount_paid
        por invoice_date — real cobrado, distinto del MRR a propósito).
      - Clientes por VARIANTE: barras horizontales (conteo de activas por variante).
      - Ingresos por programa: donut. Pagos recientes: tabla últimas 10 de invoices.
    ✓ Arquitectura 3 capas: finance-helpers.ts (puras, TDD) → finance-queries.ts
      (server-only, RLS admin is_admin()) → page.tsx (Server Component) + 2 charts client.
    ✓ Bug corregido: el PRIMER pago (billing_reason='subscription_create') NO se
      registraba en invoices (recordInvoice se llamaba sin subscriptionDbId y retornaba).
      Fix: busca la sub por stripe_subscription_id y registra el invoice + test.
    ✓ Backfill: scripts/backfill-first-invoices.ts (idempotente vía stripe_invoice_id
      unique). EJECUTADO contra datos reales (2 pagos $999 insertados).
    Decisiones de scope (brainstorm): SOLO el dashboard. Diferido a Fase 6:
      /admin/clients + ficha individual, CSV export de clientas, página /admin/payments
      con botón "Ver todos". Sin badge delta en MRR (no hay snapshots históricos).
    Ajustes post-validación del usuario: fecha "Junio de 2026" (capitaliza inicial en
      JS, sin text-transform); KPI MRR subtítulo "*Estimado" en cursiva; clientes
      agrupados por VARIANTE (no por programa). formatMXN usa currencyDisplay
      "narrowSymbol" (robusto ante ICU de Vercel); badge "Pagado" usa token --exito.

  ✓ FASE 6 — PULIDO + LAUNCH (EN CURSO, en main — detalle por sub-bloque en sección 11)
    ✓ Sub-bloque 1: Gestión de Clientes (merge 0d23c5e) — /admin/clients lista + ficha 6 tabs
      + borrado total de cliente (migración 007 ON DELETE CASCADE, aplicada y verificada). 142 tests.
    ✓ Sub-bloque 3: Página de Pagos (merge d52f224) — /admin/payments + "Ver todos" + LENGUAJE
      NEUTRO ('cliente') en toda la UI. Extrae paginate/STATUS_LABEL a módulos compartidos. 144 tests.
    ✓ Sub-bloque 4b: Constructor de Onboarding (merge 9477a8c) — /admin/onboarding-settings
      (CRUD de onboarding_questions; sin migración). 151 tests.
    ✓ Sub-bloque 4a: Núm. Celular en /auth/register (merge bdb4e83) — campo obligatorio con lada
      (lib/auth/phone, TDD) → migración 008 (handle_new_user copia phone a profiles.phone, aplicada).
      Activa el botón WhatsApp admin→cliente. 159 tests.
    ✓ Sub-bloque A: Auditoría de seguridad + ciclo de corrección (merge bb05894) — reporte read-only
      (0 críticos, docs/superpowers/audits/) → corregidos 5 medios + bonus: DEF-1 (requireAdmin/
      requireAdminPage uniforme), SUB-1 (acceso = active/trialing/past_due + banner WhatsApp; pilares
      respeta ACCESS_STATES), INP-2 (validación zod + sanitize-html), INP-3 (msg genérico + phone
      normalizado), RLS-1/2+HYG-1 (migración 009). + G3 (redirect /auth con sesión). 195 tests.
    ✓ Sub-bloque B2: /portal/settings completo (merge 4271c85) — pantalla "Mi cuenta": edición nombre/
      teléfono + contraseña (server actions, identidad de getUser INP-4, contraseña actual re-verificada
      sin tocar sesión, email solo-lectura), foto de perfil (bucket público 'avatars', comprimida a ≤800px,
      iniciales de respaldo), ficha de suscripción con barra "Mes X de Y", historial de pagos paginado
      10/página (lectura vía RLS de dueño). Migración 010 (bucket avatars) aplicada. 216 tests.
    ✓ Sub-bloque C+D: pulido auditoría + limpieza de tipos (merge b32f0c5, SIN migración) — 8 bajos
      cerrados (STG-2 signed URLs 600s; INP-5 tope 200/5000 sendMessage; EDGE-3 getUTCDay; MW-3 matcher
      excluye webhooks/cron con literal inline; EDGE-5 progress deriva subscriptionId del server; INP-1
      logAndGeneric; SVC-2 checkout RLS-aware; INP-4 onboarding server action) + limpieza (types.ts a mano,
      0 casts injustificados, Relationships:[] + "trialing"; try/catch retrieve re-lanza; formatDate
      unificado; tests cloneDay/cloneWeek) + bonus (fix BILLING_LABELS, dayLabel timestamptz, fix
      pre-existente router.refresh() tras guardar progreso en /portal/today). 247 tests.
    ✓ CRUD de Series en admin (HEAD d2b3d70, SIN migración): botón "Nueva serie" habilitado en
      /admin/content/[programId]; 3 server actions en lib/admin/seriesActions.ts (createSeries/
      updateSeries/deleteSeries, con requireAdmin + revalidatePath); SeriesFormModal (crear: Mes#/
      título/descripción/variantes checkboxes; editar: +published; error 23505 inline); SeriesDeleteDialog
      (cascade warning modal); NewSeriesButton (client component, mantiene page.tsx Server Component);
      SeriesAccordion reescrito: header <div> (no anidar <button>), menú ⋯ (click-outside patrón
      DayCellMenu), modales en Fragment fuera del card. getAdminProgram devuelve variants[] + variantIds[]
      por serie (guard seriesIds.length>0 antes de .in()). DELETE borra variant_series_map primero (FK
      sin CASCADE). 252/252 tests, smoke OK (crear/editar/publicar/mes-duplicado/eliminar). 10 commits.
    Specs/planes en docs/superpowers/ (gestion-clientes / admin-payments / onboarding-builder /
    telefono-registro / auditoria-seguridad / fixes-seguridad / 2026-06-13-b2-portal-settings /
    2026-06-15-fase6-cd-pulido-limpieza / 2026-06-16-series-crud-admin).

PENDIENTE (Fase 6):
  ✓ BUG G4 RESUELTO (merge 1e838d7): invoice.paid llega ~1s antes que checkout.session.completed
    (único creador de la fila de sub) → invoice descartado. Fix: registrar el primer invoice en
    handleCheckoutCompleted (expand latest_invoice) + recordInvoice idempotente (upsert). Backfill
    de 2 subs huérfanas aplicado. Smoke OK.
  ✓ B1 Logout en UI MERGEADO (0dde433): LogoutButton en sidebar admin (quitado link roto
    "Ver portal de cliente") + /portal/settings MÍNIMO (datos de cuenta solo-lectura + logout,
    arregla la pestaña Configuración que era 404). Reusa components/auth/LogoutButton.tsx.
  ✓ B2 /portal/settings COMPLETO MERGEADO (4271c85): "Mi cuenta" con edición nombre/teléfono +
    contraseña + foto de perfil (bucket público 'avatars', ≤800px) + ficha de suscripción ("Mes X de Y")
    + historial de pagos paginado. Migración 010 aplicada. 216 tests, smoke+re-smoke OK.
  ✓ C+D MERGEADO (b32f0c5): 8 bajos de auditoría (INP-1, EDGE-5, EDGE-3, MW-3, SVC-2, STG-2, INP-4, INP-5)
    + limpieza de tipos (types.ts a mano, 0 casts injustificados; try/catch retrieve re-lanza; formatDate
    unificado; tests cloneDay/cloneWeek). 247 tests.
  ✓ CRUD de Series COMPLETO (HEAD d2b3d70, 10 commits, SIN migración): botón "Nueva serie" funcional;
    createSeries/updateSeries/deleteSeries; SeriesFormModal + SeriesDeleteDialog + NewSeriesButton;
    SeriesAccordion con menú ⋯; getAdminProgram devuelve variants[] + variantIds[]. 252 tests, smoke OK.
  ✓ DECISIONES DE AURA: P5 dominio confirmado (auramaristany.com email + app.auramaristany.com app,
    ya en Vercel). P1 precios: Aura quiere ver el demo funcionando ANTES de definir precios → demo
    sale en Stripe TEST; precios reales + Stripe live = trabajo futuro antes del lanzamiento.
  ✓ A2 Resend + confirmación de email CONFIGURADO (dominio verificado, SMTP Supabase, Confirm email).
  ✓ A3 Deploy a Vercel COMPLETO (demo en vivo en https://app.auramaristany.com, Stripe test, webhook
    test, GitHub conectado, datos demo cargados). Verificado: /auth/login 200, rutas protegidas
    redirigen, middleware OK.
  ○ Task 5 — Smoke E2E en producción CON AURA (SIGUIENTE): login admin demo (hola@auramaristany.com/
    09876543) + cliente demo (gaby.torres@test.aura.mx/12345678) + registro real → confirmación →
    onboarding → checkout test (4242 4242 4242 4242) → webhook crea sub.
  ○ Correcciones menores detectadas por el usuario en la verificación de navegador (pendientes de
    detallar/implementar).
  ○ ANTES DE LANZAR (futuro): Stripe LIVE + precios reales de Aura (crear 10 Prices live + actualizar
    program_variants + flip de keys + webhook live); WhatsApp real de Aura; limpieza de datos de
    clientes demo (conservando admin y programas/series); env vars de Preview en Vercel; decidir si
    se construye UI de admin para gestión de planes/precios o se mantiene script+SQL.
  ○ Registrado para después (fuera de scope C+D): saveBlocks/savePillarBlocks no transaccionales.
  ○ Setup local: correr `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
    para probar checkout (ver sección 12).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. FASES DE DESARROLLO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fase 0 — Fundación         (sem 1-2)   Next.js + Supabase + Stripe test + Vercel  ✓ COMPLETADA
Fase 1 — Suscripción MVP   (sem 3-5)   Quiz→pago→onboarding→portal básico          ✓ COMPLETADA
Fase 2 — Contenido         (sem 6-9)   CMS grilla semanal + portal del día + progreso  ✓ COMPLETADA
  ✓ Sub A: portal/today funcional     ✓ Sub B: UI/UX portal
  ✓ Sub C: Admin layout + sidebar     ✓ Sub D: CMS overview + grilla semanal
  ✓ Sub E: Editor de día             ✓ Sub F: Gestión de días + Pilares
  ✓ Ronda de ajustes post-smoke (rediseño editor + fixes) — FASE 2 COMPLETADA
Fase 3 — Historial         (sem 10-11) Gráficas desempeño + fotos + historial de días  ✓ COMPLETADA
Fase 4 — Mensajería        (sem 12)    Comunicación Aura→clientas + email + WhatsApp  ✓ COMPLETADA (merge dbdb432)
Fase 5 — Financiero        (sem 13)    Dashboard MRR e ingresos                      ✓ COMPLETADA (merge a9ecb32)
Fase 6 — Pulido + Launch   (sem 14-15) Edge cases + auditoría seguridad + producción  ← EN CURSO
  ✓ Sub-bloque 1: Gestión de Clientes (merge 0d23c5e) — /admin/clients lista (búsqueda,
    filtros programa|estado, paginación 10, CSV export) + ficha 6 tabs (Resumen, Onboarding,
    Progreso, Fotos con borrado admin, Pagos, Mensajes+WhatsApp) + borrado total de clienta
    (guard de sub activa → 409, no toca Stripe; cascade vía migración 007 ON DELETE CASCADE,
    APLICADA y verificada). TDD en helpers (23 tests), 142/142, smoke E2E validado.
  ✓ Sub-bloque 3: Página de Pagos (merge d52f224) — /admin/payments (listado completo de invoices,
    filtro por estado, paginación 10, cliente→ficha, "← Dashboard") + enlace "Ver todos →" en el
    dashboard. Extrae paginate y STATUS_LABEL a módulos compartidos. Incluye pasada de LENGUAJE
    NEUTRO ('clienta(s)' → 'cliente(s)' en toda la UI). 144/144 tests, build verde, smoke validado.
  ✓ Sub-bloque 4b: Constructor de Onboarding (merge 9477a8c) — /admin/onboarding-settings: admin CRUD
    sobre onboarding_questions (crear/editar modal 4 tipos + opciones, reordenar drag dnd-kit,
    activar/desactivar — solo desactivar). Helpers TDD + server actions (RLS admin, sin migración).
    151/151 tests, build verde, smoke validado.
  ✓ Sub-bloque 4a: Núm. Celular en registro (merge bdb4e83) — campo obligatorio con lada de país en
    /auth/register (lib/auth/phone validatePhone, 11-15 dígitos, TDD) → signUp metadata → migración 008
    (handle_new_user copia phone a profiles.phone, APLICADA y verificada end-to-end). Activa el botón
    WhatsApp admin→cliente. 159/159 tests.
  ✓ Sub-bloque A: Auditoría de seguridad + ciclo de corrección (merge bb05894) — reporte read-only
    (4 auditores paralelos, 0 críticos) → corregidos 5 medios + bonus: DEF-1 (requireAdmin/
    requireAdminPage en lib/admin/auth.ts), SUB-1 (subscriptionGrantsAccess = active/trialing/past_due
    en middleware/getTodayContent/getPerformanceData/pillars + banner WhatsApp), INP-2 (validación zod
    + sanitize-html), INP-3 (msg genérico registro + phone normalizado), RLS-1/2+HYG-1 (migración 009).
    + G3 (autenticado no puede re-login en /auth). 195/195 tests, build verde, smoke+re-smoke OK.
  ✓ A1 (BUG G4) RESUELTO (merge 1e838d7): primer invoice se registra en checkout.session.completed
    (no en invoice.paid, que llega antes); recordInvoice idempotente; backfill aplicado. 197 tests.
  ✓ B1 Logout en UI MERGEADO (merge 0dde433): logout en sidebar admin + /portal/settings mínimo.
  ✓ B2 /portal/settings COMPLETO MERGEADO (merge 4271c85): "Mi cuenta" — edición nombre/teléfono +
    contraseña + avatar (bucket público, ≤800px) + ficha de suscripción ("Mes X de Y") + historial de
    pagos paginado. Migración 010 (bucket avatars) aplicada y verificada. 216/216 tests.
  ✓ C+D pulido auditoría + limpieza tipos MERGEADO (merge b32f0c5, SIN migración): 8 bajos cerrados
    (STG-2/INP-5/EDGE-3/MW-3/EDGE-5/INP-1/SVC-2/INP-4) + types.ts a mano (0 casts injustificados) +
    try/catch retrieve (re-lanza) + formatDate unificado + tests cloneDay/cloneWeek + bonus
    (BILLING_LABELS, dayLabel timestamptz, fix pre-existente router.refresh() en /portal/today). 247/247 tests.
  ✓ CRUD de Series en admin COMPLETO (HEAD d2b3d70, SIN migración, 10 commits en main): Aura puede
    crear series (Mes#, título, descripción, variantes), editar (+ published) y eliminar (cascade
    warning) desde /admin/content/[programId]. Server actions lib/admin/seriesActions.ts. Menú ⋯ en
    SeriesAccordion (patrón DayCellMenu). Error 23505 (mes duplicado) inline. FK sin CASCADE → delete
    borra variant_series_map antes de program_series. 252/252 tests, smoke OK.
  ✓ DEMO EN LÍNEA (16-jun): app desplegada en https://app.auramaristany.com (Vercel Production, modo
    DEMO para feedback de Aura). A2 Resend+SMTP+Confirm email configurado; A3 deploy completo (repo
    privado bijeded/auramaristany conectado a Vercel project-a24no, 11 env vars Stripe TEST, webhook
    test we_1Tj1aZ…, seed demo cargado). seed-demo.ts reescrito aditivo+sin-secretos. Stripe en TEST
    (Aura quiere ver el demo antes de dar precios). Logins demo: admin hola@auramaristany.com/09876543,
    clientes /12345678.
  Pendiente: Task 5 smoke E2E con Aura; correcciones menores de la verificación de navegador; ANTES
    DE LANZAR → Stripe LIVE + precios reales, WhatsApp real, limpieza de datos demo, env Preview.
    Registrado para después: transaccionalidad de saveBlocks/savePillarBlocks.

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
    DECISIÓN DE AURA (16-jun): quiere ver el DEMO funcionando antes de definir precios. El demo sale
    en Stripe TEST con precios simulados ($999 MXN). Antes del lanzamiento real Aura dará los precios
    → se crean los Products/Prices en Stripe LIVE y se actualizan stripe_price_id/price_mxn en
    program_variants (vía scripts/seed-stripe.ts en live + SQL). NO hay UI de admin para planes/precios
    (decisión futura: mantener script+SQL o construir UI según necesidades de Aura).

P2: ¿Qué pasa en semanas 5 de un mes? (ver Limitaciones arriba)
    Opciones: a) descanso automático  b) repetir contenido semana 4
              c) Aura crea contenido para semana 5 opcional en el CMS

P3: ¿La clienta puede EDITAR un registro pasado desde /portal/history/[logId]?
    RESUELTO (Fase 3): el detalle es SOLO LECTURA. No se permite editar registros
    pasados. Si se quisiera, sería una decisión/feature posterior.

P4: ¿Cuáles son las preguntas del onboarding que Aura quiere hacer?
    INFRA LISTA (Fase 6 ✓): el constructor /admin/onboarding-settings ya permite a Aura
    crear/editar/reordenar/activar sus preguntas (4 tipos). Quedan las 3 seed de prueba
    (migración 002) hasta que Aura defina y cargue su set definitivo desde el admin.

P5: ¿El nombre de dominio ya está comprado? ¿app.auramaristany.com o similar?
    RESUELTO (16-jun): auramaristany.com comprado (DNS en IONOS). Email desde el dominio (Resend
    verificado, remitente no-reply@auramaristany.com); app en app.auramaristany.com (conectado a
    Vercel, sirviendo el demo). El apex auramaristany.com NO está apuntado a Vercel (irrelevante;
    solo se usa el subdominio app).

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
Estado: Fases 0–5 COMPLETAS y en main; Fase 6 EN CURSO (sub-bloques mergeados: 1 Gestión de Clientes
0d23c5e, 3 Página de Pagos d52f224, 4b Constructor de Onboarding 9477a8c, 4a Núm. Celular en registro
bdb4e83, A Auditoría de seguridad + ciclo de corrección bb05894, B2 /portal/settings completo 4271c85,
C+D pulido auditoría + limpieza de tipos b32f0c5, CRUD de Series en admin HEAD d2b3d70).
Migraciones 001–010 aplicadas (007 = ON DELETE CASCADE; 008 = phone; 009 = endurecimiento seguridad;
010 = bucket público avatars); backfill de invoices ejecutado; E2E validado. UI con lenguaje neutro
('cliente'). 252/252 tests. ✓ BUG G4 resuelto (1e838d7). ✓ B1 logout en UI mergeado (0dde433).
✓ B2 /portal/settings completo mergeado (4271c85). ✓ C+D pulido auditoría + limpieza tipos mergeado (b32f0c5).
✓ CRUD de Series en admin completo (HEAD d2b3d70, SIN migración, 10 commits).
✓ DEMO EN LÍNEA desplegado (16-jun): https://app.auramaristany.com (Vercel Production, Stripe TEST,
demo para feedback de Aura). A2 Resend+SMTP+Confirm email ✓. A3 deploy Vercel ✓ (repo privado
bijeded/auramaristany conectado, 11 env vars, webhook test, datos demo cargados). seed-demo.ts
reescrito aditivo+sin-secretos. Dominio (P5) y decisión de precios (P1: demo antes de precios) resueltos.
Pendiente Fase 6: Task 5 smoke E2E con Aura + correcciones menores de la verificación de navegador;
ANTES DE LANZAR → Stripe LIVE + precios reales, WhatsApp real, limpieza datos demo, env Preview.
Registrado para después: transaccionalidad de saveBlocks/savePillarBlocks.
Usar el flujo brainstorm → plan → ejecución (superpowers).
════════════════════════════════════════════════════════════════
