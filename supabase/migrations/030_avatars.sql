-- Foto profilo: bucket pubblico in lettura, ognuno scrive solo nella propria cartella <uid>/
-- L'URL della foto sta nei metadati dell'utente (auth.users.raw_user_meta_data.avatar_url).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: lettura pubblica" on storage.objects;
create policy "avatars: lettura pubblica" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: carica nella propria cartella" on storage.objects;
create policy "avatars: carica nella propria cartella" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: aggiorna i propri" on storage.objects;
create policy "avatars: aggiorna i propri" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: elimina i propri" on storage.objects;
create policy "avatars: elimina i propri" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
