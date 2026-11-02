// Les envies (« Ça me tente ») : ce qu'on a envie de lire, voir, écouter, visiter.
import type { UniversId } from '../theme';
import { supabase } from './supabase';

export type Envie = {
  oeuvre_id: string;
  cree_le: string;
  cachee: boolean;
  oeuvre: { id: string; titre: string; createur: string | null; univers: UniversId; image_url: string | null; date_fin: string | null };
  pense: { pseudo: string } | null; // « pensé par Sofia »
};

export type AmiAussi = { oeuvre_id: string; pseudo: string };

export async function mesEnviesIds(moi: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase.from('envies').select('oeuvre_id').eq('profil_id', moi);
  return new Set((data ?? []).map((l) => l.oeuvre_id as string));
}

export async function ajouterEnvie(moi: string, oeuvreId: string, penseePar?: string | null): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('envies').insert({ profil_id: moi, oeuvre_id: oeuvreId, pense_par: penseePar ?? null });
  if (error && error.code !== '23505') throw error; // déjà dans les envies : rien de grave
}

export async function retirerEnvie(moi: string, oeuvreId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('envies').delete().eq('profil_id', moi).eq('oeuvre_id', oeuvreId);
  if (error) throw error;
}

export async function lireEnvies(moi: string): Promise<Envie[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('envies')
    .select('oeuvre_id, cree_le, cachee, oeuvre:oeuvres(id, titre, createur, univers, image_url, date_fin), pense:profils!envies_pense_par_fkey(pseudo)')
    .eq('profil_id', moi)
    .order('cree_le', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Envie[];
}

// Parmi les personnes que je suis, qui a la même envie que moi ?
export async function amisAvecLaMemeEnvie(suivis: string[], oeuvreIds: string[]): Promise<AmiAussi[]> {
  if (!supabase || suivis.length === 0 || oeuvreIds.length === 0) return [];
  const { data } = await supabase
    .from('envies')
    .select('oeuvre_id, profil:profils!envies_profil_id_fkey(pseudo)')
    .in('profil_id', suivis)
    .in('oeuvre_id', oeuvreIds)
    .eq('cachee', false);
  return ((data ?? []) as unknown as { oeuvre_id: string; profil: { pseudo: string } | null }[])
    .filter((l) => l.profil)
    .map((l) => ({ oeuvre_id: l.oeuvre_id, pseudo: l.profil!.pseudo }));
}

// Le petit rappel affiché sur une envie qui a une date (fin d'expo, date de concert).
export function rappel(univers: UniversId, dateFin: string | null): { texte: string; urgent: boolean } | null {
  if (!dateFin) return null;
  const jour = new Date(`${dateFin}T12:00:00`);
  const aujourdHui = new Date();
  aujourdHui.setHours(12, 0, 0, 0);
  const n = Math.round((jour.getTime() - aujourdHui.getTime()) / 86400000);
  const date = jour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  if (univers === 'concerts') {
    if (n < 0) return { texte: 'Le concert est passé', urgent: false };
    if (n === 0) return { texte: 'C’est aujourd’hui !', urgent: true };
    if (n === 1) return { texte: 'C’est demain !', urgent: true };
    return { texte: n <= 14 ? `C’est dans ${n} jours` : `Le ${date}`, urgent: n <= 14 };
  }
  if (n < 0) return { texte: 'C’est terminé', urgent: false };
  if (n === 0) return { texte: 'Dernier jour !', urgent: true };
  if (n === 1) return { texte: 'Ferme demain !', urgent: true };
  return { texte: n <= 14 ? `Ferme dans ${n} jours` : `Jusqu’au ${date}`, urgent: n <= 14 };
}
