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
