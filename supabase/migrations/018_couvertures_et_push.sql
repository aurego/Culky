-- =====================================================================
-- Complément SQL n° 18 : les couvertures de secours et les notifications sur le téléphone.
--
--   • Quand Google Books n'a pas de couverture, Kulky va la chercher dans Open Library :
--     la base accepte désormais une image Open Library pour un livre trouvé sur Google.
--   • Un livre déjà dans Kulky sans couverture peut en recevoir une (jamais la remplacer).
--   • Notifications sur le téléphone (iPhone) : chaque notification de Kulky (Kulkoko,
--     commentaire, conseil, sortie…) part aussi sur le téléphone de la personne, si elle l'a accepté.
--     L'envoi passe par le service gratuit d'Expo ; aucune clé secrète n'est nécessaire ici.
--
-- À coller tel quel dans Supabase › SQL Editor. On peut le passer deux fois sans souci.
-- =====================================================================

-- 1. Une couverture Open Library est acceptée pour un livre venu de Google Books.
create or replace function public.controle_oeuvre() returns trigger
language plpgsql set search_path = public as $$
declare
  hote text;
  nouveau boolean := tg_op = 'INSERT';
begin
  -- chaque contrôle ne porte que sur ce qui change (une ancienne fiche reste corrigeable)
  if (nouveau or new.titre is distinct from old.titre or new.createur is distinct from old.createur)
     and (new.titre ~* '(http|www\.|\.[a-z]{2,6}/)' or coalesce(new.createur, '') ~* '(http|www\.|\.[a-z]{2,6}/)') then
    raise exception 'Un titre ou un nom ne peut pas contenir d''adresse web.' using errcode = 'P0001';
  end if;
  if (nouveau or new.source is distinct from old.source or new.source_id is distinct from old.source_id)
     and (new.source = 'google_books' and coalesce(new.source_id, '') !~ '^[A-Za-z0-9_-]{4,40}$'
          or new.source = 'tmdb' and coalesce(new.source_id, '') !~ '^[0-9]{1,10}$'
          or new.source = 'musicbrainz' and coalesce(new.source_id, '') !~ '^[0-9a-f-]{36}$'
          or new.source = 'openlibrary' and coalesce(new.source_id, '') !~ '^/works/OL[0-9]+W$') then
    raise exception 'Cette œuvre n''a pas un identifiant valable pour sa source.' using errcode = 'P0001';
  end if;
  if new.image_url is not null and (nouveau or new.image_url is distinct from old.image_url or new.source is distinct from old.source) then
    hote := case new.source
      when 'google_books' then '(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)'
      when 'openlibrary'  then 'covers\.openlibrary\.org'
      when 'tmdb'         then 'image\.tmdb\.org'
      when 'musicbrainz'  then 'coverartarchive\.org'
      else '(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org|image\.tmdb\.org|coverartarchive\.org|ktsbhikhrmjsoakljjlj\.supabase\.co/storage/v1/object/public)'
    end;
    if new.image_url !~ ('^https://' || hote || '/[^\s"''<>]*$') then
      raise exception 'Cette image ne vient pas d''une source connue.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- 2. Compléter la couverture d'une œuvre qui n'en a pas (jamais remplacer une couverture existante).
