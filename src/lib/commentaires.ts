// Les commentaires sous une activité, avec la case anti-spoiler, et le signalement.
import { supabase } from './supabase';

export type Commentaire = {
  id: string;
  auteur_id: string;
  texte: string;
  spoiler: boolean;
  cree_le: string;
  auteur: { pseudo: string; photo_url: string | null } | null;
  kk?: { profil_id: string }[]; // qui a applaudi ce commentaire (complément SQL n° 19)
};

export async function lireCommentaires(activiteId: string): Promise<Commentaire[]> {
  if (!supabase) return [];
  const base = 'id, auteur_id, texte, spoiler, cree_le, auteur:profils!commentaires_auteur_id_fkey(pseudo, photo_url)';
  const avecKk = await supabase.from('commentaires').select(`${base}, kk:commentaire_kulkoko(profil_id)`).eq('activite_id', activiteId).order('cree_le', { ascending: true });
  if (!avecKk.error) return (avecKk.data ?? []) as unknown as Commentaire[];
  // Sans le complément SQL n° 19, on lit les commentaires sans les Kulkokos.
  const { data, error } = await supabase.from('commentaires').select(base).eq('activite_id', activiteId).order('cree_le', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Commentaire[];
}

// Applaudir (ou ne plus applaudir) un commentaire d'un petit Kulkoko.
export async function basculerKulkokoCommentaire(commentaireId: string, moi: string, envoyer: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = envoyer
    ? await supabase.from('commentaire_kulkoko').insert({ commentaire_id: commentaireId, profil_id: moi })
    : await supabase.from('commentaire_kulkoko').delete().eq('commentaire_id', commentaireId).eq('profil_id', moi);
  if (error && error.code !== '23505') throw error;
}

export async function commenter(activiteId: string, moi: string, texte: string, spoiler: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('commentaires').insert({ activite_id: activiteId, auteur_id: moi, texte: texte.trim(), spoiler });
  if (error) throw error;
}

export async function supprimerCommentaire(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('commentaires').delete().eq('id', id);
  if (error) throw error;
}

// Signaler un contenu ou une personne : l'équipe Kulky le regarde (table « signalements » dans Supabase).
export async function signaler(moi: string, cible: { activite?: string; commentaire?: string; profil?: string }, raison: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('signalements').insert({
    auteur_id: moi,
    activite_id: cible.activite ?? null,
    commentaire_id: cible.commentaire ?? null,
    profil_signale_id: cible.profil ?? null,
    raison,
  });
  if (error) throw error;
}

export const raisonsSignalement = ['Contenu blessant ou haineux', 'Harcèlement', 'Spam ou publicité', 'Contenu inapproprié', 'Autre chose'];
