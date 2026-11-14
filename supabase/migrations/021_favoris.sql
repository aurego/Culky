-- =====================================================================
-- Complément SQL n° 21 : les chouchous et le plaisir coupable, sans passer par le journal.
--
--   • On peut mettre en chouchou (6 au maximum) ou en plaisir coupable (un seul) n'importe quelle
--     œuvre, même lue il y a dix ans, sans l'enregistrer dans son journal ni dans le fil.
--   • Les chouchous et le plaisir coupable déjà choisis sont repris automatiquement.
--   • Visibles sur le profil par toute personne connectée (sauf entre personnes bloquées).
--
-- À coller tel quel dans Supabase › SQL Editor. On peut le passer deux fois sans souci.
-- =====================================================================

create table if not exists public.favoris (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils on delete cascade,
  oeuvre_id uuid not null references public.oeuvres on delete cascade,
  type text not null check (type in ('chouchou', 'plaisir')),
  cree_le timestamptz not null default now(),
  unique (profil_id, oeuvre_id, type)
);
create index if not exists favoris_profil on public.favoris (profil_id, type);
alter table public.favoris enable row level security;
revoke all on public.favoris from public, anon;
grant select, insert, delete on public.favoris to authenticated;

drop policy if exists "favoris visibles" on public.favoris;
create policy "favoris visibles" on public.favoris for select to authenticated using (
  profil_id = auth.uid() or not public.bloque_entre(auth.uid(), profil_id));
drop policy if exists "j'ajoute mes favoris" on public.favoris;
create policy "j'ajoute mes favoris" on public.favoris for insert to authenticated with check (profil_id = auth.uid());
drop policy if exists "je retire mes favoris" on public.favoris;
create policy "je retire mes favoris" on public.favoris for delete to authenticated using (profil_id = auth.uid());

-- Au plus 6 chouchous ; un seul plaisir coupable (le nouveau remplace l'ancien).
create or replace function public.regle_favoris() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'chouchou'
     and (select count(*) from favoris where profil_id = new.profil_id and type = 'chouchou') >= 6 then
    raise exception 'Six chouchous au maximum' using errcode = 'P0001';
  end if;
  if new.type = 'plaisir' then
    delete from favoris where profil_id = new.profil_id and type = 'plaisir';
  end if;
  return new;
end $$;
revoke all on function public.regle_favoris() from public, anon, authenticated;
drop trigger if exists regle_favoris on public.favoris;
create trigger regle_favoris before insert on public.favoris
  for each row execute function public.regle_favoris();

-- Pas d'avalanche : au plus 60 ajouts par heure.
drop trigger if exists limite_debit on public.favoris;
create trigger limite_debit before insert on public.favoris
  for each row execute function public.limite_debit('profil_id', '60');

-- Reprise des chouchous et du plaisir coupable déjà choisis dans le journal.
insert into public.favoris (profil_id, oeuvre_id, type, cree_le)
select a.auteur_id, a.oeuvre_id, 'chouchou', a.date_activite::timestamptz
  from public.activites a where a.chouchou
on conflict do nothing;
do $$
begin
  insert into public.favoris (profil_id, oeuvre_id, type)
  select distinct on (a.auteur_id) a.auteur_id, a.oeuvre_id, 'plaisir'
    from public.activites a where a.plaisir_coupable
  on conflict do nothing;
exception when undefined_column then
  null; -- complément n° 20 pas passé : rien à reprendre
end $$;
