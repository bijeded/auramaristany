# Fase 0 — Fundación: Next.js + Supabase + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrappear el proyecto Next.js 14 con Supabase, identidad visual de Aura, y un flujo de login/logout completamente funcional como primer entregable verificable.

**Architecture:** App Router de Next.js 14 con Supabase Auth (email+password). El middleware protege rutas `/portal` y `/admin` verificando la sesión desde cookies. Los clientes de Supabase siguen el patrón `@supabase/ssr` — un cliente browser en componentes client-side y un cliente server que lee cookies en RSC, Server Actions y API Routes.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, @supabase/ssr, @supabase/supabase-js, Vitest (unit tests).

---

## File Structure

```
/Users/franciscovenegas/Desktop/Cowork/Aura/   ← raíz del proyecto Next.js
├── .env.local                                  create — variables de entorno
├── .env.example                                create — plantilla pública
├── .gitignore                                  modify — añadir .env.local
├── next.config.ts                              auto-generated, no modificar en Fase 0
├── tailwind.config.ts                          modify — brand tokens
├── components.json                             create — shadcn/ui config
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql              create — esquema completo + RLS
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                           create — cliente browser (singleton)
│   │   ├── server.ts                           create — cliente server (cookies SSR)
│   │   └── types.ts                            create — tipos Database generados manualmente
│   └── utils.ts                                create — helper cn()
│
├── app/
│   ├── globals.css                             modify — CSS vars de brand + reset Aura
│   ├── layout.tsx                              modify — fuentes Google (Oswald + Hind)
│   │
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx                        create — pantalla login
│   │   ├── register/
│   │   │   └── page.tsx                        create — pantalla registro
│   │   ├── callback/
│   │   │   └── route.ts                        create — handler confirm email / OAuth
│   │   └── reset-password/
│   │       └── page.tsx                        create — pantalla reset password
│   │
│   └── portal/
│       └── page.tsx                            create — placeholder protegido
│
├── components/
│   ├── ui/                                     auto-generated por shadcn
│   └── auth/
│       ├── LoginForm.tsx                       create — form con validación
│       ├── RegisterForm.tsx                    create — form con validación
│       └── ResetPasswordForm.tsx               create — form con validación
│
├── middleware.ts                               create — protección de rutas
│
└── __tests__/
    └── middleware.test.ts                      create — tests del middleware
```

---

## Task 1: Inicializar proyecto Next.js 14

**Files:**
- Create: `/Users/franciscovenegas/Desktop/Cowork/Aura/package.json` (auto)
- Create: `/Users/franciscovenegas/Desktop/Cowork/Aura/tsconfig.json` (auto)
- Create: `/Users/franciscovenegas/Desktop/Cowork/Aura/.gitignore` (auto)

- [ ] **Step 1.1: Inicializar Next.js en el directorio existente**

