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

   Comprueba que tocó UNA fila por cada par recibido, y si no LEVANTA. Sin esa
   comprobación, un id que ya no existe —o que RLS filtra— haría un update de
   menos filas y la acción devolvería éxito: la admin vería su orden nuevo
   pintado y al recargar seguiría el viejo. También caza ids repetidos, porque
   Postgres actualiza cada fila como mucho una vez por sentencia.

   Cuántas espera tocar lo deduce ELLA de `payload`, no se lo dice el llamador.
   Si fuera un parámetro, quien llamara al endpoint por su cuenta controlaría
   los dos lados de la igualdad y la garantía dejaría de ser una garantía.

   La comprobación va DENTRO de la función a propósito. Comparar el conteo
   después, en el llamador, ya sería tarde: el update habría hecho commit y
   tendríamos "error" sobre una base sí modificada —justo el orden a medias que
   este cambio viene a quitar—. Al levantar aquí, la llamada entera se deshace
   y "error" vuelve a significar "no se escribió nada".

   SECURITY INVOKER (explícito, aunque sea el default): corre con los permisos
   de quien llama, así que la política de escritura de admin que ya gobierna
   esta tabla la gobierna también aquí. Un SECURITY DEFINER se saltaría RLS y
   necesitaría su propio is_admin() — un camino privilegiado nuevo para algo
   que ya tiene uno correcto.

   Aun así se le quita el EXECUTE a public/anon. RLS ya impide que un no-admin
   toque una fila, pero el payload se parsea y se expande ANTES de que RLS
   filtre nada: dejar la función abierta regala trabajo de servidor a cualquiera
   que llegue al endpoint. La autorización la sigue dando RLS; esto es sólo
   mínimo privilegio encima.

   El tope de `payload` es de la misma familia: el cuestionario no llega ni de
   lejos a 200 preguntas, así que un array mayor no es un uso, es un abuso.

   `set search_path` fijo para que la resolución de `onboarding_questions` no
   dependa del search_path del llamador.

   Comentario en bloque a propósito: la Management API recibe el SQL en UNA
   sola línea, y una cabecera con `--` autocomentaría todo lo que va detrás.

   Tras aplicarla hay que recargar el cache de esquema de PostgREST
   (`notify pgrst, 'reload schema'`, o guardar desde el panel), o las primeras
   llamadas responden 404 aunque la función ya exista.
   ============================================================ */

create or replace function reorder_onboarding_questions(payload jsonb)
returns int
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  expected int;
  touched  int;
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception 'payload debe ser un arreglo' using errcode = 'data_exception';
  end if;

  expected := jsonb_array_length(payload);

  if expected = 0 then
    return 0;
  end if;

  if expected > 200 then
    raise exception 'demasiadas preguntas: %', expected using errcode = 'data_exception';
  end if;

  update onboarding_questions q
     set sort_order = (e->>'sort_order')::int
    from jsonb_array_elements(payload) as e
   where q.id = (e->>'id')::uuid;

  get diagnostics touched = row_count;

  -- Menos filas que pares significa: un id que ya no existe, uno repetido, o
  -- uno que RLS no deja tocar. Los tres dejan un orden que no es el pedido.
  if touched <> expected then
    raise exception 'orden parcial: % de % preguntas', touched, expected
      using errcode = 'data_exception';
  end if;

  return touched;
end;
$$;

comment on function reorder_onboarding_questions(jsonb) is
  'Aplica en una sola escritura el orden de las preguntas de onboarding. Recibe [{id, sort_order}] ya calculado por reindexOrder; si no toca una fila por par, levanta y se deshace todo. SECURITY INVOKER: RLS gobierna.';

revoke execute on function reorder_onboarding_questions(jsonb) from public, anon;
grant execute on function reorder_onboarding_questions(jsonb) to authenticated;
