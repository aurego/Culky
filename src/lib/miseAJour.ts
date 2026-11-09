// Les mises à jour de l'appli téléphone, sans passer par l'App Store (EAS Update).
// À l'ouverture de l'appli, et quand on y revient après un moment, on regarde s'il y a du nouveau :
// si oui, on le télécharge et l'appli redémarre aussitôt sur la nouvelle version (une fraction de seconde).
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const DIX_MINUTES = 10 * 60 * 1000;

async function verifier() {
  try {
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
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
