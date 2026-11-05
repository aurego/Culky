-- =====================================================================
-- Culky — schéma de la base de données, version 1
-- À coller une seule fois dans Supabase › SQL Editor › New query › Run (pour une base neuve).
-- Une base déjà installée reçoit plutôt les compléments du dossier supabase/migrations/.
-- Chaque table suit le cahier des charges V1 (section « Choix techniques »).
-- La sécurité (RLS) est activée partout : chacun ne modifie que ses propres données.
-- =====================================================================

-- Types ----------------------------------------------------------------
create type univers as enum ('livres', 'cine', 'concerts', 'expos');
create type visibilite as enum ('public', 'abonnes', 'prive');

-- Profils (un par compte) ----------------------------------------------
create table profils (
  id uuid primary key references auth.users on delete cascade,
  pseudo text unique not null check (char_length(pseudo) between 2 and 30),
  photo_url text,
  bio text check (char_length(bio) <= 200),
  univers_choisis univers[] not null default '{livres,cine,concerts,expos}',
  commentaires_reserves_abonnes boolean not null default false,
  stats_detaillees_publiques boolean not null default false,
  inscription_terminee boolean not null default false, -- pseudo et univers choisis
  cree_le timestamptz not null default now()
);

-- Création automatique du profil à l'inscription (pseudo provisoire modifiable ensuite).
create function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profils (id, pseudo)
  values (new.id, 'culky' || substr(replace(new.id::text, '-', ''), 1, 8));
  return new;
end $$;

create trigger a_l_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- Œuvres (copiées depuis Google Books, TMDB, MusicBrainz, OpenAgenda… ou créées à la main)
create table oeuvres (
  id uuid primary key default gen_random_uuid(),
  univers univers not null,
  titre text not null,
  createur text,                 -- auteur, réalisateur, artiste
  image_url text,                -- couverture ou affiche
  source text,                   -- 'google_books', 'tmdb', 'musicbrainz', 'openagenda', 'manuel'
  source_id text,                -- identifiant chez la source (ISBN, id TMDB…)
  date_fin date,                 -- fin d'une expo ou d'un film à l'affiche (pour les rappels)
  cree_par uuid references profils on delete set null,
  cree_le timestamptz not null default now(),
  unique (source, source_id)
);

-- Lieux culturels (jamais de position GPS d'une personne)
create table lieux (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type text,                     -- 'cinema', 'salle', 'musee', 'librairie'…
  ville text not null default 'Toulouse',
  cree_le timestamptz not null default now()
);

-- Activités (les sorties enregistrées) -----------------------------------
create table activites (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null references profils on delete cascade,
  oeuvre_id uuid not null references oeuvres on delete restrict,
  lieu_id uuid references lieux on delete set null,
  etat text not null default 'fini' check (etat in ('commence', 'fini')), -- livres : commencé puis fini
  au_cinema boolean,             -- ciné : au cinéma (true) ou à la maison (false)
  emotions text[] not null default '{}' check (cardinality(emotions) <= 3),
  mots text check (char_length(mots) <= 500),
  photo_url text,
  date_activite date not null default current_date,
  visibilite visibilite not null default 'public',
  grace_a uuid references profils on delete set null, -- « grâce à Claire » (pensé à toi)
  cree_le timestamptz not null default now()
);
create index on activites (auteur_id, date_activite desc);
create index on activites (cree_le desc);

-- Amis identifiés dans une activité (« tu étais avec moi »)
create table identifications (
  activite_id uuid references activites on delete cascade,
  profil_id uuid references profils on delete cascade,
  primary key (activite_id, profil_id)
);

-- Abonnements (on suit sans validation réciproque)
create table abonnements (
  abonne_id uuid references profils on delete cascade,
  suivi_id uuid references profils on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (abonne_id, suivi_id),
  check (abonne_id <> suivi_id)
);

-- Envies (« Ça me tente »)
create table envies (
  profil_id uuid references profils on delete cascade,
  oeuvre_id uuid references oeuvres on delete cascade,
  cachee boolean not null default false,
  pense_par uuid references profils on delete set null,
  cree_le timestamptz not null default now(),
  primary key (profil_id, oeuvre_id)
);

-- Culkoko (un seul par personne et par activité)
create table culkoko (
  activite_id uuid references activites on delete cascade,
  profil_id uuid references profils on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (activite_id, profil_id)
);

-- Commentaires, avec la case anti-spoiler
create table commentaires (
  id uuid primary key default gen_random_uuid(),
  activite_id uuid not null references activites on delete cascade,
  auteur_id uuid not null references profils on delete cascade,
  texte text not null check (char_length(texte) between 1 and 1000),
  spoiler boolean not null default false,
  cree_le timestamptz not null default now()
);

-- « Pensé à toi » (privé entre les deux personnes)
create table penses (
  id uuid primary key default gen_random_uuid(),
  expediteur_id uuid not null references profils on delete cascade,
  destinataire_id uuid references profils on delete cascade, -- vide tant que l'invité n'est pas inscrit
  oeuvre_id uuid not null references oeuvres on delete cascade,
  mot text check (char_length(mot) <= 300),
  propose_accompagner boolean not null default false,       -- « Et je t'accompagnerais bien »
  code_invitation text unique,                               -- lien WhatsApp/SMS pour un non-inscrit
  activite_bouclee_id uuid references activites on delete set null, -- boucle bouclée
  merci_le timestamptz,                                             -- « Merci ! » du destinataire
  cree_le timestamptz not null default now()
);

-- Notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references profils on delete cascade,
  type text not null,            -- 'culkoko', 'commentaire', 'mention', 'abonne', 'identification', 'pense', 'boucle', 'rappel'
  acteur_id uuid references profils on delete cascade,
  activite_id uuid references activites on delete cascade,
  pense_id uuid references penses on delete cascade,
  lue boolean not null default false,
  cree_le timestamptz not null default now()
);
create index on notifications (destinataire_id, cree_le desc);

