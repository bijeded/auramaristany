-- ============================================================
-- 008 — handle_new_user() copia también el teléfono del metadata
-- a profiles.phone (capturado en /auth/register). Preserva
-- security definer + set search_path = public (fix ya aplicado
-- a la función viva; se re-declara para no perderlo).
-- profiles.phone sigue nullable: cuentas sin metadata 'phone'
-- (p.ej. usuarios creados por la Auth Admin API) no se rompen.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;
