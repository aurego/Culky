// « Des personnes que tu connais peut-être » : pour trouver ses amis sans connaître leur pseudo.
// Deux pistes, sans rien demander de plus : les amis de mes amis, et les personnes qui ont vécu
// les mêmes œuvres que moi (les croisés).
import type { UniversId } from '../theme';
import type { ProfilPublic } from './fil';
import { supabase } from './supabase';

export type Suggestion = ProfilPublic & { raison: string };

const participes: Record<UniversId, string> = { livres: 'A lu', cine: 'A vu', concerts: 'A vu sur scène', expos: 'A visité' };

export async function suggererAmis(moi: string, max = 8): Promise<Suggestion[]> {
  if (!supabase || !moi) return [];
  const [abos, bloques, miennes] = await Promise.all([
    supabase.from('abonnements').select('suivi_id, statut').eq('abonne_id', moi),
    supabase.from('blocages').select('bloque_id').eq('bloqueur_id', moi),
    supabase.from('activites').select('oeuvre_id').eq('auteur_id', moi).limit(200),
  ]);
  const lignesAbos = (abos.data ?? []) as { suivi_id: string; statut: string }[];
  // Les amis de mes amis partent de mes abonnements acceptés ; mes demandes en attente sont simplement écartées.
  const suivis = new Set(lignesAbos.filter((a) => a.statut === 'accepte').map((a) => a.suivi_id));
  const exclus = new Set([moi, ...lignesAbos.map((a) => a.suivi_id), ...((bloques.data ?? []) as { bloque_id: string }[]).map((b) => b.bloque_id)]);
  const raisons = new Map<string, { score: number; raison: string }>();
  const noter = (id: string, score: number, raison: string) => {
    if (exclus.has(id)) return;
    const r = raisons.get(id);
    if (!r || score > r.score) raisons.set(id, { score: (r?.score ?? 0) + score, raison: r && r.score >= score ? r.raison : raison });
    else r.score += score;
  };

  // 1. Les amis de mes amis.
  if (suivis.size) {
    const { data } = await supabase
      .from('abonnements')
      .select('suivi_id, par:profils!abonnements_abonne_id_fkey(pseudo)')
      .in('abonne_id', [...suivis])
      .eq('statut', 'accepte')
      .limit(300);
    const parQui = new Map<string, string[]>();
    for (const l of (data ?? []) as unknown as { suivi_id: string; par: { pseudo: string } | null }[]) {
      if (!l.par) continue;
      parQui.set(l.suivi_id, [...(parQui.get(l.suivi_id) ?? []), l.par.pseudo]);
    }
    for (const [id, qui] of parQui) {
      const n = qui.length;
      noter(id, 2 * n, n === 1 ? `Suivi·e par ${qui[0]}` : `Suivi·e par ${qui[0]} et ${n - 1} autre${n > 2 ? 's' : ''}`);
    }
  }

  // 2. Les personnes qui ont vécu les mêmes œuvres que moi.
  const oeuvres = [...new Set(((miennes.data ?? []) as { oeuvre_id: string }[]).map((a) => a.oeuvre_id))];
  if (oeuvres.length) {
    const { data } = await supabase
      .from('activites')
      .select('auteur_id, oeuvre:oeuvres(titre, univers)')
      .in('oeuvre_id', oeuvres.slice(0, 100))
      .neq('auteur_id', moi)
      .order('date_activite', { ascending: false })
      .limit(200);
    for (const l of (data ?? []) as unknown as { auteur_id: string; oeuvre: { titre: string; univers: UniversId } | null }[]) {
      if (l.oeuvre) noter(l.auteur_id, 1, `${participes[l.oeuvre.univers]} « ${l.oeuvre.titre} », comme toi`);
    }
  }

  const ids = [...raisons.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, max * 2).map(([id]) => id);
  if (!ids.length) return [];
  const { data: profils } = await supabase.from('profils').select('id, pseudo, photo_url, bio, univers_choisis, inscription_terminee').in('id', ids);
  return ((profils ?? []) as (ProfilPublic & { inscription_terminee?: boolean })[])
    .filter((p) => p.pseudo && p.inscription_terminee !== false)
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    .slice(0, max)
    .map(({ inscription_terminee: _, ...p }) => ({ ...p, raison: raisons.get(p.id)!.raison }));
}