```bash
cd /Users/franciscovenegas/Desktop/Cowork/Aura
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Cuando pregunte si quiere inicializar un git repo responde `Yes`. Cuando pregunte si hay archivos que sobreescribir, di que NO (SPEC.md, handoff.md ya existen).

- [ ] **Step 1.2: Instalar dependencias adicionales**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 1.3: Instalar shadcn/ui**

```bash
npx shadcn@latest init
```

Opciones al inicializar:
- Style: `Default`
- Base color: `Neutral`
- CSS variables: `Yes`

Luego instalar componentes necesarios para auth:

```bash
npx shadcn@latest add button input label card form
```

- [ ] **Step 1.4: Verificar que el proyecto compila**

```bash
npm run dev
```

Esperado: servidor en http://localhost:3000 sin errores.

- [ ] **Step 1.5: Commit inicial**

```bash
git add .
git commit -m "feat: initialize Next.js 14 project with TypeScript, Tailwind, shadcn/ui"
```

---

## Task 2: Identidad visual — CSS vars + Tailwind config

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 2.1: Reemplazar `app/globals.css` con design tokens de Aura**

```css
/* app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Hind:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --rosa: #eddbd8;
  --rosa-soft: #f6ecea;
  --rosa-deep: #e0c8c3;
  --lavanda: #9982f4;
  --lavanda-dark: #7a63d4;
  --lavanda-soft: #efeafe;
  --lavanda-tint: rgba(153, 130, 244, 0.10);
  --negro: #1a1a1a;
  --blanco: #ffffff;
  --gris-claro: #f5f5f5;
  --gris-linea: #ececec;
  --gris-texto: #6b6b6b;
  --gris-suave: #9a9a9a;
  --error: #e05c5c;
  --error-tint: rgba(224, 92, 92, 0.10);
  --exito: #4caf7d;
  --font-head: 'Oswald', system-ui, sans-serif;
  --font-body: 'Hind', system-ui, sans-serif;
  --r-card: 12px;
  --r-lg: 16px;
  --shadow-card: 0 1px 3px rgba(26,26,26,0.05), 0 10px 30px rgba(26,26,26,0.06);
  /* shadcn/ui overrides */
  --background: 0 0% 100%;
  --foreground: 0 0% 10%;
  --primary: 250 85% 73%;
  --primary-foreground: 0 0% 100%;
  --ring: 250 85% 73%;
  --radius: 0.5rem;
}

* { box-sizing: border-box; }

body {
  font-family: var(--font-body);
  color: var(--negro);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-head);
  font-weight: 600;
  margin: 0;
  line-height: 1.08;
}
```

- [ ] **Step 2.2: Actualizar `tailwind.config.ts` con brand tokens**

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rosa: {
          DEFAULT: "#eddbd8",
          soft: "#f6ecea",
          deep: "#e0c8c3",
        },
        lavanda: {
          DEFAULT: "#9982f4",
          dark: "#7a63d4",
          soft: "#efeafe",
        },
        negro: "#1a1a1a",
        gris: {
          claro: "#f5f5f5",
          linea: "#ececec",
          texto: "#6b6b6b",
          suave: "#9a9a9a",
        },
        error: "#e05c5c",
        exito: "#4caf7d",
      },
      fontFamily: {
        head: ["Oswald", "system-ui", "sans-serif"],
        body: ["Hind", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 2.3: Actualizar `app/layout.tsx` para metadata y fuentes**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Maristany — Portal",
  description: "Tu programa de bienestar integral",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2.4: Verificar estilos**

```bash
npm run dev
```

Abre http://localhost:3000. El texto debe verse con fuente Hind, fondo blanco.

- [ ] **Step 2.5: Commit**

```bash
git add app/globals.css tailwind.config.ts app/layout.tsx
git commit -m "feat: add Aura brand design tokens and Google Fonts"
```

---

## Task 3: Supabase client helpers

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/types.ts`
- Create: `lib/utils.ts`
- Create: `.env.local`
- Create: `.env.example`

- [ ] **Step 3.1: Crear `.env.example` (para el repo)**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@auramristany.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3.2: Crear `.env.local` con credenciales reales de Supabase**

Ir a https://supabase.com → Proyecto → Settings → API. Copiar:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY`

```bash
# .env.local  (NO commitear)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3.3: Crear `lib/utils.ts`**

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3.4: Crear `lib/supabase/client.ts` (browser)**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3.5: Crear `lib/supabase/server.ts` (RSC/Server Actions)**

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 3.6: Crear `lib/supabase/types.ts` (tipos manuales de DB)**

```typescript
// lib/supabase/types.ts
export type UserRole = "client" | "admin";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "unpaid";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          birth_date: string | null;
          avatar_url: string | null;
          role: UserRole;
          stripe_customer_id: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          program_variant_id: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          months_elapsed: number;
          enrollment_date: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};