-- Signaler et bloquer (exigence Apple dès la V1)
create table blocages (
  bloqueur_id uuid references profils on delete cascade,
  bloque_id uuid references profils on delete cascade,
  primary key (bloqueur_id, bloque_id)
);

create table signalements (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null references profils on delete cascade,
  activite_id uuid references activites on delete cascade,
  commentaire_id uuid references commentaires on delete cascade,
  profil_signale_id uuid references profils on delete cascade,
  raison text,
  cree_le timestamptz not null default now()
);

-- =====================================================================
-- Sécurité : Row Level Security
-- =====================================================================
alter table profils enable row level security;
alter table oeuvres enable row level security;
alter table lieux enable row level security;
alter table activites enable row level security;
alter table identifications enable row level security;
alter table abonnements enable row level security;
alter table envies enable row level security;
alter table culkoko enable row level security;
alter table commentaires enable row level security;
alter table penses enable row level security;
alter table notifications enable row level security;
alter table blocages enable row level security;
alter table signalements enable row level security;

-- Une activité est-elle visible par la personne connectée ?
create function public.activite_visible(a activites) returns boolean
language sql stable security definer set search_path = public as $$
  select a.auteur_id = auth.uid()
      or exists (select 1 from identifications i where i.activite_id = a.id and i.profil_id = auth.uid())
      or (
        not exists (select 1 from blocages b where b.bloqueur_id = a.auteur_id and b.bloque_id = auth.uid())
        and (
          a.visibilite = 'public'
          or (a.visibilite = 'abonnes' and exists (
                select 1 from abonnements ab where ab.abonne_id = auth.uid() and ab.suivi_id = a.auteur_id))
        )
      )
$$;

-- Profils : publics en lecture, chacun modifie le sien.
create policy "profils lisibles" on profils for select using (true);
create policy "je modifie mon profil" on profils for update using (id = auth.uid());

-- Œuvres et lieux : lisibles par tous, ajout par toute personne connectée.
create policy "oeuvres lisibles" on oeuvres for select using (true);
create policy "ajouter une oeuvre" on oeuvres for insert to authenticated with check (cree_par = auth.uid());
create policy "lieux lisibles" on lieux for select using (true);
create policy "ajouter un lieu" on lieux for insert to authenticated with check (true);

