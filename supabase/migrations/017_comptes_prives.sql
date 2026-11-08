-- =====================================================================
-- Complément SQL n° 17 : comptes publics et comptes privés (comme Strava ou Instagram).
--
--   • Par défaut, un compte est PUBLIC : quand quelqu'un le suit, c'est accepté tout de suite
--     (plus de demande à valider).
--   • Une personne peut passer son compte en PRIVÉ (Réglages) : chaque nouvel abonnement
--     devient alors une demande à accepter, comme avant.
--   • Les demandes en attente vers des comptes publics sont acceptées d'office
--     (la personne qui avait demandé en est prévenue).
--
-- La sécurité ne repose pas sur l'appli : c'est la base qui décide du statut d'un nouvel
-- abonnement, quoi que l'appli envoie. À coller tel quel dans Supabase › SQL Editor.
-- On peut le passer deux fois sans souci.
-- =====================================================================

-- 1. La colonne « compte privé » sur le profil (faux par défaut : compte public).
alter table public.profils add column if not exists compte_prive boolean not null default false;

-- Chacun peut changer son propre réglage (les droits sur les colonnes sont listés un par un).
grant update (compte_prive) on public.profils to authenticated;

-- La modération ne touche pas à ce réglage sur le profil d'autrui.
create or replace function public.controle_moderation_profil() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.id is distinct from auth.uid()
     and (new.univers_choisis, new.visibilite_defaut, new.commentaires_reserves_abonnes,
          new.stats_detaillees_publiques, new.inscription_terminee, new.compte_prive)
         is distinct from
         (old.univers_choisis, old.visibilite_defaut, old.commentaires_reserves_abonnes,
          old.stats_detaillees_publiques, old.inscription_terminee, old.compte_prive)
     or (auth.uid() is not null and new.id is distinct from auth.uid() and new.photo_url is not null
         and new.photo_url is distinct from old.photo_url) then
    raise exception 'La modération ne change que le pseudo, la bio ou retire la photo.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.controle_moderation_profil() from public, anon, authenticated;

-- 2. Le statut d'un nouvel abonnement est fixé par la base, selon le compte suivi.
--    Seulement pour les abonnements créés directement par l'appli (rôle « authenticated ») :
--    les fonctions de la base (lien d'invitation secret…) gardent leur propre règle.
-- (Sans « security definer » exprès : ainsi « current_user » vaut bien « authenticated » quand c'est l'appli
--  qui écrit, et le nom du propriétaire quand c'est une fonction de la base.)
create or replace function public.statut_nouvel_abonnement() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.statut := case
      when coalesce((select compte_prive from profils where id = new.suivi_id), false) then 'en_attente'
      else 'accepte'
    end;
  end if;
  return new;
end $$;
revoke all on function public.statut_nouvel_abonnement() from public, anon, authenticated;
drop trigger if exists statut_nouvel_abonnement on public.abonnements;
create trigger statut_nouvel_abonnement before insert on public.abonnements
  for each row execute function public.statut_nouvel_abonnement();

-- Le trigger ci-dessus s'exécute avant la règle d'écriture : celle-ci accepte donc les deux statuts,
-- puisque c'est la base, et non l'appli, qui a choisi.
drop policy if exists "je m'abonne" on public.abonnements;
create policy "je m'abonne" on public.abonnements for insert to authenticated with check (
  abonne_id = auth.uid() and statut in ('en_attente', 'accepte') and not public.bloque_entre(auth.uid(), suivi_id));

-- 3. Le lien « Rejoins-moi » sans code secret : même règle (abonnement direct si le compte est public).
--    Renvoie 'abonne', 'demande_envoyee' (ou déjà en attente), 'deja_abonne', ou 'impossible'.
create or replace function public.rejoindre_etat(parrain uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  prive boolean;
begin
  if moi is null or parrain is null or parrain = moi then return 'impossible'; end if;
  if not exists (select 1 from profils where id = parrain) or public.bloque_entre(moi, parrain) then return 'impossible'; end if;
  if public.est_abonne(moi, parrain) then return 'deja_abonne'; end if;
  select compte_prive into prive from profils where id = parrain;
  if coalesce(prive, false) then
    insert into abonnements (abonne_id, suivi_id, statut) values (moi, parrain, 'en_attente') on conflict do nothing;
    return 'demande_envoyee';
  end if;
  insert into abonnements (abonne_id, suivi_id, statut) values (moi, parrain, 'accepte')
    on conflict (abonne_id, suivi_id) do update set statut = 'accepte';
  return 'abonne';
end $$;

create or replace function public.rejoindre(parrain uuid) returns boolean
language sql volatile security definer set search_path = public as $$
  select public.rejoindre_etat(parrain) in ('abonne', 'demande_envoyee', 'deja_abonne')
$$;

-- 4. Les demandes qui attendent vers un compte public : acceptées d'office.
update public.abonnements a
   set statut = 'accepte'
 where a.statut = 'en_attente'
   and not coalesce((select p.compte_prive from public.profils p where p.id = a.suivi_id), false);
