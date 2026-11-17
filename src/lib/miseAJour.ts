// Les mises à jour de l'appli téléphone, sans passer par l'App Store (EAS Update).
// À l'ouverture de l'appli, et quand on y revient après un moment, on regarde s'il y a du nouveau :
// si oui, on la télécharge. Si c'est allé très vite (l'appli vient de s'ouvrir, on n'a encore rien touché),
// l'appli redémarre aussitôt sur la nouvelle version. Sinon, on ne coupe jamais quelqu'un en plein geste :
// la nouvelle version s'installera simplement à la prochaine ouverture.
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const DIX_MINUTES = 10 * 60 * 1000;

const DELAI_MAX = 3000; // au-delà, la personne a peut-être commencé à utiliser l'appli

async function verifier() {
  const debut = Date.now();
  try {
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) return;
    const t = await Updates.fetchUpdateAsync();
    if (t.isNew && Date.now() - debut < DELAI_MAX) await Updates.reloadAsync();
  } catch {
    // Pas de réseau, ou souci passager : on réessaiera plus tard.
  }
}

export function useMisesAJour() {
  const quitteA = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return;
    verifier();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'background') quitteA.current = Date.now();
      if (etat === 'active' && quitteA.current && Date.now() - quitteA.current > DIX_MINUTES) verifier();
    });
    return () => abonnement.remove();
  }, []);
}
