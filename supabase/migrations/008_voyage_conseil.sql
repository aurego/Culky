-- Complément n° 8 : le voyage d'un conseil.
-- Je conseille un roman à Claire ; Claire le conseille à son tour à Hugo, qui le conseille à Léa…
-- Culky montre jusqu'où mon conseil a voyagé, et combien de personnes il a rendues heureuses.
-- Confidentialité : seuls les pseudos de mes amis apparaissent, les autres sont comptés (« 3 autres personnes »).
-- À coller dans Supabase > SQL Editor, après les compléments précédents. On peut le relancer sans risque.

-- Sommes-nous amis (l'un suit l'autre) ?
create or replace function public.sont_amis(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from abonnements where (abonne_id = a and suivi_id = b) or (abonne_id = b and suivi_id = a))
$$;

-- Pour chacune des œuvres que j'ai conseillées : le chemin parcouru ensuite.
--   plus_loin : personnes touchées après mes destinataires directs
--   heureux   : personnes qui l'ont vécu, sur tout le chemin (moi exclu·e)
--   noms      : pseudos de mes amis parmi les personnes touchées plus loin, dans l'ordre du voyage
--   autres    : les autres personnes touchées plus loin, simplement comptées
create or replace function public.voyages_de_mes_conseils()
returns table (oeuvre_id uuid, plus_loin integer, heureux integer, noms text[], autres integer)
language sql stable security definer set search_path = public as $$
  with recursive chemin as (
    select p.oeuvre_id, p.destinataire_id, p.cree_le, 1 as etape, p.activite_bouclee_id
    from penses p
    where p.expediteur_id = auth.uid() and p.destinataire_id is not null
    union
    select q.oeuvre_id, q.destinataire_id, q.cree_le, c.etape + 1, q.activite_bouclee_id
    from penses q
    join chemin c on q.expediteur_id = c.destinataire_id and q.oeuvre_id = c.oeuvre_id and q.cree_le > c.cree_le
    where c.etape < 8 and q.destinataire_id is not null and q.destinataire_id <> auth.uid()
  ),
  directs as (select distinct oeuvre_id, destinataire_id from chemin where etape = 1),
  loin as (
    select c.oeuvre_id, c.destinataire_id, min(c.cree_le) as quand
    from chemin c
    where c.etape > 1 and not exists (select 1 from directs d where d.oeuvre_id = c.oeuvre_id and d.destinataire_id = c.destinataire_id)
    group by c.oeuvre_id, c.destinataire_id
  ),
  vecus as (select distinct oeuvre_id, destinataire_id from chemin where activite_bouclee_id is not null)
  select o.oeuvre_id,
         (select count(*) from loin l where l.oeuvre_id = o.oeuvre_id)::int,
         (select count(*) from vecus v where v.oeuvre_id = o.oeuvre_id)::int,
         coalesce((select array_agg(pr.pseudo order by l.quand) from loin l join profils pr on pr.id = l.destinataire_id
                   where l.oeuvre_id = o.oeuvre_id and public.sont_amis(auth.uid(), l.destinataire_id)), '{}'),
         (select count(*) from loin l where l.oeuvre_id = o.oeuvre_id and not public.sont_amis(auth.uid(), l.destinataire_id))::int
  from (select distinct oeuvre_id from chemin) o
$$;
grant execute on function public.sont_amis(uuid, uuid) to authenticated;
grant execute on function public.voyages_de_mes_conseils() to authenticated;

-- Quand quelqu'un transmet à son tour un conseil reçu, ceux qui le lui avaient conseillé en amont
-- sont prévenus : « Ton conseil voyage : Claire l'a conseillé à son tour ! »
-- (le nom n'apparaît que si la personne qui transmet est une amie).
create or replace function public.notif_voyage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.destinataire_id is null then return new; end if;
  for r in
    with recursive amont as (
      select p.expediteur_id, p.cree_le, 1 as etape
      from penses p
      where p.destinataire_id = new.expediteur_id and p.oeuvre_id = new.oeuvre_id and p.cree_le < new.cree_le
      union
      select p.expediteur_id, p.cree_le, a.etape + 1
      from penses p join amont a on p.destinataire_id = a.expediteur_id and p.oeuvre_id = new.oeuvre_id and p.cree_le < a.cree_le
      where a.etape < 8
    )
    select distinct expediteur_id from amont
    where expediteur_id <> new.expediteur_id and expediteur_id <> new.destinataire_id
  loop
    perform notifier(r.expediteur_id, 'voyage',
                     case when public.sont_amis(r.expediteur_id, new.expediteur_id) then new.expediteur_id end,
                     pense => new.id, oeuvre => new.oeuvre_id,
                     cle_unique => 'voyage:' || r.expediteur_id || ':' || new.id);
  end loop;
  return new;
end $$;
drop trigger if exists quand_conseil_voyage on penses;
create trigger quand_conseil_voyage after insert or update of destinataire_id on penses
  for each row execute function public.notif_voyage();