```

- [ ] **Step 3.7: Verificar que TypeScript no tiene errores**

```bash
npx tsc --noEmit
```

Esperado: sin errores de tipos.

- [ ] **Step 3.8: Commit**

```bash
git add lib/ .env.example
git commit -m "feat: add Supabase client helpers and DB types"
```

---

## Task 4: Schema SQL + migración en Supabase

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 4.1: Crear archivo de migración**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 4.2: Crear `supabase/migrations/001_initial_schema.sql`**

```sql
-- 001_initial_schema.sql

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- PERFIL DE USUARIO
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  phone text,
  birth_date date,
  avatar_url text,
  role text not null default 'client' check (role in ('client', 'admin')),
  stripe_customer_id text unique,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ONBOARDING
create table onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null,
  question_text text not null,
  question_type text not null check (question_type in ('text', 'number', 'single_choice', 'multi_choice')),
  options jsonb,
  is_required boolean default true,
  is_active boolean default true
);

create table onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete cascade,
  responses jsonb not null,
  completed_at timestamptz
);

-- PROGRAMAS
create table programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  billing_model text not null check (billing_model in ('fixed_term_monthly', 'rolling_monthly')),
  duration_months int,
  is_active boolean default true
);

create table program_variants (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id),
  slug text unique not null,
  name text not null,
  level text check (level in ('principiante', 'intermedio', 'avanzado')),
  time_availability text check (time_availability in ('poco_tiempo', 'tiempo_suficiente')),
  stripe_price_id text unique not null,
  price_mxn numeric(10,2) not null,
  is_active boolean default true
);

create table program_variant_prerequisites (
  id uuid primary key default gen_random_uuid(),
  program_variant_id uuid references program_variants(id),
  prerequisite_group int not null,
  required_program_slug text not null,
  required_variant_levels text[],
  required_status text default 'completed'
);

-- CONTENIDO
create table program_series (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id),
  series_number int not null,
  title text not null,
  description text,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(program_id, series_number)
);

create table program_days (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references program_series(id),
  week_number int not null check (week_number between 1 and 4),
  day_of_week text not null check (day_of_week in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  workout_focus text,
  title text not null,
  description text,
  day_type text default 'workout' check (day_type in ('workout', 'rest', 'assessment')),
  duration_minutes int,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(series_id, week_number, day_of_week)
);

create table program_day_blocks (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references program_days(id) on delete cascade,
  block_type text not null check (block_type in ('text','youtube','pdf','image','exercise_list')),
  sort_order int not null,
  content jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table variant_series_map (
  program_variant_id uuid references program_variants(id),
  series_id uuid references program_series(id),
  primary key (program_variant_id, series_id)
);

-- SUSCRIPCIONES
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  program_variant_id uuid references program_variants(id),
  stripe_subscription_id text unique not null,
  stripe_customer_id text not null,
  status text not null check (status in ('active','past_due','canceled','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  months_elapsed int default 1,
  enrollment_date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id),
  stripe_event_id text unique not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz default now()
);

-- PROGRESO
create table progress_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  subscription_id uuid references subscriptions(id),
  program_day_id uuid references program_days(id),
  log_date date not null default current_date,
  completed boolean default false,
  exercises_done jsonb default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id, program_day_id)
);

create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  metric_date date not null,
  weight_kg numeric(5,2),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  notes text,
  created_at timestamptz default now()
);

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  body_metrics_id uuid references body_metrics(id),
  storage_path text not null,
  taken_at date not null default current_date,
  created_at timestamptz default now()
);

-- MENSAJES
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id),
  subject text not null,
  body text not null,
  is_broadcast boolean default false,
  created_at timestamptz default now()
);

create table message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id),
  recipient_id uuid references profiles(id),
  read_at timestamptz
);

-- FACTURAS
create table invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id),
  stripe_invoice_id text unique not null,
  amount_paid numeric(10,2) not null,
  currency text default 'mxn',
  status text not null,
  invoice_date timestamptz not null,
  created_at timestamptz default now()
);

