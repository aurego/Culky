-- =====================================================================
-- Culky — schéma de la base de données, version 1
-- À coller une seule fois dans Supabase › SQL Editor › New query › Run.
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
