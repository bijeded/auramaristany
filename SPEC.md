# Technical Specification — Aura Maristany Web Platform

## Overview

Web platform for Aura Maristany, a holistic health coach specializing in women 40+. Lets her sell, deliver, and manage training, nutrition, and wellness programs via recurring monthly subscriptions.

- **Marketing site (WordPress):** https://demo.studiosdmm.com.mx/aura/
- **Web app:** independent subdomain, e.g. `app.auramaristany.com`
- **Language:** Spanish (Mexico) · **Currency:** MXN

---

## Technology Stack

| Layer | Technology |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase (PostgreSQL + RLS + Storage + Real-time) |
| Payments | Stripe (MXN subscriptions) |
| UI | shadcn/ui + Tailwind CSS |
| Content editor | Tiptap (MIT, free) |
| Transactional email | Resend + React Email |
| Deploy | Vercel + Supabase Cloud |
| Charts | Recharts |
| Drag & drop | dnd-kit |
| Video embed | react-lite-youtube-embed |

---

## Visual Identity

| Element | Value |
|---------|-------|
| Heading/button typography | **Oswald** (Google Fonts) |
| Body text typography | **Hind** (Google Fonts) |
| Primary color | `#eddbd8` (warm dusty pink) |
| Secondary color | `#9982f4` (lavender) |
| Base | Black and white |
| Design | Mobile-first, simple UX for a 40+ audience |

---

## General Client Flow

```
Sitio WordPress
  └─ Cuestionario de nivel/perfil
       └─ Redirige a: https://app.auramaristany.com/checkout/[variantSlug]
            └─ Registro / Login en la app
                 └─ Stripe Checkout (pago)
                      └─ Cuestionario de onboarding (dentro de la app)
                           └─ /portal/today (Día 1)
```

**The client never freely chooses her variant.** The WordPress questionnaire determines the variant and redirects to the correct checkout URL.

---

## Programs

### 1. CuarentaMás — 6 months, monthly billing

| slug | Level | Time |
|-----|-------|--------|
| `cuarenta-mas-principiante-poco` | Principiante | < 45 min |
| `cuarenta-mas-principiante-suf` | Principiante | 45–80 min |
| `cuarenta-mas-intermedio-poco` | Intermedio | < 45 min |
| `cuarenta-mas-intermedio-suf` | Intermedio | 45–80 min |
| `cuarenta-mas-avanzado-suf` | Avanzado | 45–80 min |

- **Access:** only up to the current day (day N = days since enrollment + 1). No access to future days or to the next month before it begins
- **At month 6:** `completed_at` is set → unlocks CuarentaMás Extra Intermedio

### 2. CuarentaMás Extra — variants with prerequisites

**Progression:**
```
CuarentaMás Principiante → Extra Intermedio (6 meses) → Extra Avanzado (indefinido)
CuarentaMás Intermedio/Avanzado ──────────────────────→ Extra Avanzado (acceso directo)
```

| slug | Duration | Prerequisite |
|------|----------|--------------|
| `cuarenta-mas-extra-intermedio` | 6 fixed months | CuarentaMás completed (Principiante only) |
| `cuarenta-mas-extra-avanzado` | Indefinite (monthly rolling) | Extra Intermedio completed **OR** CuarentaMás Intermedio/Avanzado completed |

- **Access:** only the current month (`months_elapsed`). No access to future months, but yes to previous ones.
- **Within the month:** only up to the current day
- **Content:** library of reusable monthly plans created by Aura. The system assigns the month-N plan automatically

> ⚠ **Change decided by Aura (16-jun-2026), PENDING implementation:** CuarentaMás Extra will become a **cancelable recurring monthly charge** (like Strong & Fit), not a fixed term. For now only the **label** was changed in admin ("Mensual recurrente"). The underlying change —`programs.billing_model` for `cuarenta-mas-extra` to `rolling_monthly` + adjusting the access/`completed_at`/checkout logic (`stripe-handlers.ts`, `clients-helpers.subscriptionProgressLabel`, prerequisites)— is left for later.

### 3. Strong & Fit — indefinite monthly subscription, cumulative

| slug | Level |
|------|-------|
| `strong-fit-principiante` | Principiante |
| `strong-fit-intermedio` | Intermedio |
| `strong-fit-avanzado` | Avanzado |

- **Cumulative access:** month N = Series 1 through N visible
- **Most recent series:** only up to the current day; previous series: full access
- **Expansion:** Aura can add new series at any time

**Total Stripe Prices:** 5 (CuarentaMás) + 2 (Extra) + 3 (Strong & Fit) = **10 prices**

---

## Key field: `months_elapsed`

Stored in `subscriptions`. Incremented by 1 for each successful Stripe `invoice.paid` (never computed from dates). It's the immutable arbiter of what content each client can see.

Content is organized by **weeks** within each month (not sequential days). The access logic uses:

```
week_number  = floor((today - current_period_start).days / 7) + 1   -- value 1..4
day_of_week  = name of the day in Spanish ('lunes'..'domingo')
```

| Program | Access logic |
|---------|-----------------|
| CuarentaMás | Current month = `months_elapsed`. Access up to `(week_number, day_of_week)` inclusive. Previous weeks and days: complete. |
| Extra | Single series: `series_number = months_elapsed`. Same week/day control. |
| Strong & Fit | Accessible series: `series_number <= months_elapsed`. Only the most recent series uses week/day control; previous ones have full access. |

**History:** once a full week has passed (or the previous month), the content remains permanently accessible so the client can review any past day along with her progress log.

---

## Database — Complete Schema

