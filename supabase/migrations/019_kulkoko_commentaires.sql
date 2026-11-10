-- =====================================================================
-- Complément SQL n° 19 : un Kulkoko sur les commentaires.
--
--   • Sous chaque commentaire, on peut l'applaudir d'un petit Kulkoko (un seul par personne).
--   • Visible par celles et ceux qui voient le commentaire ; jamais entre personnes bloquées.
--   • On ne s'applaudit pas soi-même. L'auteur du commentaire est prévenu (dans l'appli et sur son téléphone).
--
-- À coller tel quel dans Supabase › SQL Editor. On peut le passer deux fois sans souci.
-- =====================================================================

create table if not exists public.commentaire_kulkoko (
  commentaire_id uuid not null references public.commentaires on delete cascade,
  profil_id uuid not null references public.profils on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (commentaire_id, profil_id)
);
create index if not exists commentaire_kulkoko_profil on public.commentaire_kulkoko (profil_id);
alter table public.commentaire_kulkoko enable row level security;
revoke all on public.commentaire_kulkoko from public, anon;
grant select, insert, delete on public.commentaire_kulkoko to authenticated;

-- On voit les Kulkokos d'un commentaire qu'on a le droit de voir (la règle des commentaires s'applique).
drop policy if exists "kulkokos de commentaires visibles" on public.commentaire_kulkoko;
create policy "kulkokos de commentaires visibles" on public.commentaire_kulkoko for select to authenticated using (
  exists (select 1 from public.commentaires c where c.id = commentaire_id)
  and not public.bloque_entre(auth.uid(), profil_id));

-- J'applaudis un commentaire que je vois, qui n'est pas le mien, d'une personne que je n'ai pas bloquée (et inversement).
drop policy if exists "j'applaudis un commentaire" on public.commentaire_kulkoko;
create policy "j'applaudis un commentaire" on public.commentaire_kulkoko for insert to authenticated with check (
  profil_id = auth.uid()
  and exists (select 1 from public.commentaires c
              where c.id = commentaire_id and c.auteur_id <> auth.uid() and not public.bloque_entre(auth.uid(), c.auteur_id)));

drop policy if exists "je retire mon applaudissement" on public.commentaire_kulkoko;
create policy "je retire mon applaudissement" on public.commentaire_kulkoko for delete to authenticated using (profil_id = auth.uid());

-- Pas d'avalanche : au plus 300 par jour et par personne (comme les Kulkokos).
drop trigger if exists limite_debit on public.commentaire_kulkoko;
create trigger limite_debit before insert on public.commentaire_kulkoko
  for each row execute function public.limite_debit('profil_id', '300');

-- L'auteur du commentaire est prévenu (une seule fois par personne et par commentaire).
create or replace function public.notif_kulkoko_commentaire() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select co.auteur_id, co.activite_id, a.oeuvre_id into c
    from commentaires co join activites a on a.id = co.activite_id where co.id = new.commentaire_id;
  if c.auteur_id is not null then
    perform notifier(c.auteur_id, 'kulkoko_commentaire', new.profil_id, activite => c.activite_id, oeuvre => c.oeuvre_id,
                     cle_unique => 'kkc:' || new.commentaire_id || ':' || new.profil_id);
  end if;
  return new;
end $$;
revoke all on function public.notif_kulkoko_commentaire() from public, anon, authenticated;
drop trigger if exists quand_kulkoko_commentaire on public.commentaire_kulkoko;
create trigger quand_kulkoko_commentaire after insert on public.commentaire_kulkoko
  for each row execute function public.notif_kulkoko_commentaire();

-- Le texte de la notification sur le téléphone.
create or replace function public.envoyer_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  qui text;
  titre text;
  texte text;
  messages jsonb;
begin
  if not exists (select 1 from jetons_push where profil_id = new.destinataire_id) then return new; end if;
  qui := coalesce((select pseudo from profils where id = new.acteur_id), 'Quelqu''un');
  titre := coalesce(
    (select o.titre from oeuvres o where o.id = new.oeuvre_id),
    (select o.titre from activites a join oeuvres o on o.id = a.oeuvre_id where a.id = new.activite_id),
    (select o.titre from penses p join oeuvres o on o.id = p.oeuvre_id where p.id = new.pense_id));
  titre := case when titre is null then 'ton activité' else '« ' || titre || ' »' end;
  texte := case new.type
    when 'culkoko' then qui || ' t''a envoyé un Kulkoko pour ' || titre || ' 👏'
    when 'commentaire' then qui || ' a commenté ' || titre
    when 'commentaire_suite' then qui || ' a aussi commenté ' || titre
    when 'kulkoko_commentaire' then qui || ' a applaudi ton commentaire sur ' || titre || ' 👏'
    when 'abonne' then qui || ' te suit maintenant'
    when 'demande_abonnement' then qui || ' aimerait te suivre'
    when 'demande_acceptee' then qui || ' a accepté ta demande'
    when 'conseil' then qui || ' a pensé à toi : ' || titre
    when 'merci' then qui || ' te dit merci pour ton conseil ' || titre || ' 🙏'
    when 'boucle' then '🎯 Ton conseil a touché juste : ' || qui || ' a vécu ' || titre
    when 'voyage' then 'Ton conseil ' || titre || ' continue son voyage !'
    when 'invitation_acceptee' then qui || ' a rejoint Kulky grâce à toi !'
    when 'sortie_invitation' then qui || ' te propose une sortie : ' || titre
    when 'sortie_reponse' then case when new.detail = 'partant' then qui || ' est partant·e pour ' || titre || ' !' else qui || ' ne pourra pas venir à ' || titre end
    when 'sortie_veille' then 'Demain : ' || titre
    when 'sortie_jour' then 'C''est aujourd''hui : ' || titre || ' !'
    else 'Du nouveau sur Kulky'
  end;
  select jsonb_agg(jsonb_build_object(
           'to', j.jeton, 'title', 'Kulky', 'body', texte, 'sound', 'default',
           'data', jsonb_build_object('type', new.type, 'activite', new.activite_id, 'sortie', new.sortie_id)))
    into messages
    from jetons_push j where j.profil_id = new.destinataire_id;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
  return new;
exception when others then
  -- Un souci d'envoi ne doit jamais empêcher la notification dans l'appli.
  return new;
end $$;
