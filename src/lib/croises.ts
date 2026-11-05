// Les croisés : quand des amis ont vécu la même œuvre (même livre, même film, même artiste, même expo).
// On le signale en douceur : une petite ligne sur la carte d'activité, et une phrase sur l'écran de fête.
import type { UniversId } from '../theme';
import { supabase } from './supabase';

// Les œuvres que j'ai déjà dans mon journal, avec où j'en suis (livre commencé ou fini).
export async function mesOeuvresVecues(moi: string): Promise<Map<string, 'commence' | 'fini'>> {
  const vecues = new Map<string, 'commence' | 'fini'>();
  if (!supabase || !moi) return vecues;
  const { data } = await supabase.from('activites').select('oeuvre_id, etat').eq('auteur_id', moi);
  for (const l of (data ?? []) as { oeuvre_id: string; etat: 'commence' | 'fini' }[]) {
    if (vecues.get(l.oeuvre_id) !== 'fini') vecues.set(l.oeuvre_id, l.etat);
  }
  return vecues;
}

// La petite ligne sous une activité d'ami, quand je l'ai vécue moi aussi.
export function phraseToiAussi(u: UniversId, monEtat: 'commence' | 'fini', spectacle = false): string {
  if (spectacle) return 'Toi aussi, tu l’as vu !';
  if (u === 'livres') return monEtat === 'commence' ? 'Toi aussi, tu le lis !' : 'Toi aussi, tu l’as lu !';
  return { cine: 'Toi aussi, tu l’as vu !', concerts: 'Toi aussi, tu l’as vu en concert !', expos: 'Toi aussi, tu l’as visitée !' }[u];
}

// Les amis (les personnes que je suis) qui ont vécu cette œuvre, pour l'écran de fête.
export async function amisQuiOntVecu(moi: string, oeuvreId: string): Promise<string[]> {
  if (!supabase || !moi) return [];
  const { data: abos } = await supabase.from('abonnements').select('suivi_id').eq('abonne_id', moi).eq('statut', 'accepte');
  const suivis = ((abos ?? []) as { suivi_id: string }[]).map((a) => a.suivi_id);
  if (suivis.length === 0) return [];
  const { data } = await supabase
    .from('activites')
    .select('auteur_id, auteur:profils!activites_auteur_id_fkey(pseudo)')
    .eq('oeuvre_id', oeuvreId)
    .in('auteur_id', suivis)
    .order('date_activite', { ascending: false })
    .limit(30);
  const pseudos = new Map<string, string>();
  for (const l of (data ?? []) as unknown as { auteur_id: string; auteur: { pseudo: string } | null }[]) {
    if (l.auteur && !pseudos.has(l.auteur_id)) pseudos.set(l.auteur_id, l.auteur.pseudo);
  }
  return [...pseudos.values()];
}

// « Hugo l'a lu aussi », « Hugo et Claire l'ont vu aussi », « Hugo, Claire et 2 autres amis l'ont vu aussi ».
export function phraseCroises(u: UniversId, pseudos: string[], spectacle = false): string | null {
  const n = pseudos.length;
  if (n === 0) return null;
  const qui = n === 1 ? pseudos[0] : n === 2 ? `${pseudos[0]} et ${pseudos[1]}` : `${pseudos[0]}, ${pseudos[1]} et ${n - 2} ${n - 2 > 1 ? 'autres amis' : 'autre ami'}`;
  const participe = spectacle ? 'vu' : { livres: 'lu', cine: 'vu', concerts: 'vu en concert', expos: 'visitée' }[u];
  return `${qui} ${n === 1 ? 'l’a' : 'l’ont'} ${participe} aussi`;
}
