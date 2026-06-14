-- supabase/migrations/010_avatars_bucket.sql
-- Bucket público para fotos de perfil. Las escrituras pasan por el route handler
-- con service-role (omite RLS); solo se necesita lectura pública.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
