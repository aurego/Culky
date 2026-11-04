// Les films : recherche dans TMDB (The Movie Database), en français, avec les affiches.
// La clé d'accès (« API Read Access Token ») est rangée dans Vercel, jamais dans le code :
// EXPO_PUBLIC_TMDB_TOKEN. Sans elle, on saisit le film à la main, comme avant.
import type { OeuvreTrouvee } from './oeuvres';

const jeton = process.env.EXPO_PUBLIC_TMDB_TOKEN;
export const rechercheFilmsPossible = !!jeton;

const api = 'https://api.themoviedb.org/3';
const affiche = (chemin: string | null | undefined) => (chemin ? `https://image.tmdb.org/t/p/w342${chemin}` : null);

// Le long « API Read Access Token » (eyJ…) passe dans l'en-tête ; la courte « API Key » marche aussi, dans l'adresse.
const jetonLong = (jeton ?? '').trim().length > 40;

async function appeler<T>(chemin: string): Promise<T> {
  const cle = (jeton ?? '').trim();
  const adresse = `${api}${chemin}${jetonLong ? '' : `${chemin.includes('?') ? '&' : '?'}api_key=${cle}`}`;
  const r = await fetch(adresse, { headers: jetonLong ? { Authorization: `Bearer ${cle}`, Accept: 'application/json' } : { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`TMDB : ${r.status}`);
  return r.json() as Promise<T>;
}

type FilmTmdb = { id: number; title: string; original_title?: string; release_date?: string; poster_path?: string | null; popularity?: number };

export async function rechercherFilms(texte: string): Promise<OeuvreTrouvee[]> {
  const q = texte.trim();
  if (q.length < 2 || !jeton) return [];
  const d = await appeler<{ results?: FilmTmdb[] }>(`/search/movie?query=${encodeURIComponent(q)}&language=fr-FR&region=FR&include_adult=false&page=1`);
  return (d.results ?? [])
    .slice(0, 12)
    .map((f) => ({
      univers: 'cine' as const,
      titre: f.title,
      createur: null,
      image_url: affiche(f.poster_path),
      source: 'tmdb' as const,
      source_id: String(f.id),
      annee: f.release_date?.slice(0, 4) || null,
    }));
}

// Le réalisateur ou la réalisatrice, ajouté une fois le film choisi.
export async function completerFilm(o: OeuvreTrouvee): Promise<OeuvreTrouvee> {
  if (!jeton || o.source !== 'tmdb' || !o.source_id || o.createur) return o;
  try {
    const c = await appeler<{ crew?: { job: string; name: string }[] }>(`/movie/${o.source_id}/credits?language=fr-FR`);
    const noms = (c.crew ?? []).filter((x) => x.job === 'Director').map((x) => x.name);
    return noms.length ? { ...o, createur: noms.slice(0, 2).join(', ') } : o;
  } catch {
    return o;
  }
}
