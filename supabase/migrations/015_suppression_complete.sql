-- Complément n° 15 : quand on supprime son compte, ses photos souvenirs partent aussi
-- (avant, seules les photos de profil étaient effacées).
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then raise exception 'Pas connecté'; end if;
  -- Les photos (profil et souvenirs) rangées dans le dossier de la personne.
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'delete from storage.objects where bucket_id in (''avatars'', ''souvenirs'') and (storage.foldername(name))[1] = $1' using moi::text;
  end if;
  delete from auth.users where id = moi; -- le reste suit (suppression en cascade)
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
