-- ============================================================
-- 012 — Bookings (Calendly) — A6+A7 booking system
-- Ledger of 1:1 video calls booked through the Calendly embed.
-- Rows are written ONLY by the Calendly webhook under service-role
--   (invitee.created -> upsert active; invitee.canceled -> mark canceled).
-- The client never writes bookings; RLS grants the owner read-only access.
-- calendly_invitee_uri is the idempotency key (Calendly redelivers events).
-- Enforced app-side: "one future, non-canceled call at a time".
-- ============================================================

create table bookings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  calendly_invitee_uri text not null unique,
  calendly_event_uri text,
  scheduled_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'canceled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index bookings_profile_id_idx on bookings(profile_id);
create index bookings_profile_status_scheduled_idx on bookings(profile_id, status, scheduled_at);

-- keep updated_at fresh on cancellation upserts
create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- RLS: owner reads own rows; admin reads all. No client insert/update/delete —
-- the webhook writes under service-role, which bypasses RLS.
alter table bookings enable row level security;

drop policy if exists "bookings_select_own_or_admin" on bookings;
create policy "bookings_select_own_or_admin"
  on bookings for select
  using (profile_id = auth.uid() or is_admin());
