-- 020_onboarding_questions_admin_write_check.sql
-- D20 — la policy de escritura admin de onboarding_questions no tenía `with check`.
--
-- 001 la creó como `for all using (is_admin())`. Para `update` Postgres cae al
-- `using`, así que funcionalmente era equivalente, pero va contra la regla 3 de
-- CLAUDE.md y desde la 018 es la única guarda de `reorder_onboarding_questions`.
-- Se declara el check explícito en vez de depender del fallback.

drop policy if exists "onboarding_questions_admin_write" on onboarding_questions;

create policy "onboarding_questions_admin_write"
  on onboarding_questions for all
  using (is_admin())
  with check (is_admin());
