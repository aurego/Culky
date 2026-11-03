// Qui est connecté ? Ce fichier garde en mémoire la session (le compte connecté)
// et le profil Kulky correspondant (pseudo, univers…), pour tous les écrans.
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { UniversId } from '../theme';
import { supabase } from './supabase';

export type Profil = {
  id: string;
  pseudo: string;
  bio: string | null;
  photo_url: string | null;
  univers_choisis: UniversId[];
  inscription_terminee: boolean;
  visibilite_defaut?: 'public' | 'abonnes' | 'prive'; // complément SQL n° 9
  commentaires_reserves_abonnes?: boolean;
};

type Contexte = {
  pret: boolean; // false tant qu'on ne sait pas encore si quelqu'un est connecté, ou que son profil charge
  session: Session | null;
  profil: Profil | null;
  rechargerProfil: () => Promise<void>;
  seDeconnecter: () => Promise<void>;
};

const SessionContexte = createContext<Contexte>({
  pret: false,
  session: null,
  profil: null,
  rechargerProfil: async () => {},
  seDeconnecter: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [pret, setPret] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [profilEnCours, setProfilEnCours] = useState(false);
  const utilisateurActuel = useRef<string | null>(null);

  const chargerProfil = useCallback(async (s: Session | null) => {
    if (!supabase || !s) {
      setProfil(null);
      setProfilEnCours(false);
      return;
    }
    const { data, error } = await supabase
      .from('profils')
      .select('*') // toutes les colonnes : l'appli marche même si un complément SQL récent n'est pas encore passé
      .eq('id', s.user.id)
      .maybeSingle();
    if (error) console.warn('Profil introuvable :', error.message);
    setProfil((data as Profil | null) ?? null);
    setProfilEnCours(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      utilisateurActuel.current = data.session?.user.id ?? null;
      setSession(data.session);
      await chargerProfil(data.session);
      setPret(true);
    });
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => {
      setSession(nouvelle);
      // On ne recharge le profil que si la personne connectée change
      // (pas à chaque renouvellement automatique de la session).
      const id = nouvelle?.user.id ?? null;
      if (id === utilisateurActuel.current) return;
      utilisateurActuel.current = id;
      if (id) setProfilEnCours(true);
      // On recharge en dehors de l'écouteur, comme le recommande Supabase.
      setTimeout(() => chargerProfil(nouvelle), 0);
    });
    return () => abonnement.subscription.unsubscribe();
  }, [chargerProfil]);

  const rechargerProfil = useCallback(() => chargerProfil(session), [chargerProfil, session]);

  const seDeconnecter = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setProfil(null);
  }, []);

  return (
    <SessionContexte.Provider value={{ pret: pret && !profilEnCours, session, profil, rechargerProfil, seDeconnecter }}>
      {children}
    </SessionContexte.Provider>
  );
}

export const useSession = () => useContext(SessionContexte);

// Les messages d'erreur de Supabase sont en anglais : on les traduit dans le ton de Kulky.
export function traduireErreur(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.';
  if (m.includes('password should be at least')) return 'Ton mot de passe doit faire au moins 6 caractères.';
  if (m.includes('email not confirmed')) return 'Confirme d’abord ton adresse grâce à l’e-mail reçu.';
  if (m.includes('unable to validate email') || m.includes('invalid format') || m.includes('is invalid'))
    return 'Cette adresse e-mail ne semble pas valide.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop d’essais d’un coup. Patiente une minute et réessaie.';
  if (m.includes('network') || m.includes('fetch')) return 'Pas de connexion. Vérifie ton réseau et réessaie.';
  if (m.includes('database error saving new user')) return 'La création de ton profil a coincé. Réessaie dans un instant.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Les inscriptions sont fermées pour l’instant.';
  console.warn('Erreur :', message); // le détail technique reste pour nous, pas pour l'écran
  return 'Oups, quelque chose a coincé. Réessaie dans un instant.';
}
