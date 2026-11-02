// Les concerts : recherche d'artistes dans MusicBrainz, la grande base musicale libre (gratuite, sans clé).
// MusicBrainz demande d'y aller doucement (une recherche par seconde au plus) : la recherche attend
// que la personne ait fini de taper.
import type { OeuvreTrouvee } from './oeuvres';

type ArtisteMb = { id: string; name: string; type?: string; country?: string; disambiguation?: string; score?: number; area?: { name?: string } };

const types: Record<string, string> = { Group: 'Groupe', Person: 'Artiste', Orchestra: 'Orchestre', Choir: 'Chœur' };

export async function rechercherArtistes(texte: string): Promise<OeuvreTrouvee[]> {
  const q = texte.trim();
  if (q.length < 2) return [];
  const r = await fetch(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(q)}&fmt=json&limit=10`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`MusicBrainz : ${r.status}`);
  const d: { artists?: ArtisteMb[] } = await r.json();
  return (d.artists ?? [])
    .filter((a) => (a.score ?? 100) >= 60)
    .map((a) => ({
      univers: 'concerts' as const,
      titre: a.name,
      createur: a.name,
      image_url: null,
      source: 'musicbrainz' as const,
      source_id: a.id,
      // Pour distinguer les homonymes : « Groupe · Toulouse », « Artiste · rappeur français »…
      annee: [a.type ? types[a.type] ?? null : null, a.disambiguation || a.area?.name || null].filter(Boolean).join(' · ') || null,
    }));
}