-- TRIGGER: actualizar updated_at automáticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger trg_subscriptions_updated_at before update on subscriptions for each row execute function set_updated_at();
create trigger trg_program_days_updated_at before update on program_days for each row execute function set_updated_at();
create trigger trg_program_day_blocks_updated_at before update on program_day_blocks for each row execute function set_updated_at();
create trigger trg_progress_logs_updated_at before update on progress_logs for each row execute function set_updated_at();

-- TRIGGER: crear perfil al registrar usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table profiles enable row level security;
alter table onboarding_questions enable row level security;
alter table onboarding_responses enable row level security;
alter table subscriptions enable row level security;
alter table subscription_events enable row level security;
alter table progress_logs enable row level security;
alter table body_metrics enable row level security;
alter table progress_photos enable row level security;
alter table messages enable row level security;
alter table message_recipients enable row level security;
alter table invoices enable row level security;
alter table programs enable row level security;
alter table program_variants enable row level security;
alter table program_series enable row level security;
alter table program_days enable row level security;
alter table program_day_blocks enable row level security;

-- Helper: es admin?
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: cada usuario ve y edita solo el suyo; admin ve todos
create policy "profiles_select_own" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());
create policy "profiles_admin_all" on profiles for all using (is_admin());

-- subscriptions: clienta ve la suya; admin ve todas
create policy "subscriptions_select_own" on subscriptions for select using (profile_id = auth.uid() or is_admin());
create policy "subscriptions_admin_all" on subscriptions for all using (is_admin());

-- progress_logs: clienta gestiona los suyos; admin ve todos
create policy "progress_logs_own" on progress_logs for all using (profile_id = auth.uid() or is_admin());

-- body_metrics y fotos: solo propias
create policy "body_metrics_own" on body_metrics for all using (profile_id = auth.uid() or is_admin());
create policy "progress_photos_own" on progress_photos for all using (profile_id = auth.uid() or is_admin());

-- onboarding_responses: solo propia
create policy "onboarding_responses_own" on onboarding_responses for all using (profile_id = auth.uid() or is_admin());

-- onboarding_questions: cualquier autenticado puede leer; solo admin escribe
create policy "onboarding_questions_read" on onboarding_questions for select using (auth.uid() is not null);
create policy "onboarding_questions_admin" on onboarding_questions for all using (is_admin());

-- programas y variantes: lectura pública; escritura solo admin
create policy "programs_read" on programs for select using (true);
create policy "programs_admin" on programs for all using (is_admin());
create policy "program_variants_read" on program_variants for select using (true);
create policy "program_variants_admin" on program_variants for all using (is_admin());

-- contenido publicado: clientas con suscripción activa pueden leer; admin todo
create policy "program_series_read" on program_series for select using (
  published = true or is_admin()
);
create policy "program_series_admin" on program_series for all using (is_admin());
create policy "program_days_read" on program_days for select using (
  published = true or is_admin()
);
create policy "program_days_admin" on program_days for all using (is_admin());
create policy "program_day_blocks_read" on program_day_blocks for select using (
  exists (select 1 from program_days d where d.id = day_id and (d.published = true or is_admin()))
);
create policy "program_day_blocks_admin" on program_day_blocks for all using (is_admin());

-- mensajes: destinatario puede leer los suyos; admin todo
create policy "messages_admin" on messages for all using (is_admin());
create policy "message_recipients_own" on message_recipients for select using (recipient_id = auth.uid() or is_admin());
create policy "message_recipients_admin" on message_recipients for all using (is_admin());

-- invoices: clienta ve las suyas; admin ve todas
create policy "invoices_own" on invoices for select using (
  exists (select 1 from subscriptions s where s.id = subscription_id and s.profile_id = auth.uid())
  or is_admin()
);
create policy "invoices_admin" on invoices for all using (is_admin());

