# Especificación Técnica — Plataforma Web Aura Maristany

## Visión General

Plataforma web para Aura Maristany, coach de salud integral especializada en mujeres 40+. Permite vender, entregar y gestionar programas de entrenamiento, alimentación y bienestar mediante suscripciones mensuales recurrentes.

- **Sitio de marketing (WordPress):** https://demo.studiosdmm.com.mx/aura/
- **App web:** subdominio independiente, ej. `app.auramaristany.com`
- **Idioma:** español (México) · **Moneda:** MXN

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| Base de datos + Auth | Supabase (PostgreSQL + RLS + Storage + Real-time) |
| Pagos | Stripe (suscripciones MXN) |
| UI | shadcn/ui + Tailwind CSS |
| Editor de contenido | Tiptap (MIT, sin costo) |
| Email transaccional | Resend + React Email |
| Deploy | Vercel + Supabase Cloud |
| Gráficas | Recharts |
| Drag & drop | dnd-kit |
| Video embed | react-lite-youtube-embed |

---

## Identidad Visual

| Elemento | Valor |
|---------|-------|
| Tipografía encabezados/botones | **Oswald** (Google Fonts) |
| Tipografía texto | **Hind** (Google Fonts) |
| Color primario | `#eddbd8` (rosa polvoso cálido) |
| Color secundario | `#9982f4` (lavanda) |
| Base | Negro y blanco |
| Diseño | Mobile-first, UX simple para público 40+ |

---

## Flujo General del Cliente

```
Sitio WordPress
  └─ Cuestionario de nivel/perfil
       └─ Redirige a: https://app.auramaristany.com/checkout/[variantSlug]
            └─ Registro / Login en la app
                 └─ Stripe Checkout (pago)
                      └─ Cuestionario de onboarding (dentro de la app)
                           └─ /portal/today (Día 1)
```

**El cliente nunca elige su variante libremente.** El cuestionario en WordPress determina la variante y redirige al URL de checkout correcto.

---

## Programas

### 1. CuarentaMás — 6 meses, facturación mensual

| slug | Nivel | Tiempo |
|-----|-------|--------|
| `cuarenta-mas-principiante-poco` | Principiante | < 45 min |
| `cuarenta-mas-principiante-suf` | Principiante | 45–80 min |
| `cuarenta-mas-intermedio-poco` | Intermedio | < 45 min |
| `cuarenta-mas-intermedio-suf` | Intermedio | 45–80 min |
| `cuarenta-mas-avanzado-suf` | Avanzado | 45–80 min |

- **Acceso:** solo hasta el día actual (día N = días desde inscripción + 1). Sin acceso a días futuros ni al mes siguiente antes de que empiece
- **Al mes 6:** `completed_at` se establece → desbloquea CuarentaMás Extra Intermedio

### 2. CuarentaMás Extra — variantes con prerequisitos

**Progresión:**
```
CuarentaMás Principiante → Extra Intermedio (6 meses) → Extra Avanzado (indefinido)
CuarentaMás Intermedio/Avanzado ──────────────────────→ Extra Avanzado (acceso directo)
```

| slug | Duración | Prerequisito |
|------|----------|--------------|
| `cuarenta-mas-extra-intermedio` | 6 meses fijos | CuarentaMás completado (solo Principiante) |
| `cuarenta-mas-extra-avanzado` | Indefinida (mensual rolling) | Extra Intermedio completado **O** CuarentaMás Intermedio/Avanzado completado |

- **Acceso:** solo el mes actual (`months_elapsed`). No hay acceso a meses futuros, pero si a anteriores.
- **Dentro del mes:** solo hasta el día actual
- **Contenido:** biblioteca de planes mensuales reutilizables creados por Aura. El sistema asigna el plan del mes N automáticamente

### 3. Strong & Fit — suscripción mensual indefinida, acumulativa

| slug | Nivel |
|------|-------|
| `strong-fit-principiante` | Principiante |
| `strong-fit-intermedio` | Intermedio |
| `strong-fit-avanzado` | Avanzado |

- **Acceso acumulativo:** mes N = Series 1 a N visibles
- **Serie más reciente:** solo hasta el día actual; series anteriores: acceso completo
- **Expansión:** Aura puede agregar nuevas series en cualquier momento

**Total Stripe Prices:** 5 (CuarentaMás) + 2 (Extra) + 3 (Strong & Fit) = **10 prices**