```sql
-- USERS
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,                  -- captured in /auth/register (required in the form, with country
                               -- code, normalized to digits) via the handle_new_user trigger (migr.
                               -- 008). Nullable at the DB level: old/API-created accounts may have it null.
  birth_date DATE,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  stripe_customer_id TEXT UNIQUE,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ONBOARDING (questionnaire configurable by Aura)
CREATE TABLE onboarding_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'text' | 'number' | 'single_choice' | 'multi_choice'
  options JSONB,               -- ["Option A", "Option B"] for choice types
  is_required BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id),
  responses JSONB NOT NULL,    -- { "question_id": "answer" }
  completed_at TIMESTAMPTZ
);

-- PROGRAMS
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  billing_model TEXT NOT NULL, -- 'fixed_term_monthly' | 'rolling_monthly'
  duration_months INT,         -- 6 for CuarentaMás, NULL for indefinite ones
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

-- Prerequisites with OR logic (same group = AND; different groups = OR)
CREATE TABLE program_variant_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_variant_id UUID REFERENCES program_variants(id),
  prerequisite_group INT NOT NULL,
  required_program_slug TEXT NOT NULL,
  required_variant_levels TEXT[],  -- NULL = any level
  required_status TEXT DEFAULT 'completed'
);

-- CONTENT
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
  week_number  INT  NOT NULL,  -- 1, 2, 3, or 4 (week within the month)
  day_of_week  TEXT NOT NULL,  -- 'lunes' | 'martes' | 'miercoles' | 'jueves'
                               -- | 'viernes' | 'sabado' | 'domingo'
  workout_focus TEXT,          -- "Enfoque": free-text descriptor of the activity
                               -- ('Tren Inferior', 'Protocolo Cardiovascular', 'Descanso', etc.)
  title TEXT NOT NULL,
  description TEXT,
  day_type TEXT DEFAULT 'workout', -- (v1.2: deprecated) The editor no longer exposes a type selector.
                               -- All days are "Actividad Física"; the descriptor is workout_focus.
                               -- Rest day = Aura creates a day with rest-day content.
                               -- The generic rest card only appears if NO row exists for today.
  duration_minutes INT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(series_id, week_number, day_of_week)
);

-- Example Month 1 CuarentaMás:
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
  -- cardio_zone2:  {}  -- fixed calculator; the client enters her age in the portal
  --                    -- and sees her Zone 2 range = (220-age)*0.60 to (220-age)*0.70
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Variant → series mapping (allows reusing content across variants)
CREATE TABLE variant_series_map (
  program_variant_id UUID REFERENCES program_variants(id),
  series_id UUID REFERENCES program_series(id),
  PRIMARY KEY (program_variant_id, series_id)
);

-- MONTHLY PILLARS (CuarentaMás/Extra only; change per month/series, not per day)
-- Content parallel to the physical activity: Alimentación con intención,
-- Autoconocimiento, Manejo de estrés/descanso/sueño, Respiraciones y suelo pélvico.
-- Reuse the same block system (mirror tables of program_days/program_day_blocks).
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
  block_type TEXT NOT NULL,    -- same types as program_day_blocks (incl. cardio_zone2)
  sort_order INT NOT NULL,
  content JSONB NOT NULL
);
-- Portal: /portal/pilares shows the published pillars for the current month
-- (months_elapsed → series), only for CuarentaMás/Extra subscriptions.

-- SUBSCRIPTIONS
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
  completed_at TIMESTAMPTZ,    -- set at month 6 for CuarentaMás and Extra Intermedio
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log of Stripe events
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- PROGRESS TRACKING
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
  -- (N objects in series = N sets; fields null if not filled in)
  notes TEXT,                 -- ⚠ the column is called 'notes' (not 'general_notes').
                              -- The code exposes it as general_notes via an alias in the SELECT
                              -- (general_notes:notes) and writes to 'notes' in the upsert.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, program_day_id) -- 1 record per (client, day); the upsert uses this onConflict
);

-- ⚠ DRIFT (fixed 10-jun-2026): the old block listed 'measured_at' +
-- UNIQUE(profile_id, measured_at) + waist/hip NUMERIC(5,2), which do NOT match
-- the applied table (migration 001). Below is the REAL schema. It isn't captured
-- in any phase (body_metrics stays empty); the field exists only for future use.
CREATE TABLE body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  metric_date DATE NOT NULL,           -- ⚠ actual: 'metric_date' (not 'measured_at')
  weight_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,1),               -- ⚠ actual: NUMERIC(5,1)
  hip_cm NUMERIC(5,1),                 -- ⚠ actual: NUMERIC(5,1)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
  -- There is NO UNIQUE(profile_id, measured_at).
);

CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  body_metrics_id UUID REFERENCES body_metrics(id), -- stays NULL (metrics aren't captured)
  storage_path TEXT NOT NULL,  -- private bucket 'progress', prefix {profile_id}/
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE, -- ⚠ the actual column is 'taken_at' (not 'photo_date')
  caption TEXT,                -- optional client comment (migration 005)
  -- angle TEXT existed in the original plan but is NOT in the actual table; unused.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MESSAGING
-- ⚠ DRIFT (fixed 9-jun-2026, pre-Phase 4): the original block in this SPEC
-- listed columns that do NOT exist in the applied table (migration 001). Below
-- is the REAL schema. The recipient is modeled ONLY via message_recipients
-- (there's no recipient_id or broadcast_filter on messages). If Phase 4 decides
-- to add broadcast_filter/unique/created_at, it'll be in migration 006.
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,       -- ⚠ actual: NOT NULL (the old SPEC had it nullable)
  body TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
  -- There is NO recipient_id or broadcast_filter (the old SPEC listed them).
);

CREATE TABLE message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id),
  recipient_id UUID REFERENCES profiles(id), -- ⚠ actual: 'recipient_id' (not 'profile_id')
  read_at TIMESTAMPTZ          -- null = unread
  -- There is NO created_at or UNIQUE(message_id, recipient_id) declared.
  -- (candidates for migration 006 if needed; decide in the Phase 4 brainstorm.)
);
-- ⚠ RLS pending: in 001 there is NO SELECT policy on `messages` for clients
-- (only messages_admin_write). The client needs to read the subject/body of
-- messages where she has a row in message_recipients → add in migration 006.

-- FINANCES
-- ⚠ DRIFT (fixed 9-jun-2026, pre-Phase 5): the original block listed
-- amount_mxn/paid_at and invoice_date DATE, which do NOT match the applied table
-- (migration 001). Below is the REAL schema (what recordInvoice writes in
-- lib/webhooks/stripe-handlers.ts). The financial dashboard (Phase 5 ✓) reads
-- amount_paid + currency, and invoice_date is timestamptz. There is NO paid_at.
-- ✓ Phase 5: fixed the bug where the FIRST payment (billing_reason=
-- 'subscription_create') wasn't recorded; backfill applied to prior payments.
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,  -- ⚠ actual: 'amount_paid' (not 'amount_mxn')
  currency TEXT DEFAULT 'mxn',         -- ⚠ actual: 'currency' exists (the old SPEC didn't have it)
  status TEXT NOT NULL,        -- 'paid' | 'open' | 'void' | 'uncollectible'
  invoice_date TIMESTAMPTZ NOT NULL,   -- ⚠ actual: timestamptz (not DATE)
  created_at TIMESTAMPTZ DEFAULT now()
  -- There is NO paid_at (the old SPEC listed it).
);
```

