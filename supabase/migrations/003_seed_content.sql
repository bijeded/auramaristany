-- 003_seed_content.sql
-- Seed: 1 serie para CuarentaMás (Mes 1) con días y bloques de los 5 tipos.
-- Propósito: tener contenido real para poder probar /portal/today.
-- Corre en Supabase Dashboard → SQL Editor → New query.
--
-- Prerequisito: 002_seed_programs_variants.sql ya aplicado.
-- IDs de variantes CuarentaMás: 00000000-0000-0000-0002-00000000000{1..5}
-- ID programa CuarentaMás:      00000000-0000-0000-0001-000000000001

-- ── 1. SERIE (Mes 1) ──────────────────────────────────────────────────────────

insert into program_series (id, program_id, series_number, title, description, published)
values (
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0001-000000000001',
  1,
  'Estrategia Antisedentarismo',
  'Primer mes del programa. Enfoque en activar el metabolismo y establecer hábitos.',
  true
);

-- ── 2. MAPEO variante → serie (las 5 variantes de CuarentaMás) ───────────────

insert into variant_series_map (program_variant_id, series_id) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000001'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000001'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000001'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0003-000000000001'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0003-000000000001');

-- ── 3. DÍAS ───────────────────────────────────────────────────────────────────
-- Semana 1: lunes, miércoles, viernes (jueves y fin de semana = descanso automático)
-- Semana 2: lunes, miércoles (para probar navegación entre semanas)

insert into program_days
  (id, series_id, week_number, day_of_week, workout_focus, title, day_type, duration_minutes, published)
values
  -- Semana 1
  ('00000000-0000-0000-0004-000000000001',
   '00000000-0000-0000-0003-000000000001',
   1, 'lunes', 'Tren Inferior',
   'Piernas y Glúteos — Bienvenida al programa',
   'workout', 40, true),

  ('00000000-0000-0000-0004-000000000002',
   '00000000-0000-0000-0003-000000000001',
   1, 'miercoles', 'Tren Superior',
   'Brazos, Hombros y Espalda',
   'workout', 45, true),

  ('00000000-0000-0000-0004-000000000003',
   '00000000-0000-0000-0003-000000000001',
   1, 'viernes', 'Full Body',
   'Entrenamiento Completo — Cierre de semana',
   'workout', 50, true),

  -- Semana 2
  ('00000000-0000-0000-0004-000000000004',
   '00000000-0000-0000-0003-000000000001',
   2, 'lunes', 'Tren Inferior',
   'Piernas y Glúteos — Progresión',
   'workout', 40, true),

  ('00000000-0000-0000-0004-000000000005',
   '00000000-0000-0000-0003-000000000001',
   2, 'miercoles', 'Protocolo Cardiovascular',
   'Cardio y Movilidad',
   'workout', 35, true);

-- ── 4. BLOQUES para el día lunes semana 1 (los 5 tipos) ──────────────────────