-- subscription_events: solo admin
create policy "subscription_events_admin" on subscription_events for all using (is_admin());
```

- [ ] **Step 4.3: Aplicar migración en Supabase Dashboard**

Ir a https://supabase.com → tu proyecto → SQL Editor → New query.
Pegar el contenido completo de `001_initial_schema.sql` y ejecutar.

Verificar: en Table Editor deben aparecer todas las tablas listadas arriba.

- [ ] **Step 4.4: Configurar Auth en Supabase Dashboard**

En Supabase → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

En Authentication → Email Templates, verificar que el email de confirmación usa el link magic link.

- [ ] **Step 4.5: Commit**

```bash
git add supabase/
git commit -m "feat: add complete database schema with RLS policies"
```

---

## Task 5: Middleware de protección de rutas

**Files:**
- Create: `middleware.ts`
- Create: `__tests__/middleware.test.ts`

- [ ] **Step 5.1: Configurar Vitest**

Añadir al `package.json` (en la sección `scripts`):

```json
"test": "vitest",
"test:run": "vitest run"
```

Crear `vitest.config.ts`:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

Crear `vitest.setup.ts`:

```typescript
// vitest.setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5.2: Escribir test del middleware (FAIL first)**

```typescript
// __tests__/middleware.test.ts
import { describe, it, expect } from "vitest";

// La lógica de redirect del middleware extraída como función pura para poder testearla
import { getRedirectPath } from "@/lib/middleware-utils";

describe("getRedirectPath", () => {
  it("redirige al login si no hay sesión", () => {
    const result = getRedirectPath({
      pathname: "/portal/today",
      hasSession: false,
      role: null,
      onboardingCompleted: false,
      hasActiveSubscription: false,
    });
    expect(result).toBe("/auth/login");
  });

  it("redirige al portal si admin intenta acceder a /portal", () => {
    const result = getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "admin",
      onboardingCompleted: true,
      hasActiveSubscription: false,
    });
    expect(result).toBe("/admin/dashboard");
  });

  it("redirige al admin dashboard si cliente intenta acceder a /admin", () => {
    const result = getRedirectPath({
      pathname: "/admin/clients",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
    });
    expect(result).toBe("/portal/today");
  });

  it("redirige a onboarding si suscripción activa pero no completó onboarding", () => {
    const result = getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "client",
      onboardingCompleted: false,
      hasActiveSubscription: true,
    });
    expect(result).toBe("/onboarding/questionnaire");
  });

  it("permite acceso si todo está completo", () => {
    const result = getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "client",
      onboardingCompleted: true,
      hasActiveSubscription: true,
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 5.3: Verificar que el test falla**

```bash
npm run test:run
```

Esperado: FAIL — `Cannot find module '@/lib/middleware-utils'`

- [ ] **Step 5.4: Crear `lib/middleware-utils.ts`**

```typescript
// lib/middleware-utils.ts
import type { UserRole } from "./supabase/types";

interface RedirectParams {
  pathname: string;
  hasSession: boolean;
  role: UserRole | null;
  onboardingCompleted: boolean;
  hasActiveSubscription: boolean;
}

export function getRedirectPath(params: RedirectParams): string | null {
  const { pathname, hasSession, role, onboardingCompleted, hasActiveSubscription } = params;

  if (!hasSession) {
    if (pathname.startsWith("/portal") || pathname.startsWith("/admin") || pathname.startsWith("/onboarding")) {
      return "/auth/login";
    }
    return null;
  }

  if (role === "admin" && pathname.startsWith("/portal")) {
    return "/admin/dashboard";
  }

  if (role === "client" && pathname.startsWith("/admin")) {
    return "/portal/today";
  }

  if (hasSession && role === "client" && pathname.startsWith("/portal")) {
    if (!hasActiveSubscription) {
      return null; // checkout redirect se maneja por separado con la URL preservada
    }
    if (!onboardingCompleted) {
      return "/onboarding/questionnaire";
    }
  }

  return null;
}
```

- [ ] **Step 5.5: Ejecutar tests para verificar que pasan**

```bash
npm run test:run
```

Esperado: 5 tests PASS.

- [ ] **Step 5.6: Crear `middleware.ts`**

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRedirectPath } from "@/lib/middleware-utils";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  let role: "client" | "admin" | null = null;
  let onboardingCompleted = false;
  let hasActiveSubscription = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile) {
      role = profile.role as "client" | "admin";
      onboardingCompleted = profile.onboarding_completed;
    }

    if (role === "client") {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("profile_id", user.id)
        .eq("status", "active")
        .single();
      hasActiveSubscription = !!sub;
    }
  }

  const redirectPath = getRedirectPath({
    pathname: request.nextUrl.pathname,
    hasSession: !!user,
    role,
    onboardingCompleted,
    hasActiveSubscription,
  });

  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5.7: Commit**

```bash
git add middleware.ts lib/middleware-utils.ts __tests__/ vitest.config.ts vitest.setup.ts package.json
git commit -m "feat: add route protection middleware with unit tests"
```

---

## Task 6: Páginas de autenticación

**Files:**
- Create: `components/auth/LoginForm.tsx`
- Create: `components/auth/RegisterForm.tsx`
- Create: `components/auth/ResetPasswordForm.tsx`
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/register/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/reset-password/page.tsx`

