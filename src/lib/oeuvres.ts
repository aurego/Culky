// Trouver une œuvre (livre, film, artiste, expo) et la ranger dans notre table « oeuvres ».
// Livres : Google Books, avec Open Library en secours (gratuits).
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
  source: 'google_books' | 'openlibrary' | 'tmdb' | 'musicbrainz' | 'manuel';
  source_id: string | null;
  annee?: string | null;
  nb_pages?: number | null; // livres : nombre de pages (Google Books)
  genre?: 'concert' | 'spectacle' | null; // univers « Scène » : concert ou spectacle (théâtre, danse, cirque…)
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
    industryIdentifiers?: { type: string; identifier: string }[];
  };
};

// Livres : Google Books d'abord ; s'il ne répond pas (quota dépassé, panne) ou ne trouve rien, Open Library prend le relais.
// Une clé Google Books (EXPO_PUBLIC_GOOGLE_BOOKS_KEY, facultative) évite les refus « trop de demandes ».
const cleGoogle = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

export async function rechercherLivres(texte: string): Promise<OeuvreTrouvee[]> {
  const q = texte.trim();
  if (q.length < 2) return [];
  const google = await rechercherGoogleBooks(q).catch((e) => {
    console.warn('Google Books :', e);
    return [] as OeuvreTrouvee[];
  });
  if (google.length >= 3) return google;
  const openLibrary = await rechercherOpenLibrary(q).catch(() => [] as OeuvreTrouvee[]);
  return sansDoublons([...google, ...openLibrary]).slice(0, 15);
}

// Google renvoie souvent plusieurs éditions du même livre : on n'en garde qu'une.
// Si une édition a une couverture et pas l'autre, on garde celle qui en a une.
function sansDoublons(liste: OeuvreTrouvee[]): OeuvreTrouvee[] {
  const parCle = new Map<string, number>();
  const garde: OeuvreTrouvee[] = [];
  for (const o of liste) {
    const cle = `${o.titre.toLowerCase().trim()}|${(o.createur ?? '').toLowerCase().split(',')[0].trim()}`;
    const deja = parCle.get(cle);
    if (deja === undefined) {
      parCle.set(cle, garde.length);
      garde.push(o);
    } else if (!garde[deja].image_url && o.image_url) {
      garde[deja] = o;
    }
  }
  return garde;
}

// Pas de couverture chez Google ? On la cherche dans Open Library (par ISBN, sinon par titre et auteur).
async function couvertureOpenLibrary(titre: string, auteur: string | null, isbn: string | null): Promise<string | null> {
  const q = isbn ? `isbn=${isbn}` : `title=${encodeURIComponent(titre)}${auteur ? `&author=${encodeURIComponent(auteur.split(',')[0])}` : ''}`;
  const r = await fetch(`https://openlibrary.org/search.json?${q}&limit=3&fields=cover_i`);
  if (!r.ok) return null;
  const d: { docs?: { cover_i?: number }[] } = await r.json();
  const id = d.docs?.find((x) => x.cover_i)?.cover_i;
  return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null;
}

async function completerCouvertures(liste: (OeuvreTrouvee & { isbn?: string | null })[]): Promise<OeuvreTrouvee[]> {
  const sans = liste.filter((o) => !o.image_url).slice(0, 6);
  await Promise.all(
    sans.map(async (o) => {
      const delai = new Promise<null>((ok) => setTimeout(() => ok(null), 2500)); // on n'attend jamais longtemps
      o.image_url = await Promise.race([couvertureOpenLibrary(o.titre, o.createur, o.isbn ?? null).catch(() => null), delai]);
    }),
  );
  return liste.map(({ isbn: _isbn, ...o }) => o);
}

async function rechercherGoogleBooks(q: string): Promise<OeuvreTrouvee[]> {
  // D'abord les éditions en français ; s'il y en a peu (un livre en VO, par exemple), on cherche aussi dans toutes les langues.
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&printType=books${cleGoogle ? `&key=${cleGoogle}` : ''}`;
  const reponse = await fetch(`${base}&langRestrict=fr`);
  if (!reponse.ok) throw new Error(`Google Books : ${reponse.status}`);
  const donnees: { items?: VolumeGoogle[] } = await reponse.json();
  if ((donnees.items?.length ?? 0) < 5) {
    const autres = await fetch(base).then((r) => (r.ok ? r.json() : { items: [] }), () => ({ items: [] }));
    donnees.items = [...(donnees.items ?? []), ...((autres as { items?: VolumeGoogle[] }).items ?? [])];
  }
  const livres = sansDoublons(
    (donnees.items ?? [])
      .filter((v) => v.volumeInfo?.title)
      .map((v) => {
        const info = v.volumeInfo!;
        const image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
        const isbn = info.industryIdentifiers?.find((x) => x.type === 'ISBN_13')?.identifier ?? info.industryIdentifiers?.find((x) => x.type === 'ISBN_10')?.identifier ?? null;
        return {
          isbn,
          univers: 'livres' as const,
          titre: info.title!,
          createur: info.authors?.join(', ') ?? null,
          image_url: image ? image.replace('http://', 'https://') : null,
          source: 'google_books' as const,
          source_id: v.id,
          annee: info.publishedDate?.slice(0, 4) ?? null,
          nb_pages: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
        };
      }),
  ).slice(0, 15);
  return completerCouvertures(livres);
}

type LivreOpenLibrary = { key: string; title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number; number_of_pages_median?: number };

async function rechercherOpenLibrary(q: string): Promise<OeuvreTrouvee[]> {
  const champs = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median';
  const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=${champs}`);
  if (!r.ok) throw new Error(`Open Library : ${r.status}`);
  const d: { docs?: LivreOpenLibrary[] } = await r.json();
  return (d.docs ?? [])
    .filter((l) => l.title)
    .map((l) => ({
      univers: 'livres' as const,
      titre: l.title!,
      createur: l.author_name?.slice(0, 2).join(', ') ?? null,
      image_url: l.cover_i ? `https://covers.openlibrary.org/b/id/${l.cover_i}-M.jpg` : null,
      source: 'openlibrary' as const,
      source_id: l.key,
      annee: l.first_publish_year ? String(l.first_publish_year) : null,
      nb_pages: l.number_of_pages_median ?? null,
    }));
}

