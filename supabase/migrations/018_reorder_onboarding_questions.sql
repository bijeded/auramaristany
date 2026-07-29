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

   Devuelve CUÁNTAS filas tocó. Sin ese número, un id que ya no existe —o que
   RLS filtra— haría un update de cero filas y la acción devolvería éxito: la
   admin vería su orden nuevo pintado y al recargar seguiría el viejo. El
   llamador compara el conteo contra los ids que mandó.

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
   ============================================================ */

create or replace function reorder_onboarding_questions(payload jsonb)
returns int
language sql
security invoker
set search_path = public, pg_temp
as $$
  with updated as (
    update onboarding_questions q
       set sort_order = (e->>'sort_order')::int
      from jsonb_array_elements(payload) as e
     where q.id = (e->>'id')::uuid
    returning 1
  )
  select count(*)::int from updated;
$$;

comment on function reorder_onboarding_questions(jsonb) is
  'Aplica en una sola escritura el orden de las preguntas de onboarding. Recibe [{id, sort_order}] ya calculado por reindexOrder y devuelve cuantas filas toco. SECURITY INVOKER: RLS gobierna.';
