════════════════════════════════════════════════════════════════
DOCUMENTO DE TRASPASO — PLATAFORMA WEB AURA MARISTANY
Fecha: 4 de junio de 2026 · Estado: planificación completa, listo para desarrollo
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

exercises_done JSONB estructura:
  { "exercise-uuid": { "completed": true, "reps_done": 12,
                        "weight_kg": 15.0, "notes": "..." } }

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
/app/api/webhooks/stripe/route.ts   — ciclo de vida de suscripciones
/middleware.ts                      — protección por rol/suscripción/onboarding
/components/admin/DayEditor.tsx     — editor CMS de Aura
/components/portal/TodayView.tsx    — vista del día + progreso integrado

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

PENDIENTE (próximo paso — Fase 0):
  ○ Inicializar proyecto Next.js 14 + TypeScript + Tailwind + shadcn/ui
  ○ Configurar Supabase: migraciones SQL, Auth, Storage, RLS
  ○ Stripe test mode: crear 10 Products/Prices en MXN
  ○ Configurar Vercel + variables de entorno
  ○ Implementar login/logout funcional como primer entregable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. FASES DE DESARROLLO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fase 0 — Fundación         (sem 1-2)   Next.js + Supabase + Stripe test + Vercel
Fase 1 — Suscripción MVP   (sem 3-5)   Quiz→pago→onboarding→portal básico
Fase 2 — Contenido         (sem 6-9)   CMS grilla semanal + portal del día + progreso
Fase 3 — Historial         (sem 10-11) Gráficas desempeño + fotos + historial de días
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

MODELO SEMANAL — MESES DE 5 SEMANAS: El modelo actual asume 4 semanas por
mes. Si un período de pago cae en un mes con 5 lunes (por ejemplo), la
semana 5 no tiene contenido definido en la tabla. Decisión pendiente:
¿mostrar descanso, repetir semana 4, o agregar semana 5 al CMS?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. PREGUNTAS PENDIENTES (sin resolver)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

P1: ¿Cuáles son los precios exactos en MXN de cada variante?
    (Necesario antes de crear los Stripe Products/Prices)

P2: ¿Qué pasa en semanas 5 de un mes? (ver Limitaciones arriba)
    Opciones: a) descanso automático  b) repetir contenido semana 4
              c) Aura crea contenido para semana 5 opcional en el CMS

P3: ¿La clienta puede EDITAR un registro pasado desde /portal/history/[logId]?
    Hoy definido como solo lectura. Decisión pendiente si se quiere permitir
    correcciones posteriores.

P4: ¿Cuáles son las preguntas del onboarding que Aura quiere hacer?
    El sistema está preparado para cualquier set de preguntas (Aura las
    configura desde el admin), pero sería útil tenerlas para poblar datos
    de prueba en Fase 1.

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
Para continuar: leer SPEC.md completo, revisar los JSX del diseño,
y comenzar con Fase 0 (inicializar Next.js 14).
════════════════════════════════════════════════════════════════
