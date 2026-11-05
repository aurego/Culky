-- =====================================================================
-- Complément n° 16 : sécurité (suite de l'audit du 5 novembre 2026).
-- À coller d'un bloc dans Supabase > SQL Editor, après les compléments 2 à 15.
-- On peut le relancer sans risque : il ne refait que ce qui manque.
--
-- Ce que ça change, en bref :
--   • Les abonnements deviennent des DEMANDES : la personne suivie accepte (ou refuse).
--     Les abonnements qui existent déjà restent acceptés.
--   • Plus personne ne peut fabriquer une notification à la main (fonction notifier fermée).
--   • Un conseil reçu ne peut plus être réécrit (seuls « Merci » et la boucle bouclée).
--   • Un blocage tient partout : conseils, identifications, invitations aux sorties.
--   • Les photos ne se listent plus ; 2 Mo au plus, en JPEG, PNG ou WebP.
--   • Pseudos : lettres latines, chiffres, point, tirets ; « Kulky… » et « admin… » réservés.
--   • Limites de débit : on ne peut plus envoyer des centaines de choses à la minute.
--   • Sans compte, on ne lit plus rien, sauf la page d'invitation et le profil public minimal
--     (fonctions profil_public_par_code et profil_public) qu'affiche la page « Rejoins-moi ».
--   • Le lien « Rejoins-moi » porte un code secret (mon_lien_parrainage, rejoindre_par_code) ;
--     avec seulement l'identifiant d'un profil, on ne fait plus qu'une demande d'abonnement.
--   • Couvertures : seulement les hôtes connus, cohérents avec la source ; pas d'adresse web dans un titre.
--   • Une équipe de modération (table moderateurs) peut corriger ou retirer ce qui est signalé.
--
-- Les fonctions que l'appli appelle (RPC) :
--   sans compte : lire_invitation(code), profil_public_par_code(code), profil_public(profil)
--   connecté·e  : mon_lien_parrainage(), nouveau_lien_parrainage(), rejoindre_par_code(code),
--                 rejoindre_etat(parrain) / rejoindre(parrain) (= simple demande d'abonnement),
--                 accepter_invitation(code), est_moderateur(), completer_nb_pages(o, n),
--                 mots_du_livre(o), ma_progression(o), voyages_de_mes_conseils(), generer_rappels(),
--                 supprimer_mon_compte()
--
-- Modératrices en plus (droits limités par les règles) :
--   oeuvres             titre, createur, image_url ; suppression
--   profils signalés    les colonnes de profil ci-dessous
--
-- Les types de notifications (colonne notifications.type) :
--   culkoko             quelqu'un a envoyé un Kulkoko sur mon activité
--   commentaire         nouveau commentaire sur mon activité
--   commentaire_suite   nouveau commentaire sur une activité que j'ai commentée
--   demande_abonnement  NOUVEAU : quelqu'un demande à me suivre (acteur = la personne qui demande)
--   demande_acceptee    NOUVEAU : ma demande a été acceptée (acteur = la personne que je suis désormais)
--   abonne              quelqu'un me suit d'office (lien « Rejoins-moi » ou invitation, nouveau compte)
--   invitation_acceptee mon ami a rejoint Kulky grâce à mon lien ou à mon conseil
--   conseil             on a pensé à moi (« Pensé à toi »)
--   merci               on m'a dit merci pour mon conseil
--   boucle              mon conseil a été vécu
--   voyage              mon conseil a été transmis plus loin
--   sortie_invitation   on m'invite à une sortie
--   sortie_reponse      réponse à ma sortie (detail = 'partant' ou 'pas_cette_fois')
--   sortie_veille, sortie_jour  rappels de sortie
--
-- Ce que l'appli a encore le droit de modifier (droits par colonne, partie 9) :
--   profils             pseudo, bio, photo_url, univers_choisis, visibilite_defaut,
--                       commentaires_reserves_abonnes, stats_detaillees_publiques, inscription_terminee
--   activites           etat, au_cinema, emotions, mots, photo_url, date_activite, visibilite,
--                       grace_a, chouchou, lieu_id
--   abonnements         statut (seulement la personne suivie, pour accepter)
--   notifications       lue
--   penses              merci_le, activite_bouclee_id (seulement le destinataire)
--   sortie_participants reponse, repondu_le
--   sorties             date_prevue, heure, lieu, mot
--   marque_pages        page, progression, mot, emotion
--   envies              cachee
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Abonnements : une colonne « statut ». Les abonnements déjà là restent acceptés ;
--    les nouveaux commencent « en attente ».
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'abonnements' and column_name = 'statut') then
    alter table public.abonnements add column statut text not null default 'accepte';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'abonnements_statut_valide') then
    alter table public.abonnements add constraint abonnements_statut_valide check (statut in ('en_attente', 'accepte'));
  end if;
end $$;
alter table public.abonnements alter column statut set default 'en_attente';
create index if not exists abonnements_suivi_statut on public.abonnements (suivi_id, statut);


-- ---------------------------------------------------------------------
-- 2. Petites fonctions utiles aux règles.
-- ---------------------------------------------------------------------
-- Y a-t-il un blocage entre ces deux personnes, dans un sens ou dans l'autre ?
-- Ne répond que si la personne connectée est l'une des deux (sinon « non ») :
-- on ne peut pas s'en servir pour espionner les blocages des autres.
create or replace function public.bloque_entre(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() in (a, b), false)
     and exists (select 1 from blocages
                 where (bloqueur_id = a and bloque_id = b) or (bloqueur_id = b and bloque_id = a))
$$;

-- « a » suit-il « b », demande acceptée ?
create or replace function public.est_abonne(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from abonnements where abonne_id = a and suivi_id = b and statut = 'accepte')
$$;

-- Sommes-nous amis (l'un suit l'autre, demande acceptée) ?
create or replace function public.sont_amis(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from abonnements
                 where statut = 'accepte'
                   and ((abonne_id = a and suivi_id = b) or (abonne_id = b and suivi_id = a)))
$$;