**Security:** Row Level Security (RLS) in Supabase on all tables. Clients only see their own data. Admins see everything (`is_admin()`). Security lives in the database, not just in the application. **Defense in depth (Phase 6 audit, merge `bb05894`):** beyond middleware and RLS, server-actions, queries using service-role, and admin pages verify role with `requireAdmin()`/`requireAdminPage()` (`lib/admin/auth.ts`). Content input validated server-side (zod) and Tiptap HTML sanitized on save (`sanitize-html`). **Migration 009** hardened: explicit `with check` on `for all` policies for client data, fixed `search_path` on `is_admin()`, and phone normalization in the `handle_new_user` trigger. Portal access is granted by `subscriptionGrantsAccess` (`lib/content/subscription-access.ts`): states **`active`/`trialing`/`past_due`** (past_due shows a pending-payment banner; the cutoff is defined by Stripe Smart Retries).

---

## Application Structure (App Router)

```
/app
  /(marketing)
    /checkout/[variantSlug]       ← payment landing (comes from the WordPress quiz)

  /auth
    /login
    /register                     ← name + phone number (with country code, required) + email + password
    /callback
    /reset-password

  /onboarding
    /questionnaire                ← guard: active subscription + onboarding_completed=false

  /portal                         ← guard: active subscription + onboarding_completed=true
    /today                        ← day's content + integrated progress (1 single screen)
    /pilares                      ← monthly pillars (gate CuarentaMás/Extra)
    /activando                    ← post-payment polling: waits for the Stripe webhook before redirecting
    /sin-suscripcion              ← landing page when there's no active subscription
    /history                      ← "Mi Progreso": Desempeño (Recharts) + Fotos tabs
    /history/[logId]              ← detail of a past day: content + saved log (read-only)
    /messages                     ← read-only Aura→client inbox (Phase 4) + WhatsApp to Aura
    /messages/[id]                ← message detail (marks read_at) (Phase 4)
    /settings                     ← "Mi cuenta": name/phone editing + password + avatar + subscription card + payment history  [Phase 6 ✓]

  /admin                          ← guard: role='admin'
    /dashboard
    /clients                      ← client list (filters, pagination, CSV)  [Phase 6 ✓]
    /clients/[clientId]           ← 6-tab profile  [Phase 6 ✓]
    /payments                     ← full invoice listing  [Phase 6 ✓]
    /content/[programId]/series/[seriesId]/days/[dayId]
    /messages
    /onboarding-settings          ← questionnaire builder  [Phase 6 ✓]

  /api
    /webhooks/stripe
    /subscriptions/create-checkout
    /subscriptions/customer-portal
    /admin/upload                 ← admin upload to public bucket 'content'
    /admin/clients/[clientId]                 ← DELETE client (guard + cascade 007)  [Phase 6 ✓]
    /admin/clients/[clientId]/photos/[photoId] ← DELETE client photo (admin)  [Phase 6 ✓]
    /portal/progress              ← upsert of the day's log (autosave)
    /portal/photos                ← POST upload photo (private bucket 'progress')
    /portal/photos/[id]           ← DELETE delete own photo
    /cron/purge-messages          ← (Phase 4) Vercel Cron: deletes messages >180 days old (Bearer CRON_SECRET)
```

> **Messaging (Phase 4):** sending (admin), marking read, and deleting use **server actions**
> (`lib/admin/messageActions.ts`, `lib/portal/messageActions.ts`), not route handlers.

### Middleware logic (in order)
1. Not authenticated → `/auth/login`
2. Authenticated but no row in `profiles` (`role=null`) → `/auth/login`
3. No active subscription → `/portal/sin-suscripcion` (except `/portal/activando` and `/portal/sin-suscripcion`, which are accessible without a subscription)
4. Active subscription + `onboarding_completed=false` → `/onboarding/questionnaire`
5. Admin visiting `/portal` → `/admin/dashboard`
6. Client visiting `/admin` → `/portal/today`

---

## Day View with Integrated Progress (`/portal/today`)

A single screen — no additional navigation needed to log progress:

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

The system determines the content to display with:
```
content = program_days WHERE
  series_id   = current month's series (months_elapsed)
  week_number = floor((today - current_period_start).days / 7) + 1
  day_of_week = today's day name in Spanish
```
If no row exists for that `(week_number, day_of_week)` → show the rest-day card.

