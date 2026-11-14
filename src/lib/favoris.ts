// Mes chouchous (6 au maximum) et mon plaisir coupable (un seul) : des œuvres choisies pour mon profil,
// sans forcément les enregistrer dans mon journal (complément SQL n° 21).
import type { UniversId } from '../theme';
import { supabase } from './supabase';

export type TypeFavori = 'chouchou' | 'plaisir';
export type Favori = { id: string; oeuvre_id: string; type: TypeFavori; oeuvre: { titre: string; univers: UniversId; image_url: string | null; createur: string | null } };
export const MAX_CHOUCHOUS = 6;

// null : la table n'existe pas encore (complément SQL n° 21 pas passé).
export async function lireFavoris(profilId: string): Promise<Favori[] | null> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('favoris')
    .select('id, oeuvre_id, type, oeuvre:oeuvres(titre, univers, image_url, createur)')
    .eq('profil_id', profilId)
    .order('cree_le', { ascending: true });
  if (error) return null;
  return ((data ?? []) as unknown as Favori[]).filter((f) => f.oeuvre);
}

export async function ajouterFavori(moi: string, oeuvreId: string, type: TypeFavori): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('favoris').insert({ profil_id: moi, oeuvre_id: oeuvreId, type });
  if (error && error.code !== '23505') throw error; // 23505 : déjà dans mes favoris
}

export async function retirerFavori(moi: string, oeuvreId: string, type: TypeFavori): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('favoris').delete().eq('profil_id', moi).eq('oeuvre_id', oeuvreId).eq('type', type);
  if (error) throw error;
}

export function messageFavori(e: unknown): string {
  const m = (e as { message?: string })?.message ?? '';
  return m.includes('Six chouchous') ? `Tu as déjà ${MAX_CHOUCHOUS} chouchous : retires-en un avant d’en ajouter un autre.` : 'Oups, ça n’a pas marché. Réessaie dans un instant.';
}