insert into program_day_blocks (id, day_id, block_type, sort_order, content)
values

  -- Bloque 1: Texto introductorio
  ('00000000-0000-0000-0005-000000000001',
   '00000000-0000-0000-0004-000000000001',
   'text', 1,
   '{"html": "<h2>Bienvenida a tu primer entrenamiento</h2><p>Hoy comenzamos con <strong>Tren Inferior</strong>. El objetivo de esta sesión es activar los músculos de las piernas y los glúteos con movimientos controlados. Recuerda calentar 5 minutos antes de empezar.</p><ul><li>Mantén la espalda recta en todo momento</li><li>Respira: exhala en el esfuerzo, inhala al regresar</li><li>Si sientes dolor articular, detente y ajusta el peso</li></ul>"}'::jsonb),

  -- Bloque 2: Video de YouTube (calentamiento)
  ('00000000-0000-0000-0005-000000000002',
   '00000000-0000-0000-0004-000000000001',
   'youtube', 2,
   '{"video_id": "dQw4w9WgXcQ", "title": "Calentamiento de 5 minutos — Tren Inferior"}'::jsonb),

  -- Bloque 3: Lista de ejercicios (con métricas de reps y peso)
  ('00000000-0000-0000-0005-000000000003',
   '00000000-0000-0000-0004-000000000001',
   'exercise_list', 3,
   '{
     "exercises": [
       {
         "id": "ex-001",
         "name": "Sentadilla con mancuernas",
         "sets": 3,
         "reps": "12",
         "rest_seconds": 60,
         "notes": "Baja hasta que los muslos queden paralelos al suelo",
         "video_url": "",
         "metrics": ["reps_done", "weight_kg"]
       },
       {
         "id": "ex-002",
         "name": "Hip Thrust con barra",
         "sets": 3,
         "reps": "15",
         "rest_seconds": 90,
         "notes": "Aprieta los glúteos en la parte alta del movimiento",
         "video_url": "",
         "metrics": ["reps_done", "weight_kg"]
       },
       {
         "id": "ex-003",
         "name": "Zancadas alternadas",
         "sets": 3,
         "reps": "10 por lado",
         "rest_seconds": 60,
         "notes": "Mantén el torso erguido y la rodilla delantera sobre el tobillo",
         "video_url": "",
         "metrics": ["reps_done"]
       },
       {
         "id": "ex-004",
         "name": "Puente de glúteo",
         "sets": 3,
         "reps": "20",
         "rest_seconds": 45,
         "notes": "Variante de peso corporal para finalizar",
         "video_url": "",
         "metrics": ["reps_done"]
       }
     ]
   }'::jsonb),

  -- Bloque 4: PDF adjunto
  ('00000000-0000-0000-0005-000000000004',
   '00000000-0000-0000-0004-000000000001',
   'pdf', 4,
   '{"storage_path": "pdfs/mes1-semana1-lunes-guia.pdf", "filename": "Guía Mes 1 — Semana 1.pdf", "label": "Descarga la guía de esta semana"}'::jsonb),

  -- Bloque 5: Imagen de referencia
  ('00000000-0000-0000-0005-000000000005',
   '00000000-0000-0000-0004-000000000001',
   'image', 5,
   '{"storage_path": "images/mes1-semana1-lunes-postura.jpg", "alt": "Postura correcta para sentadilla con mancuernas"}'::jsonb);

-- ── 5. BLOQUES para miércoles semana 1 (texto + ejercicios) ──────────────────

insert into program_day_blocks (id, day_id, block_type, sort_order, content)
values
  ('00000000-0000-0000-0005-000000000006',
   '00000000-0000-0000-0004-000000000002',
   'text', 1,
   '{"html": "<h2>Tren Superior</h2><p>Hoy trabajamos brazos, hombros y espalda. Estos músculos son clave para la postura y la funcionalidad del día a día.</p>"}'::jsonb),

  ('00000000-0000-0000-0005-000000000007',
   '00000000-0000-0000-0004-000000000002',
   'exercise_list', 2,
   '{
     "exercises": [
       {
         "id": "ex-005",
         "name": "Press de hombros con mancuernas",
         "sets": 3,
         "reps": "12",
         "rest_seconds": 60,
         "notes": "Mantén el core activo",
         "video_url": "",
         "metrics": ["reps_done", "weight_kg"]
       },
       {
         "id": "ex-006",
         "name": "Remo con mancuerna",
         "sets": 3,
         "reps": "10 por lado",
         "rest_seconds": 60,
         "notes": "Codo pegado al cuerpo en la subida",
         "video_url": "",
         "metrics": ["reps_done", "weight_kg"]
       },
       {
         "id": "ex-007",
         "name": "Curl de bíceps",
         "sets": 3,
         "reps": "12",
         "rest_seconds": 45,
         "notes": "",
         "video_url": "",
         "metrics": ["reps_done", "weight_kg"]
       }
     ]
   }'::jsonb);

-- ── 6. BLOQUE para viernes semana 1 (video + ejercicios) ─────────────────────

insert into program_day_blocks (id, day_id, block_type, sort_order, content)
values
  ('00000000-0000-0000-0005-000000000008',
   '00000000-0000-0000-0004-000000000003',
   'youtube', 1,
   '{"video_id": "dQw4w9WgXcQ", "title": "Full Body — Rutina de cierre de semana"}'::jsonb),

  ('00000000-0000-0000-0005-000000000009',
   '00000000-0000-0000-0004-000000000003',
   'exercise_list', 2,
   '{
     "exercises": [
       {
         "id": "ex-008",
         "name": "Sentadilla + Press de hombros",
         "sets": 4,
         "reps": "10",
         "rest_seconds": 75,
         "notes": "Movimiento compuesto: baja en sentadilla, sube y presiona",
         "video_url": "",
         "metrics": ["reps_done", "weight_kg"]
       },
       {
         "id": "ex-009",
         "name": "Plancha",
         "sets": 3,
         "reps": "30 segundos",
         "rest_seconds": 30,
         "notes": "Cuerpo recto de cabeza a talones",
         "video_url": "",
         "metrics": ["reps_done"]
       }
     ]
   }'::jsonb);