---

## Campo clave: `months_elapsed`

Almacenado en `subscriptions`. Se incrementa en 1 por cada `invoice.paid` exitoso de Stripe (no se computa desde fechas). Es el árbitro inmutable de qué contenido puede ver cada cliente.

El contenido está organizado por **semanas** dentro de cada mes (no días secuenciales). La lógica de acceso usa:

```
semana_actual    = floor((today - current_period_start).days / 7) + 1   -- valor 1..4
día_de_hoy       = nombre del día en español ('lunes'..'domingo')
```

| Programa | Lógica de acceso |
|---------|-----------------|
| CuarentaMás | Mes actual = `months_elapsed`. Acceso hasta `(semana_actual, día_de_hoy)` inclusive. Semanas y días anteriores: completos. |
| Extra | Serie única: `series_number = months_elapsed`. Mismo control semana/día. |
| Strong & Fit | Series accesibles: `series_number <= months_elapsed`. Solo la serie más reciente usa control semana/día; las anteriores son acceso completo. |

**Historial:** una vez que una semana completa ha pasado (o el mes anterior), el contenido queda accesible permanentemente para que la clienta pueda revisar cualquier día pasado junto a su registro de progreso.

---

## Base de Datos — Esquema Completo

```sql
-- USUARIOS
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  stripe_customer_id TEXT UNIQUE,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ONBOARDING (cuestionario configurable por Aura)
CREATE TABLE onboarding_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'text' | 'number' | 'single_choice' | 'multi_choice'
  options JSONB,               -- ["Opción A", "Opción B"] para tipos choice
  is_required BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id),
  responses JSONB NOT NULL,    -- { "question_id": "respuesta" }
  completed_at TIMESTAMPTZ
);

-- PROGRAMAS
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  billing_model TEXT NOT NULL, -- 'fixed_term_monthly' | 'rolling_monthly'
  duration_months INT,         -- 6 para CuarentaMás, NULL para indefinidos
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE program_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  level TEXT,                  -- 'principiante' | 'intermedio' | 'avanzado'
  time_availability TEXT,      -- 'poco_tiempo' | 'tiempo_suficiente' | NULL
  stripe_price_id TEXT UNIQUE NOT NULL,
  price_mxn NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Prerequisitos con lógica OR (mismo grupo = AND; grupos distintos = OR)
CREATE TABLE program_variant_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_variant_id UUID REFERENCES program_variants(id),
  prerequisite_group INT NOT NULL,
  required_program_slug TEXT NOT NULL,
  required_variant_levels TEXT[],  -- NULL = cualquier nivel
  required_status TEXT DEFAULT 'completed'
);

-- CONTENIDO
CREATE TABLE program_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  series_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, series_number)
);

CREATE TABLE program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES program_series(id),
  week_number  INT  NOT NULL,  -- 1, 2, 3 o 4 (semana dentro del mes)
  day_of_week  TEXT NOT NULL,  -- 'lunes' | 'martes' | 'miercoles' | 'jueves'
                               -- | 'viernes' | 'sabado' | 'domingo'
  workout_focus TEXT,          -- "Enfoque": descriptor libre de la actividad
                               -- ('Tren Inferior', 'Protocolo Cardiovascular', 'Descanso', etc.)
  title TEXT NOT NULL,
  description TEXT,
  day_type TEXT DEFAULT 'workout', -- (v1.2: en desuso) El editor ya no expone selector de tipo.
                               -- Todos los días son "Actividad Física"; el descriptor es workout_focus.
                               -- Día de descanso = Aura crea un día con contenido de descanso.
                               -- La card genérica de descanso solo aparece si NO existe fila para hoy.
  duration_minutes INT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(series_id, week_number, day_of_week)
);

-- Ejemplo Mes 1 CuarentaMás:
--   (s1, 1, 'lunes',     'Tren Inferior', 'Estrategia Antisedentarismo', ...)
--   (s1, 1, 'martes',    'Tren Superior', 'Estrategia Antisedentarismo', ...)
--   (s1, 1, 'miércoles', 'Protocolo Cardiovascular', 'Estrategia Antisedentarismo', ...)
--   (s1, 1, 'jueves',    'Tren Inferior', 'Empuje — Pecho y Hombros', ...)
--   (s1, 1, 'viernes',   'Tren Superior', 'Estrategia Antisedentarismo', ...)
--   (s1, 1, 'sábado',    'Protocolo Cardiovascular', 'Estrategia Antisedentarismo', ...)
--   (s1, 2, 'lunes',     'Tren Inferior', 'Estrategia Antisedentarismo', ...)
--   (s1, 2, 'martes',    'Tren Superior', 'Estrategia Antisedentarismo', ...)
--   (s1, 2, 'miércoles', 'Protocolo Cardiovascular', 'Estrategia Antisedentarismo', ...)
--   -- domingo: sin fila → portal muestra card de descanso

CREATE TABLE program_day_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID REFERENCES program_days(id),
  block_type TEXT NOT NULL,    -- 'text' | 'youtube' | 'pdf' | 'image' | 'exercise_list' | 'cardio_zone2'
  sort_order INT NOT NULL,
  content JSONB NOT NULL,
  -- text:          { "html": "..." }
  -- youtube:       { "video_id": "...", "title": "..." }
  -- pdf:           { "storage_path": "...", "filename": "...", "label": "..." }
  -- image:         { "storage_path": "...", "alt": "..." }
  -- exercise_list: { "exercises": [{ "id": "uuid", "name": "...", "sets": 3,
  --                  "reps": "12", "rest_seconds": 60, "notes": "...",
  --                  "metrics": ["reps_done", "weight_kg"] }] }
  -- cardio_zone2:  {}  -- calculadora fija; la clienta ingresa su edad en el portal
  --                    -- y ve su rango Zona 2 = (220-edad)*0.60 a (220-edad)*0.70
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mapeo variante → series (permite reutilizar contenido entre variantes)
CREATE TABLE variant_series_map (
  program_variant_id UUID REFERENCES program_variants(id),
  series_id UUID REFERENCES program_series(id),
  PRIMARY KEY (program_variant_id, series_id)
);

-- PILARES MENSUALES (solo CuarentaMás/Extra; cambian por mes/serie, no por día)
-- Contenido paralelo a la actividad física: Alimentación con intención,
-- Autoconocimiento, Manejo de estrés/descanso/sueño, Respiraciones y suelo pélvico.
-- Reusan el mismo sistema de bloques (tablas espejo de program_days/program_day_blocks).
CREATE TABLE program_series_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES program_series(id) ON DELETE CASCADE,
  pillar_key TEXT NOT NULL,    -- 'alimentacion' | 'autoconocimiento' | 'estres_sueno' | 'respiraciones'
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(series_id, pillar_key)
);

CREATE TABLE program_pillar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id UUID REFERENCES program_series_pillars(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,    -- mismos tipos que program_day_blocks (incl. cardio_zone2)
  sort_order INT NOT NULL,
  content JSONB NOT NULL
);
-- Portal: /portal/pilares muestra los pilares publicados del mes actual
-- (months_elapsed → serie), solo para suscripciones CuarentaMás/Extra.

-- SUSCRIPCIONES
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  program_variant_id UUID REFERENCES program_variants(id),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,        -- 'active' | 'past_due' | 'canceled' | 'unpaid'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  months_elapsed INT DEFAULT 1,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,    -- se establece al mes 6 en CuarentaMás y Extra Intermedio
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auditoría de eventos de Stripe
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- SEGUIMIENTO DE PROGRESO
CREATE TABLE progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  subscription_id UUID REFERENCES subscriptions(id),
  program_day_id UUID REFERENCES program_days(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  exercises_done JSONB,
  -- { "exercise-uuid": { "completed": true,
  --                      "series": [{ "reps_done": 12, "weight_kg": 15.0 }, ...] } }
  -- (N objetos en series = N sets; campos null si no se llenaron)
  notes TEXT,                 -- ⚠ la columna se llama 'notes' (no 'general_notes').
                              -- El código lo expone como general_notes vía alias en el SELECT
                              -- (general_notes:notes) y escribe en 'notes' en el upsert.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, program_day_id) -- 1 registro por (clienta, día); el upsert usa este onConflict
);

CREATE TABLE body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  measured_at DATE NOT NULL,
  weight_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  hip_cm NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, measured_at)
);

CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  body_metrics_id UUID REFERENCES body_metrics(id), -- queda NULL (no se capturan métricas)
  storage_path TEXT NOT NULL,  -- bucket privado 'progress', prefijo {profile_id}/
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE, -- ⚠ la columna real es 'taken_at' (no 'photo_date')
  caption TEXT,                -- comentario opcional de la clienta (migración 005)
  -- angle TEXT existía en el plan original pero NO está en la tabla real; sin uso.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MENSAJERÍA
-- ⚠ DRIFT (corregido 9-jun-2026, pre-Fase 4): el bloque original de este SPEC
-- listaba columnas que NO existen en la tabla aplicada (migración 001). Lo de
-- abajo es el esquema REAL. El destino se modela SOLO vía message_recipients
-- (no hay recipient_id ni broadcast_filter en messages). Si la Fase 4 decide
-- agregar broadcast_filter/unique/created_at, será en una migración 006.
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,       -- ⚠ real: NOT NULL (el SPEC viejo lo daba nullable)
  body TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
  -- NO existe recipient_id ni broadcast_filter (el SPEC viejo los listaba).
);

CREATE TABLE message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id),
  recipient_id UUID REFERENCES profiles(id), -- ⚠ real: 'recipient_id' (no 'profile_id')
  read_at TIMESTAMPTZ          -- null = no leído
  -- NO existe created_at ni UNIQUE(message_id, recipient_id) declarado.
  -- (candidatos a migración 006 si se necesitan; decidir en el brainstorm de Fase 4.)
);
-- ⚠ RLS pendiente: en 001 NO hay policy de SELECT sobre `messages` para clientas
-- (solo messages_admin_write). La clienta necesita leer subject/body de los
-- mensajes donde tiene fila en message_recipients → agregar en migración 006.

-- FINANZAS
-- ⚠ DRIFT (corregido 9-jun-2026, pre-Fase 5): el bloque original listaba
-- amount_mxn/paid_at y invoice_date DATE, que NO coinciden con la tabla aplicada
-- (migración 001). Lo de abajo es el esquema REAL (lo que escribe recordInvoice en
-- lib/webhooks/stripe-handlers.ts). El dashboard financiero (Fase 5 ✓) lee
-- amount_paid + currency, e invoice_date es timestamptz. NO existe paid_at.
-- ✓ Fase 5: corregido el bug por el que el PRIMER pago (billing_reason=
-- 'subscription_create') no se registraba; backfill aplicado a los pagos previos.
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,  -- ⚠ real: 'amount_paid' (no 'amount_mxn')
  currency TEXT DEFAULT 'mxn',         -- ⚠ real: existe 'currency' (el SPEC viejo no lo tenía)
  status TEXT NOT NULL,        -- 'paid' | 'open' | 'void' | 'uncollectible'
  invoice_date TIMESTAMPTZ NOT NULL,   -- ⚠ real: timestamptz (no DATE)
  created_at TIMESTAMPTZ DEFAULT now()
  -- NO existe paid_at (el SPEC viejo lo listaba).
);
```