// Renvoie l'identifiant de l'œuvre dans notre base, en la créant si besoin.
// (Le nombre de pages se complète APRÈS la publication de l'activité : la base ne l'accepte
// que de quelqu'un qui a une activité sur ce livre. Voir completerNbPages dans marquePages.ts.)
export async function enregistrerOeuvre(o: OeuvreTrouvee, auteurId: string): Promise<string> {
  return trouverOuCreerOeuvre(o, auteurId);
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
    if (existante) {
      // Une fiche déjà dans Kulky sans couverture : on lui donne celle qu'on vient de trouver (la base ne remplace jamais).
      if (o.image_url && o.univers === 'livres') supabase.rpc('completer_couverture', { o: existante.id, url: o.image_url }).then(() => undefined, () => undefined);
      return existante.id as string;
    }
  }
  const ligne: Record<string, unknown> = {
    univers: o.univers,
    titre: o.titre.trim(),
    createur: o.createur?.trim() || null,
    image_url: o.image_url,
    source: o.source,
    source_id: o.source_id,
    date_fin: o.date_fin ?? null,
    cree_par: auteurId,
  };
  let { data, error } = await supabase
    .from('oeuvres')
    .insert(o.genre === 'spectacle' ? { ...ligne, genre: 'spectacle' } : ligne)
    .select('id')
    .single();
  // Sans le complément SQL n° 14, la colonne « genre » n'existe pas encore : on enregistre sans.
  if (error && o.genre === 'spectacle' && /genre/.test(error.message)) ({ data, error } = await supabase.from('oeuvres').insert(ligne).select('id').single());
  if (error) {
    // Quelqu'un l'a ajoutée au même moment : on la récupère.
    if (error.code === '23505' && o.source_id) {
      const { data: d } = await supabase.from('oeuvres').select('id').eq('source', o.source).eq('source_id', o.source_id).single();
      if (d) return d.id as string;
    }
    throw error;
  }
  return data!.id as string;
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

// Les expos et les spectacles : pas de grande base gratuite, alors on cherche parmi ceux déjà enregistrés sur Kulky.
// Plus il y a de monde, plus la liste s'enrichit (et chacun retrouve la même œuvre, ce qui crée les croisés).
export async function rechercherExpos(texte: string): Promise<OeuvreTrouvee[]> {
  return rechercherCommunaute(texte, 'expos');
}
export async function rechercherSpectacles(texte: string): Promise<OeuvreTrouvee[]> {
  return rechercherCommunaute(texte, 'concerts', 'spectacle');
}
async function rechercherCommunaute(texte: string, u: 'expos' | 'concerts', genre?: 'spectacle'): Promise<OeuvreTrouvee[]> {
  if (!supabase) return [];
  const q = texte.trim().replace(/[%,()"\\]/g, ' ');
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('oeuvres')
    .select('*')
    .eq('univers', u)
    .or(`titre.ilike."%${q}%",createur.ilike."%${q}%"`)
    .limit(30);
  if (error) throw error;
  const vues = new Set<string>();
  const resultats: OeuvreTrouvee[] = [];
  for (const o of (data ?? []) as { id: string; titre: string; createur: string | null; image_url: string | null; date_fin: string | null; genre?: string | null; source?: string }[]) {
    if (genre && o.genre !== genre) continue;
    const cle = `${o.titre.trim().toLowerCase()}|${(o.createur ?? '').trim().toLowerCase()}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    resultats.push({ id: o.id, univers: u, titre: o.titre, createur: o.createur, image_url: o.image_url, date_fin: o.date_fin, source: 'manuel', source_id: null, genre: (o.genre as 'spectacle' | null) ?? null });
  }
  return resultats.slice(0, 8);
}
