-- =====================================================================
-- Culky — complément n° 3 : le « Merci ! » des conseils, et les sorties entre amis
-- À coller une seule fois dans Supabase › SQL Editor › New query › Run.
-- =====================================================================

-- 1. « Merci ! » : la personne qui reçoit un conseil peut remercier en un geste.
alter table penses add column if not exists merci_le timestamptz;

-- 2. Les sorties : « On y va ensemble ? », avec une date et des amis invités.
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