**Seguridad:** Row Level Security (RLS) en Supabase en todas las tablas. Clientes solo ven sus propios datos. Admins ven todo. La seguridad vive en la base de datos, no solo en la aplicación.

---

## Estructura de la Aplicación (App Router)

```
/app
  /(marketing)
    /checkout/[variantSlug]       ← landing de pago (viene del quiz de WordPress)

  /auth
    /login
    /register
    /callback
    /reset-password

  /onboarding
    /questionnaire                ← guard: suscripción activa + onboarding_completed=false

  /portal                         ← guard: suscripción activa + onboarding_completed=true
    /today                        ← contenido del día + progreso integrado (1 sola pantalla)
    /pilares                      ← pilares mensuales (gate CuarentaMás/Extra)
    /activando                    ← polling post-pago: espera webhook de Stripe antes de redirigir
    /sin-suscripcion              ← página de aterrizaje cuando no hay suscripción activa
    /history                      ← "Mi Progreso": tabs Desempeño (Recharts) + Fotos
    /history/[logId]              ← detalle de un día anterior: contenido + registro guardado (lectura)
    /messages                     ← bandeja read-only Aura→clienta (Fase 4) + WhatsApp a Aura
    /messages/[id]                ← detalle del mensaje (marca read_at) (Fase 4)
    /settings                     ← (pendiente)

  /admin                          ← guard: role='admin'
    /dashboard
    /clients/[clientId]
    /content/[programId]/series/[seriesId]/days/[dayId]
    /messages
    /onboarding-settings

  /api
    /webhooks/stripe
    /subscriptions/create-checkout
    /subscriptions/customer-portal
    /admin/upload                 ← upload admin a bucket público 'content'
    /portal/progress              ← upsert del registro del día (auto-guardado)
    /portal/photos                ← POST subir foto (bucket privado 'progress')
    /portal/photos/[id]           ← DELETE borrar foto propia
    /cron/purge-messages          ← (Fase 4) Vercel Cron: borra mensajes >180 días (Bearer CRON_SECRET)
```

