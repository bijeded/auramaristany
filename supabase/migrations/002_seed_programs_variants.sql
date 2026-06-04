-- 002_seed_programs_variants.sql
-- Seed: 3 programs, 10 variants (placeholder stripe_price_id), prerequisites, onboarding questions
-- Run in Supabase Dashboard → SQL Editor → New query

-- Programs
insert into programs (id, slug, name, billing_model, duration_months) values
  ('00000000-0000-0000-0001-000000000001', 'cuarenta-mas',       'CuarentaMás',       'fixed_term_monthly', 6),
  ('00000000-0000-0000-0001-000000000002', 'cuarenta-mas-extra', 'CuarentaMás Extra', 'fixed_term_monthly', 6),
  ('00000000-0000-0000-0001-000000000003', 'strong-fit',         'Strong & Fit',      'rolling_monthly',    null);

-- Program variants (stripe_price_id placeholder — updated by seed-stripe.ts output)
insert into program_variants (id, program_id, slug, name, level, time_availability, stripe_price_id, price_mxn) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-principiante-poco', 'CuarentaMás Principiante Poco Tiempo',
   'principiante', 'poco_tiempo', 'price_placeholder_1', 999.00),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-principiante-suf', 'CuarentaMás Principiante Tiempo Suficiente',
   'principiante', 'tiempo_suficiente', 'price_placeholder_2', 999.00),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-intermedio-poco', 'CuarentaMás Intermedio Poco Tiempo',
   'intermedio', 'poco_tiempo', 'price_placeholder_3', 999.00),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-intermedio-suf', 'CuarentaMás Intermedio Tiempo Suficiente',
   'intermedio', 'tiempo_suficiente', 'price_placeholder_4', 999.00),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-avanzado-suf', 'CuarentaMás Avanzado Tiempo Suficiente',
   'avanzado', 'tiempo_suficiente', 'price_placeholder_5', 999.00),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000002',
   'cuarenta-mas-extra-intermedio', 'CuarentaMás Extra Intermedio',
   'intermedio', null, 'price_placeholder_6', 999.00),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000002',
   'cuarenta-mas-extra-avanzado', 'CuarentaMás Extra Avanzado',
   'avanzado', null, 'price_placeholder_7', 999.00),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000003',
   'strong-fit-principiante', 'Strong & Fit Principiante',
   'principiante', null, 'price_placeholder_8', 999.00),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000003',
   'strong-fit-intermedio', 'Strong & Fit Intermedio',
   'intermedio', null, 'price_placeholder_9', 999.00),
  ('00000000-0000-0000-0002-000000000010', '00000000-0000-0000-0001-000000000003',
   'strong-fit-avanzado', 'Strong & Fit Avanzado',
   'avanzado', null, 'price_placeholder_10', 999.00);

-- Prerequisite: Extra Intermedio requires CuarentaMás completed (any level)
insert into program_variant_prerequisites
  (program_variant_id, prerequisite_group, required_program_slug, required_variant_levels, required_status)
values
  ('00000000-0000-0000-0002-000000000006', 1, 'cuarenta-mas', null, 'completed');

-- Prerequisite: Extra Avanzado requires (Extra Intermedio completed) OR (CuarentaMás intermedio/avanzado completed)
insert into program_variant_prerequisites
  (program_variant_id, prerequisite_group, required_program_slug, required_variant_levels, required_status)
values
  ('00000000-0000-0000-0002-000000000007', 1, 'cuarenta-mas-extra', array['intermedio'], 'completed'),
  ('00000000-0000-0000-0002-000000000007', 2, 'cuarenta-mas', array['intermedio','avanzado'], 'completed');

-- Seed 3 onboarding questions (Aura can edit these from admin panel later)
insert into onboarding_questions (sort_order, question_text, question_type, options, is_required) values
  (1, '¿Cuál es tu principal objetivo con el programa?', 'single_choice',
   '["Perder peso", "Ganar fuerza y músculo", "Mejorar mi salud general", "Aumentar mi energía"]'::jsonb, true),
  (2, '¿Tienes alguna lesión o condición médica que debamos considerar?', 'text', null, false),
  (3, '¿Cuántos días a la semana puedes entrenar?', 'single_choice',
   '["2-3 días", "4-5 días", "6-7 días"]'::jsonb, true);
