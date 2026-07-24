-- ============================================================
-- 011 — Cancellation surveys (A9)
-- Captures WHY a subscription was cancelled.
--   voluntary:   inserted by the portal cancel flow (RLS-aware, owner).
--   involuntary: inserted by the Stripe webhook (service-role) when dunning
--                exhausts retries (cancellation_details.reason = payment_failed/disputed).
-- profile_id is kept alongside subscription_id so the analytics survive if the
-- subscription row is later deleted (subscription_id -> set null on delete).
-- ============================================================

create table cancellation_surveys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  reason text not null check (reason in (
    'precio_muy_caro',
    'no_tengo_tiempo',
    'no_logre_objetivo',
    'no_veo_resultados',
    'encontre_otra_opcion',
    'otro',
    'pago_fallido'
  )),
  detail text check (detail is null or char_length(detail) <= 200),
  source text not null check (source in ('voluntary', 'involuntary')),
  created_at timestamptz default now()
);

create index cancellation_surveys_profile_id_idx on cancellation_surveys(profile_id);
create index cancellation_surveys_subscription_id_idx on cancellation_surveys(subscription_id);

-- RLS: owner reads/inserts own rows; owner deletes own VOLUNTARY rows (reactivation).
-- Involuntary rows are written by the webhook under service-role (bypasses RLS).
alter table cancellation_surveys enable row level security;

drop policy if exists "cancellation_surveys_select_own_or_admin" on cancellation_surveys;
create policy "cancellation_surveys_select_own_or_admin"
  on cancellation_surveys for select
  using (profile_id = auth.uid() or is_admin());

drop policy if exists "cancellation_surveys_insert_own" on cancellation_surveys;
create policy "cancellation_surveys_insert_own"
  on cancellation_surveys for insert
  with check (profile_id = auth.uid() and source = 'voluntary' and reason <> 'pago_fallido');

drop policy if exists "cancellation_surveys_delete_own_voluntary" on cancellation_surveys;
create policy "cancellation_surveys_delete_own_voluntary"
  on cancellation_surveys for delete
  using (profile_id = auth.uid() and source = 'voluntary');