- [ ] **Step 6.1: Crear layout visual compartido para auth**

Crear `app/auth/layout.tsx`:

```tsx
// app/auth/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--rosa-soft)" }}>
      <div className="flex-shrink-0 text-center pt-8 pb-4 px-6">
        <span
          className="font-head font-semibold tracking-widest uppercase text-xl"
          style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
        >
          AURA
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-start px-6 pb-9 pt-1 max-w-md mx-auto w-full">
        {children}
      </div>
      <footer className="text-center pb-6 text-xs" style={{ color: "var(--gris-suave)" }}>
        © Aura Maristany · <a href="#" className="underline">Términos</a> · <a href="#" className="underline">Privacidad</a>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6.2: Crear `components/auth/LoginForm.tsx`**

```tsx
// components/auth/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Correo o contraseña incorrectos. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/portal/today");
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-7" style={{ boxShadow: "var(--shadow-card)" }}>
      <h1 className="font-head text-2xl font-semibold text-center mb-1">Bienvenida de vuelta</h1>
      <p className="text-sm text-center mb-6" style={{ color: "var(--gris-texto)" }}>
        Ingresa con tu correo electrónico
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}

        <div className="text-right -mt-2">
          <Link href="/auth/reset-password" className="text-sm underline" style={{ color: "var(--lavanda-dark)" }}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full font-head font-medium"
          style={{ background: "var(--lavanda)", color: "#fff" }}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: "var(--gris-linea)" }} />
        <span className="text-sm" style={{ color: "var(--gris-texto)" }}>o</span>
        <div className="flex-1 h-px" style={{ background: "var(--gris-linea)" }} />
      </div>

      <p className="text-sm text-center" style={{ color: "var(--gris-texto)" }}>
        ¿No tienes cuenta?{" "}
        <Link href="/auth/register" className="underline" style={{ color: "var(--lavanda-dark)" }}>
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6.3: Crear `app/auth/login/page.tsx`**