-- Activités
create policy "activites visibles" on activites for select using (activite_visible(activites));
create policy "j'enregistre mes activites" on activites for insert to authenticated with check (auteur_id = auth.uid());
create policy "je modifie mes activites" on activites for update using (auteur_id = auth.uid());
create policy "je supprime mes activites" on activites for delete using (auteur_id = auth.uid());

-- Identifications : visibles avec l'activité, ajoutées par l'auteur.
create policy "identifications visibles" on identifications for select using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a)));
create policy "l'auteur identifie" on identifications for insert to authenticated with check (
  exists (select 1 from activites a where a.id = activite_id and a.auteur_id = auth.uid()));
create policy "retirer une identification" on identifications for delete using (
  profil_id = auth.uid() or exists (select 1 from activites a where a.id = activite_id and a.auteur_id = auth.uid()));

-- Abonnements : publics, chacun gère les siens.
create policy "abonnements lisibles" on abonnements for select using (true);
create policy "je m'abonne" on abonnements for insert to authenticated with check (abonne_id = auth.uid());
create policy "je me desabonne" on abonnements for delete using (abonne_id = auth.uid());

-- Envies : visibles par tous sauf si cachées ; chacun gère les siennes.
create policy "envies visibles" on envies for select using (profil_id = auth.uid() or not cachee);
create policy "j'ajoute une envie" on envies for insert to authenticated with check (profil_id = auth.uid());
create policy "je modifie mes envies" on envies for update using (profil_id = auth.uid());
create policy "je retire une envie" on envies for delete using (profil_id = auth.uid());

-- Culkoko
create policy "culkoko visibles" on culkoko for select using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a)));
create policy "je donne un culkoko" on culkoko for insert to authenticated with check (
  profil_id = auth.uid() and exists (select 1 from activites a where a.id = activite_id and activite_visible(a)));
create policy "je retire mon culkoko" on culkoko for delete using (profil_id = auth.uid());

-- Commentaires (le réglage « réservés aux abonnés » est vérifié ici)
create policy "commentaires visibles" on commentaires for select using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a)));
create policy "je commente" on commentaires for insert to authenticated with check (
  auteur_id = auth.uid() and exists (
    select 1 from activites a join profils p on p.id = a.auteur_id
    where a.id = activite_id and activite_visible(a)
      and (not p.commentaires_reserves_abonnes or a.auteur_id = auth.uid()
           or exists (select 1 from abonnements ab where ab.abonne_id = auth.uid() and ab.suivi_id = a.auteur_id))));
create policy "je supprime mes commentaires" on commentaires for delete using (
  auteur_id = auth.uid() or exists (select 1 from activites a where a.id = activite_id and a.auteur_id = auth.uid()));

-- Pensés à toi : privés entre expéditeur et destinataire.
create policy "mes penses" on penses for select using (expediteur_id = auth.uid() or destinataire_id = auth.uid());
create policy "j'envoie un pense" on penses for insert to authenticated with check (expediteur_id = auth.uid());
create policy "le destinataire boucle la boucle" on penses for update using (destinataire_id = auth.uid());

-- Notifications : chacun ne voit que les siennes.
create policy "mes notifications" on notifications for select using (destinataire_id = auth.uid());
create policy "je marque comme lue" on notifications for update using (destinataire_id = auth.uid());

-- Blocages et signalements
create policy "mes blocages" on blocages for select using (bloqueur_id = auth.uid());
create policy "je bloque" on blocages for insert to authenticated with check (bloqueur_id = auth.uid());
create policy "je debloque" on blocages for delete using (bloqueur_id = auth.uid());
create policy "je signale" on signalements for insert to authenticated with check (auteur_id = auth.uid());

-- =====================================================================
-- Sorties entre amis (« On y va ensemble ? »)
-- =====================================================================
create table if not exists sorties (
  id uuid primary key default gen_random_uuid(),
  organisateur_id uuid not null references profils on delete cascade,
  oeuvre_id uuid not null references oeuvres on delete cascade,
  date_prevue date not null,
  heure text check (char_length(heure) <= 20),   -- « 20 h 30 », facultatif
  lieu text check (char_length(lieu) <= 120),     -- facultatif
  mot text check (char_length(mot) <= 300),       -- facultatif
  cree_le timestamptz not null default now()
);
create index if not exists sorties_date on sorties (date_prevue);

