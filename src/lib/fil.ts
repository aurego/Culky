// Le fil (abonnements et Découvrir), les Kulkoko, et les abonnements entre personnes.
import type { UniversId } from '../theme';
import { mesOeuvresVecues } from './croises';
import { mesEnviesIds } from './envies';
import { supabase } from './supabase';

export type ActiviteFil = {
  id: string;
  auteur_id: string;
  oeuvre_id: string;
  date_activite: string;
  cree_le: string;
  etat: 'commence' | 'fini';
  emotions: string[];
  mots: string | null;
  au_cinema: boolean | null;
  photo_url?: string | null; // ma photo souvenir (complément SQL n° 13)
  oeuvre: { titre: string; createur: string | null; univers: UniversId; image_url: string | null };
  lieu: { nom: string } | null;
  auteur: { pseudo: string; photo_url: string | null };
  culkoko: number; // combien de Kulkoko reçus
  monCulkoko: boolean; // ai-je envoyé le mien ?
  monEnvie: boolean; // l'œuvre est-elle déjà dans mes envies ?
  nbCommentaires: number;
  monEtat?: 'commence' | 'fini'; // si j'ai vécu cette œuvre moi aussi (les croisés)
};

const colonnes =
  '*, oeuvre:oeuvres(titre, createur, univers, image_url), lieu:lieux(nom), auteur:profils!activites_auteur_id_fkey(pseudo, photo_url), nb:commentaires(count)';

// Les personnes que je suis.
export async function mesAbonnements(moi: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('abonnements').select('suivi_id').eq('abonne_id', moi);
  if (error) throw error;
  return (data ?? []).map((l) => l.suivi_id as string);
}

// mode « abonnements » : moi + les personnes que je suis ; mode « decouvrir » : toutes les activités publiques.
// Les règles de la base (RLS) cachent d'office ce que je n'ai pas le droit de voir.
export async function lireFil(mode: 'abonnements' | 'decouvrir', moi: string, auteurUnique?: string): Promise<ActiviteFil[]> {
  if (!supabase) return [];
  let requete = supabase.from('activites').select(colonnes).order('date_activite', { ascending: false }).order('cree_le', { ascending: false }).limit(40);
  if (auteurUnique) requete = requete.eq('auteur_id', auteurUnique);
  else if (mode === 'abonnements') requete = requete.in('auteur_id', [moi, ...(await mesAbonnements(moi))]);
  else requete = requete.eq('visibilite', 'public');
  const { data, error } = await requete;
  if (error) throw error;
  const [envies, vecues] = await Promise.all([mesEnviesIds(moi), mesOeuvresVecues(moi).catch(() => new Map())]);
  const activites = ((data ?? []) as unknown as (Omit<ActiviteFil, 'culkoko' | 'monCulkoko' | 'monEnvie' | 'nbCommentaires'> & { nb?: { count: number }[] })[]).map(({ nb, ...a }) => ({
    ...a,
    monEnvie: envies.has(a.oeuvre_id),
    nbCommentaires: nb?.[0]?.count ?? 0,
    monEtat: a.auteur_id !== moi ? vecues.get(a.oeuvre_id) : undefined,
  }));
  return ajouterCulkoko(activites, moi);
}

async function ajouterCulkoko(activites: Omit<ActiviteFil, 'culkoko' | 'monCulkoko'>[], moi: string): Promise<ActiviteFil[]> {
  if (!supabase || activites.length === 0) return activites.map((a) => ({ ...a, culkoko: 0, monCulkoko: false }));
  const { data } = await supabase
    .from('culkoko')
    .select('activite_id, profil_id')
    .in('activite_id', activites.map((a) => a.id));
  const lignes = (data ?? []) as { activite_id: string; profil_id: string }[];
  return activites.map((a) => {
    const miens = lignes.filter((l) => l.activite_id === a.id);
    return { ...a, culkoko: miens.length, monCulkoko: miens.some((l) => l.profil_id === moi) };
  });
}

// Une seule activité (pour l'écran des commentaires).
export async function lireActivite(id: string, moi: string): Promise<ActiviteFil | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('activites').select(colonnes).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { nb, ...a } = data as unknown as Omit<ActiviteFil, 'culkoko' | 'monCulkoko' | 'monEnvie' | 'nbCommentaires'> & { nb?: { count: number }[] };
  const [envies, vecues] = await Promise.all([mesEnviesIds(moi), mesOeuvresVecues(moi).catch(() => new Map())]);
  const monEtat = a.auteur_id !== moi ? vecues.get(a.oeuvre_id) : undefined;
  const [complete] = await ajouterCulkoko([{ ...a, monEnvie: envies.has(a.oeuvre_id), nbCommentaires: nb?.[0]?.count ?? 0, monEtat }], moi);
  return complete;
}