-- Enlever les accents (pour comparer « Aurélie » et « Aurelie »).
create or replace function public.sans_accents(t text) returns text
language sql immutable parallel safe set search_path = public as $$
  select translate(t, 'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿŒœ',
                      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyyOo')
$$;

-- L'adresse du stockage Supabase de Kulky (photos de profil et souvenirs).
-- ⚠ À changer si la base change de projet Supabase (ou passe sur un domaine personnalisé).
create or replace function public.hote_stockage() returns text
language sql immutable parallel safe as $$
  select 'https://ktsbhikhrmjsoakljjlj.supabase.co/storage/v1/object/public/'
$$;


-- ---------------------------------------------------------------------
-- 3. Qui voit une activité : l'autrice, et sinon (sans blocage entre nous) :
--    tout le monde si publique, les personnes identifiées, les abonnés ACCEPTÉS si « abonnés ».
--    Sans compte : rien.
-- ---------------------------------------------------------------------
create or replace function public.activite_visible(a activites) returns boolean
language sql stable security definer set search_path = public as $$
  select a.auteur_id = auth.uid()
      or (auth.uid() is not null
          and not public.bloque_entre(a.auteur_id, auth.uid())
          and (a.visibilite = 'public'
               or exists (select 1 from identifications i where i.activite_id = a.id and i.profil_id = auth.uid())
               or (a.visibilite = 'abonnes' and public.est_abonne(auth.uid(), a.auteur_id))))
$$;


-- ---------------------------------------------------------------------
-- 4. La lecture est réservée aux personnes connectées.
--    Sans compte, seules deux fonctions répondent : lire_invitation (page d'un conseil reçu)
--    et profil_public (page « Rejoins-moi » : pseudo, photo, univers).
-- ---------------------------------------------------------------------
drop policy if exists "profils lisibles" on profils;
create policy "profils lisibles" on profils for select to authenticated using (true);

drop policy if exists "oeuvres lisibles" on oeuvres;
create policy "oeuvres lisibles" on oeuvres for select to authenticated using (true);

drop policy if exists "lieux lisibles" on lieux;
create policy "lieux lisibles" on lieux for select to authenticated using (true);

drop policy if exists "activites visibles" on activites;
create policy "activites visibles" on activites for select to authenticated using (activite_visible(activites));

drop policy if exists "identifications visibles" on identifications;
create policy "identifications visibles" on identifications for select to authenticated using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a)));

drop policy if exists "envies visibles" on envies;
create policy "envies visibles" on envies for select to authenticated using (
  profil_id = auth.uid() or (not cachee and not public.bloque_entre(auth.uid(), profil_id)));

drop policy if exists "culkoko visibles" on culkoko;
create policy "culkoko visibles" on culkoko for select to authenticated using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a))
  and not public.bloque_entre(auth.uid(), profil_id));

drop policy if exists "commentaires visibles" on commentaires;
create policy "commentaires visibles" on commentaires for select to authenticated using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a))
  and not public.bloque_entre(auth.uid(), commentaires.auteur_id));

drop policy if exists "mes notifications" on notifications;
create policy "mes notifications" on notifications for select to authenticated using (destinataire_id = auth.uid());

drop policy if exists "mes blocages" on blocages;
create policy "mes blocages" on blocages for select to authenticated using (bloqueur_id = auth.uid());

drop policy if exists "mes sorties" on sorties;
create policy "mes sorties" on sorties for select to authenticated using (dans_la_sortie(id));

drop policy if exists "participants visibles" on sortie_participants;
create policy "participants visibles" on sortie_participants for select to authenticated using (dans_la_sortie(sortie_id));

drop policy if exists "mes marque-pages" on marque_pages;
create policy "mes marque-pages" on marque_pages for select to authenticated using (auteur_id = auth.uid());

-- Le profil public minimal, lisible sans compte (page « Rejoins-moi »).
create or replace function public.profil_public(profil uuid)
returns table (id uuid, pseudo text, photo_url text, univers_choisis univers[])
language sql stable security definer set search_path = public as $$
  select p.id, p.pseudo, p.photo_url, p.univers_choisis
  from profils p
  where p.id = profil_public.profil and p.inscription_terminee
$$;


-- ---------------------------------------------------------------------
-- 5. Les règles des abonnements (demandes).
--    • Je demande à suivre quelqu'un : la ligne naît « en attente » (pas de blocage entre nous).
--    • Je vois les abonnements acceptés de tout le monde, et les demandes qui me concernent.
--    • Seule la personne suivie accepte (statut → 'accepte').
--    • Je peux supprimer ma demande ou mon abonnement ; la personne suivie peut refuser
--      une demande ou retirer un abonné.
-- ---------------------------------------------------------------------
drop policy if exists "abonnements lisibles" on abonnements;
create policy "abonnements lisibles" on abonnements for select to authenticated using (
  abonne_id = auth.uid() or suivi_id = auth.uid()
  or (statut = 'accepte'
      and not public.bloque_entre(auth.uid(), abonne_id) and not public.bloque_entre(auth.uid(), suivi_id)));

drop policy if exists "je m'abonne" on abonnements;
create policy "je m'abonne" on abonnements for insert to authenticated with check (
  abonne_id = auth.uid() and statut = 'en_attente' and not public.bloque_entre(auth.uid(), suivi_id));

drop policy if exists "j'accepte une demande" on abonnements;
create policy "j'accepte une demande" on abonnements for update to authenticated
  using (suivi_id = auth.uid()) with check (suivi_id = auth.uid() and statut = 'accepte');

drop policy if exists "je me desabonne" on abonnements;
create policy "je me desabonne" on abonnements for delete to authenticated using (
  abonne_id = auth.uid() or suivi_id = auth.uid());


-- ---------------------------------------------------------------------
-- 6. Les autres règles d'écriture, avec le blocage partout.
-- ---------------------------------------------------------------------
-- Commentaires « réservés aux abonnés » : seuls les abonnés acceptés.
drop policy if exists "je commente" on commentaires;
create policy "je commente" on commentaires for insert to authenticated with check (
  auteur_id = auth.uid() and exists (
    select 1 from activites a join profils p on p.id = a.auteur_id
    where a.id = activite_id and activite_visible(a)
      and (not p.commentaires_reserves_abonnes or a.auteur_id = auth.uid()
           or public.est_abonne(auth.uid(), a.auteur_id))));

-- Identifier quelqu'un : seulement un ami, sans blocage, sur ma propre activité.
drop policy if exists "l'auteur identifie" on identifications;
create policy "l'auteur identifie" on identifications for insert to authenticated with check (
  exists (select 1 from activites a where a.id = activite_id and a.auteur_id = auth.uid())
  and profil_id <> auth.uid()
  and not public.bloque_entre(auth.uid(), profil_id)
  and public.sont_amis(auth.uid(), profil_id));

-- Conseils (« Pensé à toi ») :
--   • envoi à un ami (sans blocage), ou à personne quand c'est un lien d'invitation ;
--   • on ne peut pas créer un conseil déjà « remercié » ou « bouclé » ;
--   • le destinataire ne voit plus les conseils d'une personne bloquée ;
--   • le destinataire ne peut toucher qu'à « Merci » et à la boucle, avec SA propre activité sur la même œuvre ;
--   • le destinataire peut supprimer un conseil reçu.
drop policy if exists "mes penses" on penses;
create policy "mes penses" on penses for select to authenticated using (
  expediteur_id = auth.uid()
  or (destinataire_id = auth.uid() and not public.bloque_entre(expediteur_id, auth.uid())));

drop policy if exists "j'envoie un pense" on penses;
create policy "j'envoie un pense" on penses for insert to authenticated with check (
  expediteur_id = auth.uid()
  and merci_le is null and activite_bouclee_id is null
  and (
    (destinataire_id is null and code_invitation is not null and char_length(code_invitation) between 12 and 64)
    or (destinataire_id is not null and code_invitation is null
        and destinataire_id <> auth.uid()
        and not public.bloque_entre(auth.uid(), destinataire_id)
        and public.sont_amis(auth.uid(), destinataire_id))));

drop policy if exists "le destinataire boucle la boucle" on penses;
create policy "le destinataire boucle la boucle" on penses for update to authenticated
  using (destinataire_id = auth.uid())
  with check (destinataire_id = auth.uid() and (
    activite_bouclee_id is null or exists (
      select 1 from activites a
      where a.id = activite_bouclee_id and a.auteur_id = auth.uid() and a.oeuvre_id = penses.oeuvre_id)));

