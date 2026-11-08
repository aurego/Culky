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
  oeuvre: { titre: string; createur: string | null; univers: UniversId; image_url: string | null; genre?: string | null };
  lieu: { nom: string } | null;
  auteur: { pseudo: string; photo_url: string | null };
  culkoko: number; // combien de Kulkoko reçus
  monCulkoko: boolean; // ai-je envoyé le mien ?
  applaudisseurs?: Applaudisseur[]; // qui a envoyé un Kulkoko (le plus récent d'abord)
  monEnvie: boolean; // l'œuvre est-elle déjà dans mes envies ?
  nbCommentaires: number;
  monEtat?: 'commence' | 'fini'; // si j'ai vécu cette œuvre moi aussi (les croisés)
};

const colonnes =
  '*, oeuvre:oeuvres(*), lieu:lieux(nom), auteur:profils!activites_auteur_id_fkey(pseudo, photo_url), nb:commentaires(count)';

// Les personnes que je suis (demande acceptée).
export async function mesAbonnements(moi: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('abonnements').select('suivi_id').eq('abonne_id', moi).eq('statut', 'accepte');
  if (error) throw error;
  return (data ?? []).map((l) => l.suivi_id as string);
}

// mode « abonnements » : moi + les personnes que je suis ; mode « decouvrir » : toutes les activités publiques.
// Les règles de la base (RLS) cachent d'office ce que je n'ai pas le droit de voir.
// « debut » et « nombre » : pour charger la suite du fil quand on arrive en bas.
export const TAILLE_PAGE_FIL = 30;
export async function lireFil(mode: 'abonnements' | 'decouvrir', moi: string, auteurUnique?: string, debut = 0, nombre = 40): Promise<ActiviteFil[]> {
  if (!supabase) return [];
  let requete = supabase
    .from('activites')
    .select(colonnes)
    .order('date_activite', { ascending: false })
    .order('cree_le', { ascending: false })
    .order('id', { ascending: false })
    .range(debut, debut + nombre - 1);
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
    .select('activite_id, profil_id, profil:profils(id, pseudo, photo_url)')
    .in('activite_id', activites.map((a) => a.id))
    .order('cree_le', { ascending: false });
  const lignes = (data ?? []) as unknown as { activite_id: string; profil_id: string; profil: Applaudisseur | null }[];
  return activites.map((a) => {
    const miens = lignes.filter((l) => l.activite_id === a.id);
    return {
      ...a,
      culkoko: miens.length,
      monCulkoko: miens.some((l) => l.profil_id === moi),
      applaudisseurs: miens.map((l) => l.profil).filter((p): p is Applaudisseur => !!p),
    };
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

// Qui a envoyé un Kulkoko à cette activité (le plus récent d'abord).
export type Applaudisseur = { id: string; pseudo: string; photo_url: string | null };
export async function lireKulkokos(activiteId: string): Promise<Applaudisseur[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('culkoko')
    .select('profil:profils(id, pseudo, photo_url)')
    .eq('activite_id', activiteId)
    .order('cree_le', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { profil: Applaudisseur | null }[]).map((l) => l.profil).filter((p): p is Applaudisseur => !!p);
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

// Les abonnements se demandent : la personne suivie accepte (ou refuse).
// « aucun » : je ne la suis pas ; « en_attente » : ma demande attend sa réponse ; « accepte » : je la suis.
export type EtatSuivi = 'aucun' | 'en_attente' | 'accepte';

export async function compterAbonnes(id: string): Promise<{ abonnes: number; abonnements: number }> {
  if (!supabase) return { abonnes: 0, abonnements: 0 };
  const [a, b] = await Promise.all([
    supabase.from('abonnements').select('abonne_id', { count: 'exact', head: true }).eq('suivi_id', id).eq('statut', 'accepte'),
    supabase.from('abonnements').select('suivi_id', { count: 'exact', head: true }).eq('abonne_id', id).eq('statut', 'accepte'),
  ]);
  return { abonnes: a.count ?? 0, abonnements: b.count ?? 0 };
}

export async function etatSuivi(moi: string, autre: string): Promise<EtatSuivi> {
  if (!supabase) return 'aucun';
  const { data, error } = await supabase.from('abonnements').select('statut').eq('abonne_id', moi).eq('suivi_id', autre).maybeSingle();
  if (error) throw error;
  return ((data as { statut?: EtatSuivi } | null)?.statut as EtatSuivi) ?? 'aucun';
}

export async function jeSuis(moi: string, autre: string): Promise<boolean> {
  return (await etatSuivi(moi, autre).catch(() => 'aucun')) === 'accepte';
}

// Suivre quelqu'un, ou annuler ma demande / ne plus suivre. C'est la base qui décide du résultat :
// abonnement direct si son compte est public, demande à accepter s'il est privé (complément SQL n° 17).
export async function suivre(moi: string, autre: string, oui: boolean): Promise<EtatSuivi> {
  if (!supabase) return 'aucun';
  if (!oui) {
    const { error } = await supabase.from('abonnements').delete().eq('abonne_id', moi).eq('suivi_id', autre);
    if (error) throw error;
    return 'aucun';
  }
  const { error } = await supabase.from('abonnements').insert({ abonne_id: moi, suivi_id: autre });
  if (error && error.code !== '23505') throw error; // 23505 = déjà demandé ou déjà abonné : rien de grave
  return etatSuivi(moi, autre).catch(() => 'en_attente' as EtatSuivi);
}

// Les demandes que j'ai reçues, les plus récentes d'abord.
export async function demandesRecues(moi: string): Promise<ProfilPublic[]> {
  if (!supabase || !moi) return [];
  const { data, error } = await supabase
    .from('abonnements')
    .select('cree_le, p:profils!abonnements_abonne_id_fkey(id, pseudo, photo_url, bio, univers_choisis)')
    .eq('suivi_id', moi)
    .eq('statut', 'en_attente')
    .order('cree_le', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { p: ProfilPublic | null }[]).map((l) => l.p).filter((p): p is ProfilPublic => !!p);
}

// J'accepte la demande de « autre » : il ou elle voit désormais mes activités réservées aux abonnés.
export async function accepterDemande(moi: string, autre: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('abonnements').update({ statut: 'accepte' }).eq('abonne_id', autre).eq('suivi_id', moi);
  if (error) throw error;
}

// Je refuse une demande, ou je retire quelqu'un de mes abonnés (il ou elle n'est pas prévenu·e).
export async function retirerAbonne(moi: string, autre: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('abonnements').delete().eq('abonne_id', autre).eq('suivi_id', moi);
  if (error) throw error;
}

// Mes amis : les personnes que je suis, celles qui me suivent, et qui est réciproque (demandes acceptées).
// « demandeEnvoyee » : j'ai demandé à suivre cette personne, elle n'a pas encore répondu.
export type Ami = ProfilPublic & { jeLeSuis: boolean; ilMeSuit: boolean; demandeEnvoyee: boolean };

export async function listerAmis(id: string, moi: string): Promise<Ami[]> {
  if (!supabase) return [];
  const colonnesProfil = 'id, pseudo, photo_url, bio, univers_choisis';
  const [suivis, abonnes, miens] = await Promise.all([
    supabase.from('abonnements').select(`statut, p:profils!abonnements_suivi_id_fkey(${colonnesProfil})`).eq('abonne_id', id),
    supabase.from('abonnements').select(`p:profils!abonnements_abonne_id_fkey(${colonnesProfil})`).eq('suivi_id', id).eq('statut', 'accepte'),
    id === moi ? Promise.resolve({ data: null, error: null }) : supabase.from('abonnements').select('suivi_id, statut').eq('abonne_id', moi),
  ]);
  if (suivis.error) throw suivis.error;
  if (abonnes.error) throw abonnes.error;
  const lignesSuivis = (suivis.data ?? []) as unknown as { statut: EtatSuivi; p: ProfilPublic | null }[];
  // Mes propres liens (je suis / j'ai demandé), vus depuis la liste de « id ».
  const mesLiens = new Map<string, EtatSuivi>(
    id === moi
      ? lignesSuivis.filter((l) => l.p).map((l) => [l.p!.id, l.statut])
      : ((miens.data ?? []) as { suivi_id: string; statut: EtatSuivi }[]).map((l) => [l.suivi_id, l.statut]),
  );
  const etatDe = (pid: string) => ({ jeLeSuis: mesLiens.get(pid) === 'accepte', demandeEnvoyee: mesLiens.get(pid) === 'en_attente' });
  const tous = new Map<string, Ami>();
  // Sur ma propre liste, les demandes en attente servent à l'état du bouton, sans compter comme abonnements.
  for (const l of lignesSuivis) if (l.p && (l.statut === 'accepte' || id === moi)) tous.set(l.p.id, { ...l.p, ...etatDe(l.p.id), ilMeSuit: false });
  for (const l of (abonnes.data ?? []) as unknown as { p: ProfilPublic | null }[]) {
    if (!l.p) continue;
    const deja = tous.get(l.p.id);
    tous.set(l.p.id, { ...(deja ?? { ...l.p, ...etatDe(l.p.id) }), ilMeSuit: true });
  }
  return [...tous.values()].filter((a) => a.id !== moi || id !== moi).sort((x, y) => x.pseudo.localeCompare(y.pseudo));
}
