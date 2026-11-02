// L'invitation par lien : « Claire a pensé à toi » fait entrer son ami dans Culky, déjà relié à elle.
// 1. L'ami ouvre /invitation/<code> : on lui montre le conseil, même sans compte.
// 2. On garde le code de côté pendant qu'il crée son compte.
// 3. Dès qu'il arrive dans l'appli, on accepte l'invitation : le conseil arrive dans « Pour toi »
//    et chacun suit l'autre.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { UniversId } from '../theme';
import { supabase } from './supabase';

const CLE = 'culky-invitation';
let enMemoire: string | null = null;

export type Invitation = {
  expediteur_pseudo: string;
  titre: string;
  createur: string | null;
  univers: UniversId;
  image_url: string | null;
  mot: string | null;
  deja_acceptee: boolean;
};

export async function garderCode(code: string): Promise<void> {
  enMemoire = code;
  try {
    await AsyncStorage.setItem(CLE, code);
  } catch {
    // stockage indisponible (navigation privée…) : la mémoire suffit pour cette visite
  }
}

export async function codeEnAttente(): Promise<string | null> {
  if (enMemoire) return enMemoire;
  try {
    return await AsyncStorage.getItem(CLE);
  } catch {
    return null;
  }
}

export async function oublierCode(): Promise<void> {
  enMemoire = null;
  try {
    await AsyncStorage.removeItem(CLE);
  } catch {
    // rien
  }
}

export async function lireInvitation(code: string): Promise<Invitation | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('lire_invitation', { code });
  if (error) throw error;
  return ((data ?? []) as Invitation[])[0] ?? null;
}

// Renvoie true si un conseil vient d'arriver dans « Pour toi ».
export async function accepterInvitation(code: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('accepter_invitation', { code });
  if (error) throw error;
  return !!data;
}

// Un code difficile à deviner (12 caractères).
export function nouveauCode(): string {
  const lettres = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 12; i++) code += lettres[Math.floor(Math.random() * lettres.length)];
  return code;
}

// L'adresse à partager. Sur le web, celle du site ; sur téléphone, celle de la version web publiée.
export function lienInvitation(code: string): string {
  const site = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SITE_URL ?? '';
  return site ? `${site}/invitation/${code}` : '';
}

// Anciens liens « /?invitation=code » : on récupère le code au démarrage (web).
export function codeDansLAdresse(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('invitation');
}

// ——— « Rejoins-moi sur Culky » : l'invitation d'une personne, sans œuvre ———
const CLE_PARRAIN = 'culky-parrain';
let parrainEnMemoire: string | null = null;

export async function garderParrain(id: string): Promise<void> {
  parrainEnMemoire = id;
  try {
    await AsyncStorage.setItem(CLE_PARRAIN, id);
  } catch {
    // la mémoire suffit
  }
}

export async function parrainEnAttente(): Promise<string | null> {
  if (parrainEnMemoire) return parrainEnMemoire;
  try {
    return await AsyncStorage.getItem(CLE_PARRAIN);
  } catch {
    return null;
  }
}

export async function oublierParrain(): Promise<void> {
  parrainEnMemoire = null;
  try {
    await AsyncStorage.removeItem(CLE_PARRAIN);
  } catch {
    // rien
  }
}

// On se suit l'un l'autre (et le parrain est prévenu). Renvoie true si c'est fait.
export async function rejoindre(parrain: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('rejoindre', { parrain });
  if (error) throw error;
  return !!data;
}

export function lienRejoindre(moi: string): string {
  const site = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SITE_URL ?? '';
  return `${site}/rejoindre/${moi}`;
}