> **Mensajería (Fase 4):** el envío (admin), marcar leído y eliminar usan **server actions**
> (`lib/admin/messageActions.ts`, `lib/portal/messageActions.ts`), no route handlers.

### Lógica de middleware (en orden)
1. No autenticado → `/auth/login`
2. Autenticado pero sin fila en `profiles` (`role=null`) → `/auth/login`
3. Sin suscripción activa → `/portal/sin-suscripcion` (excepto `/portal/activando` y `/portal/sin-suscripcion`, que son accesibles sin suscripción)
4. Suscripción activa + `onboarding_completed=false` → `/onboarding/questionnaire`
5. Admin visitando `/portal` → `/admin/dashboard`
6. Cliente visitando `/admin` → `/portal/today`

---

## Vista del Día con Progreso Integrado (`/portal/today`)

Una sola pantalla — sin navegación adicional para registrar progreso:

```
┌─────────────────────────────────────┐
│  Mes 1 · Semana 2          [Avatar] │
│  Miércoles 3 de junio               │
│  ████████████░░░░░  CuarentaMás     │
├─────────────────────────────────────┤
│  HOY · MIÉRCOLES                    │
│  Piernas y Glúteos                  │
│  [Tren Inferior]  (Enfoque)         │
│  ⏱ 40 minutos                       │
├─────────────────────────────────────┤
│  [▶ Video] (thumbnail propio + play)│
│  [Texto enriquecido]                │
├─────────────────────────────────────┤
│  EJERCICIOS DE HOY                  │
│  ☐ Sentadilla con mancuerna         │
│    Meta: 3×12 | Descanso: 60 seg   │
│    Reps completadas: [___]          │
│    Peso usado (kg): [___]           │
│    Notas: [________________]        │
│  ☐ Hip Thrust                       │
│    Meta: 3×15 | Descanso: 90 seg   │
│    ...                              │
│  Notas generales: [______________]  │
├─────────────────────────────────────┤
│  [PDF adjunto]                      │
├─────────────────────────────────────┤
│     [ Guardar mi progreso ]         │
└─────────────────────────────────────┘
```

