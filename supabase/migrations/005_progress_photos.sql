-- supabase/migrations/005_progress_photos.sql
-- Fase 3: fotos de progreso privadas + comentario.

-- 1. Comentario libre por foto (reemplaza el uso de 'angle', que queda sin uso).
alter table progress_photos add column if not exists caption text;

-- 2. Bucket privado para fotos de progreso (NO público, a diferencia de 'content').
insert into storage.buckets (id, name, public)
values ('progress', 'progress', false)
on conflict (id) do nothing;

-- 3. RLS de Storage para el bucket 'progress'.
--    La clienta solo accede a objetos bajo su propio prefijo {profile_id}/...
--    (el primer segmento del path es su uid). Admin ve todo.
create policy "progress_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

create policy "progress_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "progress_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

-- 4. progress_photos ya tiene RLS own_or_admin en 001. Confirmar/crear por si falta.
--    (Idempotente: drop + create.)
drop policy if exists "progress_photos_own_or_admin" on progress_photos;
create policy "progress_photos_own_or_admin"
  on progress_photos for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());