drop policy if exists "je supprime un conseil reçu" on penses;
create policy "je supprime un conseil reçu" on penses for delete to authenticated using (destinataire_id = auth.uid());

-- Sorties : on n'invite que ses amis (sans blocage), et pas soi-même.
drop policy if exists "l'organisatrice invite" on sortie_participants;
create policy "l'organisatrice invite" on sortie_participants for insert to authenticated with check (
  j_organise(sortie_id)
  and profil_id <> auth.uid()
  and not public.bloque_entre(auth.uid(), profil_id)
  and public.sont_amis(auth.uid(), profil_id));

-- Marque-pages : une modification garde le marque-page sur MON activité de la même œuvre.
drop policy if exists "je modifie mes marque-pages" on marque_pages;
create policy "je modifie mes marque-pages" on marque_pages for update to authenticated
  using (auteur_id = auth.uid())
  with check (auteur_id = auth.uid() and exists (
    select 1 from activites a
    where a.id = activite_id and a.auteur_id = auth.uid() and a.oeuvre_id = marque_pages.oeuvre_id));

-- Lieux : on retient qui l'a ajouté (pour la limite de débit).
alter table public.lieux add column if not exists cree_par uuid references profils on delete set null default auth.uid();
drop policy if exists "ajouter un lieu" on lieux;
create policy "ajouter un lieu" on lieux for insert to authenticated with check (cree_par = auth.uid());


-- ---------------------------------------------------------------------
-- 7. Les notifications automatiques, sans doublons (clé unique à chaque fois).
--    Faire / défaire / refaire un geste ne renvoie plus de notification.
-- ---------------------------------------------------------------------
create or replace function public.notif_culkoko() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notifier((select auteur_id from activites where id = new.activite_id), 'culkoko', new.profil_id,
                   activite => new.activite_id,
                   cle_unique => 'culkoko:' || new.activite_id || ':' || new.profil_id);
  return new;
end $$;

-- Abonnements : une demande prévient la personne suivie (au plus une fois par jour et par personne) ;
-- une acceptation prévient la personne qui avait demandé ; un abonnement d'office (lien « Rejoins-moi »)
-- prévient comme avant (« abonne »).
create or replace function public.notif_abonne() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jour text := to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD');
begin
  if tg_op = 'INSERT' then
    if new.statut = 'en_attente' then
      perform notifier(new.suivi_id, 'demande_abonnement', new.abonne_id,
                       cle_unique => 'demande:' || new.suivi_id || ':' || new.abonne_id || ':' || jour);
    else
      perform notifier(new.suivi_id, 'abonne', new.abonne_id,
                       cle_unique => 'abonne:' || new.suivi_id || ':' || new.abonne_id || ':' || jour);
    end if;
  elsif old.statut = 'en_attente' and new.statut = 'accepte' then
    perform notifier(new.abonne_id, 'demande_acceptee', new.suivi_id,
                     cle_unique => 'acceptee:' || new.abonne_id || ':' || new.suivi_id || ':' || jour);
  end if;
  return new;
end $$;
drop trigger if exists quand_abonne on abonnements;
create trigger quand_abonne after insert or update of statut on abonnements
  for each row execute function public.notif_abonne();

create or replace function public.notif_conseil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notifier(new.destinataire_id, 'conseil', new.expediteur_id, pense => new.id, oeuvre => new.oeuvre_id,
                     cle_unique => 'conseil:' || new.id);
  else
    if old.merci_le is null and new.merci_le is not null then
      perform notifier(new.expediteur_id, 'merci', new.destinataire_id, pense => new.id, oeuvre => new.oeuvre_id,
                       cle_unique => 'merci:' || new.id);
    end if;
    if old.activite_bouclee_id is null and new.activite_bouclee_id is not null then
      perform notifier(new.expediteur_id, 'boucle', new.destinataire_id, activite => new.activite_bouclee_id,
                       pense => new.id, oeuvre => new.oeuvre_id, cle_unique => 'boucle:' || new.id);
    end if;
  end if;
  return new;
end $$;

create or replace function public.notif_sortie() returns trigger
language plpgsql security definer set search_path = public as $$
declare s sorties;
begin
  select * into s from sorties where id = new.sortie_id;
  if tg_op = 'INSERT' then
    perform notifier(new.profil_id, 'sortie_invitation', s.organisateur_id, sortie => s.id, oeuvre => s.oeuvre_id,
                     cle_unique => 'sortie_invitation:' || s.id || ':' || new.profil_id);
  elsif new.reponse is distinct from old.reponse and new.reponse <> 'invite' then
    perform notifier(s.organisateur_id, 'sortie_reponse', new.profil_id, sortie => s.id, oeuvre => s.oeuvre_id,
                     infos => new.reponse,
                     cle_unique => 'sortie_reponse:' || s.id || ':' || new.profil_id || ':' || new.reponse);
  end if;
  return new;
end $$;


-- ---------------------------------------------------------------------
-- 8. Rejoindre Kulky par un lien.
--    • Le lien « Rejoins-moi » porte un CODE SECRET (64 caractères tirés au hasard), plus l'identifiant
--      du profil (que toute personne connectée peut voir). Seul ce code relie d'office :
--      on se suit l'un l'autre SEULEMENT pour un compte créé il y a moins de 2 heures, une seule fois.
--    • Le lien d'un conseil (code d'invitation, au moins 12 caractères) : même règle pour se suivre.
--    • Avec seulement l'identifiant (anciens liens /rejoindre/<id>), on ne fait plus qu'une DEMANDE
--      d'abonnement, que la personne acceptera ou non.
-- ---------------------------------------------------------------------
create table if not exists public.parrainages (
  filleul_id uuid primary key references profils on delete cascade,
  parrain_id uuid not null references profils on delete cascade,
  cree_le timestamptz not null default now()
);
alter table public.parrainages enable row level security;  -- aucune règle : lisible seulement par les fonctions
revoke all on public.parrainages from anon, authenticated;

create table if not exists public.liens_parrainage (
  profil_id uuid primary key references profils on delete cascade,
  code text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  cree_le timestamptz not null default now()
);
alter table public.liens_parrainage enable row level security;  -- aucune règle : secret
revoke all on public.liens_parrainage from anon, authenticated;