El sistema determina el contenido a mostrar con:
```
contenido = program_days WHERE
  series_id   = serie del mes actual (months_elapsed)
  week_number = floor((today - current_period_start).days / 7) + 1
  day_of_week = nombre del día de hoy en español
```
Si no existe fila para ese `(week_number, day_of_week)` → mostrar card de descanso.

- El banner de progreso muestra "Mes N · Semana N" en lugar de "Día N de 180"
- El badge `workout_focus` ("Enfoque": "Tren Inferior", "Protocolo Cardiovascular", "Descanso", etc.) aparece como tag (ya no hay badge de tipo de día)
- Campos de progreso opcionales
- Guardado automático con debounce
- Si ya hay progreso registrado hoy, se muestran los valores previos
- Métricas de ejercicio extensibles: el campo `"metrics"` en el JSON del ejercicio define qué campos aparecen

---

## Historial / Mi Progreso (`/portal/history`)

> **Implementado en Fase 3 (v1.3).** La pantalla sigue el prototipo `client-progress.jsx`: **2 tabs (Desempeño · Fotos)**, no los 3 tabs que describía la v1.1. Las **métricas corporales** (peso/cintura/cadera) NO se piden ni registran; `body_metrics` queda sin captura. Detalle de día = **solo lectura** (resuelve P3).

La clienta puede ver su desempeño a lo largo del mes, revisar días pasados con su registro, y subir fotos de progreso privadas.

### Tab "Desempeño"

- **Gráficas (Recharts)** de las métricas de ejercicio (peso/reps/otras) **del mes corriente** (`log_date >= current_period_start`). Selector de ejercicio (pills) + **toggle de métrica dinámico** según el array `metrics` del ejercicio. **Sin** selector de periodo y **sin** stat cards.
- **Relación de ejercicios: por NOMBRE normalizado** (no por uuid), para conectar el mismo ejercicio a lo largo de los días aunque Aura cree cada día desde cero. Agregación por día: **peso = promedio de las series**, **reps = suma**.
- Debajo: lista **"Historial de ejercicios"** — cronológica (reciente primero) de los días con `progress_log`. Cada fila: fecha, título, `workout_focus` como tag, y `N/M` ejercicios completados. Click → `/portal/history/[logId]`.