create table if not exists sortie_participants (
  sortie_id uuid references sorties on delete cascade,
  profil_id uuid references profils on delete cascade,
  reponse text not null default 'invite' check (reponse in ('invite', 'partant', 'pas_cette_fois')),
  repondu_le timestamptz,
  primary key (sortie_id, profil_id)
);

alter table sorties enable row level security;
alter table sortie_participants enable row level security;

-- Suis-je dans cette sortie (organisatrice ou invitée) ?
create or replace function public.dans_la_sortie(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sorties where id = s and organisateur_id = auth.uid())
      or exists (select 1 from sortie_participants where sortie_id = s and profil_id = auth.uid())
$$;

create or replace function public.j_organise(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sorties where id = s and organisateur_id = auth.uid())
$$;

-- Une sortie n'est visible que par les personnes qui en font partie.
drop policy if exists "mes sorties" on sorties;
drop policy if exists "j'organise une sortie" on sorties;
drop policy if exists "je modifie ma sortie" on sorties;
drop policy if exists "j'annule ma sortie" on sorties;
create policy "mes sorties" on sorties for select using (dans_la_sortie(id));
create policy "j'organise une sortie" on sorties for insert to authenticated with check (organisateur_id = auth.uid());
create policy "je modifie ma sortie" on sorties for update using (organisateur_id = auth.uid());
create policy "j'annule ma sortie" on sorties for delete using (organisateur_id = auth.uid());

drop policy if exists "participants visibles" on sortie_participants;
drop policy if exists "l'organisatrice invite" on sortie_participants;
drop policy if exists "je réponds" on sortie_participants;
drop policy if exists "je me retire ou l'organisatrice retire" on sortie_participants;
create policy "participants visibles" on sortie_participants for select using (dans_la_sortie(sortie_id));
create policy "l'organisatrice invite" on sortie_participants for insert to authenticated with check (j_organise(sortie_id));
create policy "je réponds" on sortie_participants for update using (profil_id = auth.uid()) with check (profil_id = auth.uid());
create policy "je me retire ou l'organisatrice retire" on sortie_participants for delete using (profil_id = auth.uid() or j_organise(sortie_id));

-- =====================================================================
-- Notifications automatiques et rappels
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
-- Complément n° 5 : les marque-pages partagés (réactions sans spoiler, débloquées à la page).
-- À coller dans Supabase > SQL Editor, après les compléments 2, 3 et 4. On peut le relancer sans risque.

-- Le nombre de pages d'un livre (vient de Google Books), pour la barre de progression.
alter table oeuvres add column if not exists nb_pages integer check (nb_pages is null or nb_pages > 0);

-- « Où j'en suis ? » : une étape de lecture, avec un petit mot ou une émotion facultatifs.
-- On compare les lecteurs en pourcentage (progression), car les éditions n'ont pas la même pagination.
create table if not exists marque_pages (
  id uuid primary key default gen_random_uuid(),
  activite_id uuid not null references activites on delete cascade,
  auteur_id uuid not null references profils on delete cascade,
  oeuvre_id uuid not null references oeuvres on delete cascade,
  page integer check (page is null or page > 0),
  progression numeric(5, 2) not null check (progression >= 0 and progression <= 100),
  mot text check (char_length(mot) <= 280),
  emotion text,
  cree_le timestamptz not null default now()
);
create index if not exists marque_pages_oeuvre on marque_pages (oeuvre_id, progression);
create index if not exists marque_pages_auteur on marque_pages (auteur_id, oeuvre_id);

alter table marque_pages enable row level security;

-- Chacun ne lit directement que ses propres marque-pages.
-- Ceux des autres passent par la fonction mots_du_livre, qui applique la règle d'or.
drop policy if exists "mes marque-pages" on marque_pages;
drop policy if exists "je pose un marque-page" on marque_pages;
drop policy if exists "je modifie mes marque-pages" on marque_pages;
drop policy if exists "je supprime mes marque-pages" on marque_pages;
create policy "mes marque-pages" on marque_pages for select using (auteur_id = auth.uid());
create policy "je pose un marque-page" on marque_pages for insert to authenticated with check (
  auteur_id = auth.uid()
  and exists (select 1 from activites a where a.id = activite_id and a.auteur_id = auth.uid() and a.oeuvre_id = marque_pages.oeuvre_id));
