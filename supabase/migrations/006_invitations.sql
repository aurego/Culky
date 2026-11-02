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
