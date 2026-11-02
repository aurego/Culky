-- =====================================================================
-- Culky — complément n° 2 : suivi de l'inscription
-- À coller une seule fois dans Supabase › SQL Editor › New query › Run.
-- Ajoute une case « inscription terminée » au profil : tant qu'elle est vide,
-- l'appli montre les étapes d'inscription (pseudo, univers) au lieu de l'accueil.
-- =====================================================================
alter table profils add column if not exists inscription_terminee boolean not null default false;
