-- ============================================================
-- 009 — Endurecimiento de seguridad (post-auditoría Fase 6)
-- RLS-1: with check explícito en políticas for-all de datos de cliente.
-- RLS-2: with check en messages_admin_write.
-- HYG-1: search_path explícito en is_admin().
-- INP-3: normalización server-side de phone en handle_new_user().
-- ============================================================

-- RLS-1 — progress_logs
drop policy if exists "progress_logs_own_or_admin" on progress_logs;
create policy "progress_logs_own_or_admin"
  on progress_logs for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- RLS-1 — body_metrics
drop policy if exists "body_metrics_own_or_admin" on body_metrics;
create policy "body_metrics_own_or_admin"
  on body_metrics for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- RLS-1 — onboarding_responses
drop policy if exists "onboarding_responses_own_or_admin" on onboarding_responses;
create policy "onboarding_responses_own_or_admin"
  on onboarding_responses for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- RLS-2 — messages_admin_write
drop policy if exists "messages_admin_write" on messages;
create policy "messages_admin_write"
  on messages for all
  using (is_admin())
  with check (is_admin());

-- HYG-1 — is_admin() con search_path fijado
create or replace function is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- INP-3 — handle_new_user() normaliza phone server-side
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  raw_phone text := nullif(new.raw_user_meta_data->>'phone', '');
  norm_phone text := nullif(regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g'), '');
begin
  insert into profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when length(coalesce(norm_phone, '')) between 11 and 15 then norm_phone else null end
  );
  return new;
end;
$$;