- The progress banner shows "Mes N · Semana N" instead of "Día N de 180"
- The `workout_focus` badge ("Enfoque": "Tren Inferior", "Protocolo Cardiovascular", "Descanso", etc.) appears as a tag (there's no longer a day-type badge)
- Optional progress fields
- Automatic debounced save
- If progress is already logged for today, the previous values are shown
- Extensible exercise metrics: the `"metrics"` field in the exercise's JSON defines which fields appear

---

## History / Mi Progreso (`/portal/history`)

> **Implemented in Phase 3 (v1.3).** The screen follows the `client-progress.jsx` prototype: **2 tabs (Desempeño · Fotos)**, not the 3 tabs described in v1.1. **Body metrics** (weight/waist/hip) are NOT requested or recorded; `body_metrics` remains uncaptured. Day detail = **read-only** (resolves P3).

The client can see her performance over the course of the month, review past days along with her log, and upload private progress photos.

### "Desempeño" Tab

- **Charts (Recharts)** of exercise metrics (weight/reps/others) **for the current month** (`log_date >= current_period_start`). Exercise selector (pills) + **dynamic metric toggle** based on the exercise's `metrics` array. **No** period selector and **no** stat cards.
- **Exercise matching: by normalized NAME** (not by uuid), to connect the same exercise across days even though Aura creates each day from scratch. Per-day aggregation: **weight = average of the sets**, **reps = sum**.
- Below: **"Historial de ejercicios"** list — chronological (most recent first) of days with a `progress_log`. Each row: date, title, `workout_focus` as a tag, and `N/M` exercises completed. Click → `/portal/history/[logId]`.

### "Fotos" Tab

- Gallery in a **private Storage bucket (`progress`)** served with **signed URLs** (TTL **600s / 10 min**, lowered from 1h in STG-2). 3-column grid with **filter by month**.
- Upload photo: file/camera + **optional comment** (not editable); date = today. **Client-side compression** to 1280px (longer side) + JPEG before uploading. Limits: **5MB/file**, **max 250 photos** per client (badge `[N/250]`).
- Viewer (lightbox) with navigation and **delete** (owner only; admin can via RLS, no UI yet).

### Detail View (`/portal/history/[logId]`)

Renders the same visual structure as `/portal/today` but in **read-only mode** (reuses `BlockView` with the `loggedExercises` prop):
- All content blocks (text, video, PDF, image, cardio_zone2) visible normally
- Exercise list shows the values the client logged (reps, weight per set) pre-loaded and **not editable** (`ExerciseListLogged`), with ✓ if marked complete
- Day's general notes visible
- Badge "📅 {log date}" in the header (instead of "HOY")
- No save button
- Ownership validation: the `logId` must belong to the authenticated client (otherwise, 404)

---

## Admin Panel

### Financial Dashboard — `/admin/dashboard` (Phase 5 ✓ implemented)
- **KPIs:** MRR (sum of `active` subscriptions × `program_variants.price_mxn`; predictive, labeled "*Estimado", no delta badge), total active subscriptions, "Renuevan este mes" (expiring in ≤30 days + amount), "Requieren atención" (count of `past_due`, links to `/admin/clients`).
- **Ingresos por mes:** bar chart (Recharts), fixed 12-month window (source: `invoices.amount_paid` grouped by `invoice_date`, actually collected — intentionally different from MRR).
- **Clientes por variante:** horizontal bars (count of active subscriptions by `program_variants.name`).
- **Ingresos por programa:** donut chart (`invoices.amount_paid` grouped by program).
- **Pagos recientes:** table (date, client, program, amount, status), last 10 rows of `invoices`. **"Ver todos →"** button links to `/admin/payments` (Phase 6 ✓).
- **Data layer:** `lib/admin/finance-helpers.ts` (pure functions, TDD) + `lib/admin/finance-queries.ts` (server-only, admin RLS `is_admin()`). Source = `invoices` table, not the Stripe API.

### Payments Page — `/admin/payments` (Phase 6 ✓ implemented)
- Full listing of `invoices` (`getAllPayments`, ordered by `invoice_date` desc): Fecha · Cliente (link to their profile) · Programa·variante · Monto · Estado.
- **Status filter** (Todos/Pagado/Pendiente/Anulado/Fallido) + **pagination of 10**; "← Dashboard" button. Client-side filter/pagination (low volume).
- **Shared layer:** `lib/admin/pagination.ts` (`paginate`, reused with `/admin/clients`) + `lib/admin/payment-status.ts` (`STATUS_LABEL`, reused with the dashboard) + pure `filterPaymentsByStatus` (TDD).

### Client Management — `/admin/clients` (Phase 6 ✓ implemented)
- **List** (`getClientsList`, one row per client, grouped by `profile_id` and picking the primary subscription): search by name/email, program **|** payment-status pill filters, **pagination of 10**, **CSV export** (respects active filters, via `clientsToCSV`). Program column = pill with the program + variant as a subtitle.
- **Individual profile** `/admin/clients/[clientId]` (`getClientDetail`): 6 tabs — Resumen (subscriptions + progress label by billing model + Eliminar button), Onboarding, Progreso (`progress_logs`), **Fotos** (signed URLs + filter by month + **admin deletion**, closes out the Phase 3 follow-up), Pagos (`invoices`), Mensajes (+ WhatsApp button if `phone` exists). Body metrics aren't shown (`body_metrics` isn't captured).
- **Delete client**: `DELETE /api/admin/clients/[clientId]` endpoint with `canDeleteClient` guard (409 if there's a non-canceled subscription — **doesn't touch Stripe**), deletes Storage photos and `auth.admin.deleteUser` → cascade via migration **007** (`ON DELETE CASCADE` across the profiles/subscriptions FK chain). Photo endpoint: `DELETE /api/admin/clients/[clientId]/photos/[photoId]`.
- **CSV export** of clients (for newsletter/win-back of inactive ones) — included in the list (deferred from Phase 4).
- **Data layer:** `lib/admin/clients-queries.ts` (server-only, admin RLS) + `lib/admin/clients-helpers.ts` (pure functions, TDD: `filterClients`/`pickPrimarySubscription`/`subscriptionProgressLabel`/`canDeleteClient`/`clientsToCSV`/`paginate`) + `lib/admin/date-helpers.ts` (shared with the portal).

