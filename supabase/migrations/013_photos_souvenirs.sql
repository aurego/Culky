-- Complément n° 13 : sa propre photo sur une activité (concert, expo).
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.

-- 1. L'adresse de la photo, sur l'activité.
alter table activites add column if not exists photo_url text;

-- 2. Les photos souvenirs, rangées dans un dossier par personne (lisibles par tous, modifiables par soi).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('souvenirs', 'souvenirs', true) on conflict (id) do nothing;
    execute 'drop policy if exists "souvenirs lisibles" on storage.objects';
    execute 'drop policy if exists "je range mes souvenirs" on storage.objects';
    execute 'drop policy if exists "je retire mes souvenirs" on storage.objects';
    execute $p$create policy "souvenirs lisibles" on storage.objects for select using (bucket_id = 'souvenirs')$p$;
    execute $p$create policy "je range mes souvenirs" on storage.objects for insert to authenticated
              with check (bucket_id = 'souvenirs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "je retire mes souvenirs" on storage.objects for delete to authenticated
              using (bucket_id = 'souvenirs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
