-- 015_per_variant_curriculum.sql
-- L2a — el currículo pasa a ser POR VARIANTE.
--
-- Problema que resuelve: `unique(program_id, series_number)` hace que un número
-- de mes sea único en TODO el programa. Pero un programa tiene varios niveles y
-- cada uno necesita su propio currículo numerado desde 1 (Strong & Fit tiene
-- tres niveles y sólo cabían seis series en total). Además el contenido difiere
-- por VARIANTE, no por nivel: Principiante Poco Tiempo y Principiante Tiempo
-- Suficiente son entrenamientos distintos. Por eso la posición pasa al mapeo
-- (`variant_series_map.ordinal`) y `series_number` desaparece.
--
-- ⚠ DESTRUCTIVA. Borra todo el contenido y lo vuelve a sembrar. Es seguro sólo
-- porque a 2026-07-27 todo el contenido es demo: 1 serie, 28 días, 244 bloques,
-- nada escrito por Aura (verificado). Si esto se ejecuta cuando ya exista
-- currículo real, DESTRUYE SU TRABAJO.
--
-- ⚠ Al aplicarla, la app desplegada queda rota (lee `series_number`) hasta que
-- se despliegue el código de este mismo cambio. Decisión tomada: se acepta.
--
-- Re-ejecutarla es seguro por construcción: borra todo y siembra de cero, así
-- que el estado final es el mismo (no necesita `on conflict do nothing`).

begin;

-- ── 1. Borrado del contenido demo ────────────────────────────────────────────
-- Orden por FKs: `program_days.series_id` NO tiene cascade (001:99), así que hay
-- que borrarlo a mano. Sí caen por cascade: `program_day_blocks` desde
-- `program_days`, y `program_series_pillars` → `program_pillar_blocks` desde
-- `program_series`.
delete from variant_series_map;
delete from program_days;
delete from program_series;

-- ── 2. La posición vive en el mapeo, no en la serie ──────────────────────────
alter table variant_series_map add column ordinal int not null;

alter table variant_series_map
  add constraint variant_series_map_variant_ordinal_key
  unique (program_variant_id, ordinal);

-- ── 3. `series_number` deja de direccionar contenido ─────────────────────────
-- Se elimina en lugar de conservarse como "etiqueta": sería un segundo número
-- de mes sin garantía de integridad y sin lector, libre de divergir del ordinal
-- que ve la cliente.
alter table program_series
  drop constraint if exists program_series_program_id_series_number_key;
alter table program_series drop column series_number;

-- ── 4. El orden entre niveles se declara como dato ───────────────────────────
-- Lo lee el cambio siguiente (l2-level-ladder-progression); aquí sólo se puebla.
-- Se declara en vez de deducirse de `level` porque CuarentaMás NO es escalera
-- (es de plazo fijo) y porque Extra podría ganar el eje `time_availability`.
alter table program_variants
  add column ladder_next_variant_id uuid references program_variants(id);

alter table program_variants
  add constraint program_variants_ladder_not_self
  check (ladder_next_variant_id is null or ladder_next_variant_id <> id);

-- Strong & Fit: Principiante → Intermedio → Avanzado → (fin)
update program_variants set ladder_next_variant_id = '00000000-0000-0000-0002-000000000009'
  where id = '00000000-0000-0000-0002-000000000008';
update program_variants set ladder_next_variant_id = '00000000-0000-0000-0002-000000000010'
  where id = '00000000-0000-0000-0002-000000000009';

-- CuarentaMás Extra: Intermedio → Avanzado → (fin)
update program_variants set ladder_next_variant_id = '00000000-0000-0000-0002-000000000007'
  where id = '00000000-0000-0000-0002-000000000006';

-- Las 5 variantes de CuarentaMás quedan en null: plazo fijo, terminan, no escalan.

-- ── 5. Resiembra del contenido demo bajo la forma nueva ──────────────────────
-- 6 meses por CADA variante, numerados desde 1 en cada una: es justo el caso que
-- antes era imposible. Antes de esto sólo 2 de 20 clientes demo veían contenido
-- (existía una única serie, mapeada a las 5 variantes de CuarentaMás, y el
-- resolutor pedía series_number = months_elapsed).
--
-- Tablas temporales en vez de CTEs encadenados: los ids se generan una sola vez
-- y se reutilizan sin depender del orden de evaluación de CTEs modificadores.

create temp table _spec on commit drop as
select
  pv.id           as variant_id,
  pv.program_id   as program_id,
  pv.name         as variant_name,
  n               as ordinal,
  gen_random_uuid() as series_id
from program_variants pv
cross join generate_series(1, 6) as n;

create temp table _day_spec on commit drop as
select
  s.series_id,
  w.week_number,
  d.day_of_week,
  gen_random_uuid() as day_id
from _spec s
cross join generate_series(1, 4) as w(week_number)
cross join (values ('lunes'), ('miercoles'), ('viernes')) as d(day_of_week);

insert into program_series (id, program_id, title, description, published)
select
  series_id,
  program_id,
  'Mes ' || ordinal || ' · ' || variant_name,
  'Contenido demo. Se reemplaza con el currículo real.',
  true
from _spec;

insert into variant_series_map (program_variant_id, series_id, ordinal)
select variant_id, series_id, ordinal from _spec;

insert into program_days
  (id, series_id, week_number, day_of_week, workout_focus, title, day_type, duration_minutes, published)
select
  day_id,
  series_id,
  week_number,
  day_of_week,
  'Full Body',
  'Entrenamiento demo',
  'workout',
  40,
  true
from _day_spec;

insert into program_day_blocks (day_id, block_type, sort_order, content)
select
  day_id,
  'text',
  1,
  jsonb_build_object(
    'html',
    '<p>Contenido demo. Aura reemplaza este bloque con el entrenamiento real.</p>'
  )
from _day_spec;

commit;
