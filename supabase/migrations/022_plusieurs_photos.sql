-- =====================================================================
-- Complément SQL n° 22 : plusieurs photos souvenirs par activité (6 au maximum).
--
--   • La liste des photos est rangée dans « photos » ; « photo_url » garde la première
--     (pour les anciennes versions de l'appli, et l'image en tête de la carte).
--   • Chaque photo doit venir du dossier Kulky de la personne, comme avant.
--   • Les photos déjà publiées sont reprises automatiquement.
--
-- À coller tel quel dans Supabase › SQL Editor. On peut le passer deux fois sans souci.
-- =====================================================================

alter table public.activites add column if not exists photos text[] not null default '{}';
do $$
begin
  alter table public.activites add constraint six_photos_max check (cardinality(photos) <= 6);
exception when duplicate_object then null;
end $$;
grant update (photos) on public.activites to authenticated;

-- Chaque photo vient du stockage Kulky, dans le dossier de la personne, avec un nom de fichier simple.
create or replace function public.controle_photos() returns trigger
language plpgsql set search_path = public as $$
declare
  debut text := public.hote_stockage() || 'souvenirs/' || new.auteur_id || '/';
  p text;
begin
  if tg_op = 'UPDATE' and new.photos is not distinct from old.photos then return new; end if;
  foreach p in array coalesce(new.photos, '{}') loop
    if left(p, length(debut)) <> debut or substr(p, length(debut) + 1) !~ '^[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp)$' then
      raise exception 'Cette photo doit être envoyée depuis Kulky.' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists controle_photos on public.activites;
create trigger controle_photos before insert or update of photos on public.activites
  for each row execute function public.controle_photos();

-- Reprise des photos déjà publiées.
update public.activites set photos = array[photo_url] where photo_url is not null and cardinality(photos) = 0;
