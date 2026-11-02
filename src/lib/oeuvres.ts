// Trouver une œuvre (livre, film, artiste, expo) et la ranger dans notre table « oeuvres ».
// Livres : recherche dans Google Books (gratuit, sans clé).
// Ciné, concerts, expos : saisie du titre pour l'instant (TMDB et les agendas viendront ensuite).
import type { UniversId } from '../theme';
import { supabase } from './supabase';

export type OeuvreTrouvee = {
  id?: string; // déjà dans notre base (venue d'une envie, par exemple)
  date_fin?: string | null; // fin d'expo ou date de concert, pour les rappels
  univers: UniversId;
  titre: string;
  createur: string | null; // auteur, réalisateur, artiste, musée
  image_url: string | null;
  source: 'google_books' | 'tmdb' | 'musicbrainz' | 'manuel';
  source_id: string | null;
  annee?: string | null;
  nb_pages?: number | null; // livres : nombre de pages (Google Books)
};

type VolumeGoogle = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

export async function rechercherLivres(texte: string): Promise<OeuvreTrouvee[]> {
  const q = texte.trim();
  if (q.length < 2) return [];
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books&langRestrict=fr`;
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Google Books : ${reponse.status}`);
  const donnees: { items?: VolumeGoogle[] } = await reponse.json();
  const vus = new Set<string>();
  return (donnees.items ?? [])
    .filter((v) => v.volumeInfo?.title)
    .map((v) => {
      const info = v.volumeInfo!;
      const image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
      return {
        univers: 'livres' as const,
        titre: info.title!,
        createur: info.authors?.join(', ') ?? null,
        image_url: image ? image.replace('http://', 'https://') : null,
        source: 'google_books' as const,
        source_id: v.id,
        annee: info.publishedDate?.slice(0, 4) ?? null,
        nb_pages: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
      };
    })
    // Google renvoie souvent plusieurs éditions du même livre : on n'en garde qu'une.
    .filter((o) => {
      const cle = `${o.titre.toLowerCase()}|${(o.createur ?? '').toLowerCase()}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}

// Renvoie l'identifiant de l'œuvre dans notre base, en la créant si besoin.
export async function enregistrerOeuvre(o: OeuvreTrouvee, auteurId: string): Promise<string> {
  const id = await trouverOuCreerOeuvre(o, auteurId);
  // Le nombre de pages sert aux marque-pages ; sans le complément SQL n° 5, on s'en passe.
  if (o.nb_pages && supabase) await supabase.rpc('completer_nb_pages', { o: id, n: o.nb_pages }).then(() => undefined, () => undefined);
  return id;
}

async function trouverOuCreerOeuvre(o: OeuvreTrouvee, auteurId: string): Promise<string> {
  if (!supabase) throw new Error('Base non configurée');
  if (o.id) return o.id;
  if (o.source !== 'manuel' && o.source_id) {
    const { data: existante } = await supabase
      .from('oeuvres')
      .select('id')
      .eq('source', o.source)
      .eq('source_id', o.source_id)
      .maybeSingle();
    if (existante) return existante.id as string;
  }
  const { data, error } = await supabase
    .from('oeuvres')
    .insert({
      univers: o.univers,
      titre: o.titre.trim(),
      createur: o.createur?.trim() || null,
      image_url: o.image_url,
      source: o.source,
      source_id: o.source_id,
      date_fin: o.date_fin ?? null,
      cree_par: auteurId,
    })
    .select('id')
    .single();
  if (error) {
    // Quelqu'un l'a ajoutée au même moment : on la récupère.
    if (error.code === '23505' && o.source_id) {
      const { data: d } = await supabase.from('oeuvres').select('id').eq('source', o.source).eq('source_id', o.source_id).single();
      if (d) return d.id as string;
    }
    throw error;
  }
  return data.id as string;
}

// Un lieu culturel tapé à la main : on réutilise celui qui porte déjà ce nom, sinon on le crée.
export async function trouverOuCreerLieu(nom: string): Promise<string | null> {
  const propre = nom.trim();
  if (!supabase || !propre) return null;
  const { data: existant } = await supabase.from('lieux').select('id').ilike('nom', propre).limit(1).maybeSingle();
  if (existant) return existant.id as string;
  const { data, error } = await supabase.from('lieux').insert({ nom: propre }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

// Relire une œuvre déjà dans notre base.
export async function lireOeuvre(id: string): Promise<OeuvreTrouvee | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('oeuvres').select('id, univers, titre, createur, image_url, source, source_id, date_fin').eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...(data as OeuvreTrouvee), source: data.source === 'google_books' ? 'google_books' : 'manuel' };
}
