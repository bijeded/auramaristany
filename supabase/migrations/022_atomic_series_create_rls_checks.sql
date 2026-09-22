/* ============================================================
   022 — Creación atómica de series (D34) y `with check` explícito en las
   políticas de escritura admin del contenido (D35)

   `createSeries` insertaba la serie y luego sus mapeos en dos llamadas
   PostgREST, cada una con su propio commit, y compensaba un mapeo fallido
   con un delete de mejor esfuerzo. Si ese delete también fallaba quedaba una
   serie sin variante: invisible en todos los currículos e imposible de
   borrar desde el editor. `create_series_with_mappings` hace las dos
   escrituras en una sola llamada, es decir, en una sola transacción.

   Misma forma que `update_series_with_mappings` (021): SECURITY INVOKER, así
   que las políticas `is_admin()` siguen siendo la frontera; NO decide nada
   (la pertenencia de las variantes al programa se valida en la acción de
   servidor); `published` siempre false al crear; el id de la serie sale de la
   fila insertada y nunca del payload, así que un payload no puede colgar
   mapeos de una serie existente. Devuelve el id nuevo.

   Nueve políticas `for all using (is_admin())` de 001 y 004 no declaraban
   `with check`. Postgres cae al `using`, así que eran equivalentes, pero va
   contra la regla 3 y cuatro de ellas son la única guarda de las funciones
   de 021 y de esta. Se usa `alter policy` y no drop-and-recreate (como la
   020): el `using` no se reescribe, un nombre mal escrito falla en vez de
   dejar una segunda política permisiva al lado, y no hay ventana sin
   política. Es re-ejecutable tal cual.

   Las cuatro políticas del mismo patrón fuera del contenido (profiles,
   invoices, subscription_events, message_recipients) quedan en D36.

   Comentarios en bloque, sin guiones dobles: la Management API recibe el SQL
   en UNA sola línea. Tras aplicarla: notify pgrst, 'reload schema'.
   ============================================================ */

create or replace function create_series_with_mappings(
  p_program_id uuid,
  p_title text,
  p_description text,
  p_mappings jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_series_id uuid;
begin
  if jsonb_typeof(p_mappings) is distinct from 'array' then
    raise exception 'p_mappings debe ser un arreglo' using errcode = 'data_exception';
  end if;
  if jsonb_array_length(p_mappings) = 0 then
    raise exception 'una serie necesita al menos una variante' using errcode = 'data_exception';
  end if;
  if jsonb_array_length(p_mappings) > 50 then
    raise exception 'demasiados mapeos: %', jsonb_array_length(p_mappings) using errcode = 'data_exception';
  end if;

  insert into program_series (program_id, title, description, published)
  values (p_program_id, p_title, p_description, false)
  returning id into v_series_id;

  insert into variant_series_map (program_variant_id, series_id, ordinal)
  select m.program_variant_id, v_series_id, m.ordinal
    from jsonb_to_recordset(p_mappings) as m(program_variant_id uuid, ordinal int);

  return v_series_id;
end;
$$;

comment on function create_series_with_mappings(uuid, text, text, jsonb) is
  'Crea una serie sin publicar y sus mapeos variante-serie en una sola transacción. Recibe [{program_variant_id, ordinal}], al menos uno. Devuelve el id de la serie. SECURITY INVOKER: RLS gobierna.';

revoke execute on function create_series_with_mappings(uuid, text, text, jsonb) from public, anon;
grant execute on function create_series_with_mappings(uuid, text, text, jsonb) to authenticated;

alter policy "program_series_admin_write" on program_series with check (is_admin());
alter policy "program_day_blocks_admin_write" on program_day_blocks with check (is_admin());
alter policy "pillar_blocks_admin_write" on program_pillar_blocks with check (is_admin());
alter policy "variant_series_map_admin_write" on variant_series_map with check (is_admin());
alter policy "program_days_admin_write" on program_days with check (is_admin());
alter policy "pillars_admin_write" on program_series_pillars with check (is_admin());
alter policy "programs_admin_write" on programs with check (is_admin());
alter policy "program_variants_admin_write" on program_variants with check (is_admin());
alter policy "program_variant_prerequisites_admin_write" on program_variant_prerequisites with check (is_admin());
