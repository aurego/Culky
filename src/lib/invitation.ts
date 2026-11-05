// L'invitation par lien : « Claire a pensé à toi » fait entrer son ami dans Kulky, déjà relié à elle.
// 1. L'ami ouvre /invitation/<code> : on lui montre le conseil, même sans compte.
// 2. On garde le code de côté pendant qu'il crée son compte.
// 3. Dès qu'il arrive dans l'appli, on accepte l'invitation : le conseil arrive dans « Pour toi »
//    (et, pour un compte tout neuf, chacun suit l'autre).
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

// Un code difficile à deviner (12 caractères), tiré par le générateur sûr du navigateur ou du téléphone.
export function nouveauCode(): string {
  const lettres = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 signes : un octet % 32 reste équitable
  const octets = new Uint8Array(12);
  const c = (globalThis as { crypto?: { getRandomValues?: (t: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(octets);
  else for (let i = 0; i < octets.length; i++) octets[i] = Math.floor(Math.random() * 256); // secours, très rare
  return Array.from(octets, (o) => lettres[o % lettres.length]).join('');
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

// ——— « Rejoins-moi sur Kulky » : l'invitation d'une personne, sans œuvre ———
// Mon lien porte un code secret (64 caractères) : <site>/rejoindre/<code>.
// Les anciens liens portaient l'identifiant du profil : ils ne font plus qu'une demande d'abonnement.
const CLE_PARRAIN = 'culky-parrain';
let parrainEnMemoire: string | null = null;

export const estCodeSecret = (s: string | null | undefined): s is string => !!s && /^[0-9a-f]{64}$/.test(s);
const estIdentifiant = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// On garde le code du lien (ou l'ancien identifiant) pendant la création du compte.
export async function garderParrain(codeOuId: string): Promise<void> {
  parrainEnMemoire = codeOuId;
  try {
    await AsyncStorage.setItem(CLE_PARRAIN, codeOuId);
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

// Ce que montre la page « Rejoins-moi », même sans compte.
export type ProfilDuLien = { id: string; pseudo: string; photo_url: string | null; univers_choisis: UniversId[] };

export async function profilDuLien(codeOuId: string): Promise<ProfilDuLien | null> {
  if (!supabase) return null;
  const { data, error } = estCodeSecret(codeOuId)
    ? await supabase.rpc('profil_public_par_code', { code: codeOuId })
    : estIdentifiant(codeOuId)
      ? await supabase.rpc('profil_public', { profil: codeOuId })
      : { data: [], error: null };
  if (error) throw error;
  const p = ((data ?? []) as ProfilDuLien[])[0];
  return p?.pseudo ? p : null;
}

// Rejoindre avec le code secret :
//   'relies'        c'est fait, on se suit l'un l'autre (compte tout neuf)
//   'deja_relies'   on se suivait déjà
//   'compte_ancien' / 'deja_utilise'  rien n'est fait : on proposera une demande d'abonnement
//   'impossible'    code inconnu, soi-même, ou blocage
export type ResultatRejoindre = 'relies' | 'deja_relies' | 'compte_ancien' | 'deja_utilise' | 'impossible';

export async function rejoindreParCode(code: string): Promise<ResultatRejoindre> {
  if (!supabase || !estCodeSecret(code)) return 'impossible';
  const { data, error } = await supabase.rpc('rejoindre_par_code', { code });
  if (error) throw error;
  return (data as ResultatRejoindre) ?? 'impossible';
}

// Mon lien à partager (créé la première fois).
export async function monLienRejoindre(): Promise<string> {
  if (!supabase) return '';
  const { data, error } = await supabase.rpc('mon_lien_parrainage');
  if (error) throw error;
  return data ? adresseRejoindre(data as string) : '';
}

// Changer de lien : l'ancien ne marche plus (si on l'a trop partagé).
export async function changerMonLien(): Promise<string> {
  if (!supabase) return '';
  const { data, error } = await supabase.rpc('nouveau_lien_parrainage');
  if (error) throw error;
  return data ? adresseRejoindre(data as string) : '';
}

function adresseRejoindre(code: string): string {
  const site = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SITE_URL ?? '';
  return `${site}/rejoindre/${code}`;
}
