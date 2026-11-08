// Les notifications sur le téléphone (appli iPhone et Android) : la base les envoie toute seule
// (complément SQL n° 18) vers les téléphones dont elle connaît le « jeton ».
// Sur le web, tout ici ne fait rien.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const natif = Platform.OS === 'ios' || Platform.OS === 'android';
const CLE_JETON = 'kulky-jeton-push';

if (natif) {
  // Appli ouverte : la notification s'affiche quand même, en bandeau.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export type EtatPush = 'indisponible' | 'accorde' | 'refuse' | 'a-demander';

export async function etatPush(): Promise<EtatPush> {
  if (!natif || !Device.isDevice) return 'indisponible';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'accorde';
  return canAskAgain ? 'a-demander' : 'refuse';
}

async function enregistrerCeTelephone(): Promise<void> {
  if (!supabase) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: jeton } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  if (!jeton) return;
  await supabase.rpc('enregistrer_jeton', { j: jeton, p: Platform.OS });
  await AsyncStorage.setItem(CLE_JETON, jeton).catch(() => undefined);
}

// Le bouton « Activer » : la fenêtre du téléphone s'ouvre, puis on range le jeton.
export async function activerPush(): Promise<boolean> {
  if (!natif || !Device.isDevice) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  await enregistrerCeTelephone().catch(() => undefined);
  return true;
}

// À la déconnexion : ce téléphone ne reçoit plus les notifications de ce compte.
export async function oublierCeTelephone(): Promise<void> {
  if (!natif || !supabase) return;
  const jeton = await AsyncStorage.getItem(CLE_JETON).catch(() => null);
  if (jeton) await supabase.rpc('oublier_jeton', { j: jeton }).then(() => undefined, () => undefined);
  await AsyncStorage.removeItem(CLE_JETON).catch(() => undefined);
}

// Où mène une notification touchée.
function ouvrir(donnees: Record<string, unknown> | undefined) {
  const activite = typeof donnees?.activite === 'string' ? donnees.activite : null;
  const sortie = typeof donnees?.sortie === 'string' ? donnees.sortie : null;
  if (activite) router.push({ pathname: '/activite/[id]', params: { id: activite } });
  else if (sortie || donnees?.type) router.push('/notifications');
}

// Une fois connecté·e : on garde le jeton à jour (il peut changer), et on ouvre le bon écran quand on touche une notification.
export function useNotificationsTelephone(moi: string | undefined) {
  useEffect(() => {
    if (!natif || !moi) return;
    etatPush()
      .then((e) => (e === 'accorde' ? enregistrerCeTelephone() : undefined))
      .catch(() => undefined);
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) ouvrir(r.notification.request.content.data as Record<string, unknown>);
      })
      .catch(() => undefined);
    const abonnement = Notifications.addNotificationResponseReceivedListener((r) => ouvrir(r.notification.request.content.data as Record<string, unknown>));
    return () => abonnement.remove();
  }, [moi]);
}