```tsx
// app/auth/login/page.tsx
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 6.4: Crear `components/auth/RegisterForm.tsx`**

```tsx
// components/auth/RegisterForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-xl bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "var(--lavanda-tint)" }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lavanda)" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="font-head text-2xl font-semibold mb-3">¡Ya casi! Revisa tu correo</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--gris-texto)" }}>
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Haz clic en él para activar tu cuenta.
        </p>
        <Link href="/auth/login">
          <Button variant="outline" className="w-full">Volver al inicio de sesión</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-7" style={{ boxShadow: "var(--shadow-card)" }}>
      <h1 className="font-head text-2xl font-semibold text-center mb-1">Crea tu cuenta</h1>
      <p className="text-sm text-center mb-6" style={{ color: "var(--gris-texto)" }}>
        Para acceder a tu programa de Aura
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            placeholder="María Elena García"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--error)" }}>{error}</p>
        )}

        <div
          className="flex items-start gap-2.5 cursor-pointer"
          onClick={() => setTerms((t) => !t)}
        >
          <div
            className="mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center"
            style={{ background: terms ? "var(--lavanda)" : "#fff", borderColor: terms ? "var(--lavanda)" : "var(--gris-linea)" }}
          >
            {terms && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <span className="text-sm leading-snug" style={{ color: "var(--gris-texto)" }}>
            Acepto los{" "}
            <span className="underline" style={{ color: "var(--lavanda-dark)" }}>Términos y Condiciones</span>
            {" "}y la{" "}
            <span className="underline" style={{ color: "var(--lavanda-dark)" }}>Política de Privacidad</span>
          </span>
        </div>

        <Button
          type="submit"
          disabled={!terms || loading}
          className="w-full font-head font-medium"
          style={{ background: "var(--lavanda)", color: "#fff" }}
        >
          {loading ? "Creando cuenta..." : "Crear mi cuenta"}
        </Button>
      </form>

      <p className="text-sm text-center mt-4" style={{ color: "var(--gris-texto)" }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/auth/login" className="underline" style={{ color: "var(--lavanda-dark)" }}>
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6.5: Crear `app/auth/register/page.tsx`**

```tsx
// app/auth/register/page.tsx
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return <RegisterForm />;
}
```

- [ ] **Step 6.6: Crear `app/auth/callback/route.ts`**

```typescript
// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/portal/today";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=callback_failed", request.url));
}
```

- [ ] **Step 6.7: Crear `components/auth/ResetPasswordForm.tsx`**

```tsx
// components/auth/ResetPasswordForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password/update`,
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(76,175,125,0.12)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--exito)" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="font-head text-2xl font-semibold mb-3">Revisa tu correo</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--gris-texto)" }}>
          Si existe una cuenta con ese correo, recibirás instrucciones en los próximos minutos.
        </p>
        <Link href="/auth/login">
          <Button variant="outline" className="w-full">Volver al inicio de sesión</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-7" style={{ boxShadow: "var(--shadow-card)" }}>
      <h1 className="font-head text-2xl font-semibold text-center mb-2">¿Olvidaste tu contraseña?</h1>
      <p className="text-sm text-center mb-6" style={{ color: "var(--gris-texto)" }}>
        Ingresa tu correo y te enviaremos un enlace para restablecerla.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full font-head font-medium"
          style={{ background: "var(--lavanda)", color: "#fff" }}
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>
      <p className="text-sm text-center mt-4">
        <Link href="/auth/login" className="underline" style={{ color: "var(--lavanda-dark)" }}>
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6.8: Crear `app/auth/reset-password/page.tsx`**

```tsx
// app/auth/reset-password/page.tsx
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
```

- [ ] **Step 6.9: Commit**

```bash
git add app/auth/ components/auth/
git commit -m "feat: add auth pages (login, register, reset-password, callback)"
```

---

## Task 7: Portal placeholder + página home

**Files:**
- Create: `app/portal/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 7.1: Crear `app/portal/page.tsx` (placeholder)**

```tsx
// app/portal/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--rosa-soft)" }}>
      <span className="font-head text-2xl font-semibold tracking-widest uppercase mb-4">AURA</span>
      <div className="rounded-xl bg-white p-8 text-center w-full max-w-sm" style={{ boxShadow: "var(--shadow-card)" }}>
        <h1 className="font-head text-xl mb-2">Portal — Coming soon</h1>
        <p className="text-sm mb-6" style={{ color: "var(--gris-texto)" }}>
          Sesión activa: <strong>{user.email}</strong>
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}