### Tab "Fotos"

- Galería en **bucket privado de Storage (`progress`)** servida con **signed URLs** (TTL 1h). Grid de 3 columnas con **filtro por mes**.
- Subir foto: archivo/cámara + **comentario opcional** (no editable); fecha = hoy. **Compresión en cliente** a 1280px (lado mayor) + JPEG antes de subir. Límites: **5MB/archivo**, **máx 250 fotos** por clienta (badge `[N/250]`).
- Visor (lightbox) con navegación y **borrar** (solo la dueña; admin puede por RLS, sin UI aún).

### Vista de Detalle (`/portal/history/[logId]`)

Renderiza la misma estructura visual que `/portal/today` pero en **modo lectura** (reusa `BlockView` con la prop `loggedExercises`):
- Todos los bloques de contenido (texto, video, PDF, imagen, cardio_zone2) visibles normalmente
- Lista de ejercicios muestra los valores que la clienta registró (reps, peso por serie) pre-cargados y **no editables** (`ExerciseListLogged`), con ✓ si se marcó completo
- Notas generales del día visibles
- Badge "📅 {fecha del log}" en el encabezado (en lugar de "HOY")
- Sin botón de guardar
- Validación de pertenencia: el `logId` debe ser de la clienta autenticada (si no, 404)

---

## Panel de Administración

### Dashboard Financiero — `/admin/dashboard` (Fase 5 ✓ implementada)
- **KPIs:** MRR (suma de suscripciones `active` × `program_variants.price_mxn`; predictivo, etiquetado "*Estimado", sin badge delta), total suscripciones activas, "Renuevan este mes" (vencen en ≤30 días + monto), "Requieren atención" (conteo `past_due`, enlaza a `/admin/clients`).
- **Ingresos por mes:** gráfica de barras (Recharts), ventana fija de 12 meses (fuente: `invoices.amount_paid` agrupado por `invoice_date`, real cobrado — distinto del MRR a propósito).
- **Clientes por variante:** barras horizontales (conteo de activas por `program_variants.name`).
- **Ingresos por programa:** donut (`invoices.amount_paid` agrupado por programa).
- **Pagos recientes:** tabla (fecha, clienta, programa, monto, estado), últimas 10 filas de `invoices`. (Botón "Ver todos" + página de listado completo → Fase 6.)
- **Capa de datos:** `lib/admin/finance-helpers.ts` (funciones puras, TDD) + `lib/admin/finance-queries.ts` (server-only, RLS admin `is_admin()`). Fuente = tabla `invoices`, no Stripe API.

### Gestión de Clientes — `/admin/clients` (stub hoy → Fase 6)
- Lista con filtros: programa, estado de pago, fecha de inscripción
- Detalle: respuestas de onboarding, progreso de ejercicios, métricas corporales, pagos, mensajes
- CSV export de clientas (para newsletter/win-back de no-activas) — diferido aquí desde Fase 4.

### CMS de Contenido
- Navegación: Programa → Serie/Mes → Grilla semanal → Día
- **Vista de serie:** grilla 4 filas (semanas) × 7 columnas (días de la semana). Cada celda muestra el `workout_focus` del día o "—" si es descanso. Color por estado: publicado (lavanda), borrador (gris), vacío (blanco). Al hacer clic en una celda se abre el editor de ese día.
  ```
           Lun         Mar    Mié         Jue    Vie         Sáb    Dom
  Sem 1  [T.Inf ✓]   [—]   [T.Sup ✓]   [—]   [Full ✓]   [—]    [—]
  Sem 2  [T.Inf ✓]   [—]   [T.Sup ✓]   [—]   [Full ✓]   [—]    [—]
  Sem 3  [T.Inf]     [—]   [T.Sup]     [—]   [Full]     [—]    [—]
  Sem 4  [vacío]     [—]   [vacío]     [—]   [vacío]    [—]    [—]
  ```
