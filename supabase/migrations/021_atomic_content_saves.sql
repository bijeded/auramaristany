/* ============================================================
   021 — Guardados atómicos de bloques y de mapeos de serie (D2, D13)

   `saveBlocks`, `savePillarBlocks` y `updateSeries` reconciliaban con
   borrar-e-insertar en llamadas PostgREST separadas, y cada una hace commit
   por su cuenta. Un insert fallido después de un delete ya confirmado dejaba
   un día o un pilar SIN bloques, o una serie mapeada a CERO variantes
   (invisible en todos los currículos, irrecuperable desde el editor).

   Cada función hace la escritura entera en una sola llamada, es decir, en una
   sola transacción: cualquier error (un CHECK de block_type, un 23505 de
   posición ocupada, un fallo de RLS) deshace también el delete.

   Igual que la 018, NO deciden nada: reciben filas ya validadas, saneadas y
   ordenadas por la acción de servidor. El id del padre llega SIEMPRE como
   argumento escalar y nunca se lee del payload, así que un payload no puede
   apuntar a otro día, pilar o serie.

   SECURITY INVOKER: corren con los permisos de quien llama, así que las
   políticas `is_admin()` de las tres tablas siguen siendo la frontera. Se
   quita EXECUTE a public/anon por mínimo privilegio; el tope de tamaño del
   payload es de la misma familia.

   `update_series_with_mappings` levanta si el update de `program_series` no
   tocó exactamente una fila (id inexistente o filtrado por RLS), y si recibe
   cero mapeos: una serie sin variante no tiene posición.

   Tres funciones en vez de una genérica con el nombre de tabla como
   argumento: evita SQL dinámico en algo que `authenticated` puede llamar.

   Comentarios en bloque, sin guiones dobles: la Management API recibe el SQL
   en UNA sola línea. Tras aplicarla: notify pgrst, 'reload schema'.
   ============================================================ */

create or replace function save_day_blocks(p_day_id uuid, p_blocks jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'p_blocks debe ser un arreglo' using errcode = 'data_exception';
  end if;
  if jsonb_array_length(p_blocks) > 200 then
    raise exception 'demasiados bloques: %', jsonb_array_length(p_blocks) using errcode = 'data_exception';
  end if;

  delete from program_day_blocks where day_id = p_day_id;

  insert into program_day_blocks (day_id, block_type, sort_order, content)
  select p_day_id, b.block_type, b.sort_order, b.content
    from jsonb_to_recordset(p_blocks) as b(block_type text, sort_order int, content jsonb);
end;
$$;

create or replace function save_pillar_blocks(p_pillar_id uuid, p_blocks jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'p_blocks debe ser un arreglo' using errcode = 'data_exception';
  end if;
  if jsonb_array_length(p_blocks) > 200 then
    raise exception 'demasiados bloques: %', jsonb_array_length(p_blocks) using errcode = 'data_exception';
  end if;

  delete from program_pillar_blocks where pillar_id = p_pillar_id;

  insert into program_pillar_blocks (pillar_id, block_type, sort_order, content)
  select p_pillar_id, b.block_type, b.sort_order, b.content
    from jsonb_to_recordset(p_blocks) as b(block_type text, sort_order int, content jsonb);
end;
$$;

create or replace function update_series_with_mappings(
  p_series_id uuid,
  p_mappings jsonb,
  p_title text,
  p_description text,
  p_published boolean
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  touched int;
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

  delete from variant_series_map where series_id = p_series_id;

  insert into variant_series_map (program_variant_id, series_id, ordinal)
  select m.program_variant_id, p_series_id, m.ordinal
    from jsonb_to_recordset(p_mappings) as m(program_variant_id uuid, ordinal int);

  update program_series
     set title = p_title, description = p_description, published = p_published
   where id = p_series_id;

  get diagnostics touched = row_count;
  if touched <> 1 then
    raise exception 'serie no actualizada: % filas', touched using errcode = 'data_exception';
  end if;
end;
$$;

comment on function save_day_blocks(uuid, jsonb) is
  'Reemplaza en una sola transacción los bloques de un día. Recibe [{block_type, sort_order, content}] ya validado y saneado. SECURITY INVOKER: RLS gobierna.';
comment on function save_pillar_blocks(uuid, jsonb) is
  'Reemplaza en una sola transacción los bloques de un pilar. Recibe [{block_type, sort_order, content}] ya validado y saneado. SECURITY INVOKER: RLS gobierna.';
comment on function update_series_with_mappings(uuid, jsonb, text, text, boolean) is
  'Reemplaza los mapeos variante-serie y actualiza los metadatos de la serie en una sola transacción. Recibe [{program_variant_id, ordinal}], al menos uno. SECURITY INVOKER: RLS gobierna.';

revoke execute on function save_day_blocks(uuid, jsonb) from public, anon;
revoke execute on function save_pillar_blocks(uuid, jsonb) from public, anon;
revoke execute on function update_series_with_mappings(uuid, jsonb, text, text, boolean) from public, anon;
grant execute on function save_day_blocks(uuid, jsonb) to authenticated;
grant execute on function save_pillar_blocks(uuid, jsonb) to authenticated;
grant execute on function update_series_with_mappings(uuid, jsonb, text, text, boolean) to authenticated;
