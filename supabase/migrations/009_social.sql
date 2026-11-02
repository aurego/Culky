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