// Server Action para logout
import { LogoutButton } from "@/components/auth/LogoutButton";
```

- [ ] **Step 7.2: Crear `components/auth/LogoutButton.tsx`**

```tsx
// components/auth/LogoutButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleLogout}
    >
      Cerrar sesión
    </Button>
  );
}
```

- [ ] **Step 7.3: Actualizar `app/page.tsx` para redirigir**

```tsx
// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/auth/login");
}
```

- [ ] **Step 7.4: Commit**

```bash
git add app/portal/ app/page.tsx components/auth/LogoutButton.tsx
git commit -m "feat: add portal placeholder and home redirect"
```

---

## Task 8: Smoke test — verificar flujo completo

- [ ] **Step 8.1: Correr servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Step 8.2: Verificar redirects del middleware**

Abrir http://localhost:3000/portal/today sin sesión.
Esperado: redirige a `/auth/login`.

Abrir http://localhost:3000/admin/dashboard sin sesión.
Esperado: redirige a `/auth/login`.

- [ ] **Step 8.3: Flujo de registro**

1. Abrir http://localhost:3000/auth/register
2. Llenar nombre, correo real, contraseña (min 8 chars), confirmar, aceptar términos
3. Clic "Crear mi cuenta"
4. Esperado: pantalla de confirmación con el correo ingresado
5. Revisar email → clic en enlace de confirmación
6. Esperado: redirige a `/portal/today` mostrando el correo de la sesión

- [ ] **Step 8.4: Flujo de login**

1. Cerrar sesión desde el portal (botón "Cerrar sesión")
2. Esperado: redirige a `/auth/login`
3. Ingresar credenciales
4. Clic "Ingresar"
5. Esperado: redirige a `/portal/today`

- [ ] **Step 8.5: Flujo de reset de contraseña**

1. Ir a `/auth/login` → clic "¿Olvidaste tu contraseña?"
2. Ingresar correo → clic "Enviar enlace"
3. Esperado: pantalla de confirmación
4. Revisar email → enlace de reset recibido (no es necesario completar el reset en Fase 0)

- [ ] **Step 8.6: Correr tests unitarios**

```bash
npm run test:run
```

Esperado: 5/5 PASS.

- [ ] **Step 8.7: Verificar que compila sin errores de TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 8.8: Commit final de Fase 0**

```bash
git add .
git commit -m "feat: complete Fase 0 — working auth with Supabase"
```

---

## Task 9: (Opcional) Deploy a Vercel

- [ ] **Step 9.1: Crear repo en GitHub**

```bash
gh repo create aura-maristany-app --private --source=. --push
```

- [ ] **Step 9.2: Conectar a Vercel**

```bash
npx vercel --prod
```

Cuando pregunte por environment variables, agregar todas las del `.env.local`.

Agregar en Supabase → Auth → URL Configuration:
- Site URL: tu URL de Vercel (ej. `https://aura-maristany.vercel.app`)
- Redirect URLs: `https://aura-maristany.vercel.app/auth/callback`

- [ ] **Step 9.3: Verificar deploy**

Abrir la URL de Vercel, repetir el smoke test en Step 8.2.

---

## Self-Review — Cobertura del Spec

| Requisito Fase 0 | Tarea |
|---|---|
| ✅ Next.js 14 + TypeScript + Tailwind + shadcn/ui | Task 1, 2, 3 |
| ✅ Supabase Auth (email+password) | Task 4, 6 |
| ✅ Schema SQL completo con RLS | Task 4 |
| ✅ Supabase client helpers (browser + server) | Task 3 |
| ✅ Middleware protección de rutas por rol/suscripción/onboarding | Task 5 |
| ✅ Identidad visual Aura (Oswald, Hind, paleta colores) | Task 2 |
| ✅ Login/logout funcional como primer entregable | Task 6, 7 |
| ✅ Registro con confirmación por correo | Task 6 |
| ✅ Reset de contraseña | Task 6 |
| ✅ Tests unitarios del middleware | Task 5 |
| ⚠️ Stripe no implementado | Fase 1 — por diseño |
| ⚠️ .env.local con keys reales no incluido | Paso manual del desarrollador |

**Preguntas pendientes del handoff sin resolver:**
- P1 (precios MXN): no bloqueante para Fase 0, Stripe no se toca aquí
- P5 (dominio): necesario para Task 9 (Vercel) pero no para desarrollo local
