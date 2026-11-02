// Petit test de connexion : l'appli demande à la base si elle répond.
// Sert au voyant affiché dans le bandeau en haut des écrans.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type EtatBase = 'verification' | 'connectee' | 'erreur' | 'non-configuree';

let dernierEtat: EtatBase | null = null; // on ne teste qu'une fois par ouverture de l'appli

export function useConnexionBase(): EtatBase {
  const [etat, setEtat] = useState<EtatBase>(dernierEtat ?? (supabase ? 'verification' : 'non-configuree'));

  useEffect(() => {
    if (!supabase || dernierEtat) return;
    supabase
      .from('profils')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        dernierEtat = error ? 'erreur' : 'connectee';
        if (error) console.warn('Base Culky injoignable :', error.message);
        setEtat(dernierEtat);
      });
  }, []);

  return etat;
}
