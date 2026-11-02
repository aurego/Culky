-- =====================================================================
-- Culky — complément n° 4 : les notifications dans l'appli
-- À coller une seule fois dans Supabase › SQL Editor › New query › Run.
-- La base crée elle-même les notifications (Culkoko, conseil, invitation…),
-- et une tâche programmée prépare chaque matin les rappels des sorties prévues.
-- =====================================================================

-- 1. Quelques colonnes de plus pour savoir de quoi parle chaque notification.
alter table notifications add column if not exists sortie_id uuid references sorties on delete cascade;
alter table notifications add column if not exists oeuvre_id uuid references oeuvres on delete cascade;
alter table notifications add column if not exists detail text;            -- « partant », nombre de jours…
alter table notifications add column if not exists cle text unique;         -- évite d'envoyer deux fois le même rappel

-- 2. Une seule fonction pour créer une notification (jamais à soi-même).
create or replace function public.notifier(
  pour uuid, quoi text, par uuid default null, activite uuid default null, pense uuid default null,
  sortie uuid default null, oeuvre uuid default null, infos text default null, cle_unique text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if pour is null or pour = par then return; end if;
  -- Une personne bloquée ne peut pas déranger.
  if par is not null and exists (select 1 from blocages where bloqueur_id = pour and bloque_id = par) then return; end if;
  insert into notifications (destinataire_id, type, acteur_id, activite_id, pense_id, sortie_id, oeuvre_id, detail, cle)
  values (pour, quoi, par, activite, pense, sortie, oeuvre, infos, cle_unique)
  on conflict (cle) do nothing;
end $$;

-- 3. Les déclencheurs : chaque geste prévient la bonne personne.
create or replace function public.notif_culkoko() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notifier((select auteur_id from activites where id = new.activite_id), 'culkoko', new.profil_id, activite => new.activite_id);
  return new;
end $$;
drop trigger if exists quand_culkoko on culkoko;
create trigger quand_culkoko after insert on culkoko for each row execute function public.notif_culkoko();

create or replace function public.notif_abonne() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notifier(new.suivi_id, 'abonne', new.abonne_id);
  return new;
end $$;
drop trigger if exists quand_abonne on abonnements;
create trigger quand_abonne after insert on abonnements for each row execute function public.notif_abonne();

create or replace function public.notif_conseil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notifier(new.destinataire_id, 'conseil', new.expediteur_id, pense => new.id, oeuvre => new.oeuvre_id);
  else
    if old.merci_le is null and new.merci_le is not null then
      perform notifier(new.expediteur_id, 'merci', new.destinataire_id, pense => new.id, oeuvre => new.oeuvre_id);
    end if;
    if old.activite_bouclee_id is null and new.activite_bouclee_id is not null then
      perform notifier(new.expediteur_id, 'boucle', new.destinataire_id, activite => new.activite_bouclee_id, pense => new.id, oeuvre => new.oeuvre_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists quand_conseil on penses;
create trigger quand_conseil after insert or update on penses for each row execute function public.notif_conseil();

create or replace function public.notif_sortie() returns trigger
language plpgsql security definer set search_path = public as $$
declare s sorties;
begin
  select * into s from sorties where id = new.sortie_id;
  if tg_op = 'INSERT' then
    perform notifier(new.profil_id, 'sortie_invitation', s.organisateur_id, sortie => s.id, oeuvre => s.oeuvre_id);
  elsif new.reponse is distinct from old.reponse and new.reponse <> 'invite' then
    perform notifier(s.organisateur_id, 'sortie_reponse', new.profil_id, sortie => s.id, oeuvre => s.oeuvre_id, infos => new.reponse);
  end if;
  return new;
end $$;
drop trigger if exists quand_sortie on sortie_participants;
create trigger quand_sortie after insert or update on sortie_participants for each row execute function public.notif_sortie();

-- 4. Les rappels : la veille et le jour d'une sortie prévue.
--    Appelée chaque matin par la tâche programmée (pour tout le monde),
--    et à l'ouverture de l'appli (pour la personne connectée seulement).
create or replace function public.generer_rappels() returns void
language plpgsql security definer set search_path = public as $$
declare
  cible uuid := auth.uid();      -- null quand c'est la tâche programmée
  r record;
  jour date := (now() at time zone 'Europe/Paris')::date;
begin
  for r in
    select s.id, s.oeuvre_id, s.date_prevue, p.profil_id
    from sorties s
    join lateral (
      select s.organisateur_id as profil_id
      union
      select sp.profil_id from sortie_participants sp where sp.sortie_id = s.id and sp.reponse <> 'pas_cette_fois'
    ) p on true
    where s.date_prevue in (jour, jour + 1) and (cible is null or p.profil_id = cible)
  loop
    perform notifier(r.profil_id,
      case when r.date_prevue = jour then 'sortie_jour' else 'sortie_veille' end,
      sortie => r.id, oeuvre => r.oeuvre_id,
      cle_unique => concat_ws(':', 'sortie', r.id, r.profil_id, r.date_prevue - jour));
  end loop;

end $$;
grant execute on function public.generer_rappels() to authenticated;

-- 5. Lire et marquer comme lues ses notifications (les règles existent déjà ; on s'assure qu'elles sont là).
drop policy if exists "mes notifications" on notifications;
drop policy if exists "je marque comme lue" on notifications;
create policy "mes notifications" on notifications for select using (destinataire_id = auth.uid());
create policy "je marque comme lue" on notifications for update using (destinataire_id = auth.uid()) with check (destinataire_id = auth.uid());

-- 6. La tâche programmée : chaque matin à 7 h (heure de Paris en hiver, 8 h en été).
--    Si l'extension n'est pas disponible, les rappels se créeront quand même à l'ouverture de l'appli.
do $$
begin
  execute 'create extension if not exists pg_cron';
  execute $c$select cron.schedule('culky-rappels', '0 6 * * *', 'select public.generer_rappels()')$c$;
exception when others then
  raise notice 'Tâche programmée non créée (%). Les rappels se créeront à l''ouverture de l''appli.', sqlerrm;
end $$;
