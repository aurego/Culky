// Les marque-pages partagés : « Où j'en suis ? », et les mots des amis débloqués à la page.
// La règle d'or (ne rien montrer au-delà de ma page) est appliquée par la base elle-même,
// dans la fonction mots_du_livre : impossible de lire un mot qu'on n'a pas encore dépassé.
import { supabase } from './supabase';

export type MonMarquePage = { id: string; page: number | null; progression: number; mot: string | null; emotion: string | null; cree_le: string };

export type MotAmi = {
  id: string;
  auteur_id: string;
  pseudo: string;
  progression: number;
  page: number | null; // null tant que c'est verrouillé
  mot: string | null;
  emotion: string | null;
  cree_le: string;
  debloque: boolean;
};

export type EtatLecture = {
  nbPages: number | null;
  moi: MonMarquePage | null; // mon marque-page le plus avancé
  mots: MotAmi[];
};

export async function lireEtatLecture(oeuvreId: string, moi: string): Promise<EtatLecture> {
  if (!supabase) return { nbPages: null, moi: null, mots: [] };
  const [o, m, mots] = await Promise.all([
    supabase.from('oeuvres').select('nb_pages').eq('id', oeuvreId).maybeSingle(),
    supabase
      .from('marque_pages')
      .select('id, page, progression, mot, emotion, cree_le')
      .eq('oeuvre_id', oeuvreId)
      .eq('auteur_id', moi)
      .order('progression', { ascending: false })
      .order('cree_le', { ascending: false })
      .limit(1),
    supabase.rpc('mots_du_livre', { o: oeuvreId }),
  ]);
  if (o.error) throw o.error;
  if (m.error) throw m.error;
  if (mots.error) throw mots.error;
  const premier = (m.data ?? [])[0];
  return {
    nbPages: (o.data?.nb_pages as number | null) ?? null,
    moi: premier ? { ...premier, progression: Number(premier.progression) } : null,
    mots: ((mots.data ?? []) as MotAmi[]).map((x) => ({ ...x, progression: Number(x.progression) })),
  };
}

export async function completerNbPages(oeuvreId: string, n: number): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('completer_nb_pages', { o: oeuvreId, n });
}

// Pose un marque-page. La progression (en %) sert à comparer les lecteurs, quelle que soit l'édition.
export async function poserMarquePage(p: {
  activiteId: string;
  oeuvreId: string;
  auteurId: string;
  page: number | null;
  progression: number;
  mot: string;
  emotion: string | null;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('marque_pages').insert({
    activite_id: p.activiteId,
    oeuvre_id: p.oeuvreId,
    auteur_id: p.auteurId,
    page: p.page,
    progression: Math.round(Math.min(100, Math.max(0, p.progression)) * 100) / 100,
    mot: p.mot.trim() || null,
    emotion: p.emotion,
  });
  if (error) throw error;
}

export const progressionDe = (page: number, nbPages: number) => Math.min(100, (page / nbPages) * 100);

// « 3 mots t'attendent plus loin »
export const motsVerrouilles = (mots: MotAmi[]) => mots.filter((m) => !m.debloque);
export const motsDebloques = (mots: MotAmi[]) => mots.filter((m) => m.debloque);

export function libellePosition(m: { page: number | null; progression: number }): string {
  return m.page ? `page ${m.page}` : `${Math.round(m.progression)} %`;
}
