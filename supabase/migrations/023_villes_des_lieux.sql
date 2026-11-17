-- 023 · La ville des lieux (cinéma, salle, musée)
-- Avant, chaque lieu recevait « Toulouse » par défaut, même quand personne ne l'avait écrit.
-- Désormais la ville est celle que la personne écrit, ou vide.
-- (On ne garde jamais la position GPS d'une personne : seulement le lieu qu'elle choisit d'écrire.)

alter table public.lieux alter column ville set default '';

-- Les villes remplies automatiquement : on les vide (elles n'avaient pas été choisies).
update public.lieux set ville = '' where ville = 'Toulouse';

-- Retrouver vite un lieu par son nom et sa ville.
create index if not exists lieux_nom_ville on public.lieux (lower(nom), lower(ville));
