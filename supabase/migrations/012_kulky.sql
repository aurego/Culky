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
