-- ============================================================
-- 018 — Reordenar preguntas de onboarding en una sola escritura (D18)
--
-- Antes, `reorderQuestions` aplicaba el orden con un `update` por pregunta y
-- salía al primer error, así que un fallo a media lista dejaba el cuestionario
-- renumerado a trozos: un orden que la admin nunca eligió y nunca vio, que las
-- clientas nuevas contestan antes de que nadie lo note.
--
-- La función aplica el orden entero de golpe. NO decide las posiciones: las
-- recibe ya calculadas por `reindexOrder` (lib/admin/onboarding-helpers.ts),
-- que es su único hogar y tiene tests. Numerar aquí con `with ordinality`
-- volvería a dejar esa regla en dos sitios, sólo que el segundo en SQL.
--
-- SECURITY INVOKER (explícito, aunque sea el default): corre con los permisos
-- de quien llama, así que la política de escritura de admin que ya gobierna
-- esta tabla la gobierna también aquí. Un SECURITY DEFINER se saltaría RLS y
-- necesitaría su propio is_admin() — un camino privilegiado nuevo para algo
-- que ya tiene uno correcto. Por eso no hace falta restringir el EXECUTE:
-- quien no es admin puede llamarla, pero RLS no le deja tocar ninguna fila.
--
-- `set search_path` fijo para que la resolución de `onboarding_questions` no
-- dependa del search_path del llamador.
-- ============================================================

create or replace function reorder_onboarding_questions(payload jsonb)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update onboarding_questions q
     set sort_order = (e->>'sort_order')::int
    from jsonb_array_elements(payload) as e
   where q.id = (e->>'id')::uuid;
$$;

comment on function reorder_onboarding_questions(jsonb) is
  'Aplica en una sola escritura el orden de las preguntas de onboarding. Recibe [{id, sort_order}] ya calculado por reindexOrder. SECURITY INVOKER: RLS gobierna.';