- Al crear/editar un día, Aura define: semana, día de semana, `workout_focus` (Enfoque, texto libre), título, duración (sin selector de tipo — todos son "Actividad Física")
- Editor de bloques arrastrables (dnd-kit):
  - **Texto:** editor Tiptap con bold, italic, encabezados (H2/H3/H4), listas (UL y OL)
  - **YouTube:** pegar URL → extrae video_id → preview del embed
  - **PDF:** upload a Supabase Storage → guarda storage_path
  - **Imagen:** upload a Supabase Storage + alt text + preview
  - **Lista de ejercicios:** nombre, series×reps, descanso, notas, URL de video demo por ejercicio, y qué métricas registrará la cliente (reps / peso)
  - **Calculadora Cardio Zona 2:** bloque fijo (la clienta ingresa su edad en el portal)
- Estado por día como selector Publicado / Borrador (y por serie)
- Timeline expandible para Extra y Strong & Fit (misma grilla por cada serie)

### Mensajería
- Individual (a una cliente) o broadcast (filtrado por programa)
- Historial de enviados
- Notificación por email al destinatario (Resend)

### Configuración de Onboarding
- Crear, editar, reordenar preguntas del cuestionario
- Tipos: texto libre, número, selección única, selección múltiple

---

## Integración Stripe

### Webhooks manejados

| Evento | Acción |
|--------|--------|
| `checkout.session.completed` | Crea `subscriptions` (months_elapsed=1), email de bienvenida |
| `invoice.paid` | Crea `invoices` (incluye el PRIMER pago `subscription_create` — corregido en Fase 5); en renovaciones incrementa months_elapsed y detecta `completed_at` (mes 6 en CuarentaMás y Extra Intermedio) |
| `customer.subscription.updated` | Actualiza status y cancel_at_period_end |
| `customer.subscription.deleted` | Marca cancelada |
| `invoice.payment_failed` | Actualiza a past_due, email de aviso |

Todos los eventos se registran en `subscription_events` para auditoría.

### Checkout
- `variantSlug` viene en la URL (del quiz de WordPress)
- Servidor verifica prerequisites antes de crear Stripe Checkout Session
- Prerequisitos: tabla `program_variant_prerequisites` con lógica AND/OR por grupos

---

## Variables de Entorno

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # solo servidor, nunca expuesta al cliente

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@auramaristany.com   # en dev sin dominio verificado: onboarding@resend.dev

# Mensajería (Fase 4)
NEXT_PUBLIC_AURA_WHATSAPP=                      # número de Aura, formato internacional solo dígitos
CRON_SECRET=                                    # secreto del Vercel Cron de retención de mensajes (prod)