create policy "je modifie mes marque-pages" on marque_pages for update using (auteur_id = auth.uid());
create policy "je supprime mes marque-pages" on marque_pages for delete using (auteur_id = auth.uid());

-- Où j'en suis dans ce livre : 100 si je l'ai fini, sinon mon marque-page le plus avancé.
create or replace function public.ma_progression(o uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from activites a where a.oeuvre_id = o and a.auteur_id = auth.uid() and a.etat = 'fini') then 100
    else coalesce((select max(m.progression) from marque_pages m where m.oeuvre_id = o and m.auteur_id = auth.uid()), 0)
  end
$$;

-- La règle d'or : les mots des autres lecteurs (que j'ai le droit de voir), en clair seulement
-- si je les ai dépassés. Sinon, la ligne arrive verrouillée : ni mot, ni émotion, ni page.
create or replace function public.mots_du_livre(o uuid)
returns table (
  id uuid,
  auteur_id uuid,
  pseudo text,
  progression numeric,
  page integer,
  mot text,
  emotion text,
  cree_le timestamptz,
  debloque boolean
)
language sql stable security definer set search_path = public as $$
  with moi as (select public.ma_progression(o) as p)
  select m.id,
         m.auteur_id,
         pr.pseudo,
         m.progression,
         case when m.progression <= moi.p then m.page end,
         case when m.progression <= moi.p then m.mot end,
         case when m.progression <= moi.p then m.emotion end,
         m.cree_le,
         m.progression <= moi.p
  from marque_pages m
  join activites a on a.id = m.activite_id
  join profils pr on pr.id = m.auteur_id
  cross join moi
  where m.oeuvre_id = o
    and m.auteur_id <> auth.uid()
    and (m.mot is not null or m.emotion is not null)
    and public.activite_visible(a)
  order by m.progression, m.cree_le
$$;

grant execute on function public.ma_progression(uuid) to authenticated;
grant execute on function public.mots_du_livre(uuid) to authenticated;

-- Compléter le nombre de pages d'un livre quand personne ne l'a encore donné (Google Books, ou le lecteur).
create or replace function public.completer_nb_pages(o uuid, n integer) returns void
language sql volatile security definer set search_path = public as $$
  update oeuvres set nb_pages = n where id = o and nb_pages is null and n between 1 and 20000 and auth.uid() is not null
