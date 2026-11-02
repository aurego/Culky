-- Complément n° 10 : supprimer son compte depuis l'appli (exigé par Apple et Google).
-- Tout part avec le compte : profil, activités, envies, conseils, commentaires, marque-pages…
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then raise exception 'Pas connecté'; end if;
  -- Les photos de profil rangées dans le dossier de la personne.
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'delete from storage.objects where bucket_id = ''avatars'' and (storage.foldername(name))[1] = $1' using moi::text;
  end if;
  delete from auth.users where id = moi; -- le reste suit (suppression en cascade)
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
