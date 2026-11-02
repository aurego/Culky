// Les sorties entre amis : « On y va ensemble ? », avec une date, des invités et leurs réponses.
import type { UniversId } from '../theme';
import { supabase } from './supabase';

export type Reponse = 'invite' | 'partant' | 'pas_cette_fois';

export type Sortie = {
  id: string;
  organisateur_id: string;
  date_prevue: string;
  heure: string | null;
  lieu: string | null;
  mot: string | null;
  oeuvre: { id: string; titre: string; createur: string | null; univers: UniversId; image_url: string | null };
  organisateur: { pseudo: string };
  participants: { profil_id: string; reponse: Reponse; profil: { pseudo: string } | null }[];
};

export async function creerSortie(
  moi: string,
  s: { oeuvreId: string; date: string; heure: string; lieu: string; mot: string; invites: string[] },
): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const { data, error } = await supabase
    .from('sorties')
    .insert({
      organisateur_id: moi,
      oeuvre_id: s.oeuvreId,
      date_prevue: s.date,
      heure: s.heure.trim() || null,
      lieu: s.lieu.trim() || null,
      mot: s.mot.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (s.invites.length) {
    const { error: e2 } = await supabase.from('sortie_participants').insert(s.invites.map((p) => ({ sortie_id: data.id, profil_id: p })));
    if (e2) throw e2;
  }
  return data.id as string;
}

// Toutes les sorties dont je fais partie (les règles de la base cachent les autres).
export async function lireSorties(): Promise<Sortie[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sorties')
    .select(
      'id, organisateur_id, date_prevue, heure, lieu, mot, oeuvre:oeuvres(id, titre, createur, univers, image_url), organisateur:profils!sorties_organisateur_id_fkey(pseudo), participants:sortie_participants(profil_id, reponse, profil:profils!sortie_participants_profil_id_fkey(pseudo))',
    )
    .order('date_prevue', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Sortie[];
}

export async function repondre(sortieId: string, moi: string, reponse: Reponse): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('sortie_participants')
    .update({ reponse, repondu_le: new Date().toISOString() })
    .eq('sortie_id', sortieId)
    .eq('profil_id', moi);
  if (error) throw error;
}

export async function annulerSortie(sortieId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('sorties').delete().eq('id', sortieId);
  if (error) throw error;
}
