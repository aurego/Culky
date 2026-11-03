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
