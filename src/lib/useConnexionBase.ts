// Petit test de connexion : l'appli demande à la base si elle répond.
// Sert au voyant affiché dans le bandeau en haut des écrans.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type EtatBase = 'verification' | 'connectee' | 'erreur' | 'non-configuree';
export type ConnexionBase = { etat: EtatBase; detail?: string };

const DELAI_MAX = 10000; // au-delà de 10 secondes sans réponse, on considère la base injoignable

let dernier: ConnexionBase | null = null; // on ne teste qu'une fois par ouverture de l'appli

export function useConnexionBase(): ConnexionBase {
  const [connexion, setConnexion] = useState<ConnexionBase>(
    dernier ?? { etat: supabase ? 'verification' : 'non-configuree' },
  );

  useEffect(() => {
    if (!supabase || dernier) return;
    let fini = false;
    const conclure = (c: ConnexionBase) => {
      if (fini) return;
      fini = true;
      dernier = c;
      if (c.etat === 'erreur') console.warn('Base Culky injoignable :', c.detail);
      setConnexion(c);
    };
    const minuteur = setTimeout(() => conclure({ etat: 'erreur', detail: 'pas de réponse' }), DELAI_MAX);
    supabase
      .from('profils')
      .select('id', { count: 'exact', head: true })
      .then(
        ({ error }) => conclure(error ? { etat: 'erreur', detail: error.message || error.code } : { etat: 'connectee' }),
        (e: unknown) => conclure({ etat: 'erreur', detail: String(e) }),
      )
      .then(() => clearTimeout(minuteur));
    return () => clearTimeout(minuteur);
  }, []);

  return connexion;
}
