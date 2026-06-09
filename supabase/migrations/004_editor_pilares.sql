-- supabase/migrations/004_editor_pilares.sql

-- 1.1 Rename day_type 'assessment' → 'cardio'
alter table program_days drop constraint program_days_day_type_check;
alter table program_days add constraint program_days_day_type_check
  check (day_type in ('workout', 'rest', 'cardio'));

-- 1.3 Nuevo block type cardio_zone2 en program_day_blocks
alter table program_day_blocks drop constraint program_day_blocks_block_type_check;
alter table program_day_blocks add constraint program_day_blocks_block_type_check
  check (block_type in ('text','youtube','pdf','image','exercise_list','cardio_zone2'));

-- 1.4 Pilares mensuales
create table program_series_pillars (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references program_series(id) on delete cascade,
  pillar_key text not null check (pillar_key in
    ('alimentacion','autoconocimiento','estres_sueno','respiraciones')),
  title text not null,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(series_id, pillar_key)
);

create table program_pillar_blocks (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references program_series_pillars(id) on delete cascade,
  block_type text not null check (block_type in
    ('text','youtube','pdf','image','exercise_list','cardio_zone2')),
  sort_order int not null,
  content jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_program_series_pillars_updated_at
  before update on program_series_pillars for each row execute function set_updated_at();
create trigger trg_program_pillar_blocks_updated_at
  before update on program_pillar_blocks for each row execute function set_updated_at();

-- RLS (espejo de program_days / program_day_blocks)
alter table program_series_pillars enable row level security;
alter table program_pillar_blocks enable row level security;

create policy "pillars_read_published"
  on program_series_pillars for select using (published = true or is_admin());
create policy "pillars_admin_write"
  on program_series_pillars for all using (is_admin());

create policy "pillar_blocks_read_published"
  on program_pillar_blocks for select using (
    exists (
      select 1 from program_series_pillars p
      where p.id = program_pillar_blocks.pillar_id
        and (p.published = true or is_admin())
    )
  );
create policy "pillar_blocks_admin_write"
  on program_pillar_blocks for all using (is_admin());

-- Bucket de Storage para PDFs/imágenes de contenido
insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do nothing;

-- Solo admins escriben en el bucket content; lectura pública
create policy "content_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and is_admin());
create policy "content_public_read"
  on storage.objects for select using (bucket_id = 'content');
