-- 016_content_ladder_pointer.sql
-- L2b — la posición en el contenido pasa a ser estado explícito de la suscripción.
--
-- Problema que resuelve: hoy el contenido se direcciona con `months_elapsed`
-- sobre la variante comprada. Eso rompe por dos lados:
--   · el mes 7 de Strong & Fit Principiante no resuelve a ninguna serie —la
--     cliente paga y no ve nada—, porque nada hace subir de nivel;
--   · una cliente que Aura evalúa y manda directa a Intermedio recibe el mes 1
--     de PRINCIPIANTE, contenido equivocado desde el primer día en un programa
--     de fuerza para mujeres de 40+, donde el nivel es seguridad, no gusto.
--
-- La posición pasa a tres columnas que avanzan un paso por mes cobrado:
--   content_variant_id  el peldaño en el que está AHORA (≠ el que compró)
--   content_ordinal     la posición dentro de ese peldaño
--   content_loops       vueltas completadas en el último peldaño
--
-- `program_variant_id` NO cambia: es lo que compró y su vínculo con el precio de
-- Stripe. `months_elapsed` tampoco cambia de significado: sigue siendo el
-- árbitro de facturación y de tiempo transcurrido, y deja de ser la dirección
-- del contenido.
--
-- Por qué estado guardado y no aritmética sobre `months_elapsed`: el catálogo de
-- Avanzado crece por diseño. Cualquier posición derivada de un conteo se
-- reordena sola al publicar una serie más y baraja a todas las clientes que ya
-- daban vueltas.
--
-- Run-once: NO re-ejecutar. Un segundo intento falla en `add column` (42701) y
-- hace rollback — inofensivo, pero no es una comprobación válida (misma lección
-- que 014 con 42P07 y 015).

begin;

alter table subscriptions
  add column content_variant_id uuid references program_variants(id),
  add column content_ordinal int not null default 1,
  add column content_loops int not null default 0;

comment on column subscriptions.content_variant_id is
  'Peldaño de contenido actual. Distinto de program_variant_id en cuanto la cliente sube de nivel: aquél es lo que paga, éste lo que entrena.';
comment on column subscriptions.content_ordinal is
  'Posición dentro del peldaño (variant_series_map.ordinal). Avanza un paso por invoice.paid nuevo, nunca se calcula desde months_elapsed.';
comment on column subscriptions.content_loops is
  'Vueltas completadas en el último peldaño. > 0 activa el aviso "Repitiendo Mes N" en el portal.';

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Toda suscripción existente empezó en la variante que compró y no ha subido de
-- peldaño (nada en el código lo hacía), así que su peldaño es esa misma variante
-- y su posición es el mes que lleva.
--
-- Verificado contra la base viva el 2026-07-28 antes de aplicar: 20 filas, y el
-- `months_elapsed` de cada una (1..6) existe como `ordinal` en el currículo de su
-- propia variante (las 10 variantes tienen 1,2,3,4,5,6). Ninguna queda apuntando
-- a una posición inexistente.
update subscriptions
   set content_variant_id = program_variant_id,
       content_ordinal    = greatest(months_elapsed, 1),
       content_loops      = 0;

commit;
