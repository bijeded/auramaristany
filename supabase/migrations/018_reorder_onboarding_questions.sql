/* ============================================================
   018 — Reordenar preguntas de onboarding en una sola escritura (D18)

   Antes, `reorderQuestions` aplicaba el orden con un `update` por pregunta y
   salía al primer error, así que un fallo a media lista dejaba el cuestionario
   renumerado a trozos: un orden que la admin nunca eligió y nunca vio, que las
   clientes nuevas contestan antes de que nadie lo note.

   La función aplica el orden entero de golpe. NO decide las posiciones: las
   recibe ya calculadas por `reindexOrder` (lib/admin/onboarding-helpers.ts),
   que es su único hogar y tiene tests. Numerar aquí con `with ordinality`
   volvería a dejar esa regla en dos sitios, sólo que el segundo en SQL.

   Recibe también CUÁNTAS filas espera tocar, y si no coinciden LEVANTA. Sin
   esa comprobación, un id que ya no existe —o que RLS filtra— haría un update
   de menos filas y la acción devolvería éxito: la admin vería su orden nuevo
   pintado y al recargar seguiría el viejo.

   La comprobación va DENTRO de la función a propósito. Comparar el conteo
   después, en el llamador, ya sería tarde: el update habría hecho commit y
   tendríamos "error" sobre una base sí modificada —justo el orden a medias que
   este cambio viene a quitar—. Al levantar aquí, la llamada entera se deshace
   y "error" vuelve a significar "no se escribió nada".

   SECURITY INVOKER (explícito, aunque sea el default): corre con los permisos
   de quien llama, así que la política de escritura de admin que ya gobierna
   esta tabla la gobierna también aquí. Un SECURITY DEFINER se saltaría RLS y
   necesitaría su propio is_admin() — un camino privilegiado nuevo para algo
   que ya tiene uno correcto. Por eso no hace falta restringir el EXECUTE:
   quien no es admin puede llamarla, pero RLS no le deja tocar ninguna fila
   (y entonces el conteo sale 0 y la acción falla, que es lo correcto).

   `set search_path` fijo para que la resolución de `onboarding_questions` no
   dependa del search_path del llamador.

   Comentario en bloque a propósito: la Management API recibe el SQL en UNA
   sola línea, y una cabecera con `--` autocomentaría todo lo que va detrás.

   Tras aplicarla hay que recargar el cache de esquema de PostgREST
   (`notify pgrst, 'reload schema'`, o guardar desde el panel), o las primeras
   llamadas responden 404 aunque la función ya exista.
   ============================================================ */

create or replace function reorder_onboarding_questions(payload jsonb, expected int)
returns int
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  touched int;
begin
  update onboarding_questions q
     set sort_order = (e->>'sort_order')::int
    from jsonb_array_elements(payload) as e
   where q.id = (e->>'id')::uuid;

  get diagnostics touched = row_count;

  if touched <> expected then
    raise exception 'orden parcial: % de % preguntas', touched, expected
      using errcode = 'data_exception';
  end if;

  return touched;
end;
$$;

comment on function reorder_onboarding_questions(jsonb, int) is
  'Aplica en una sola escritura el orden de las preguntas de onboarding. Recibe [{id, sort_order}] ya calculado por reindexOrder y el numero de filas que espera tocar; si no coinciden levanta y se deshace todo. SECURITY INVOKER: RLS gobierna.';