# App
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com
```

---

## Archivos Críticos del Sistema

| Archivo | Rol |
|---------|-----|
| `/supabase/migrations/001_initial_schema.sql` | Esquema completo + RLS + función `get_accessible_content()` |
| `/lib/content/access.ts` | Lógica de acceso para los 3 programas con control de día máximo |
| `/app/api/webhooks/stripe/route.ts` | Ciclo de vida de suscripciones |
| `/middleware.ts` | Protección por rol, suscripción y onboarding |
| `/components/admin/DayEditor.tsx` | Editor de contenido de Aura |
| `/components/portal/TodayView.tsx` | Vista del día con progreso integrado |

---

## Plan de Desarrollo

| Fase | Semanas | Entregable |
|------|---------|-----------|
| 0 — Fundación | 1-2 | Login/logout funcional, skeleton en Vercel |
| 1 — Suscripción MVP | 3-5 | Quiz → pago → onboarding → portal |
| 2 — Contenido | 6-9 | Aura crea contenido, cliente lo ve y registra progreso |
| 3 — Historial | 10-11 | Gráficas de métricas + galería de fotos |
| 4 — Mensajería | 12 | Comunicación Aura ↔ clientes |
| 5 — Financiero | 13 | Dashboard de MRR e ingresos |
| 6 — Pulido + Launch | 14-15 | App lista para producción |

---

## Verificación End-to-End

1. URL con variantSlug → registro → tarjeta Stripe test → cuestionario → `/portal/today`
2. Cliente en Semana 1, Miércoles: no puede ver el Miércoles de Semana 2 (no existe celda accesible aún)
3. Días de descanso: días de la semana sin fila en `program_days` → portal muestra card de descanso (sin error)
4. Strong & Fit mes 2: Semanas 1-4 de Serie 1 completas + Serie 2 hasta (semana_actual, día_de_hoy)
5. Extra mes 3: solo Serie 3 visible, sin acceso a Serie 2 ni Serie 4
6. Sin `completed_at`: checkout de Extra falla con mensaje claro
7. Ejercicio marcado + reps anotadas → recargar → datos persisten
8. Video YouTube: thumbnail propio → clic → iframe sin sugerencias
9. Historial: entrar a `/portal/history`, seleccionar un día pasado → ver contenido + registro en lectura
10. Respuestas de onboarding de cliente visibles en su ficha de admin
11. MRR del dashboard = suma manual de suscripciones activas × precio

---

*Spec generado el 3 de junio de 2026 · Versión 1.1 — Cambios: modelo semanal (week_number + day_of_week) en program_days; historial de días anteriores en /portal/history*

*Versión 1.2 (9 de junio de 2026) — Cambios tras smoke de Fase 2: se elimina el selector de tipo de día (todos son "Actividad Física"; el Enfoque/`workout_focus` describe la actividad y los días de descanso llevan contenido); nuevo block type `cardio_zone2` (calculadora); tablas de pilares mensuales (`program_series_pillars`, `program_pillar_blocks`) + sección `/portal/pilares` para CuarentaMás/Extra. Pendiente ronda de ajustes de UI del editor (acercar al prototipo design-handoff).*

*Versión 1.4 (9 de junio de 2026) — Fase 4 (Mensajería) implementada en rama `feature/fase-4-mensajeria` (NO mergeada; pendiente aplicar migración 006 al remoto + smoke). Mensajería unidireccional Aura→clientas in-app (individual + broadcast por programa/variante, modelo snapshot), bandeja read-only + marcar leído + badge de no-leídos. Infra de email `lib/email/` (Resend + React Email, best-effort, no-op sin key) con email de mensaje nuevo + **emails de ciclo de vida** en los webhooks de Stripe (bienvenida/pago-fallido/cancelación). Enlaces a **WhatsApp** (portal→Aura, admin→clienta). Corregido el drift de §messages (esquema real). **Migración 006**: policy SELECT de `messages` para clientas + UPDATE de `read_at` por la dueña + índices. CSV export de clientas diferido a Fase 5. Spec/plan en `docs/superpowers/`.*

*Versión 1.3 (9 de junio de 2026) — Fase 3 (Historial) completada y mergeada a main. `/portal/history` con **2 tabs (Desempeño · Fotos)** según prototipo (no 3); **sin métricas corporales** (`body_metrics` sin captura); gráficas Recharts del **mes corriente** con relación de ejercicios **por nombre** (no uuid); detalle `/portal/history/[logId]` **solo lectura** (resuelve P3). Fotos en **bucket privado `progress`** con signed URLs, comentario opcional, compresión cliente 1280px, límites 5MB/**250 fotos** (badge `[N/250]`). Migración `005_progress_photos.sql` aplicada: bucket privado + RLS de storage + columna `caption`. Corrección de esquema: la columna real de `progress_photos` es **`taken_at`** (no `photo_date`) y **no** existe `angle`. Follow-ups: regenerar `lib/supabase/types.ts` (incluir `progress_photos`/`body_metrics`), UI admin para borrar fotos, notas de admin sobre el registro (diferido a Fase 4).*

*Versión 1.5 (10 de junio de 2026) — Fase 5 (Dashboard Financiero) completada y **mergeada a main** (merge `a9ecb32`). `/admin/dashboard`: KPIs (MRR "*Estimado" = activas × `price_mxn`, sin badge delta; activas; renuevan en ≤30 días + monto; `past_due` → `/admin/clients`), ingresos por mes (barras Recharts, 12m fijo), **clientes por variante** (barras), ingresos por programa (donut), pagos recientes (últimas 10). Capa de datos: `lib/admin/finance-helpers.ts` (puras, TDD) + `lib/admin/finance-queries.ts` (server-only, RLS admin). ✓ **Bug corregido:** el primer pago (`billing_reason='subscription_create'`) ya se registra en `invoices`; **backfill** aplicado (`scripts/backfill-first-invoices.ts`, idempotente). E2E validado con cuentas reales. Diferido a **Fase 6:** página `/admin/payments` + botón "Ver todos", `/admin/clients`+ficha, CSV export de clientas. Spec/plan en `docs/superpowers/` (`2026-06-10-fase-5-financiero-*`).*