create or replace function public.completer_couverture(o uuid, url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or url is null or char_length(url) > 1000
     or url !~ '^https://(covers\.openlibrary\.org|books\.google\.com|books\.googleusercontent\.com)/[^\s"''<>]*$' then
    return;
  end if;
  update oeuvres set image_url = url where id = o and image_url is null and univers = 'livres';
end $$;
revoke all on function public.completer_couverture(uuid, text) from public, anon;
grant execute on function public.completer_couverture(uuid, text) to authenticated;

-- 3. Les téléphones de chacun (un « jeton » par téléphone, donné par Expo).
create table if not exists public.jetons_push (
  jeton text primary key check (jeton ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$'),
  profil_id uuid not null references public.profils on delete cascade,
  plateforme text check (plateforme in ('ios', 'android')),
  cree_le timestamptz not null default now()
);
create index if not exists jetons_push_profil on public.jetons_push (profil_id);
alter table public.jetons_push enable row level security;
-- Personne ne lit ni n'écrit directement : tout passe par les deux fonctions ci-dessous.
revoke all on public.jetons_push from public, anon, authenticated;

-- Je range le jeton de mon téléphone (s'il appartenait à un autre compte sur ce téléphone, il passe au mien).
create or replace function public.enregistrer_jeton(j text, p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into jetons_push (jeton, profil_id, plateforme) values (j, auth.uid(), p)
  on conflict (jeton) do update set profil_id = auth.uid(), plateforme = excluded.plateforme, cree_le = now();
end $$;
revoke all on function public.enregistrer_jeton(text, text) from public, anon;
grant execute on function public.enregistrer_jeton(text, text) to authenticated;

-- À la déconnexion : ce téléphone ne reçoit plus mes notifications.
create or replace function public.oublier_jeton(j text) returns void
language sql security definer set search_path = public as $$
  delete from jetons_push where jeton = j and profil_id = auth.uid();
$$;
revoke all on function public.oublier_jeton(text) from public, anon;
grant execute on function public.oublier_jeton(text) to authenticated;

-- 4. L'envoi : à chaque nouvelle notification, un message part vers les téléphones de la personne.
create extension if not exists pg_net;

create or replace function public.envoyer_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  qui text;
  titre text;
  texte text;
  messages jsonb;
begin
  if not exists (select 1 from jetons_push where profil_id = new.destinataire_id) then return new; end if;
  qui := coalesce((select pseudo from profils where id = new.acteur_id), 'Quelqu''un');
  titre := coalesce(
    (select o.titre from oeuvres o where o.id = new.oeuvre_id),
    (select o.titre from activites a join oeuvres o on o.id = a.oeuvre_id where a.id = new.activite_id),
    (select o.titre from penses p join oeuvres o on o.id = p.oeuvre_id where p.id = new.pense_id));
  titre := case when titre is null then 'ton activité' else '« ' || titre || ' »' end;
  texte := case new.type
    when 'culkoko' then qui || ' t''a envoyé un Kulkoko pour ' || titre || ' 👏'
    when 'commentaire' then qui || ' a commenté ' || titre
    when 'commentaire_suite' then qui || ' a aussi commenté ' || titre
    when 'abonne' then qui || ' te suit maintenant'
    when 'demande_abonnement' then qui || ' aimerait te suivre'
    when 'demande_acceptee' then qui || ' a accepté ta demande'
    when 'conseil' then qui || ' a pensé à toi : ' || titre
    when 'merci' then qui || ' te dit merci pour ton conseil ' || titre || ' 🙏'
    when 'boucle' then '🎯 Ton conseil a touché juste : ' || qui || ' a vécu ' || titre
    when 'voyage' then 'Ton conseil ' || titre || ' continue son voyage !'
    when 'invitation_acceptee' then qui || ' a rejoint Kulky grâce à toi !'
    when 'sortie_invitation' then qui || ' te propose une sortie : ' || titre
    when 'sortie_reponse' then case when new.detail = 'partant' then qui || ' est partant·e pour ' || titre || ' !' else qui || ' ne pourra pas venir à ' || titre end
    when 'sortie_veille' then 'Demain : ' || titre
    when 'sortie_jour' then 'C''est aujourd''hui : ' || titre || ' !'
    else 'Du nouveau sur Kulky'
  end;
  select jsonb_agg(jsonb_build_object(
           'to', j.jeton, 'title', 'Kulky', 'body', texte, 'sound', 'default',
           'data', jsonb_build_object('type', new.type, 'activite', new.activite_id, 'sortie', new.sortie_id)))
    into messages
    from jetons_push j where j.profil_id = new.destinataire_id;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
  return new;
exception when others then
  -- Un souci d'envoi ne doit jamais empêcher la notification dans l'appli.
  return new;
end $$;
revoke all on function public.envoyer_push() from public, anon, authenticated;
drop trigger if exists envoyer_push on public.notifications;
create trigger envoyer_push after insert on public.notifications
  for each row execute function public.envoyer_push();
