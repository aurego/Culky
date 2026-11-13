-- =====================================================================
-- Complément SQL n° 20 : « Mon plaisir coupable 😉 » sur le profil.
--
--   • Chacun peut choisir UNE œuvre de son journal comme plaisir coupable.
--   • En choisir une autre remplace la précédente, automatiquement.
--   • Elle s'affiche sur le profil, sous les chouchous, avec les mêmes règles de visibilité
--     que l'activité (une activité « moi seul·e » reste invisible pour les autres).
--
-- À coller tel quel dans Supabase › SQL Editor. On peut le passer deux fois sans souci.
-- =====================================================================

alter table public.activites add column if not exists plaisir_coupable boolean not null default false;
create index if not exists activites_plaisir_coupable on public.activites (auteur_id) where plaisir_coupable;

-- Chacun peut cocher ou décocher son propre plaisir coupable (la règle « je modifie mes activités » s'applique).
grant update (plaisir_coupable) on public.activites to authenticated;

-- Un seul par personne : en choisir un nouveau décoche l'ancien.
create or replace function public.un_seul_plaisir_coupable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plaisir_coupable then
    update activites set plaisir_coupable = false
     where auteur_id = new.auteur_id and plaisir_coupable and id <> new.id;
  end if;
  return new;
end $$;
revoke all on function public.un_seul_plaisir_coupable() from public, anon, authenticated;
drop trigger if exists un_seul_plaisir_coupable on public.activites;
create trigger un_seul_plaisir_coupable after insert or update of plaisir_coupable on public.activites
  for each row when (new.plaisir_coupable) execute function public.un_seul_plaisir_coupable();
