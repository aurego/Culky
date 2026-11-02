-- Complément n° 11 : les chouchous du profil, et l'invitation simple d'un ami.
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.

-- 1. Mes chouchous : jusqu'à 6 œuvres que je mets en avant sur mon profil.
alter table activites add column if not exists chouchou boolean not null default false;
create index if not exists activites_chouchous on activites (auteur_id) where chouchou;

create or replace function public.limite_chouchous() returns trigger
language plpgsql as $$
begin
  if new.chouchou and not coalesce(old.chouchou, false)
     and (select count(*) from activites where auteur_id = new.auteur_id and chouchou and id <> new.id) >= 6 then
    raise exception 'Six chouchous au maximum' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists six_chouchous on activites;
create trigger six_chouchous before insert or update of chouchou on activites
  for each row execute function public.limite_chouchous();

-- 2. « Rejoins-moi sur Culky » : le lien d'invitation d'une personne (sans œuvre à conseiller).
--    Quand l'ami crée son compte avec ce lien, on se suit l'un l'autre, et la personne est prévenue.
create or replace function public.rejoindre(parrain uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null or parrain is null or parrain = moi then return false; end if;
  if not exists (select 1 from profils where id = parrain) then return false; end if;
  if exists (select 1 from blocages b where (b.bloqueur_id = moi and b.bloque_id = parrain)
                                         or (b.bloqueur_id = parrain and b.bloque_id = moi)) then return false; end if;
  insert into abonnements (abonne_id, suivi_id) values (moi, parrain) on conflict do nothing;
  insert into abonnements (abonne_id, suivi_id) values (parrain, moi) on conflict do nothing;
  perform notifier(parrain, 'invitation_acceptee', moi, cle_unique => 'rejoindre:' || parrain || ':' || moi);
  return true;
end $$;
grant execute on function public.rejoindre(uuid) to authenticated;
