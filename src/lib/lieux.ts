// Les lieux culturels (cinéma, salle, musée) : leur nom, leur ville, et un raccourci vers la carte.
// On ne garde jamais la position d'une personne : seulement le lieu qu'elle a choisi d'écrire.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

export type Lieu = { nom: string; ville?: string | null };

const CLE_VILLE = 'kulky-derniere-ville';

// « Grand Rex, Paris » (ou juste « Grand Rex » si la ville n'est pas connue).
export function nomLieu(l: Lieu | null | undefined): string | null {
  if (!l?.nom) return null;
  const ville = l.ville?.trim();
  return ville && ville.toLowerCase() !== l.nom.trim().toLowerCase() ? `${l.nom}, ${ville}` : l.nom;
}

// Ouvre le lieu dans Plans (iPhone) ou Google Maps (Android, ordinateur).
export function ouvrirDansPlans(l: Lieu) {
  const q = encodeURIComponent([l.nom, l.ville].filter(Boolean).join(', '));
  const url = Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  else Linking.openURL(url).catch(() => undefined);
}

// On propose la dernière ville écrite : la plupart du temps, on sort dans la même ville.
export async function lireDerniereVille(): Promise<string> {
  try { return (await AsyncStorage.getItem(CLE_VILLE)) ?? ''; } catch { return ''; }
}
export async function retenirVille(ville: string) {
  try { if (ville.trim()) await AsyncStorage.setItem(CLE_VILLE, ville.trim()); } catch { /* rien */ }
}
