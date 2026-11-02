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
