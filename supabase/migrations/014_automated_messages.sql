-- ============================================================
-- 014 — Automated messages (A4)
-- Two automated outreach rules evaluated by a daily cron:
--   booking_reminder  — first day of an "agendar" window (content-driven).
--   inactivity_nudge  — >=10 days with no progress_logs.
--
-- automated_notices  = the dedupe ledger. Written ONLY by the cron under
--   service-role. unique(profile_id, rule, period_key) IS the dedupe: the
--   cron inserts on-conflict-do-nothing and sends only when a row was
--   actually inserted (insert-before-send: a crash costs a missed message,
--   never a duplicate).
--   ⚠ Dedupe must NEVER be derived from message history — the purge-messages
--   cron hard-deletes messages older than 180 days, so a history-based check
--   would silently start re-sending.
--
-- automated_messages = the editable copy for each rule (2 fixed rows).
--   Aura edits subject/body and flips is_active at /admin/automated-messages.
--   No create/delete: the row is only the copy, the TRIGGER is code
--   (lib/admin/notice-rules.ts). See backlog A13.
--
-- ⚠ The `rule` CHECK constraint on BOTH tables mirrors the NoticeRule union in
--   lib/supabase/types.ts. Adding a rule in code without migrating the
--   constraint fails the insert — they must ship in the same change.
-- ============================================================

-- ---------- 1) Dedupe ledger ----------
create table automated_notices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  rule text not null check (rule in ('booking_reminder', 'inactivity_nudge')),
  -- booking_reminder: '<period_start>:W<n>-<dow>' — names the FIRST cell of the
  --   run, so the two runs in a period get distinct keys AND the week-4 clamp
  --   (days 29-31 re-resolving to an already-visited W4 cell) collides instead
  --   of sending twice.
  -- inactivity_nudge: '<last_activity_date>' | 'never:<enrollment_date>' —
  --   streak-anchored, so one nudge per distinct quiet spell.
  period_key text not null,
  sent_at timestamptz default now(),
  unique (profile_id, rule, period_key)
);

-- No extra index: the unique(profile_id, rule, period_key) constraint's implicit
-- index already serves lookups on the (profile_id, rule) prefix.

-- RLS with NO policies on purpose: only the cron (service-role, which bypasses
-- RLS) reads and writes this ledger. Clients must not be able to read their own
-- nudge history, and nothing in the app needs it — including admins, so any
-- future nudge-history view must go through the service-role client.
-- `force` + `revoke` make the deny explicit instead of merely implied by the
-- absence of policies: without `force`, a future `security definer` function
-- owned by postgres would bypass RLS silently.
alter table automated_notices enable row level security;
alter table automated_notices force row level security;
revoke all on automated_notices from anon, authenticated;

-- ---------- 2) Editable copy per rule ----------
create table automated_messages (
  rule text primary key check (rule in ('booking_reminder', 'inactivity_nudge')),
  subject text not null check (char_length(subject) <= 200),
  body text not null check (char_length(body) <= 5000),
  is_active boolean not null default true,
  updated_at timestamptz default now()
);

create trigger automated_messages_set_updated_at
  before update on automated_messages
  for each row execute function set_updated_at();

-- RLS: admin-only. The cron reads this table under service-role (bypasses RLS).
alter table automated_messages enable row level security;

drop policy if exists "automated_messages_admin_all" on automated_messages;
create policy "automated_messages_admin_all"
  on automated_messages for all
  using (is_admin())
  with check (is_admin());

-- ---------- 3) Seed the initial copy ----------
-- Plain text (message bodies are rendered with white-space: pre-line, never as
-- HTML). {nombre} is the only substituted placeholder.
insert into automated_messages (rule, subject, body) values
  (
    'booking_reminder',
    'Ya puedes agendar tu llamada',
    'Hola {nombre}:' || chr(10) || chr(10) ||
    'Ya está abierta tu ventana para apartar nuestra videollamada. Entra a tu plan de hoy y elige el horario que mejor te acomode.' || chr(10) || chr(10) ||
    'Me encanta este momento del mes: es cuando revisamos juntas cómo te has sentido y ajustamos lo que haga falta.' || chr(10) || chr(10) ||
    'Nos vemos pronto,' || chr(10) ||
    'Aura'
  ),
  (
    'inactivity_nudge',
    '¿Todo bien?',
    'Hola {nombre}:' || chr(10) || chr(10) ||
    'Noté que llevas unos días sin registrar tu avance y quería saludarte. No vengo a regañarte: la vida se pone intensa y eso le pasa a todas.' || chr(10) || chr(10) ||
    'Si quieres retomar, empieza por el día de hoy sin pensar en los que quedaron atrás. Y si algo no te está funcionando, escríbeme y lo ajustamos.' || chr(10) || chr(10) ||
    'Aquí sigo,' || chr(10) ||
    'Aura'
  )
-- Idempotente: esta migración se aplica a mano por la Management API, donde una
-- aplicación parcial o repetida es un modo de fallo normal. Sin esto, un
-- segundo intento falla por PK y deja la migración a medias. Tampoco debe
-- pisar la copia que Aura haya editado desde /admin/automated-messages.
on conflict (rule) do nothing;
