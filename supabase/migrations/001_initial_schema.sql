-- 001_initial_schema.sql
-- Aura Maristany Platform — Initial Schema
-- Apply via: Supabase Dashboard > SQL Editor > New Query

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
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

-- ============================================================
-- ONBOARDING (configurable questions by Aura from admin panel)
-- ============================================================
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

-- ============================================================
-- PROGRAMS
-- ============================================================
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

-- Prerequisite logic: same group = AND; different groups = OR
create table program_variant_prerequisites (
  id uuid primary key default gen_random_uuid(),
  program_variant_id uuid references program_variants(id),
  prerequisite_group int not null,
  required_program_slug text not null,
  required_variant_levels text[],
  required_status text default 'completed'
);

-- ============================================================
-- CONTENT
-- ============================================================
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

-- Days are identified by (series_id, week_number, day_of_week) — NOT sequential numbers
-- Absence of a row for a given (week_number, day_of_week) = rest day (no content required)
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
  -- text:          { "html": "..." }
  -- youtube:       { "video_id": "...", "title": "..." }
  -- pdf:           { "storage_path": "...", "filename": "...", "label": "..." }
  -- image:         { "storage_path": "...", "alt": "..." }
  -- exercise_list: { "exercises": [{ "id": "uuid", "name": "...", "sets": 3,
  --                  "reps": "12", "rest_seconds": 60, "notes": "...",
  --                  "metrics": ["reps_done", "weight_kg"] }] }
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- N:N mapping: allows content reuse across variants
create table variant_series_map (
  program_variant_id uuid references program_variants(id),
  series_id uuid references program_series(id),
  primary key (program_variant_id, series_id)
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
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
  -- Incremented +1 on each invoice.paid webhook. NEVER computed from dates.
  -- This is the immutable arbiter of which content month the client can access.
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

-- ============================================================
-- PROGRESS TRACKING
-- ============================================================
create table progress_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  subscription_id uuid references subscriptions(id),
  program_day_id uuid references program_days(id),
  log_date date not null default current_date,
  completed boolean default false,
  -- { "exercise-uuid": { "completed": true, "reps_done": 12, "weight_kg": 15.0, "notes": "..." } }
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

-- ============================================================
-- MESSAGING
-- ============================================================
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

-- ============================================================
-- BILLING
-- ============================================================
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

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles for each row execute function set_updated_at();
create trigger trg_subscriptions_updated_at
  before update on subscriptions for each row execute function set_updated_at();
create trigger trg_program_series_updated_at
  before update on program_series for each row execute function set_updated_at();
create trigger trg_program_days_updated_at
  before update on program_days for each row execute function set_updated_at();
create trigger trg_program_day_blocks_updated_at
  before update on program_day_blocks for each row execute function set_updated_at();
create trigger trg_progress_logs_updated_at
  before update on progress_logs for each row execute function set_updated_at();

-- Auto-create profile row when a new user signs up via Supabase Auth
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
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table profiles enable row level security;
alter table onboarding_questions enable row level security;
alter table onboarding_responses enable row level security;
alter table programs enable row level security;
alter table program_variants enable row level security;
alter table program_variant_prerequisites enable row level security;
alter table program_series enable row level security;
alter table program_days enable row level security;
alter table program_day_blocks enable row level security;
alter table variant_series_map enable row level security;
alter table subscriptions enable row level security;
alter table subscription_events enable row level security;
alter table progress_logs enable row level security;
alter table body_metrics enable row level security;
alter table progress_photos enable row level security;
alter table messages enable row level security;
alter table message_recipients enable row level security;
alter table invoices enable row level security;

-- Helper: is current user an admin?
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles
create policy "profiles_select_own_or_admin"
  on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own"
  on profiles for update using (id = auth.uid());
create policy "profiles_admin_insert_update_delete"
  on profiles for all using (is_admin());

-- onboarding_questions: any authenticated user can read; only admin writes
create policy "onboarding_questions_read_authenticated"
  on onboarding_questions for select using (auth.uid() is not null);
create policy "onboarding_questions_admin_write"
  on onboarding_questions for all using (is_admin());

-- onboarding_responses: own only + admin
create policy "onboarding_responses_own_or_admin"
  on onboarding_responses for all using (profile_id = auth.uid() or is_admin());

-- programs + variants: public read; admin write
create policy "programs_public_read"
  on programs for select using (true);
create policy "programs_admin_write"
  on programs for all using (is_admin());
create policy "program_variants_public_read"
  on program_variants for select using (true);
create policy "program_variants_admin_write"
  on program_variants for all using (is_admin());
create policy "program_variant_prerequisites_public_read"
  on program_variant_prerequisites for select using (true);
create policy "program_variant_prerequisites_admin_write"
  on program_variant_prerequisites for all using (is_admin());

-- content: published rows readable; admin reads all
create policy "program_series_read_published"
  on program_series for select using (published = true or is_admin());
create policy "program_series_admin_write"
  on program_series for all using (is_admin());
create policy "program_days_read_published"
  on program_days for select using (published = true or is_admin());
create policy "program_days_admin_write"
  on program_days for all using (is_admin());
create policy "program_day_blocks_read_published"
  on program_day_blocks for select using (
    exists (select 1 from program_days d where d.id = day_id and (d.published = true or is_admin()))
  );
create policy "program_day_blocks_admin_write"
  on program_day_blocks for all using (is_admin());
create policy "variant_series_map_public_read"
  on variant_series_map for select using (true);
create policy "variant_series_map_admin_write"
  on variant_series_map for all using (is_admin());

-- subscriptions: own only + admin
create policy "subscriptions_own_or_admin"
  on subscriptions for select using (profile_id = auth.uid() or is_admin());
create policy "subscriptions_admin_write"
  on subscriptions for all using (is_admin());

-- subscription_events: admin only
create policy "subscription_events_admin_only"
  on subscription_events for all using (is_admin());

-- progress: own only + admin
create policy "progress_logs_own_or_admin"
  on progress_logs for all using (profile_id = auth.uid() or is_admin());
create policy "body_metrics_own_or_admin"
  on body_metrics for all using (profile_id = auth.uid() or is_admin());
create policy "progress_photos_own_or_admin"
  on progress_photos for all using (profile_id = auth.uid() or is_admin());

-- messages: admin creates; recipients read theirs
create policy "messages_admin_write"
  on messages for all using (is_admin());
create policy "message_recipients_own_or_admin"
  on message_recipients for select using (recipient_id = auth.uid() or is_admin());
create policy "message_recipients_admin_write"
  on message_recipients for all using (is_admin());

-- invoices: own subscription's invoices + admin
create policy "invoices_own_or_admin"
  on invoices for select using (
    exists (
      select 1 from subscriptions s
      where s.id = subscription_id and s.profile_id = auth.uid()
    ) or is_admin()
  );
create policy "invoices_admin_write"
  on invoices for all using (is_admin());