### Content CMS
- Navigation: Program → Series/Month → Weekly grid → Day
- **Series CRUD** [Phase 6 ✓]: from `/admin/content/[programId]` the admin can create, edit, and delete series. "Nueva serie" button → `SeriesFormModal` (create mode): month number, title, description (optional), and variant checkboxes (at least one required). "⋯" menu in each `SeriesAccordion`'s header → edit (same fields + Publicado toggle) or delete (dialog with a cascade warning). Server actions in `lib/admin/seriesActions.ts` (`createSeries`/`updateSeries`/`deleteSeries`). Variant↔series mapping via `variant_series_map`; the DELETE explicitly deletes that table before `program_series` (FK without ON DELETE CASCADE).
- **Series view:** 4-row (weeks) × 7-column (days of the week) grid. Each cell shows the day's `workout_focus` or "—" if it's a rest day. Color by state: published (lavender), draft (gray), empty (white). Clicking a cell opens that day's editor.
  ```
           Lun         Mar    Mié         Jue    Vie         Sáb    Dom
  Sem 1  [T.Inf ✓]   [—]   [T.Sup ✓]   [—]   [Full ✓]   [—]    [—]
  Sem 2  [T.Inf ✓]   [—]   [T.Sup ✓]   [—]   [Full ✓]   [—]    [—]
  Sem 3  [T.Inf]     [—]   [T.Sup]     [—]   [Full]     [—]    [—]
  Sem 4  [vacío]     [—]   [vacío]     [—]   [vacío]    [—]    [—]
  ```
- When creating/editing a day, Aura sets: week, day of the week, `workout_focus` (Enfoque, free text), title, duration (no type selector — all days are "Actividad Física")
- Draggable block editor (dnd-kit):
  - **Text:** Tiptap editor with bold, italic, headings (H2/H3/H4), lists (UL and OL)
  - **YouTube:** paste URL → extracts video_id → embed preview
  - **PDF:** upload to Supabase Storage → saves storage_path
  - **Image:** upload to Supabase Storage + alt text + preview
  - **Exercise list:** name, sets×reps, rest, notes, demo video URL per exercise, and which metrics the client will log (reps / weight)
  - **Cardio Zone 2 Calculator:** fixed block (the client enters her age in the portal)
- Per-day state as a Publicado / Borrador selector (and per series)
- Expandable timeline for Extra and Strong & Fit (same grid per series)

### Messaging
- Individual (to one client) or broadcast (filtered by program)
- Sent history
- Email notification to the recipient (Resend)

### Onboarding Configuration — `/admin/onboarding-settings` (Phase 6 ✓ implemented)
- Builder (`OnboardingBuilder`): create, edit (`OnboardingQuestionEditor` modal), **reorder via drag** (dnd-kit), and **activate/deactivate** questions. Deactivate only (`is_active=false`), no hard delete, so as not to leave orphaned responses in the jsonb.
- Types: free text, number, single choice, multiple choice (the last two with an options editor).
- **Data layer:** `lib/admin/onboarding-helpers.ts` (`validateQuestion`/`reindexOrder`, pure TDD) + `lib/admin/onboardingActions.ts` (server actions `saveQuestion`/`reorderQuestions`/`setQuestionActive`, admin RLS, no migration). The client's questionnaire (`/onboarding/questionnaire`) reflects the active ones in order, unchanged.

---

## Stripe Integration

### Webhooks Handled

| Event | Action |
|--------|--------|
| `checkout.session.completed` | Creates `subscriptions` (months_elapsed=1), welcome email |
| `invoice.paid` | Creates `invoices` (includes the FIRST payment `subscription_create` — fixed in Phase 5); on renewals increments months_elapsed and detects `completed_at` (month 6 for CuarentaMás and Extra Intermedio) |
| `customer.subscription.updated` | Updates status and cancel_at_period_end |
| `customer.subscription.deleted` | Marks canceled |
| `invoice.payment_failed` | Updates to past_due, notice email |

All events are logged in `subscription_events` for auditing.

### Checkout
- `variantSlug` comes in the URL (from the WordPress quiz)
- Server verifies prerequisites before creating the Stripe Checkout Session
- Prerequisites: `program_variant_prerequisites` table with AND/OR logic by groups

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, never exposed to the client

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=no-reply@auramaristany.com  # domain verified in Resend; in dev without a domain: onboarding@resend.dev

# Messaging (Phase 4)
NEXT_PUBLIC_AURA_WHATSAPP=                      # Aura's number, international format, digits only
CRON_SECRET=                                    # secret for the Vercel Cron message-retention job (prod)

