// Enregistrer une activité, et relire son journal et ses compteurs de l'année.
import type { UniversId } from '../theme';
import { universIds } from '../theme';
import { supabase } from './supabase';

export type Visibilite = 'public' | 'abonnes' | 'prive';

export type NouvelleActivite = {
  auteurId: string;
  oeuvreId: string;
  lieuId: string | null;
  etat: 'commence' | 'fini';
  auCinema: boolean | null;
  emotions: string[];
  mots: string;
  visibilite: Visibilite;
  dateActivite?: string; // aaaa-mm-jj : pour ajouter une lecture ou une sortie passée
  photoUrl?: string | null; // ma photo souvenir (concert, expo)
};

export async function publierActivite(a: NouvelleActivite): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  const { data, error } = await supabase
    .from('activites')
    .insert({
      auteur_id: a.auteurId,
      oeuvre_id: a.oeuvreId,
      lieu_id: a.lieuId,
      etat: a.etat,
      au_cinema: a.auCinema,
      emotions: a.emotions,
      mots: a.mots.trim() || null,
      visibilite: a.visibilite,
      ...(a.dateActivite ? { date_activite: a.dateActivite } : {}),
      ...(a.photoUrl ? { photo_url: a.photoUrl } : {}),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export type EntreeJournal = {
  id: string;
  oeuvre_id: string;
  date_activite: string;
  etat: 'commence' | 'fini';
  emotions: string[];
  mots: string | null;
  au_cinema: boolean | null;
  visibilite: Visibilite;
  oeuvre: { titre: string; createur: string | null; univers: UniversId; image_url: string | null };
  lieu: { nom: string } | null;
};

// Le journal de la personne connectée, du plus récent au plus ancien.
export async function lireJournal(auteurId: string, limite = 30): Promise<EntreeJournal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('activites')
    .select('id, oeuvre_id, date_activite, etat, emotions, mots, au_cinema, visibilite, oeuvre:oeuvres(titre, createur, univers, image_url), lieu:lieux(nom)')
    .eq('auteur_id', auteurId)
    .order('date_activite', { ascending: false })
    .order('cree_le', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as unknown as EntreeJournal[];
}

// Changer qui voit une activité déjà publiée (« moi seul·e » la masque à tout le monde).
export async function changerVisibilite(id: string, visibilite: Visibilite): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('activites').update({ visibilite }).eq('id', id);
  if (error) throw error;
}

export async function supprimerActivite(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('activites').delete().eq('id', id);
  if (error) throw error;
}

// Combien d'activités terminées cette année, par univers.
// Un livre ne compte que lorsqu'il est fini.
export async function compterAnnee(auteurId: string, annee = new Date().getFullYear()): Promise<Record<UniversId, number>> {
  const zero = { livres: 0, cine: 0, concerts: 0, expos: 0 } as Record<UniversId, number>;
  if (!supabase) return zero;
  const { data, error } = await supabase
    .from('activites')
    .select('oeuvre:oeuvres(univers)')
    .eq('auteur_id', auteurId)
    .eq('etat', 'fini')
    .gte('date_activite', `${annee}-01-01`)
    .lte('date_activite', `${annee}-12-31`);
  if (error) throw error;
  for (const ligne of (data ?? []) as unknown as { oeuvre: { univers: UniversId } | null }[]) {
    const u = ligne.oeuvre?.univers;
    if (u && universIds.includes(u)) zero[u] += 1;
  }
  return zero;
}

// Les mots de la célébration, accordés selon l'univers : « ton 12e livre », « ta 1re expo ».
const noms: Record<UniversId, { nom: string; pluriel: string; feminin: boolean }> = {
  livres: { nom: 'livre', pluriel: 'livres', feminin: false },
  cine: { nom: 'film', pluriel: 'films', feminin: false },
  concerts: { nom: 'concert', pluriel: 'concerts', feminin: false },
  expos: { nom: 'expo', pluriel: 'expos', feminin: true },
};

export function rangDeLAnnee(univers: UniversId, n: number): string {
  const { nom, feminin } = noms[univers];
  const rang = n === 1 ? (feminin ? '1re' : '1er') : `${n}e`;
  return `${feminin ? 'ta' : 'ton'} ${rang} ${nom} de l’année`;
}

export function nomPluriel(univers: UniversId, n: number): string {
  return n > 1 ? noms[univers].pluriel : noms[univers].nom;
}

// Les stats de l'année, en un coup d'œil : l'activité mois par mois (par univers), le mois le plus riche,
// le lieu où l'on revient le plus, et le créateur qu'on a le plus suivi.
export type StatsAnnee = {
  mois: Record<UniversId, number>[]; // 12 mois
  moisFort: string | null;
  lieuFavori: { nom: string; fois: number } | null;
  createurFavori: { nom: string; fois: number; univers: UniversId } | null; // compté en œuvres différentes (concerts : en fois)
};
const nomsDesMois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export async function lireStatsAnnee(auteurId: string, annee = new Date().getFullYear()): Promise<StatsAnnee> {
  const mois = Array.from({ length: 12 }, () => ({ livres: 0, cine: 0, concerts: 0, expos: 0 }) as Record<UniversId, number>);
  const vide: StatsAnnee = { mois, moisFort: null, lieuFavori: null, createurFavori: null };
  if (!supabase) return vide;
  const { data, error } = await supabase
    .from('activites')
    .select('date_activite, oeuvre_id, oeuvre:oeuvres(univers, createur), lieu:lieux(nom)')
    .eq('auteur_id', auteurId)
    .eq('etat', 'fini')
    .gte('date_activite', `${annee}-01-01`)
    .lte('date_activite', `${annee}-12-31`);
  if (error) return vide;
  const lieux = new Map<string, number>();
  const createurs = new Map<string, { oeuvres: Set<string>; fois: number; univers: UniversId }>();
  for (const l of (data ?? []) as unknown as { date_activite: string; oeuvre_id: string; oeuvre: { univers: UniversId; createur: string | null } | null; lieu: { nom: string } | null }[]) {
    const u = l.oeuvre?.univers;
    const m = Number(l.date_activite.slice(5, 7)) - 1;
    if (u && universIds.includes(u) && m >= 0 && m < 12) mois[m][u] += 1;
    if (l.lieu?.nom) lieux.set(l.lieu.nom, (lieux.get(l.lieu.nom) ?? 0) + 1);
    if (l.oeuvre?.createur && u) {
      const c = createurs.get(l.oeuvre.createur) ?? { oeuvres: new Set<string>(), fois: 0, univers: u };
      c.oeuvres.add(l.oeuvre_id);
      c.fois += 1;
      createurs.set(l.oeuvre.createur, c);
    }
  }
  const totaux = mois.map((x) => universIds.reduce((s, u) => s + x[u], 0));
  const max = Math.max(...totaux);
  const meilleur = (m: Map<string, number>) => {
    const [nom, fois] = [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return nom && fois >= 2 ? { nom, fois } : null; // une seule fois, ce n'est pas encore un favori
  };
  // Pour un artiste en concert, on compte les fois ; sinon les œuvres différentes (revoir le même film ne compte qu'une fois).
  const scores = new Map([...createurs.entries()].map(([nom, c]) => [nom, c.univers === 'concerts' ? c.fois : c.oeuvres.size]));
  const top = meilleur(scores);
  return { mois, moisFort: max >= 2 ? nomsDesMois[totaux.indexOf(max)] : null, lieuFavori: meilleur(lieux), createurFavori: top ? { ...top, univers: createurs.get(top.nom)!.univers } : null };
}