// Envoyer (ou retirer) son Kulkoko.
export async function basculerCulkoko(activiteId: string, moi: string, envoyer: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = envoyer
    ? await supabase.from('culkoko').insert({ activite_id: activiteId, profil_id: moi })
    : await supabase.from('culkoko').delete().eq('activite_id', activiteId).eq('profil_id', moi);
  if (error && error.code !== '23505') throw error; // 23505 = déjà envoyé : rien de grave
}

// ——— Les personnes ———
export type ProfilPublic = { id: string; pseudo: string; photo_url: string | null; bio: string | null; univers_choisis: UniversId[] };

export async function lireProfil(id: string): Promise<ProfilPublic | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('profils').select('id, pseudo, photo_url, bio, univers_choisis').eq('id', id).maybeSingle();
  const p = data as ProfilPublic | null;
  return p?.pseudo ? p : null; // un profil sans pseudo (lien abîmé) = pas de profil
}

export async function chercherProfils(texte: string, moi: string): Promise<ProfilPublic[]> {
  const q = texte.trim().replace(/[%_,()]/g, '');
  if (!supabase || q.length < 2) return [];
  const { data, error } = await supabase
    .from('profils')
    .select('id, pseudo, photo_url, bio, univers_choisis')
    .ilike('pseudo', `%${q}%`)
    .eq('inscription_terminee', true)
    .neq('id', moi)
    .limit(15);
  if (error) throw error;
  // Ceux dont le pseudo commence par ce qu'on a tapé d'abord, puis les autres.
  const debut = q.toLowerCase();
  return ((data ?? []) as ProfilPublic[]).sort((a, b) => Number(!a.pseudo.toLowerCase().startsWith(debut)) - Number(!b.pseudo.toLowerCase().startsWith(debut)));
}

export async function compterAbonnes(id: string): Promise<{ abonnes: number; abonnements: number }> {
  if (!supabase) return { abonnes: 0, abonnements: 0 };
  const [a, b] = await Promise.all([
    supabase.from('abonnements').select('abonne_id', { count: 'exact', head: true }).eq('suivi_id', id),
    supabase.from('abonnements').select('suivi_id', { count: 'exact', head: true }).eq('abonne_id', id),
  ]);
  return { abonnes: a.count ?? 0, abonnements: b.count ?? 0 };
}

export async function jeSuis(moi: string, autre: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from('abonnements').select('suivi_id').eq('abonne_id', moi).eq('suivi_id', autre).maybeSingle();
  return !!data;
}

export async function suivre(moi: string, autre: string, oui: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = oui
    ? await supabase.from('abonnements').insert({ abonne_id: moi, suivi_id: autre })
    : await supabase.from('abonnements').delete().eq('abonne_id', moi).eq('suivi_id', autre);
  if (error && error.code !== '23505') throw error;
}

// Mes amis : les personnes que je suis, celles qui me suivent, et qui est réciproque.
export type Ami = ProfilPublic & { jeLeSuis: boolean; ilMeSuit: boolean };

export async function listerAmis(id: string, moi: string): Promise<Ami[]> {
  if (!supabase) return [];
  const colonnesProfil = 'id, pseudo, photo_url, bio, univers_choisis';
  const [suivis, abonnes, miens] = await Promise.all([
    supabase.from('abonnements').select(`p:profils!abonnements_suivi_id_fkey(${colonnesProfil})`).eq('abonne_id', id),
    supabase.from('abonnements').select(`p:profils!abonnements_abonne_id_fkey(${colonnesProfil})`).eq('suivi_id', id),
    id === moi ? Promise.resolve({ data: null }) : supabase.from('abonnements').select('suivi_id').eq('abonne_id', moi),
  ]);
  const jeSuisIds = new Set(
    id === moi ? ((suivis.data ?? []) as unknown as { p: ProfilPublic }[]).map((l) => l.p?.id) : ((miens.data ?? []) as { suivi_id: string }[]).map((l) => l.suivi_id),
  );
  const tous = new Map<string, Ami>();
  for (const l of (suivis.data ?? []) as unknown as { p: ProfilPublic | null }[]) if (l.p) tous.set(l.p.id, { ...l.p, jeLeSuis: jeSuisIds.has(l.p.id), ilMeSuit: false });
  for (const l of (abonnes.data ?? []) as unknown as { p: ProfilPublic | null }[]) {
    if (!l.p) continue;
    const deja = tous.get(l.p.id);
    tous.set(l.p.id, { ...(deja ?? { ...l.p, jeLeSuis: jeSuisIds.has(l.p.id) }), ilMeSuit: true });
  }
  return [...tous.values()].filter((a) => a.id !== moi || id !== moi).sort((x, y) => x.pseudo.localeCompare(y.pseudo));
}