# App
NEXT_PUBLIC_APP_URL=https://app.auramaristany.com
```

---

## Critical System Files

| File | Role |
|---------|-----|
| `/supabase/migrations/001_initial_schema.sql` | Complete schema + RLS + `get_accessible_content()` function |
| `/lib/content/access.ts` | Access logic for the 3 programs with max-day control |
| `/app/api/webhooks/stripe/route.ts` | Subscription lifecycle |
| `/middleware.ts` | Protection by role, subscription, and onboarding |
| `/components/admin/DayEditor.tsx` | Aura's content editor |
| `/components/portal/TodayView.tsx` | Day view with integrated progress |

---

## Development Plan

| Phase | Weeks | Deliverable |
|------|---------|-----------|
| 0 — Foundation | 1-2 | Working login/logout, skeleton on Vercel |
| 1 — Subscription MVP | 3-5 | Quiz → payment → onboarding → portal |
| 2 — Content | 6-9 | Aura creates content, client views it and logs progress |
| 3 — History | 10-11 | Metric charts + photo gallery |
| 4 — Messaging | 12 | Aura ↔ client communication |
| 5 — Financial | 13 | MRR and revenue dashboard |
| 6 — Polish + Launch | 14-15 | App ready for production |

---

## End-to-End Verification

1. URL with variantSlug → registration → Stripe test card → questionnaire → `/portal/today`
2. Client in Week 1, Wednesday: cannot see Week 2's Wednesday (no accessible cell exists yet)
3. Rest days: days of the week with no row in `program_days` → portal shows the rest-day card (no error)
4. Strong & Fit month 2: Weeks 1-4 of Series 1 complete + Series 2 up to (week_number, day_of_week)
5. Extra month 3: only Series 3 visible, no access to Series 2 or Series 4
6. Without `completed_at`: Extra checkout fails with a clear message
7. Exercise marked + reps logged → reload → data persists
8. YouTube video: custom thumbnail → click → iframe with no suggestions
9. History: go to `/portal/history`, select a past day → view content + log in read-only mode
10. Client's onboarding responses visible on their admin profile
11. Dashboard MRR = manual sum of active subscriptions × price

---

*Spec generated on 3 de junio de 2026 · Version 1.1 — Changes: weekly model (week_number + day_of_week) in program_days; history of past days in /portal/history*

*Version 1.2 (9 de junio de 2026) — Changes after the Phase 2 smoke test: the day-type selector is removed (all days are "Actividad Física"; the Enfoque/`workout_focus` describes the activity and rest days carry content); new `cardio_zone2` block type (calculator); monthly pillar tables (`program_series_pillars`, `program_pillar_blocks`) + `/portal/pilares` section for CuarentaMás/Extra. A round of editor UI adjustments still pending (bringing it closer to the design-handoff prototype).*

*Version 1.4 (9 de junio de 2026) — Phase 4 (Messaging) implemented on the `feature/fase-4-mensajeria` branch (NOT merged; pending applying migration 006 to remote + smoke test). One-way in-app Aura→client messaging (individual + broadcast by program/variant, snapshot model), read-only inbox + mark-as-read + unread badge. Email infra `lib/email/` (Resend + React Email, best-effort, no-op without a key) with new-message email + **lifecycle emails** on the Stripe webhooks (welcome/failed-payment/cancellation). **WhatsApp** links (portal→Aura, admin→client). Fixed the §messages drift (actual schema). **Migration 006**: SELECT policy on `messages` for clients + `read_at` UPDATE by the owner + indexes. Client CSV export deferred to Phase 5. Spec/plan in `docs/superpowers/`.*

*Version 1.3 (9 de junio de 2026) — Phase 3 (History) completed and merged to main. `/portal/history` with **2 tabs (Desempeño · Fotos)** per the prototype (not 3); **no body metrics** (`body_metrics` uncaptured); Recharts charts for the **current month** with exercise matching **by name** (not uuid); `/portal/history/[logId]` detail **read-only** (resolves P3). Photos in a **private bucket `progress`** with signed URLs, optional comment, 1280px client-side compression, limits of 5MB/**250 photos** (badge `[N/250]`). Migration `005_progress_photos.sql` applied: private bucket + storage RLS + `caption` column. Schema fix: the actual column on `progress_photos` is **`taken_at`** (not `photo_date`) and `angle` does **not** exist. Follow-ups: regenerate `lib/supabase/types.ts` (include `progress_photos`/`body_metrics`), admin UI to delete photos, admin notes on the log (deferred to Phase 4).*

*Version 1.5 (10 de junio de 2026) — Phase 5 (Financial Dashboard) completed and **merged to main** (merge `a9ecb32`). `/admin/dashboard`: KPIs (MRR "*Estimado" = active × `price_mxn`, no delta badge; active; renewing in ≤30 days + amount; `past_due` → `/admin/clients`), revenue by month (Recharts bars, fixed 12m), **clients by variant** (bars), revenue by program (donut), recent payments (last 10). Data layer: `lib/admin/finance-helpers.ts` (pure, TDD) + `lib/admin/finance-queries.ts` (server-only, admin RLS). ✓ **Bug fixed:** the first payment (`billing_reason='subscription_create'`) now gets recorded in `invoices`; **backfill** applied (`scripts/backfill-first-invoices.ts`, idempotent). E2E validated with real accounts. Deferred to **Phase 6:** `/admin/payments` page + "Ver todos" button, `/admin/clients`+profile, client CSV export. Spec/plan in `docs/superpowers/` (`2026-06-10-fase-5-financiero-*`).*

*Version 1.6 (10 de junio de 2026) — Phase 6 (Polish + Launch) IN PROGRESS, sub-blocks merged to main: **(1) Client Management** (merge `0d23c5e`) — `/admin/clients` list (filters, pagination of 10, CSV) + 6-tab profile (incl. admin photo deletion) + **full client deletion** (`DELETE /api/admin/clients/[clientId]`, 409 guard if sub not canceled, **migration 007 `ON DELETE CASCADE`** applied); **(3) Payments Page** (merge `d52f224`) — `/admin/payments` + "Ver todos →" on the dashboard; extracts `paginate`/`STATUS_LABEL` into shared modules; **neutral language** ('clienta(s)' → 'cliente(s)') across the whole UI; **(4b) Onboarding Builder** (merge `9477a8c`) — `/admin/onboarding-settings` (CRUD for `onboarding_questions`: 4-type modal, drag reorder, activate/deactivate; no migration). Fixed drift: the actual `body_metrics` uses `metric_date`/`numeric(5,1)`/no UNIQUE. **(4a) Required phone number on `/auth/register`** (merge `bdb4e83`) — field with country code (validated by `lib/auth/phone.ts`, 11–15 digits, normalized) → `signUp` metadata → **migration 008** (`handle_new_user` copies phone to `profiles.phone`, applied and verified). Activates the admin→client WhatsApp button. **Pending for Phase 6:** connect Resend, deploy to Vercel (+ CRON_SECRET), Stripe live + real prices, security audit. 159/159 tests. Specs/plans in `docs/superpowers/` (`2026-06-10-gestion-clientes-*`, `2026-06-10-admin-payments-*`, `2026-06-10-onboarding-builder-*`, `2026-06-10-telefono-registro-*`).*

*Version 1.7 (11 de junio de 2026) — Phase 6 sub-block **A: Security audit + correction cycle** (merge `bb05894`). Read-only audit (4 parallel auditors, report in `docs/superpowers/audits/`, **0 critical**, 15 findings). Fixed the 5 medium ones + bonus: **DEF-1** (`lib/admin/auth.ts`: `requireAdmin`/`requireAdminPage` in server-actions, service-role queries, and admin pages); **SUB-1** (`lib/content/subscription-access.ts`: portal access is granted by the states **`active`/`trialing`/`past_due`**, unified across middleware/`getTodayContent`/`getPerformanceData`/`pillars`; pending-payment banner with a WhatsApp CTA); **INP-2** (input validation with zod + Tiptap HTML sanitization with `sanitize-html`); **INP-3** (generic message on registration to prevent enumeration + server-side phone normalization); **RLS-1/RLS-2/HYG-1** → **migration 009** (explicit `with check`, `search_path` on `is_admin()`, phone normalized in `handle_new_user`, applied and verified). + **G3** (an authenticated user can't re-login at `/auth/login|register`). 195/195 tests, smoke+re-smoke OK. **Pending for Phase 6:** ⚠ BUG G4 (the payment isn't recorded in `invoices` despite `stripe listen` being active — the sub stays `active` but the invoice doesn't show up), UI logout, Resend (+ confirmation SMTP), deploy to Vercel, Stripe live + prices, `/portal/settings`. Specs/plans in `docs/superpowers/` (`2026-06-11-fase6-auditoria-seguridad-*`, `2026-06-11-fase6-fixes-seguridad-*`).*

*Version 1.8 (11 de junio de 2026) — Phase 6: **A1 (BUG G4)** resolved (merge `1e838d7`) + **B1 (UI logout)** (merge `0dde433`). **G4:** the first invoice wasn't being recorded because Stripe emits `invoice.paid` ~1s before `checkout.session.completed` (the sole creator of the sub row); fix = record the first invoice in `handleCheckoutCompleted` (expand `latest_invoice`) + idempotent `recordInvoice` (`upsert onConflict stripe_invoice_id`); backfill of 2 orphaned subs applied. **B1:** `LogoutButton` in the admin sidebar (removes the broken "Ver portal de cliente" link) + minimal `/portal/settings` (read-only account data + logout; fixes the "Configuración" tab that was a 404). 197/197 tests, smoke OK. **Pending for Phase 6 (order):** B2 enrich `/portal/settings` with editing (needed for MVP) → 8 low-severity audit findings + carried-over cleanup → (in parallel) Aura's decisions on P1 pricing/P5 domain → ops block Resend (+ confirmation SMTP)/Vercel/Stripe live. Specs/plans in `docs/superpowers/` (`2026-06-11-fase6-b1-logout-*`).*

*Version 1.9 (14 de junio de 2026) — Phase 6: **B2 — `/portal/settings` complete** (merge `4271c85`). The "Configuración" tab moves from read-only to the client's "Mi cuenta" screen: **name and phone editing** + **password change** (server actions in `lib/portal/settingsActions.ts`; identity always from `getUser()` —never from the client, finding INP-4—; phone normalized with `lib/auth/phone`; the **current** password is re-verified with a *stateless* `@supabase/supabase-js` client with no cookies so as not to rotate the session; raw errors logged server-side + generic message to the client); **profile photo** (route handler `app/api/portal/avatar/route.ts` → **public bucket `avatars`**, fixed path `${user.id}/avatar.<ext>` with `upsert` + cache-busted URL; upload compressed to **≤800px** and recompressed to JPEG via generalized `lib/portal/photo-compress`; generic initials avatar if there's no photo); **subscription card** (`SubscriptionCard`: program in a pill + variant below it in admin style, status, start date, next charge + amount, **"Mes X de Y"** bar with `months_elapsed`/`duration_months`); **payment history** paginated **10/page** (`PaymentHistory`, reuses `paginate`/`STATUS_LABEL`, server-side `?page=`); plus portal header (logo + date) and logout. Email **permanently read-only**. Subscription/invoice reads via owner RLS (`subscriptions_own_or_admin`/`invoices_own_or_admin`). **Migration 010** (public bucket `avatars` + `avatars_public_read` policy, applied and verified). 216/216 tests, tsc/lint/build green, smoke+re-smoke OK. **Pending for Phase 6 (order):** C 8 low-severity audit findings + D carried-over cleanup → (in parallel) Aura's decisions on P1 pricing/P5 domain → ops block Resend (+ confirmation SMTP)/Vercel/Stripe live. Specs/plans in `docs/superpowers/` (`2026-06-13-b2-portal-settings-*`).*

*Version 2.1 (16 de junio de 2026) — Phase 6: **Series CRUD in admin** complete (10 commits, HEAD `d2b3d70`). The "Nueva serie" button in `/admin/content/[programId]` is now functional. Create (month number, title, description, variants via checkbox), edit (title, description, published, variants), delete with a cascade-warning dialog. Server actions `createSeries`/`updateSeries`/`deleteSeries` in `lib/admin/seriesActions.ts`; `getAdminProgram` now returns `variants[]` and `variantIds[]` per series; `SeriesAccordion` adds a ⋯ menu with Editar/Eliminar + `SeriesFormModal` + `SeriesDeleteDialog`; `NewSeriesButton` keeps `page.tsx` as a Server Component. Error 23505 (duplicate month) is shown inline under the Mes # field. DELETE explicitly deletes `variant_series_map` (FK without CASCADE). 252 tests, smoke OK.*

*Version 2.2 (16 de junio de 2026) — Phase 6 Ops block: **LIVE DEMO deployed**. The app is public at **https://app.auramaristany.com** (Vercel Production) as a **demo for Aura's feedback, NOT a production launch** (no real charges). **Decisions (brainstorm):** Stripe in **TEST mode** (Aura wants to see the demo working before setting prices → flipping to live is future work); **same Supabase project** (`bgvxaagfnzvzamtxqbkg`) as prod; demo data is kept (only client data gets deleted at launch). **A2 (Resend + confirmation):** domain `auramaristany.com` verified in Resend (DNS in **IONOS**, records on the `send` subdomain + DKIM `resend._domainkey`, without touching the existing IONOS email); Supabase Auth SMTP → Resend (`smtp.resend.com:465`, user `resend`); **Confirm email enabled**; `RESEND_FROM_EMAIL=no-reply@auramaristany.com`; Supabase Auth Site URL + Redirect URLs pointed at `app.auramaristany.com`. **A3 (deploy):** **private** repo `github.com/bijeded/auramaristany` connected to the Vercel project `project-a24no` (team "Aura Maristany's projects"; `main`→Production, branches→Preview); `"framework":"nextjs"` in `vercel.json`; **11 Production env vars** (Stripe **test**); test Stripe webhook (`we_1Tj1aZ…`, 4 events) → `STRIPE_WEBHOOK_SECRET`; `vercel --prod` aliased to `app.auramaristany.com` (verified: `/auth/login` 200, protected routes redirect). **Demo data loaded** (admin `hola@auramaristany.com`/`09876543` + 20 clients `/12345678`) via `scripts/seed-demo.ts` **rewritten ADDITIVE and WITHOUT secrets** (deletes only user data with service_role + empties the `avatars`/`progress` buckets, does NOT touch the catalog; removed a hardcoded Management API token). Fixed a broken build on main (`updateSeries` was setting `updated_at` by hand → TS2322; the trigger handles it). **Pending:** Task 5 E2E smoke test with Aura + minor fixes from the browser verification; **before launch:** Stripe **live** + real prices, Aura's real WhatsApp, demo data cleanup, Preview env vars. Spec/plan in `docs/superpowers/` (`2026-06-16-fase6-ops-demo-deploy-*`).*

*Version 2.3 (16 de junio de 2026) — Phase 6: **pre-demo fixes + deploy workflow fix** (commit `bf7216a`, 252 tests). UI tweaks requested before sharing with Aura: admin dashboard shows the date with the day ("16 de junio, 2026") and the AURA logo centered; Clientes list with an aligned header and **changed status-filter pills** (removes "Con pago fallido" —redundant with "Vencidas"— and adds **"Canceladas"** to allow filtering canceled accounts; `StatusFilter`/`filterClients`/`STATE_FILTERS`); Content CMS shows **"Mensual recurrente"** for CuarentaMás Extra (special-cased by slug; see the billing-change note in the Programs section); `/portal/settings` date capitalized like the rest of the portal. **Deploy workflow fix:** Git auto-deploys were **blocked by Vercel** because the commit email (`…@MBP-14-de-Fran.domain.name`, auto-generated) didn't match the GitHub account `bijeded`; `git user.email` was set to `francisco.venegas.velasco@gmail.com` (global) and, after pushing with the correct email, the Production deploy builds and promotes normally. Repo `github.com/bijeded/auramaristany` (private) → Vercel `project-a24no`; `git push main` → Production at `app.auramaristany.com`.*

*Version 2.0 (15 de junio de 2026) — Phase 6 sub-block **C+D: audit polish + type cleanup** (merge `b32f0c5`). **Phase C — the 8 low-severity audit findings:** **STG-2** (photo signed-URL expiration 3600→600s via the `lib/storage/signed-url.ts` constant); **INP-5** (`validateMessageContent`: subject ≤200 / body ≤5000 in `sendMessage`); **EDGE-3** (`toDayOfWeek` uses `getUTCDay()` —this was a real bug: the local runner is UTC-6—, aligned with the UTC week computation); **MW-3** (the middleware's `matcher` excludes `api/webhooks` and `api/cron`; **inline** literal because Next doesn't analyze a referenced constant → otherwise the matcher was ignored); **EDGE-5** (`/api/portal/progress` derives `subscriptionId` from the server with `getAccessSubscriptionId(user.id)` and ignores the one from the body); **INP-1** (`logAndGeneric` in `lib/admin/errors.ts`: raw Postgres errors → server-side log + generic message, 19 leaks closed across admin actions/routes); **SVC-2** (`create-checkout` without service-role, fully RLS-aware); **INP-4** (onboarding is saved via the `lib/onboarding/responsesActions.ts` server action with server-side validation against active `onboarding_questions`, identity from `getUser()`). **Phase D — cleanup:** **`lib/supabase/types.ts` completed by hand** (reflects migr. 001–010; **0 unjustified `as any`/`as unknown as` casts**, only the unavoidable ones from nested JOINs/SDK marked `// keep:` are kept; root cause: `Relationships: []` was missing per table → postgrest-js v2+ was returning `never` on mutations; + `"trialing"` added to `SubscriptionStatus`); `try/catch` in `stripe.subscriptions.retrieve` that **re-throws** to preserve Stripe's retry; `formatDate` unified in `lib/admin/date-helpers.ts` (`weekdayLabel`/`longDateLabel`/`dayLabel`); tests for `cloneDay`/`cloneWeek`. **Bonuses uncovered:** fixed `BILLING_LABELS` (`ongoing_monthly`→`rolling_monthly`, the UI was showing the raw value), `dayLabel` now tolerates `timestamptz`, and a **pre-existing bug fix**: `router.refresh()` after saving progress in `useProgressForm` (Next's Router Cache was serving the stale RSC on returning to `/portal/today` → the saved exercise/note appeared blank). No new migrations. **Out of scope (logged):** `saveBlocks`/`savePillarBlocks` transactionality. 247/247 tests, tsc/build green, smoke OK. **Pending for Phase 6 (order):** Aura's decisions on P1 pricing/P5 domain → ops block Resend (+ confirmation SMTP)/Vercel/Stripe live. Specs/plans in `docs/superpowers/` (`2026-06-15-fase6-cd-pulido-limpieza-*`).*