$$;
grant execute on function public.completer_nb_pages(uuid, integer) to authenticated;
-- Complément n° 6 : l'invitation par lien rattache enfin le nouveau compte.
-- Claire conseille un livre à un ami qui n'a pas Culky. Il ouvre le lien, crée son compte,
-- et retrouve le conseil dans « Pour toi », déjà relié à Claire (chacun suit l'autre).
-- À coller dans Supabase > SQL Editor, après les compléments 2 à 5. On peut le relancer sans risque.

-- Ce que montre la page d'invitation, même sans compte : qui, quoi, le petit mot.
-- Le code n'ouvre que ce conseil-là, et plus rien une fois qu'il a été accepté.
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
    and length(lire_invitation.code) >= 6
$$;

-- Accepter l'invitation, une fois connecté : le conseil devient le mien, et on se suit mutuellement.
-- Renvoie l'identifiant du conseil (ou rien si le code est inconnu ou déjà pris par quelqu'un d'autre).
create or replace function public.accepter_invitation(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  p penses%rowtype;
begin
  if moi is null then return null; end if;
  select * into p from penses where code_invitation = accepter_invitation.code for update;
  if not found or p.expediteur_id = moi then return null; end if;
  if p.destinataire_id is not null then
    return case when p.destinataire_id = moi then p.id end; -- déjà accepté par moi : rien à refaire
  end if;

  update penses set destinataire_id = moi where id = p.id;

  -- On se suit l'un l'autre (sauf si l'un a bloqué l'autre).
  if not exists (select 1 from blocages b where (b.bloqueur_id = moi and b.bloque_id = p.expediteur_id)
                                             or (b.bloqueur_id = p.expediteur_id and b.bloque_id = moi)) then
    insert into abonnements (abonne_id, suivi_id) values (moi, p.expediteur_id) on conflict do nothing;
    insert into abonnements (abonne_id, suivi_id) values (p.expediteur_id, moi) on conflict do nothing;
  end if;

  -- « Claire a pensé à toi » arrive dans la cloche du nouveau venu,
  -- et Claire apprend que son ami l'a rejoint grâce à son conseil.
  perform notifier(moi, 'conseil', p.expediteur_id, pense => p.id, oeuvre => p.oeuvre_id);
  perform notifier(p.expediteur_id, 'invitation_acceptee', moi, pense => p.id, oeuvre => p.oeuvre_id);
  return p.id;
end $$;

grant execute on function public.lire_invitation(text) to anon, authenticated;
grant execute on function public.accepter_invitation(text) to authenticated;
-- Complément n° 7 : les pseudos commencent toujours par une majuscule (« claire » devient « Claire »).
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.

-- 1. Désormais, la base met elle-même la majuscule, à l'inscription comme à chaque changement de pseudo
--    (sauf pour le pseudo provisoire « culky1a2b3c4d », remplacé dès l'étape suivante).
create or replace function public.pseudo_majuscule() returns trigger
language plpgsql as $$
begin
  if new.pseudo !~ '^culky[0-9a-f]{8}$' then
    new.pseudo := upper(left(new.pseudo, 1)) || substr(new.pseudo, 2);
  end if;
  return new;
end $$;
drop trigger if exists majuscule_au_pseudo on profils;
create trigger majuscule_au_pseudo before insert or update of pseudo on profils
  for each row execute function public.pseudo_majuscule();

-- 2. Les pseudos déjà choisis prennent leur majuscule (sauf si « Claire » existe déjà à côté de « claire »).
update profils p set pseudo = upper(left(p.pseudo, 1)) || substr(p.pseudo, 2)
where p.pseudo !~ '^culky[0-9a-f]{8}$'
  and left(p.pseudo, 1) <> upper(left(p.pseudo, 1))
  and not exists (select 1 from profils q where q.pseudo = upper(left(p.pseudo, 1)) || substr(p.pseudo, 2));

-- 3. « Claire » et « claire » ne peuvent plus coexister : un pseudo est unique, majuscules comprises.
do $$
begin
  create unique index if not exists profils_pseudo_unique_sans_casse on profils (lower(pseudo));
exception when unique_violation then
  raise notice 'Deux pseudos ne diffèrent que par les majuscules : index non créé, rien de grave.';
end $$;
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
-- Complément n° 9 : commentaires, profil et réglages, signaler et bloquer.
-- À coller dans Supabase > SQL Editor, après les compléments précédents. On peut le relancer sans risque.

-- 1. Une activité visible ne l'est plus pour moi si j'ai bloqué son auteur (en plus de l'inverse).
create or replace function public.activite_visible(a activites) returns boolean
language sql stable security definer set search_path = public as $$
  select a.auteur_id = auth.uid()
      or exists (select 1 from identifications i where i.activite_id = a.id and i.profil_id = auth.uid())
      or (
        not exists (select 1 from blocages b
                    where (b.bloqueur_id = a.auteur_id and b.bloque_id = auth.uid())
                       or (b.bloqueur_id = auth.uid() and b.bloque_id = a.auteur_id))
        and (
          a.visibilite = 'public'
          or (a.visibilite = 'abonnes' and exists (
                select 1 from abonnements ab where ab.abonne_id = auth.uid() and ab.suivi_id = a.auteur_id))
        )
      )
$$;

-- 2. Les commentaires des personnes que j'ai bloquées (ou qui m'ont bloqué·e) disparaissent pour moi.
drop policy if exists "commentaires visibles" on commentaires;
create policy "commentaires visibles" on commentaires for select using (
  exists (select 1 from activites a where a.id = activite_id and activite_visible(a))
  and not exists (select 1 from blocages b
                  where (b.bloqueur_id = auth.uid() and b.bloque_id = commentaires.auteur_id)
                     or (b.bloqueur_id = commentaires.auteur_id and b.bloque_id = auth.uid())));

-- 3. Un nouveau commentaire prévient l'auteur de l'activité, et celles et ceux qui ont déjà commenté.
create or replace function public.notif_commentaire() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  auteur uuid;
  o uuid;
  r record;
begin
  select a.auteur_id, a.oeuvre_id into auteur, o from activites a where a.id = new.activite_id;
  perform notifier(auteur, 'commentaire', new.auteur_id, activite => new.activite_id, oeuvre => o,
                   cle_unique => 'commentaire:' || auteur || ':' || new.id);
  for r in select distinct c.auteur_id from commentaires c
           where c.activite_id = new.activite_id and c.auteur_id <> new.auteur_id and c.auteur_id <> auteur
  loop
    perform notifier(r.auteur_id, 'commentaire_suite', new.auteur_id, activite => new.activite_id, oeuvre => o,
                     cle_unique => 'commentaire:' || r.auteur_id || ':' || new.id);
  end loop;
  return new;
end $$;
drop trigger if exists quand_commentaire on commentaires;
create trigger quand_commentaire after insert on commentaires for each row execute function public.notif_commentaire();

-- 4. Bloquer quelqu'un : on ne se suit plus, dans un sens comme dans l'autre.
create or replace function public.apres_blocage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from abonnements where (abonne_id = new.bloqueur_id and suivi_id = new.bloque_id)
                             or (abonne_id = new.bloque_id and suivi_id = new.bloqueur_id);
  return new;
end $$;
drop trigger if exists quand_blocage on blocages;
create trigger quand_blocage after insert on blocages for each row execute function public.apres_blocage();

-- Et on ne peut pas suivre quelqu'un avec qui il y a un blocage.
drop policy if exists "je m'abonne" on abonnements;
create policy "je m'abonne" on abonnements for insert to authenticated with check (
  abonne_id = auth.uid()
  and not exists (select 1 from blocages b where (b.bloqueur_id = suivi_id and b.bloque_id = auth.uid())
                                             or (b.bloqueur_id = auth.uid() and b.bloque_id = suivi_id)));

-- 5. Réglage : qui voit mes nouvelles activités par défaut.
alter table profils add column if not exists visibilite_defaut visibilite not null default 'public';

-- 6. Les photos de profil, rangées dans un dossier par personne (lisibles par tous, modifiables par soi).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
    execute 'drop policy if exists "photos de profil lisibles" on storage.objects';
    execute 'drop policy if exists "je range ma photo" on storage.objects';
    execute 'drop policy if exists "je change ma photo" on storage.objects';
    execute 'drop policy if exists "je retire ma photo" on storage.objects';
    execute $p$create policy "photos de profil lisibles" on storage.objects for select using (bucket_id = 'avatars')$p$;
    execute $p$create policy "je range ma photo" on storage.objects for insert to authenticated
              with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "je change ma photo" on storage.objects for update to authenticated
              using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "je retire ma photo" on storage.objects for delete to authenticated
              using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
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

-- Complément n° 12 : Culky devient Kulky. Le pseudo provisoire donné à l'inscription
-- commence désormais par « kulky » (l'appli reconnaît les deux, l'ancien et le nouveau).
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.

create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profils (id, pseudo)
  values (new.id, 'kulky' || substr(replace(new.id::text, '-', ''), 1, 8));
  return new;
end $$;

create or replace function public.pseudo_majuscule() returns trigger
language plpgsql as $$
begin
  if new.pseudo !~ '^[ck]ulky[0-9a-f]{8}$' then
    new.pseudo := upper(left(new.pseudo, 1)) || substr(new.pseudo, 2);
  end if;
  return new;
end $$;

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

-- Complément n° 14 : l'univers « Scène » réunit les concerts et les spectacles (théâtre, danse, cirque, humour…).
-- On range le genre sur l'œuvre ; sans genre, c'est un concert, comme avant.
-- À coller dans Supabase > SQL Editor. On peut le relancer sans risque.
alter table oeuvres add column if not exists genre text check (genre in ('concert', 'spectacle'));

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