-- Usage interne (jamais appelée par l'appli) : relie un compte tout neuf à son parrain.
-- Renvoie 'relies', 'compte_ancien' ou 'deja_utilise'.
create or replace function public.lier_nouveau_compte(filleul uuid, parrain uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if (select cree_le from profils where id = filleul) < now() - interval '2 hours' then return 'compte_ancien'; end if;
  insert into parrainages (filleul_id, parrain_id) values (filleul, parrain) on conflict (filleul_id) do nothing;
  if not found then return 'deja_utilise'; end if;
  insert into abonnements (abonne_id, suivi_id, statut) values (filleul, parrain, 'accepte')
    on conflict (abonne_id, suivi_id) do update set statut = 'accepte';
  insert into abonnements (abonne_id, suivi_id, statut) values (parrain, filleul, 'accepte')
    on conflict (abonne_id, suivi_id) do update set statut = 'accepte';
  return 'relies';
end $$;

-- Mon lien secret « Rejoins-moi » (créé la première fois). L'appli en fait l'adresse <site>/rejoindre/<code>.
create or replace function public.mon_lien_parrainage() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then return null; end if;
  insert into liens_parrainage (profil_id) values (auth.uid()) on conflict (profil_id) do nothing;
  select l.code into c from liens_parrainage l where l.profil_id = auth.uid();
  return c;
end $$;

-- Changer de lien (l'ancien ne marche plus), si on l'a trop partagé.
create or replace function public.nouveau_lien_parrainage() returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  delete from liens_parrainage where profil_id = auth.uid();
  return public.mon_lien_parrainage();
end $$;

-- Ce que montre la page « Rejoins-moi », même sans compte : pseudo, photo, univers.
create or replace function public.profil_public_par_code(code text)
returns table (id uuid, pseudo text, photo_url text, univers_choisis univers[])
language sql stable security definer set search_path = public as $$
  select p.id, p.pseudo, p.photo_url, p.univers_choisis
  from liens_parrainage l join profils p on p.id = l.profil_id
  where l.code = profil_public_par_code.code and p.inscription_terminee
$$;

-- Rejoindre avec le code secret. Renvoie :
--   'relies'        c'est fait, on se suit l'un l'autre (et le parrain est prévenu)
--   'deja_relies'   on se suivait déjà dans les deux sens
--   'compte_ancien' mon compte a plus de 2 h : rien n'est fait (l'appli propose une demande d'abonnement)
--   'deja_utilise'  mon compte a déjà été relié une fois par un lien : rien n'est fait (idem)
--   'impossible'    pas connecté·e, code inconnu, soi-même, ou blocage
create or replace function public.rejoindre_par_code(code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  parrain uuid;
  resultat text;
begin
  if moi is null or code is null then return 'impossible'; end if;
  select l.profil_id into parrain from liens_parrainage l where l.code = rejoindre_par_code.code;
  if parrain is null or parrain = moi or public.bloque_entre(moi, parrain) then return 'impossible'; end if;
  if public.est_abonne(moi, parrain) and public.est_abonne(parrain, moi) then return 'deja_relies'; end if;
  resultat := public.lier_nouveau_compte(moi, parrain);
  if resultat = 'relies' then
    perform notifier(parrain, 'invitation_acceptee', moi, cle_unique => 'rejoindre:' || parrain || ':' || moi);
  end if;
  return resultat;
end $$;

-- Avec seulement l'identifiant d'un profil : une simple DEMANDE d'abonnement (comme le bouton « Suivre »).
-- Renvoie 'demande_envoyee' (ou déjà en attente), 'deja_abonne', ou 'impossible'.
create or replace function public.rejoindre_etat(parrain uuid) returns text
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null or parrain is null or parrain = moi then return 'impossible'; end if;
  if not exists (select 1 from profils where id = parrain) or public.bloque_entre(moi, parrain) then return 'impossible'; end if;
  if public.est_abonne(moi, parrain) then return 'deja_abonne'; end if;
  insert into abonnements (abonne_id, suivi_id, statut) values (moi, parrain, 'en_attente') on conflict do nothing;
  return 'demande_envoyee';
end $$;

-- L'ancienne fonction (appli actuelle) : vrai si la demande est envoyée ou si je suis déjà abonné·e.
create or replace function public.rejoindre(parrain uuid) returns boolean
language sql volatile security definer set search_path = public as $$
  select public.rejoindre_etat(parrain) in ('demande_envoyee', 'deja_abonne')
$$;

-- La page d'un conseil reçu par lien (même sans compte). Le code doit faire au moins 12 caractères.
create or replace function public.lire_invitation(code text)
returns table (expediteur_pseudo text, titre text, createur text, univers univers, image_url text, mot text, deja_acceptee boolean)
language sql stable security definer set search_path = public as $$
  select pr.pseudo, o.titre, o.createur, o.univers, o.image_url,
         case when p.destinataire_id is null or p.destinataire_id = auth.uid() then p.mot end,
         p.destinataire_id is not null
  from penses p
  join profils pr on pr.id = p.expediteur_id
  join oeuvres o on o.id = p.oeuvre_id
  where p.code_invitation = lire_invitation.code
    and length(lire_invitation.code) >= 12
$$;

-- Accepter un conseil reçu par lien : le conseil devient toujours le mien ;
-- l'abonnement mutuel n'est fait d'office que pour un compte tout neuf (moins de 2 h, une fois).
create or replace function public.accepter_invitation(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  p penses%rowtype;
begin
  if moi is null or length(code) < 12 then return null; end if;
  select * into p from penses where code_invitation = accepter_invitation.code for update;
  if not found or p.expediteur_id = moi then return null; end if;
  if p.destinataire_id is not null then
    return case when p.destinataire_id = moi then p.id end; -- déjà accepté par moi : rien à refaire
  end if;
  if public.bloque_entre(moi, p.expediteur_id) then return null; end if;

  update penses set destinataire_id = moi where id = p.id;
  perform public.lier_nouveau_compte(moi, p.expediteur_id);

  perform notifier(moi, 'conseil', p.expediteur_id, pense => p.id, oeuvre => p.oeuvre_id, cle_unique => 'conseil:' || p.id);
  perform notifier(p.expediteur_id, 'invitation_acceptee', moi, pense => p.id, oeuvre => p.oeuvre_id,
                   cle_unique => 'invitation_acceptee:' || p.id);
  return p.id;
end $$;

-- Compléter le nombre de pages : seulement un livre encore sans nombre, seulement par quelqu'un
-- qui a une activité sur ce livre, et entre 20 et 5000 pages.
create or replace function public.completer_nb_pages(o uuid, n integer) returns void
language sql volatile security definer set search_path = public as $$
  update oeuvres set nb_pages = n
  where id = o and univers = 'livres' and nb_pages is null and n between 20 and 5000
    and exists (select 1 from activites a where a.oeuvre_id = o and a.auteur_id = auth.uid())
$$;


-- ---------------------------------------------------------------------
-- 9. Droits par colonne : l'appli ne peut plus modifier que les colonnes listées en tête du fichier.
--    Sans compte, on ne peut plus rien écrire du tout.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t);
    execute format('revoke truncate on public.%I from authenticated', t);
    execute format('revoke update on public.%I from authenticated', t);
  end loop;
end $$;
grant update (pseudo, bio, photo_url, univers_choisis, visibilite_defaut, commentaires_reserves_abonnes,
              stats_detaillees_publiques, inscription_terminee) on public.profils to authenticated;
grant update (etat, au_cinema, emotions, mots, photo_url, date_activite, visibilite, grace_a, chouchou, lieu_id)
  on public.activites to authenticated;
grant update (statut) on public.abonnements to authenticated;
grant update (lue) on public.notifications to authenticated;
grant update (merci_le, activite_bouclee_id) on public.penses to authenticated;
grant update (reponse, repondu_le) on public.sortie_participants to authenticated;
grant update (date_prevue, heure, lieu, mot) on public.sorties to authenticated;
grant update (page, progression, mot, emotion) on public.marque_pages to authenticated;
grant update (cachee) on public.envies to authenticated;


-- ---------------------------------------------------------------------
-- 10. Longueurs maximales des textes (vérifiées pour tout ce qui est ajouté à partir de maintenant).
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'oeuvres_longueurs') then
    alter table public.oeuvres add constraint oeuvres_longueurs check (
      char_length(titre) between 1 and 300 and char_length(coalesce(createur, '')) <= 300
      and char_length(coalesce(source_id, '')) <= 200 and char_length(coalesce(image_url, '')) <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oeuvres_source_connue') then
    alter table public.oeuvres add constraint oeuvres_source_connue check (
      source is null or source in ('google_books', 'openlibrary', 'tmdb', 'musicbrainz', 'openagenda', 'manuel')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lieux_longueurs') then
    alter table public.lieux add constraint lieux_longueurs check (
      char_length(nom) between 1 and 120 and char_length(coalesce(type, '')) <= 40 and char_length(ville) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'signalements_longueur') then
    alter table public.signalements add constraint signalements_longueur check (char_length(coalesce(raison, '')) <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'marque_pages_emotion_longueur') then
    alter table public.marque_pages add constraint marque_pages_emotion_longueur check (char_length(coalesce(emotion, '')) <= 40) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activites_emotions_longueur') then
    alter table public.activites add constraint activites_emotions_longueur check (char_length(array_to_string(emotions, '|')) <= 150) not valid;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 11. Les œuvres et les images. (Vérifié quand la valeur change : les données déjà là ne bloquent rien.)
--     • Une couverture vient d'un hôte connu, et de l'hôte qui correspond à la source
--       (Google Books → books.google…, TMDB → image.tmdb.org, Open Library → covers.openlibrary.org,
--       MusicBrainz → coverartarchive.org). Le stockage Supabase accepté est seulement celui de Kulky.
--     • L'identifiant d'une source a la bonne forme (un numéro pour TMDB…).
--     • Pas d'adresse web dans un titre ou un nom d'auteur (« http », « www. », « .com/ »…).
--     Risque qui reste : quelqu'un peut encore créer le premier une œuvre Google Books / TMDB
--     avec un titre faux mais « propre » ; les modératrices peuvent la corriger (partie 14).
--     La vraie parade serait une fonction serveur (Edge Function) qui relit la fiche à la source.
-- ---------------------------------------------------------------------
drop trigger if exists controle_image on oeuvres;
drop function if exists public.controle_image_oeuvre();

create or replace function public.controle_oeuvre() returns trigger
language plpgsql set search_path = public as $$
declare
  hote text;
  nouveau boolean := tg_op = 'INSERT';
begin
  -- chaque contrôle ne porte que sur ce qui change (une ancienne fiche reste corrigeable)
  if (nouveau or new.titre is distinct from old.titre or new.createur is distinct from old.createur)
     and (new.titre ~* '(http|www\.|\.[a-z]{2,6}/)' or coalesce(new.createur, '') ~* '(http|www\.|\.[a-z]{2,6}/)') then
    raise exception 'Un titre ou un nom ne peut pas contenir d''adresse web.' using errcode = 'P0001';
  end if;
  if (nouveau or new.source is distinct from old.source or new.source_id is distinct from old.source_id)
     and (new.source = 'google_books' and coalesce(new.source_id, '') !~ '^[A-Za-z0-9_-]{4,40}$'
          or new.source = 'tmdb' and coalesce(new.source_id, '') !~ '^[0-9]{1,10}$'
          or new.source = 'musicbrainz' and coalesce(new.source_id, '') !~ '^[0-9a-f-]{36}$'
          or new.source = 'openlibrary' and coalesce(new.source_id, '') !~ '^/works/OL[0-9]+W$') then
    raise exception 'Cette œuvre n''a pas un identifiant valable pour sa source.' using errcode = 'P0001';
  end if;
  if new.image_url is not null and (nouveau or new.image_url is distinct from old.image_url or new.source is distinct from old.source) then
    hote := case new.source
      when 'google_books' then '(books\.google\.com|books\.googleusercontent\.com)'
      when 'openlibrary'  then 'covers\.openlibrary\.org'
      when 'tmdb'         then 'image\.tmdb\.org'
      when 'musicbrainz'  then 'coverartarchive\.org'
      else '(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org|image\.tmdb\.org|coverartarchive\.org|ktsbhikhrmjsoakljjlj\.supabase\.co/storage/v1/object/public)'
    end;
    if new.image_url !~ ('^https://' || hote || '/[^\s"''<>]*$') then
      raise exception 'Cette image ne vient pas d''une source connue.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists controle_oeuvre on oeuvres;
create trigger controle_oeuvre before insert or update on oeuvres
  for each row execute function public.controle_oeuvre();

-- Une photo de profil ou souvenir vient du stockage Kulky, dans le dossier de la personne,
-- avec un nom de fichier simple (comme ceux de l'appli : photo-1730800000000.jpg).
create or replace function public.controle_photo() returns trigger
language plpgsql set search_path = public as $$
declare
  debut text;
begin
  -- (deux branches séparées : une ligne de profils n'a pas de colonne auteur_id)
  if tg_table_name = 'profils' then
    debut := public.hote_stockage() || 'avatars/' || new.id || '/';
  else
    debut := public.hote_stockage() || 'souvenirs/' || new.auteur_id || '/';
  end if;
  if new.photo_url is not null and (tg_op = 'INSERT' or new.photo_url is distinct from old.photo_url)
     and (left(new.photo_url, length(debut)) <> debut
          or substr(new.photo_url, length(debut) + 1) !~ '^[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp)$') then
    raise exception 'Cette photo doit être envoyée depuis Kulky.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists controle_photo on profils;
create trigger controle_photo before insert or update of photo_url on profils
  for each row execute function public.controle_photo();
drop trigger if exists controle_photo on activites;
create trigger controle_photo before insert or update of photo_url on activites
  for each row execute function public.controle_photo();

-- « Grâce à » (activité) et « pensé par » (envie) : seulement quelqu'un qui m'a vraiment conseillé
-- cette œuvre, et sans blocage entre nous.
create or replace function public.controle_grace() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  qui uuid;
  moi uuid;
begin
  if tg_table_name = 'activites' then
    qui := new.grace_a; moi := new.auteur_id;
    if tg_op = 'UPDATE' and new.grace_a is not distinct from old.grace_a then return new; end if;
  else
    qui := new.pense_par; moi := new.profil_id;
    if tg_op = 'UPDATE' and new.pense_par is not distinct from old.pense_par then return new; end if;
  end if;
  if qui is null or auth.uid() is null then return new; end if;
  if exists (select 1 from blocages where (bloqueur_id = qui and bloque_id = moi) or (bloqueur_id = moi and bloque_id = qui))
     or not exists (select 1 from penses p where p.expediteur_id = qui and p.destinataire_id = moi and p.oeuvre_id = new.oeuvre_id) then
    raise exception 'Cette personne ne t''a pas conseillé cette œuvre.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists controle_grace on activites;
create trigger controle_grace before insert or update of grace_a on activites
  for each row execute function public.controle_grace();
drop trigger if exists controle_grace on envies;
create trigger controle_grace before insert or update of pense_par on envies
  for each row execute function public.controle_grace();


-- ---------------------------------------------------------------------
-- 12. Pseudos : lettres latines (accents compris), chiffres, point, tiret, tiret bas, 2 à 30 caractères.
--     • « kulky » est réservé partout dans le pseudo (même écrit Ku.lky, KuIky, Ku1ky…) ;
--       seul le pseudo provisoire « kulky » + 8 caractères de SON identifiant est permis.
--     • « admin », « modération », « support », « équipe », « staff », « officiel »… réservés
--       au début ou à la fin du pseudo.
--     • Unique sans tenir compte des majuscules ni des accents.
--     (Vérifié quand le pseudo change : les pseudos actuels restent.)
-- ---------------------------------------------------------------------
create or replace function public.controle_pseudo() returns trigger
language plpgsql set search_path = public as $$
declare
  squelette text;
  mots constant text := '(admln|moderat|modo|support|equlpe|staff|offlclel|root|systeme|system)';
begin
  if tg_op = 'UPDATE' and new.pseudo is not distinct from old.pseudo then return new; end if;
  -- le pseudo provisoire de l'inscription, seulement le sien
  if new.pseudo ~ '^[ck]ulky[0-9a-f]{8}$' and substr(new.pseudo, 6) = substr(replace(new.id::text, '-', ''), 1, 8) then
    return new;
  end if;
  if new.pseudo !~ '^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9._-]{2,30}$' then
    raise exception 'Ton pseudo peut contenir des lettres, des chiffres, le point, le tiret et le tiret bas, sans espace (2 à 30 caractères).'
      using errcode = 'P0001';
  end if;
  -- le « squelette » : sans accents, sans séparateurs, i/1 → l, 0 → o
  squelette := translate(regexp_replace(lower(public.sans_accents(new.pseudo)), '[._-]', '', 'g'), 'i10', 'llo');
  if squelette ~ '[ck]ulky' or squelette ~ ('^' || mots) or squelette ~ (mots || '$') then
    raise exception 'Ce pseudo est réservé. Essaie une variante !' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists controle_pseudo on profils;
create trigger controle_pseudo before insert or update of pseudo on profils
  for each row execute function public.controle_pseudo();

-- Unicité sans majuscules (complément 7, au cas où il n'avait pas pu être créé) et sans accents.
do $$
begin
  create unique index if not exists profils_pseudo_unique_sans_casse on profils (lower(pseudo));
exception when unique_violation then
  raise notice 'Deux pseudos ne diffèrent que par les majuscules : index profils_pseudo_unique_sans_casse non créé.';
end $$;
do $$
begin
  create unique index if not exists profils_pseudo_unique_sans_accents on profils (lower(public.sans_accents(pseudo)));
exception when unique_violation then
  raise notice 'Deux pseudos ne diffèrent que par les accents : index profils_pseudo_unique_sans_accents non créé.';
end $$;


-- ---------------------------------------------------------------------
-- 13. Limites de débit : au plus N ajouts par heure et par personne.
--     On compte dans un journal à part, que personne ne peut effacer : supprimer puis recréer
--     ne remet pas le compteur à zéro. Le journal se vide des lignes de plus d'un jour
--     (chaque nuit si pg_cron est là, et de temps en temps au passage sinon).
--     Le message est gentil ; le code d'erreur PT429 fait répondre « 429 Trop de demandes ».
--     (La date de création est aussi fixée par la base.)
-- ---------------------------------------------------------------------
create table if not exists public.journal_debit (
  profil_id uuid not null references profils on delete cascade,
  table_nom text not null,
  cree_le timestamptz not null default now()
);
create index if not exists journal_debit_idx on public.journal_debit (profil_id, table_nom, cree_le);
alter table public.journal_debit enable row level security;  -- aucune règle : interne
revoke all on public.journal_debit from anon, authenticated;

create or replace function public.limite_debit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  n integer;
begin
  if moi is null then return new; end if; -- tâches programmées, éditeur SQL
  new.cree_le := now();
  if random() < 0.05 then
    delete from journal_debit where profil_id = moi and cree_le < now() - interval '1 day';
  end if;
  select count(*) into n from journal_debit
   where profil_id = moi and table_nom = tg_table_name and cree_le > now() - interval '1 hour';
  if n >= tg_argv[1]::integer then
    raise exception 'Doucement ! Tu en as fait beaucoup en peu de temps. Fais une petite pause et réessaie dans un moment.'
      using errcode = 'PT429';
  end if;
  insert into journal_debit (profil_id, table_nom) values (moi, tg_table_name);
  return new;
end $$;

do $$
declare
  r record;
begin
  for r in select * from (values
      ('activites', 'auteur_id', 120), ('oeuvres', 'cree_par', 120), ('lieux', 'cree_par', 30),
      ('penses', 'expediteur_id', 40), ('commentaires', 'auteur_id', 60), ('abonnements', 'abonne_id', 60),
      ('culkoko', 'profil_id', 300), ('envies', 'profil_id', 120), ('marque_pages', 'auteur_id', 120),
      ('sorties', 'organisateur_id', 20), ('signalements', 'auteur_id', 20)) as v(t, col, maxi)
  loop
    execute format('drop trigger if exists limite_debit on public.%I', r.t);
    execute format('create trigger limite_debit before insert on public.%I for each row execute function public.limite_debit(%L, %L)',
                   r.t, r.col, r.maxi);
  end loop;
end $$;

-- Le ménage de nuit du journal (si l'extension pg_cron est disponible).
do $$
begin
  execute $c$select cron.schedule('kulky-journal-debit', '17 3 * * *',
            'delete from public.journal_debit where cree_le < now() - interval ''1 day''')$c$;
exception when others then
  raise notice 'Ménage programmé non créé (%) : le journal se videra au passage.', sqlerrm;
end $$;

-- Au plus 30 invités par sortie, et 20 personnes identifiées par activité.
create or replace function public.limite_par_groupe() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if tg_table_name = 'sortie_participants' then
    select count(*) into n from sortie_participants where sortie_id = new.sortie_id;
    if n >= 30 then raise exception 'Une sortie compte au plus 30 invités.' using errcode = 'P0001'; end if;
  else
    select count(*) into n from identifications where activite_id = new.activite_id;
    if n >= 20 then raise exception 'Tu peux identifier au plus 20 personnes.' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
drop trigger if exists limite_groupe on sortie_participants;
create trigger limite_groupe before insert on sortie_participants for each row execute function public.limite_par_groupe();
drop trigger if exists limite_groupe on identifications;
create trigger limite_groupe before insert on identifications for each row execute function public.limite_par_groupe();


-- ---------------------------------------------------------------------
-- 14. La modération. Une modératrice (table « moderateurs », remplie à la main dans le SQL Editor) peut :
--     lire et classer les signalements ; corriger (titre, auteur, image) ou supprimer une œuvre ;
--     voir et supprimer une activité ou un commentaire signalé ; corriger un profil signalé ;
--     retirer une photo d'une activité ou d'un profil signalé (partie 15).
--     Pour supprimer une œuvre, il faut d'abord supprimer (ou corriger) les activités qui l'utilisent.
-- ---------------------------------------------------------------------
create table if not exists public.moderateurs (
  profil_id uuid primary key references profils on delete cascade,
  cree_le timestamptz not null default now()
);
alter table public.moderateurs enable row level security;  -- aucune règle : personne ne peut s'y ajouter
revoke all on public.moderateurs from anon, authenticated;

create or replace function public.est_moderateur() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from moderateurs where profil_id = auth.uid())
$$;

drop policy if exists "modération lit les signalements" on signalements;
create policy "modération lit les signalements" on signalements for select to authenticated using (public.est_moderateur());
drop policy if exists "modération classe un signalement" on signalements;
create policy "modération classe un signalement" on signalements for delete to authenticated using (public.est_moderateur());

grant update (titre, createur, image_url) on public.oeuvres to authenticated;  -- la règle ci-dessous limite aux modératrices
drop policy if exists "modération corrige une oeuvre" on oeuvres;
create policy "modération corrige une oeuvre" on oeuvres for update to authenticated
  using (public.est_moderateur()) with check (public.est_moderateur());
drop policy if exists "modération supprime une oeuvre" on oeuvres;
create policy "modération supprime une oeuvre" on oeuvres for delete to authenticated using (public.est_moderateur());

drop policy if exists "modération voit une activité signalée" on activites;
create policy "modération voit une activité signalée" on activites for select to authenticated using (
  public.est_moderateur() and exists (select 1 from signalements s where s.activite_id = activites.id));
drop policy if exists "modération supprime une activité signalée" on activites;
create policy "modération supprime une activité signalée" on activites for delete to authenticated using (
  public.est_moderateur() and exists (select 1 from signalements s where s.activite_id = activites.id));

drop policy if exists "modération voit un commentaire signalé" on commentaires;
create policy "modération voit un commentaire signalé" on commentaires for select to authenticated using (
  public.est_moderateur() and exists (select 1 from signalements s where s.commentaire_id = commentaires.id));
drop policy if exists "modération supprime un commentaire signalé" on commentaires;
create policy "modération supprime un commentaire signalé" on commentaires for delete to authenticated using (
  public.est_moderateur() and exists (select 1 from signalements s where s.commentaire_id = commentaires.id));

drop policy if exists "modération corrige un profil signalé" on profils;
create policy "modération corrige un profil signalé" on profils for update to authenticated
  using (public.est_moderateur() and exists (select 1 from signalements s where s.profil_signale_id = profils.id))
  with check (public.est_moderateur());


-- ---------------------------------------------------------------------
-- 15. Photos (stockage) : on ne peut plus lister les fichiers des autres.
--     Les adresses publiques des photos continuent de marcher (dossiers publics).
--     Chacun garde le droit de lister SES fichiers (utile pour les remplacer ou les effacer).
--     On ne dépose que dans son dossier, avec un nom simple (ex. 1234/photo-1730800000000.jpg).
--     Une modératrice peut voir et retirer la photo d'une activité signalée, ou d'un profil signalé.
--     2 Mo au plus, JPEG, PNG ou WebP seulement.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists "photos de profil lisibles" on storage.objects';
    execute 'drop policy if exists "souvenirs lisibles" on storage.objects';
    execute 'drop policy if exists "je vois mes fichiers" on storage.objects';
    execute $p$create policy "je vois mes fichiers" on storage.objects for select to authenticated
              using (bucket_id in ('avatars', 'souvenirs') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    -- Déposer une photo : dans son dossier, avec un nom simple (pas de « .. », pas de sous-dossier).
    execute 'drop policy if exists "je range ma photo" on storage.objects';
    execute 'drop policy if exists "je change ma photo" on storage.objects';
    execute 'drop policy if exists "je range mes souvenirs" on storage.objects';
    execute $p$create policy "je range ma photo" on storage.objects for insert to authenticated
              with check (bucket_id = 'avatars'
                          and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp)$'))$p$;
    execute $p$create policy "je change ma photo" on storage.objects for update to authenticated
              using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
              with check (bucket_id = 'avatars'
                          and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp)$'))$p$;
    execute $p$create policy "je range mes souvenirs" on storage.objects for insert to authenticated
              with check (bucket_id = 'souvenirs'
                          and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp)$'))$p$;
    execute 'drop policy if exists "modération voit une photo signalée" on storage.objects';
    execute 'drop policy if exists "modération retire une photo signalée" on storage.objects';
    execute $p$create policy "modération voit une photo signalée" on storage.objects for select to authenticated
              using (bucket_id in ('avatars', 'souvenirs') and public.est_moderateur() and (
                exists (select 1 from public.activites a join public.signalements s on s.activite_id = a.id
                        where a.photo_url = public.hote_stockage() || storage.objects.bucket_id || '/' || storage.objects.name)
                or exists (select 1 from public.signalements s
                           where s.profil_signale_id::text = (storage.foldername(storage.objects.name))[1])))$p$;
    execute $p$create policy "modération retire une photo signalée" on storage.objects for delete to authenticated
              using (bucket_id in ('avatars', 'souvenirs') and public.est_moderateur() and (
                exists (select 1 from public.activites a join public.signalements s on s.activite_id = a.id
                        where a.photo_url = public.hote_stockage() || storage.objects.bucket_id || '/' || storage.objects.name)
                or exists (select 1 from public.signalements s
                           where s.profil_signale_id::text = (storage.foldername(storage.objects.name))[1])))$p$;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
       set file_size_limit = 2097152,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
     where id in ('avatars', 'souvenirs');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 16. Qui peut appeler quelles fonctions.
--     • notifier et lier_nouveau_compte : personne (seulement la base elle-même).
--     • lire_invitation, profil_public et profil_public_par_code : tout le monde, même sans compte.
--     • les autres : seulement les personnes connectées.
--     • les fonctions de déclencheur : personne.
--     Et les fonctions créées plus tard ne seront plus ouvertes à tous par défaut.
-- ---------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

revoke all on function public.notifier(uuid, text, uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.lier_nouveau_compte(uuid, uuid) from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['public.lire_invitation(text)', 'public.profil_public(uuid)', 'public.profil_public_par_code(text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.activite_visible(activites)', 'public.dans_la_sortie(uuid)', 'public.j_organise(uuid)',
    'public.bloque_entre(uuid, uuid)', 'public.est_abonne(uuid, uuid)', 'public.sont_amis(uuid, uuid)',
    'public.est_moderateur()', 'public.sans_accents(text)', 'public.hote_stockage()',
    'public.ma_progression(uuid)', 'public.mots_du_livre(uuid)', 'public.completer_nb_pages(uuid, integer)',
    'public.voyages_de_mes_conseils()', 'public.generer_rappels()',
    'public.accepter_invitation(text)', 'public.rejoindre(uuid)', 'public.rejoindre_etat(uuid)',
    'public.mon_lien_parrainage()', 'public.nouveau_lien_parrainage()', 'public.rejoindre_par_code(text)',
    'public.supprimer_mon_compte()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;


-- ---------------------------------------------------------------------
-- 17. Dernières corrections, après la contre-expertise indépendante :
--     I1 : le contrôle « grâce à / pensé par » ne révèle plus les conseils d'autrui ;
--     I2 : on ne signale que ce qu'on peut voir ;
--     M1 : la modération ne change que pseudo, bio et photo d'un profil ;
--     M2 : un profil signalé n'ouvre que sa photo de profil, pas ses souvenirs ;
--     M3 : est_abonne et sont_amis ne répondent que pour soi-même ;
--     M4 : les plafonds de groupe ne renseignent que l'autrice ou l'organisatrice.
-- ---------------------------------------------------------------------
-- I1. controle_grace : ne rien vérifier (donc ne rien révéler) si la ligne n'est pas la mienne ; RLS refusera.
create or replace function public.controle_grace() returns trigger
language plpgsql security definer set search_path = public as $$
declare qui uuid; moi uuid;
begin
  if tg_table_name = 'activites' then
    qui := new.grace_a; moi := new.auteur_id;
    if tg_op = 'UPDATE' and new.grace_a is not distinct from old.grace_a then return new; end if;
  else
    qui := new.pense_par; moi := new.profil_id;
    if tg_op = 'UPDATE' and new.pense_par is not distinct from old.pense_par then return new; end if;
  end if;
  if qui is null or auth.uid() is null or moi is distinct from auth.uid() then return new; end if;
  if exists (select 1 from blocages where (bloqueur_id = qui and bloque_id = moi) or (bloqueur_id = moi and bloque_id = qui))
     or not exists (select 1 from penses p where p.expediteur_id = qui and p.destinataire_id = moi and p.oeuvre_id = new.oeuvre_id) then
    raise exception 'Cette personne ne t''a pas conseillé cette œuvre.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.controle_grace() from public, anon, authenticated;

-- I2. On ne signale que ce qu'on peut voir.
drop policy if exists "je signale" on signalements;
create policy "je signale" on signalements for insert to authenticated with check (
  auteur_id = auth.uid()
  and (activite_id is null or exists (select 1 from activites a where a.id = activite_id))        -- RLS de activites
  and (commentaire_id is null or exists (select 1 from commentaires c where c.id = commentaire_id)) -- RLS de commentaires
  and (profil_signale_id is null or profil_signale_id <> auth.uid()));

-- M1. Une modératrice ne touche, sur le profil d'autrui, qu'au pseudo, à la bio et au retrait de la photo.
create or replace function public.controle_moderation_profil() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.id is distinct from auth.uid()
     and (new.univers_choisis, new.visibilite_defaut, new.commentaires_reserves_abonnes,
          new.stats_detaillees_publiques, new.inscription_terminee)
         is distinct from
         (old.univers_choisis, old.visibilite_defaut, old.commentaires_reserves_abonnes,
          old.stats_detaillees_publiques, old.inscription_terminee)
     or (auth.uid() is not null and new.id is distinct from auth.uid() and new.photo_url is not null
         and new.photo_url is distinct from old.photo_url) then
    raise exception 'La modération ne change que le pseudo, la bio ou retire la photo.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.controle_moderation_profil() from public, anon, authenticated;
drop trigger if exists controle_moderation_profil on profils;
create trigger controle_moderation_profil before update on profils
  for each row execute function public.controle_moderation_profil();

-- M2. Stockage : un profil signalé n'ouvre que sa photo de profil (bucket avatars), pas ses souvenirs.
drop policy if exists "modération voit une photo signalée" on storage.objects;
drop policy if exists "modération retire une photo signalée" on storage.objects;
create policy "modération voit une photo signalée" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'souvenirs') and public.est_moderateur() and (
    exists (select 1 from public.activites a join public.signalements s on s.activite_id = a.id
            where a.photo_url = public.hote_stockage() || storage.objects.bucket_id || '/' || storage.objects.name)
    or (bucket_id = 'avatars' and exists (select 1 from public.signalements s
               where s.profil_signale_id::text = (storage.foldername(storage.objects.name))[1]))));
create policy "modération retire une photo signalée" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'souvenirs') and public.est_moderateur() and (
    exists (select 1 from public.activites a join public.signalements s on s.activite_id = a.id
            where a.photo_url = public.hote_stockage() || storage.objects.bucket_id || '/' || storage.objects.name)
    or (bucket_id = 'avatars' and exists (select 1 from public.signalements s
               where s.profil_signale_id::text = (storage.foldername(storage.objects.name))[1]))));

-- M3. Ces deux fonctions ne répondent que si la personne connectée est l'une des deux (ou depuis la base elle-même).
create or replace function public.est_abonne(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (select 1 from abonnements where abonne_id = a and suivi_id = b and statut = 'accepte')
$$;
create or replace function public.sont_amis(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (select 1 from abonnements
                 where statut = 'accepte'
                   and ((abonne_id = a and suivi_id = b) or (abonne_id = b and suivi_id = a)))
$$;

-- M4. Les plafonds ne s'appliquent (et ne renseignent) que pour l'autrice de l'activité ou l'organisatrice de la sortie ;
--     pour les autres, la règle d'accès refuse de toute façon l'ajout.
create or replace function public.limite_par_groupe() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if tg_table_name = 'sortie_participants' then
    if not public.j_organise(new.sortie_id) then return new; end if;
    select count(*) into n from sortie_participants where sortie_id = new.sortie_id;
    if n >= 30 then raise exception 'Une sortie compte au plus 30 invités.' using errcode = 'P0001'; end if;
  else
    if not exists (select 1 from activites a where a.id = new.activite_id and a.auteur_id = auth.uid()) then return new; end if;
    select count(*) into n from identifications where activite_id = new.activite_id;
    if n >= 20 then raise exception 'Tu peux identifier au plus 20 personnes.' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
revoke all on function public.limite_par_groupe() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 18. La modération retire la photo d'une activité signalée (la carte n'affiche plus d'image cassée).
--     Elle ne peut que vider « photo_url » : tout autre changement sur l'activité d'autrui est refusé.
-- ---------------------------------------------------------------------
drop policy if exists "modération retire la photo d'une activité signalée" on activites;
create policy "modération retire la photo d'une activité signalée" on activites for update to authenticated
  using (public.est_moderateur() and exists (select 1 from signalements s where s.activite_id = activites.id))
  with check (public.est_moderateur() and photo_url is null);

create or replace function public.controle_moderation_activite() returns trigger
language plpgsql set search_path = public as $$
begin
  -- seulement pour une modification directe faite par une modératrice (pas les cascades « set null » d'une suppression)
  if pg_trigger_depth() = 1 and auth.uid() is not null and new.auteur_id is distinct from auth.uid()
     and public.est_moderateur()
     and ((to_jsonb(new) - 'photo_url') is distinct from (to_jsonb(old) - 'photo_url') or new.photo_url is not null) then
    raise exception 'La modération peut seulement retirer la photo de cette activité.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.controle_moderation_activite() from public, anon, authenticated;
drop trigger if exists controle_moderation_activite on activites;
create trigger controle_moderation_activite before update on activites
  for each row execute function public.controle_moderation_activite();
