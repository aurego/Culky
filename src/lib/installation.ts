// « Installe Kulky sur ton écran d'accueil » : sur le web, on le propose une fois, juste après l'inscription.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CLE_A_MONTRER = 'kulky-installer-a-montrer';

// L'appli est-elle déjà ouverte depuis l'écran d'accueil (mode « standalone ») ?
export function estInstallee(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true; // appli native : rien à installer
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone || !!window.matchMedia?.('(display-mode: standalone)').matches;
}

// Le système du téléphone, pour mettre en premier les bonnes étapes.
export function systeme(): 'iphone' | 'android' | 'autre' {
  if (typeof navigator === 'undefined') return 'autre';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'autre';
}

// À la fin de l'inscription : on retient qu'il faudra le proposer (une seule fois).
export async function proposerInstallationPlusTard(): Promise<void> {
  if (estInstallee()) return;
  await AsyncStorage.setItem(CLE_A_MONTRER, '1').catch(() => undefined);
}

// En arrivant dans l'appli : faut-il le proposer maintenant ? (La réponse « oui » n'est donnée qu'une fois.)
export async function installationAProposer(): Promise<boolean> {
  if (estInstallee()) return false;
  const a = await AsyncStorage.getItem(CLE_A_MONTRER).catch(() => null);
  if (!a) return false;
  await AsyncStorage.removeItem(CLE_A_MONTRER).catch(() => undefined);
  return true;
}
